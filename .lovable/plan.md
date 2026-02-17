

## Migration Page Overhaul: Post-Migration Success View

### Overview

Replace the current "migrating" state of the page with a "Migration Succeeded" view. Add wallet connect for personalized status, and an info section about the 24-hour anti-dump protection mechanism.

### Changes

**File: `src/pages/MigratePage.tsx`**

**1. Replace Hero Section (lines 352-364)**
- Swap "TUNA is Migrating" with a green success banner: "Migration Succeeded"
- Update subtitle to: "The migration window has closed. X holders migrated Y tokens to the new TUNA."
- Pull stats from existing `stats` object for the numbers

**2. Add "Your Migration Status" Card (new, after hero)**
- If wallet not connected: show "Connect Wallet" button (uses existing `login()` from `useAuth`)
- If wallet connected: query `tuna_migration_ledger` for the connected `solanaAddress`
  - Show: tokens migrated, % of old supply, estimated new TUNA allocation (same %), and a TX link placeholder (empty until distribution happens)
  - If wallet not found in ledger: show "This wallet did not participate in the migration"

**3. Add "Distribution & Protection" Info Card (new, after status card)**
Content:
- "For the first 24 hours, migrated coins will stay in the developer wallet to ensure no dumps occur on launch day"
- "Trading fees generated during the first 24 hours will be used to buy back TUNA after any migrated user sells -- protecting the chart"
- "Distribution will be done one by one, automatically, with delays between each transfer"
- Use Shield/Clock/TrendingUp icons for visual structure

**4. Remove/Hide Migration Form and Countdown**
- Hide the countdown timer card (lines 469-498) -- migration is over
- Hide the "I've Sent My Tokens" form card (lines 551-595) -- no longer accepting submissions
- Hide the "How to Migrate" instructions card (lines 519-549)
- Keep the snapshot/migrated/received tabs for transparency

### No Database Changes Required
All needed data exists in `tuna_migration_ledger` and `tuna_migration_snapshot`.

