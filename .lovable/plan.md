

# Fix 404 Error on Token Buy - Wrong Table Lookup

## Problem

When trying to buy a token on the FunTokenDetailPage, the API returns:
```
Error: Token not found
```

**Root Cause**: The Vercel API (`api/swap/execute.ts`) calls `getTokenByMint()` which only searches the `tokens` table. However, tokens created via the FUN launcher are stored in the **`fun_tokens`** table.

This means trades work for tokens in `tokens`, but fail for FUN-launched tokens in `fun_tokens`.

---

## Solution

Update the `lib/supabase.ts` file to add a fallback that checks both tables when looking up a token by mint address.

---

## Technical Implementation

### File: `lib/supabase.ts`

**Current code (lines 121-136):**
```typescript
export async function getTokenByMint(mintAddress: string): Promise<Token | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('mint_address', mintAddress)
    .single();
  
  if (error) {
    console.error('Error fetching token:', error);
    return null;
  }
  
  return data as Token;
}
```

**New code with fallback to `fun_tokens`:**
```typescript
export async function getTokenByMint(mintAddress: string): Promise<Token | null> {
  const supabase = getSupabaseClient();
  
  // Try tokens table first
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('mint_address', mintAddress)
    .maybeSingle();
  
  if (data) {
    return data as Token;
  }
  
  // Fallback to fun_tokens table
  const { data: funToken, error: funError } = await supabase
    .from('fun_tokens')
    .select('*')
    .eq('mint_address', mintAddress)
    .maybeSingle();
  
  if (funError) {
    console.error('Error fetching token from fun_tokens:', funError);
    return null;
  }
  
  if (funToken) {
    // Map fun_tokens fields to Token interface for compatibility
    return {
      id: funToken.id,
      mint_address: funToken.mint_address,
      name: funToken.name,
      ticker: funToken.ticker,
      creator_wallet: funToken.creator_wallet,
      creator_id: null,
      dbc_pool_address: funToken.dbc_pool_address,
      damm_pool_address: null,
      virtual_sol_reserves: 30,
      virtual_token_reserves: 1_000_000_000,
      real_sol_reserves: 0,
      real_token_reserves: 0,
      total_supply: 1_000_000_000,
      bonding_curve_progress: funToken.bonding_progress || 0,
      graduation_threshold_sol: 85,
      price_sol: funToken.price_sol || 0,
      market_cap_sol: funToken.market_cap_sol || 0,
      volume_24h_sol: funToken.volume_24h_sol || 0,
      status: funToken.status === 'active' ? 'bonding' : funToken.status as any,
      migration_status: 'pending',
      holder_count: funToken.holder_count || 0,
      graduated_at: null,
      created_at: funToken.created_at,
      updated_at: funToken.updated_at,
    } as Token;
  }
  
  return null;
}
```

---

## Changes Summary

| File | Change |
|------|--------|
| `lib/supabase.ts` | Update `getTokenByMint()` to check `fun_tokens` table as fallback when token not found in `tokens` table |

---

## Result

After this fix:
1. Swap API will first check `tokens` table (existing behavior)
2. If not found, fallback to `fun_tokens` table (new behavior)
3. FUN-launched tokens will be tradeable through the swap API

