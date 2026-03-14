

## Plan: Clean Up Panel Duplicate Sections & Add Pagination

### Problem
The panel has two "Your Tokens" sections:
1. **Earnings section** (lines 619-685) — shows tokens with earnings/claim buttons
2. **Launches section** (lines 714-804) — shows created tokens with status/mcap

The user wants to remove the first one (Earnings → "Your Tokens" list) and keep the Launches section as the main tokens view. Also: limit "Recent Activity" to 5 items and add pagination to Launches.

### Changes

**1. `src/components/panel/PanelUnifiedDashboard.tsx`**

- **Remove "Your Tokens" subsection from Earnings** (lines 619-685): Delete the entire earnings breakdown block. Keep the earnings summary stats (Total Earned / Unclaimed) and the Recent Claims list — move the claim buttons into the Launches section instead.
- **Merge claim functionality into Launches section**: Each token card in Launches should show an inline "Claim" button when unclaimed earnings exist (cross-reference `earningsData` by token ID).
- **Add pagination to Launches section**: Add page state, show tokens in pages of 6, with Previous/Next buttons at the bottom.
- **Limit Recent Activity to 5**: Pass a `limit={5}` prop to `WalletTransactionHistory` and add pagination there too.

**2. `src/components/wallet/WalletTransactionHistory.tsx`**
- Add optional `limit` prop, default to showing all. When limit is set, only show that many transactions plus a "Show more" or pagination.

### Detailed approach

In `PanelUnifiedDashboard.tsx`:
- Add `const [launchPage, setLaunchPage] = useState(1); const LAUNCH_PAGE_SIZE = 6;`
- In Launches section, paginate `createdTokens`: slice based on page, show page controls
- For each launch token, look up matching earning from `earningsData?.earnings` by `token_id` and show claim button if unclaimed > MIN_CLAIM_SOL
- Remove lines 619-685 (the "Your Tokens" earnings breakdown)
- Keep lines 687-705 (Recent Claims) in the Earnings section

In `WalletTransactionHistory.tsx`:
- Add `limit?: number` prop
- Add internal pagination: `const [activityPage, setActivityPage] = useState(1)`, show 5 per page with Previous/Next

