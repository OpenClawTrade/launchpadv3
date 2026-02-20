

# Full System Update: Wallet Migration + Fee Restructure + X Bot Re-enablement

## 1. Fix Build Error (Immediate)

The previous edit removed the "Current Lock Status" section from `TokenomicsPage.tsx` but left the `ExternalLink` import unused, causing a build failure.

**File:** `src/pages/TokenomicsPage.tsx`
- Remove `ExternalLink` from the lucide-react import (no longer used)

---

## 2. Wallet Migration

Replace the compromised wallet `FDkGeRVwRo7dyWf9CaYw9Y8ZdoDnETiPDCyu5K1ghr5r` with the new wallet `HSVmkUnmkjD9YLJmgeHCRyL1isusKkU3xv4VwDaZJqRx` across all files.

### Files to update (18 total):

| File | Variable Name |
|------|--------------|
| `lib/config.ts` | `PLATFORM_FEE_WALLET` |
| `supabase/functions/fun-distribute/index.ts` | `TREASURY_WALLET` |
| `supabase/functions/fun-claim-fees/index.ts` | `TREASURY_WALLET` |
| `supabase/functions/fun-buyback/index.ts` | `TREASURY_WALLET` |
| `supabase/functions/launchpad-swap/index.ts` | `PLATFORM_FEE_WALLET` |
| `supabase/functions/launchpad-create/index.ts` | `PLATFORM_FEE_WALLET` |
| `supabase/functions/treasury-scan-pools/index.ts` | `DEPLOYER_WALLET` |
| `supabase/functions/promote-check/index.ts` | `TREASURY_WALLET` |
| `supabase/functions/deployer-dust-reclaim/index.ts` | `TREASURY_ADDRESS` |
| `supabase/functions/bags-agent-launch/index.ts` | `TREASURY_WALLET` |
| `supabase/functions/bags-claim-fees/index.ts` | `TREASURY_WALLET` |
| `supabase/functions/nfa-mint/index.ts` | `TREASURY_WALLET` |
| `src/components/panel/PanelNfaTab.tsx` | `TREASURY_WALLET` |
| `src/pages/WhitepaperPage.tsx` | Hardcoded treasury address display |
| `api/pool/create.ts` | Comment reference |
| `LAUNCHPAD_ROADMAP.md` | Documentation |
| `FEE_SYSTEM_DOCUMENTATION.md` | Documentation |
| `public/TUNA_WHITEPAPER.md` | Documentation |

### Secret Update Required
- Will request new `TREASURY_PRIVATE_KEY` secret for the new wallet's private key

---

## 3. Fee Restructure: 30% Creator / 30% Agent Trading Pool / 40% System

### Changes in `supabase/functions/agent-process-post/index.ts`:
- Change `AUTO_LAUNCH_FEE_BPS` from `8000` to `3000` (all 4 occurrences at lines 1061, 1076, 1099, 1621, 1658)

### Changes in `supabase/functions/fun-distribute/index.ts`:
- Update agent fee constants:
  - Current: `AGENT_FEE_SHARE = 0.8` / `AGENT_PLATFORM_FEE_SHARE = 0.2`
  - New: Implement 3-way split for agent tokens:
    - 30% to creator (via `creator_wallet` after X OAuth claim)
    - 30% to agent trading wallet (via `trading_agents.wallet_address`)
    - 40% to system treasury
- In the agent token processing block (line 467+), add logic to:
  1. Look up `creator_wallet` on the token
  2. Send 30% to creator (if wallet linked), otherwise hold as `creator_distributed = false`
  3. Send 30% to trading agent wallet
  4. Keep 40% in treasury

### Changes in `supabase/functions/claw-distribute/index.ts`:
- Update `AGENT_FEE_SHARE` from `0.8` to match the new 30/30/40 split
- Update `TRADING_AGENT_FEE_SHARE` from `0.5` to `0.3`

---

## 4. Update X Reply Messages

### In `supabase/functions/agent-scan-twitter/index.ts` (line ~1360):

**Current:**
```
Powered by Claw Mode - 80% of fees fund your agent!
```

**New:**
```
Trading-Fees goes to your Panel, claim them any time.
```

Both the auto-launch and manual launch reply variants will be updated.

---

## 5. Re-enable X Bot Scanning

- Set `ENABLE_X_POSTING` secret to `"true"`
- The scanning and reply system uses the same Login-First authentication (twitterapi.io `user_login_v2`/`v3`) that already works for x-bot-reply
- Re-enable the `agent-scan-twitter` cron job (1-minute cycle)
- Add `clawmode`, `buildclaw`, `openclaw` to the bot username blocklist

---

## 6. Panel: X Authorization + My Launches

The Panel already has Privy with Twitter OAuth enabled. Changes needed:

- Add a "Link X Account" button in the Panel that calls Privy's `linkTwitter()` when user hasn't linked X yet
- Add a "My Launches" section/tab showing all tokens where `post_author` matches their linked X username
- Display per-token earnings data (fees claimed, fees distributed) and total claimable amount
- Use existing `agent-find-by-twitter` edge function for token discovery
- Wire up claim functionality using existing `agent-claim` flow

---

## 7. Remove "SubTuna" Branding from Edge Function Logs

Update user-facing strings in these edge functions (table names stay as `subtuna` for DB stability):

| File | Change |
|------|--------|
| `agent-process-post/index.ts` | "SubTuna community" -> "Claw community" in logs |
| `agent-auto-engage/index.ts` | "SubTuna" -> "Claw Forum" in comments and content strings |
| `fun-create/index.ts` | "SubTuna URL" -> "community URL" in comments |
| `agent-learn-style/index.ts` | Variable names stay, log messages updated |

---

## Execution Order

1. Fix build error (ExternalLink import)
2. Request new `TREASURY_PRIVATE_KEY` secret
3. Update all 18 files with new wallet address
4. Update fee split in `agent-process-post`, `fun-distribute`, `claw-distribute`
5. Update reply messages in `agent-scan-twitter`
6. Add X linking + My Launches to Panel
7. Clean up SubTuna branding in edge function logs
8. Enable `ENABLE_X_POSTING` and re-enable cron
9. Deploy all updated edge functions

