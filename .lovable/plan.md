

# Status Check: Previous Requests

## What's been done so far
1. **Download button fix** — Done. Green "Download Generated img" button next to ticker, red X on images.
2. **Privy 1-Click Launcher plan** — Written to `.lovable/plan.md` but **NOT implemented**. TokenLauncher still uses `usePhantomWallet` (confirmed — 10 references still in `TokenLauncher.tsx`).
3. **Scrolling launched token cards above Pulse columns** — **NOT implemented**. No horizontal scrolling token card strip exists anywhere.

## What needs to be built (2 features)

### Feature 1: Privy Wallet Option in Token Launcher
**Current state:** TokenLauncher exclusively uses `usePhantomWallet`. No Privy integration.

**Plan:**
- Add a wallet selector toggle at the top of the launcher: **Phantom** | **Privy** (keep both during testing)
- When **Privy** is selected:
  - If not logged in → show "Connect Wallet" button that triggers Privy login modal
  - After login → show the embedded wallet address + balance
  - If balance is insufficient → show deposit flow: "Send SOL to this address" with the embedded wallet address, plus a fast balance poller (Alchemy/Helius RPC, 2-3s interval) that detects incoming SOL and shows "Ready to launch!"
  - If balance is sufficient → 1-click launch: metadata submission + token creation + dev buy all happen via Privy embedded wallet auto-sign (no popups, same as turbo-trade pattern)
- When **Phantom** is selected → existing flow unchanged

**Files to modify:**
- `TokenLauncher.tsx` — add wallet mode toggle, import `useSolanaWalletPrivy` + `useAuth`, conditional signing logic
- `useTokenLaunch.ts` — accept either Phantom or Privy signer
- New component: `LaunchpadDepositPrompt.tsx` — deposit address display + balance poller with "Ready to launch" state

### Feature 2: Scrolling Launched Token Cards Above Pulse
**What:** A horizontal auto-scrolling marquee strip of recently launched token cards, placed above the 3 Pulse columns (New Pairs / Final Stretch / Migrated).

**Plan:**
- New component: `LaunchedTokensMarquee.tsx`
  - Query `fun_tokens` table for recently launched tokens (last 50, ordered by `created_at DESC`)
  - Render small token cards (image, ticker, market cap) in a CSS marquee/horizontal scroll animation
  - Infinite scroll illusion by duplicating the list
- Place it inside `AxiomTerminalGrid.tsx` at the top, before the column headers
- Compact card design: token image (24px), ticker, and mcap in a pill-shaped card

**Files to modify:**
- New: `src/components/launchpad/LaunchedTokensMarquee.tsx`
- `src/components/launchpad/AxiomTerminalGrid.tsx` — render marquee above columns

