

# Fix Vanity Addresses for X !clawmode Launches + Clean Up Stale Reservations

## Problem 1: Vanity addresses silently failing on all launches

The hardcoded anon key fallback in `lib/vanityGenerator.ts` (line 63) has a **typo** -- one character is wrong (`x` instead of `z`):
- Current (broken): `...7FFIiwQTgqIQn4l`**x**`yDHPTsX...`
- Correct: `...7FFIiwQTgqIQn4l`**z**`yDHPTsX...`

This means when the Vercel `create-fun` endpoint calls `getAvailableVanityAddress()`, if no `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY` env var is set, the fallback key is invalid. The RPC call to `backend_reserve_vanity_address` fails with an auth error, returns null, and the code silently falls back to a random mint address.

**Fix:** Correct the hardcoded anon key in `lib/vanityGenerator.ts`.

## Problem 2: 5 addresses stuck as "reserved" (should be 1)

The database has 5 "reserved" vanity addresses. Only 1 (`5X42ZtH3...afCLAW`) is intentionally reserved. The other 4 (from Feb 20) were reserved during failed launches and never released because:

1. The `pump-agent-launch` edge function's error handler (catch block at line 376) does **not** release the vanity address when the launch fails.
2. Some `create-fun` Vercel failures may also leak reservations if the `releaseVanityAddress` call itself fails (same broken anon key).

**Fix (two parts):**

a. **Database cleanup:** Run a migration to release the 4 stale reserved addresses back to "available" (the ones from Feb 20 with no `used_for_token_id`).

b. **Code fix in `pump-agent-launch`:** Add vanity release logic to the catch block so failed launches always return their reserved address to the pool.

## Technical Changes

### 1. `lib/vanityGenerator.ts` (line 63)
Fix the typo in the hardcoded anon key fallback: change `lxyDHPTsX` to `lzyDHPTsX`.

### 2. Database migration
Release the 4 stale reserved addresses:
```text
UPDATE vanity_keypairs 
SET status = 'available' 
WHERE status = 'reserved' 
  AND used_for_token_id IS NULL 
  AND id != '0eb31c00-76d2-4d85-8c6b-06af32211e12';
```

### 3. `supabase/functions/pump-agent-launch/index.ts` (catch block, ~line 376)
Add vanity release on error:
```text
} catch (error) {
    // Release vanity address if reserved
    if (vanityId) {
      await supabase.rpc('backend_release_vanity_address', {
        p_keypair_id: vanityId,
      }).catch(() => {});
    }
    console.error("[pump-agent-launch] Error:", error);
    ...
}
```

After these changes, the reserved count should show 1, and all future X !clawmode launches will correctly use vanity CLAW addresses.

