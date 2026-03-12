

## Problem

The `bnb-swap` edge function returns a **500 Internal Server Error** instead of a proper 400 when PancakeSwap V2 has no liquidity. The root cause: the `instanceof NoPancakeSwapLiquidityError` check (line 576) fails in the Deno edge runtime, so the error falls through to the generic catch (line 641) which returns 500.

This is a known issue — custom `Error` subclass `instanceof` checks can be unreliable in bundled/compiled Deno edge environments.

## Fix

**File: `supabase/functions/bnb-swap/index.ts`**

1. Add a distinguishing property to `NoPancakeSwapLiquidityError` (e.g., `this.code = "NO_PANCAKESWAP_LIQUIDITY"`)
2. Replace the `instanceof` check at line 576 with a string/property check: `(e as any).code === "NO_PANCAKESWAP_LIQUIDITY"` or `e.message?.includes("No liquidity on PancakeSwap")`
3. Also update CORS headers to include the full set of Supabase client headers (same fix applied to other functions)

This ensures the Four.meme fallback is properly triggered when PancakeSwap has no pair, returning a user-friendly 400 error instead of a raw 500.

