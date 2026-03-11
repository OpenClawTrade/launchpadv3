

## Wallet Trade Notifications with Sound

### Current State
- `wallet_trades` table exists with realtime enabled (`supabase_realtime` publication)
- `CopyTrading.tsx` already subscribes to `wallet_trades` INSERTs and shows toasts — but only when that component is mounted
- `useTradeSounds.ts` hook exists with `playBuy()` and `playSell()` functions using Web Audio API
- **Nothing writes to `wallet_trades`** — the table is empty. There's no edge function or webhook ingesting on-chain trades from tracked wallets
- `HELIUS_API_KEY` secret exists, which is needed for Helius webhooks

### The Problem
The entire pipeline is broken: no backend process monitors tracked wallets on-chain and writes trades into `wallet_trades`. Without that, realtime subscriptions have nothing to deliver.

### Plan

#### 1. Create edge function: `wallet-trade-webhook`
Receives Helius enhanced transaction webhook POSTs. Parses swap/trade data (token mint, SOL amount, buy/sell direction, signature) and inserts into `wallet_trades` table. Validates requests via a `HELIUS_WEBHOOK_SECRET` header. This is the critical missing piece — it turns on-chain activity into database rows that trigger realtime events.

#### 2. Create edge function: `wallet-tracker-sync`
Called when users add/remove tracked wallets. Aggregates all unique wallet addresses from `tracked_wallets` table and creates/updates a Helius webhook via their API (`HELIUS_API_KEY` already exists). Stores the webhook ID so future calls update the same webhook rather than creating new ones. This keeps Helius monitoring the right addresses.

- Will need a new secret `HELIUS_WEBHOOK_SECRET` for authenticating incoming webhook payloads.

#### 3. Create hook: `useWalletTradeNotifications`
A global hook mounted in `StickyStatsFooter.tsx` (always visible) that:
- Loads the user's tracked wallet addresses once
- Subscribes to `postgres_changes` INSERT on `wallet_trades` 
- When a trade arrives for a tracked wallet: shows a toast notification AND plays the appropriate sound (`playBuy` for buys, `playSell` for sells) using the existing `useTradeSounds` hook
- No polling — purely event-driven via Supabase Realtime websocket

#### 4. Wire into WalletTrackerPanel
- Call `wallet-tracker-sync` edge function when adding/removing wallets to keep Helius webhook address list current
- Update "Last Active" column in real-time when trades arrive

#### 5. Register edge functions in config.toml
Add `wallet-trade-webhook` and `wallet-tracker-sync` with `verify_jwt = false`.

### Files to Create
- `supabase/functions/wallet-trade-webhook/index.ts`
- `supabase/functions/wallet-tracker-sync/index.ts`
- `src/hooks/useWalletTradeNotifications.ts`

### Files to Edit
- `src/components/layout/StickyStatsFooter.tsx` — mount `useWalletTradeNotifications`
- `src/components/layout/WalletTrackerPanel.tsx` — call sync on add/remove, receive realtime updates

### Secret Needed
- `HELIUS_WEBHOOK_SECRET` — a random string to validate incoming webhook requests

