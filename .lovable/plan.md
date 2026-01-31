

# Fix Promote Payment Address Not Generating on tuna.fun

## Problem

The "Promote" button shows "Generating payment address..." spinner indefinitely on tuna.fun. The Edge Function returns a 400 error because the promotion-related functions are missing from `supabase/config.toml`.

## Root Cause

The `promote-generate`, `promote-check`, and `promote-post` Edge Functions are **not listed** in `supabase/config.toml` with `verify_jwt = false`. 

By default, Supabase Edge Functions require JWT authentication. On tuna.fun (your production domain), unauthenticated requests are rejected before the function code even runs, causing the error.

In the Lovable preview environment, requests may bypass this due to internal authentication tokens, which is why it works there but fails on tuna.fun.

---

## Solution

Add all three promotion Edge Functions to `supabase/config.toml` with `verify_jwt = false` to allow public access (users pay for promotion without requiring login).

---

## Technical Changes

### File: `supabase/config.toml`

Add the following entries after line 136:

```toml
[functions.promote-generate]
verify_jwt = false

[functions.promote-check]
verify_jwt = false

[functions.promote-post]
verify_jwt = false
```

---

## Summary

| File | Change |
|------|--------|
| `supabase/config.toml` | Add `verify_jwt = false` for `promote-generate`, `promote-check`, and `promote-post` functions |

---

## Result

After this fix:
1. The promotion functions will accept requests without JWT authentication
2. Users on tuna.fun can click "Promote" and receive a payment address
3. The payment checking and posting will work correctly

