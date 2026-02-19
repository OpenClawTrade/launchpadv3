
## Switch Vanity Address Generator from TUNA to CLAW

### Overview

Change the target vanity suffix from `TUNA` to `CLAW` across all code, clear all existing generated addresses from the database, and start fresh generating addresses ending in `CLAW`.

### Current State

The database currently holds **400 records** (split between suffixes `tna` and `tuna` — both legacy). All of these will be deleted. The target suffix `CLAW` is 4 characters like `TUNA`, so the generation difficulty and rate are identical.

### Files to Modify

**1. `supabase/functions/vanity-cron/index.ts`** — The server-side background cron function
- Change `const TARGET_SUFFIX = 'TUNA'` → `'CLAW'`
- Change the comment from "Displayed uppercase, matched case-insensitively" to reflect CLAW

**2. `src/pages/VanityAdminPage.tsx`** — The admin UI page
- Change the default suffix in `useState` from `'TUNA'` → `'CLAW'`
- Change the `localStorage` key default from `'TUNA'` → `'CLAW'`
- Change the placeholder text in the target suffix input from `TUNA` → `CLAW`
- Update the page subtitle description that says "displayed as TUNA" → "displayed as CLAW"

**3. `api/vanity/generate.ts`** — Vercel API route (generate endpoint)
- Change `const DEFAULT_SUFFIX = 'TUNA'` → `'CLAW'`

**4. `api/vanity/batch.ts`** — Vercel API route (batch endpoint)
- Change `const DEFAULT_SUFFIX = 'TUNA'` → `'CLAW'`

### Database Cleanup

Delete all existing vanity_keypairs records (all suffixes — `tna`, `tuna`, anything else). This is a single SQL DELETE:

```sql
DELETE FROM public.vanity_keypairs;
```

This is safe because:
- Any `used` addresses are already permanently embedded in the blockchain — the database record is historical only
- Any `reserved` addresses can be abandoned (no active launches will be mid-flight at the time of deletion)
- Any `available` addresses are being discarded intentionally to start fresh with CLAW

### Sequence of Changes

```text
1. Modify 4 code files (suffix TUNA → CLAW)
2. Deploy vanity-cron edge function with new CLAW suffix
3. Run the DELETE SQL to wipe all vanity_keypairs rows
4. Visit /vanity-admin and trigger generation to start building the CLAW pool
```

### Technical Notes

- `CLAW` is 4 characters, same as `TUNA` — identical generation difficulty (~1 in 58^4 ≈ 1 in 11M addresses match, case-insensitively ~1 in 720K). The rate will be the same ~3-5 addresses per 55-second batch.
- The `vanity_target_suffix` key in `localStorage` will still exist with value `TUNA` for users who visited the page before. The code reads from localStorage on init, so the user will need to clear their browser storage OR the page will let them change it manually. To fix this cleanly, we can add a forced default of `CLAW` that overrides any stored `TUNA` value.
- All launch functions that call `getAvailableVanityAddress(suffix)` pass the suffix as a parameter — they already send `'tuna'` when requesting vanity addresses for token launches. Those will need to be updated too, but that is a separate concern from the generator itself. The admin page and cron function are the focus here.
