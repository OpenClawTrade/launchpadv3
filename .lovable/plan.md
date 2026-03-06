

## Multi-Wallet System + Trading Fee / Referral Revenue Architecture

### Part 1: Current State Analysis

**Trading fees exist and work.** Every swap through `launchpad-swap` charges `FEE_BPS = 200` (2%). The fee is recorded as `system_fee_sol` in `launchpad_transactions`. The `fun-distribute` edge function (cron) distributes accumulated fees: 50% to creator, 30% buyback, 20% platform. Fees accumulate in the treasury wallet `HSVmkUnmkjD9YLJmgeHCRyL1isusKkU3xv4VwDaZJqRx`.

**Referral rewards are NOT wired in.** The `referral_rewards` table exists, and the `get_referral_stats` function exists, but **no code actually inserts referral rewards**. The 5% referral fee from referred users' trades is not being calculated or paid anywhere. The `launchpad-swap` edge function does not check if a trader has a referrer, and `fun-distribute` does not split any portion to referrers. This is currently a dead feature — the dashboard will always show 0.

**The platform earns from:**
- 2% fee on every bonding curve trade (via `launchpad-swap`)
- Fee distribution: 20% of that 2% stays as system revenue (~0.4% of trade volume)
- For API tokens: 50% platform share
- For agent tokens: 40% platform share
- For bags tokens: 100% platform share

---

### Part 2: Multi-Wallet System (Axiom-style)

**Privy supports this natively.** Their HD wallet system allows creating multiple embedded Solana wallets per user via `useWallets` hook's `createWallet({ createAdditional: true })`. Each wallet gets its own keypair derived from the same seed. This is exactly what Axiom uses — multiple hot wallets per account for parallel trading.

**Architecture:**

```text
┌─────────────────────────────────────┐
│  User Account (Privy)               │
│                                     │
│  Wallet 1 (default) ─ 0.5 SOL      │
│  Wallet 2 (created)  ─ 1.2 SOL     │
│  Wallet 3 (created)  ─ 0.0 SOL     │
│  ...up to 25 wallets                │
└─────────────────────────────────────┘
```

**Database: `user_wallets` table**
- `id`, `profile_id`, `wallet_address`, `label` (e.g. "Main", "Sniper 1"), `is_default`, `created_at`
- Tracks all wallets per user with custom labels
- RLS: users can only see/manage their own wallets

**New files:**
1. `src/hooks/useMultiWallet.ts` — manages wallet creation, switching, labeling
   - Uses `useWallets()` from `@privy-io/react-auth/solana` to get all wallets
   - Uses `createWallet({ createAdditional: true })` to create new HD wallets
   - Tracks active wallet index, syncs to `user_wallets` table
   - Exposes `activeWallet`, `allWallets`, `createNewWallet()`, `switchWallet(index)`, `renameWallet()`

2. `src/components/wallet/WalletManagerPanel.tsx` — Axiom-style wallet list UI
   - Table with: Wallet name, truncated address (with copy), SOL balance, Holdings count
   - "Create" button (up to 25 limit)
   - Click to set active wallet
   - Rename inline editing

3. `src/components/wallet/ActiveWalletSelector.tsx` — compact dropdown in trade panels
   - Shows current wallet name + balance
   - Quick-switch between wallets without leaving the trade view

**Modified files:**
- `useSolanaWalletPrivy.ts` — accept wallet index/address parameter to sign with a specific wallet (not just the first embedded)
- `useFastSwap.ts` / `useRealSwap.ts` — pass active wallet to sign+send
- Trade panels — add `ActiveWalletSelector` above the buy/sell form
- Panel page — add "Wallets" tab with full `WalletManagerPanel`

**Speed considerations:**
- All wallets are Privy embedded (TEE) — same signing speed as current single wallet
- No external wallet connection overhead
- Each wallet can trade independently with parallel transaction submission
- Background blockhash cache shared across all wallets

---

### Part 3: Wire Referral Rewards Into Trading Flow

The referral system is currently broken because no code records rewards. Here is how to fix it:

**Modify `supabase/functions/launchpad-swap/index.ts`:**
- After calculating `systemFee`, look up if the trader (`profileId`) has a referrer via `get_referrer_for_user(profileId)`
- If referrer exists: take 5% of the `systemFee` (not 5% of the trade — 5% of the 2% fee = 0.1% of trade volume)
- Insert into `referral_rewards` table: `referrer_id`, `referred_id`, `trade_sol_amount`, `reward_sol`, `reward_pct`
- The reward SOL accumulates and gets paid out via `fun-distribute` (add referral distribution step)

**Modify `supabase/functions/fun-distribute/index.ts`:**
- Add a new step after existing distributions: query `referral_rewards` where `paid = false`, batch by referrer, send SOL from treasury, mark as paid

**New DB migration:**
- Add `paid` boolean column to `referral_rewards` (default false)
- Add `signature` text column for payout tracking

**Revenue math (per 1 SOL trade):**
- 2% fee = 0.02 SOL collected
- 5% of fee to referrer = 0.001 SOL (if referred)
- Remaining 0.019 SOL split per existing rules (creator/platform/buyback)
- Platform keeps ~0.004 SOL minimum per trade

---

### Implementation Order

1. **Database migration**: `user_wallets` table + `referral_rewards` columns (`paid`, `signature`)
2. **Wire referral rewards** into `launchpad-swap` edge function
3. **Add referral payout** step to `fun-distribute` edge function
4. **Multi-wallet hook** (`useMultiWallet.ts`)
5. **Wallet Manager UI** (panel tab + trade selector)
6. **Update signing hooks** to support wallet selection

