
# Remove "Agreed to Migrate" Stat Card

## Change

Remove the second stat card ("Agreed to Migrate") from the stats bar on the `/migrate` page, changing the grid from 4 columns to 3.

## Technical Details

| File | Lines | Change |
|------|-------|--------|
| `src/pages/MigratePage.tsx` | 420 | Change grid from `grid-cols-2 md:grid-cols-4` to `grid-cols-3` |
| `src/pages/MigratePage.tsx` | 425-431 | Delete the "Agreed to Migrate" `<Card>` block |

The remaining 3 cards will be: **Snapshot Holders**, **Total Supply Snapshot**, and **Supply Migrating**.
