
## Remove Migrate Page — Complete Cleanup

Everything related to the old TUNA migration is spread across 6 source files, 3 edge functions, and 4 database tables. This plan removes all of it cleanly with no dangling references.

---

### What Gets Removed

**Source files to delete:**
- `src/pages/MigratePage.tsx` — the entire migrate page (876 lines)
- `src/components/migration/MigrationPopup.tsx` — the popup that auto-appears on first visit directing users to /migrate
- `src/providers/SolanaWalletAdapterProvider.tsx` — the Solana wallet adapter provider, **only used by MigratePage**, so safe to delete entirely

**Edge functions to delete:**
- `supabase/functions/scan-collection-wallet/` — scans collection wallet ATA for TUNA transfers, builds the ledger
- `supabase/functions/verify-tuna-migration/` — verifies a user's migration transaction
- `supabase/functions/tuna-snapshot/` — snapshot utility for migration

**Database tables to drop (via SQL migration):**
- `tuna_migration_config` — migration deadline & config
- `tuna_migration_ledger` — who sent TUNA to the collection wallet
- `tuna_migration_snapshot` — holder snapshot at migration time
- `tuna_migration_transactions` — individual migration transaction records

---

### Files to Modify (Remove References)

| File | What to Remove |
|---|---|
| `src/App.tsx` | Remove `MigratePage` lazy import + `/migrate` route |
| `src/components/layout/Sidebar.tsx` | Remove `{ to: "/migrate", label: "Migrate", icon: ArrowLeftRight }` nav entry + `ArrowLeftRight` icon import |
| `src/components/layout/LaunchpadLayout.tsx` | Remove `MigrationPopup` import and `<MigrationPopup />` usage |

---

### What Does NOT Change

- `src/hooks/useMeteoraApi.ts` — has a `migratePool` function that calls `/pool/migrate` (the Meteora DAMM V2 pool migration for graduated tokens, completely separate from the TUNA token migration). This stays.
- `api/pool/migrate.ts` — same, this is the backend pool migration endpoint for graduated tokens. Stays.
- All agent pages, trading pages, and the rest of the site are unaffected.

---

### Order of Operations

1. Run SQL to drop the 4 database tables
2. Delete the 3 edge functions
3. Delete the 3 source files
4. Remove the 3 references in App.tsx, Sidebar.tsx, and LaunchpadLayout.tsx
