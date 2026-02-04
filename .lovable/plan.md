

# Fix: Metadata Not Showing on External Platforms for X Launches

## Problem Statement
Token `GXdR3RK8FTLhdsygkst8mUwKMV8bAXwAiExbQxEnQGWw` (TunaBytes/NEWS) launched via X (!tunalaunch) has correct metadata in our database but external platforms (Solscan, Axiom, DexScreener) show no image/links.

## Root Cause Analysis

### What's Working
- Database has correct data in `tokens` and `fun_tokens` tables
- `token-metadata` Edge Function returns correct JSON when called NOW
- Image URL is valid and accessible

### What's Broken
The `pending_token_metadata` table is **EMPTY** for this token. This table serves as a high-speed cache for external indexers that ping our metadata endpoint within the first few seconds after on-chain creation.

**Timeline of Events:**
1. User posts `!tunalaunch` on X
2. `agent-process-post` Edge Function calls Vercel API `/api/pool/create-fun`
3. Vercel API generates mint keypair
4. Vercel API tries to insert into `pending_token_metadata` (line 413-427)
5. On-chain transaction is broadcast
6. External indexers immediately fetch metadata URI
7. If step 4 failed silently OR there was a race condition, indexers cache empty/fallback response

**Evidence:**
- `pending_token_metadata` query returns 0 rows for this mint
- Only 29 total entries exist in the table (most are old test tokens)
- `expires_at` is set to 30 minutes, but entries are not being cleaned up

### Specific Code Gaps

1. **No redundant insert in Edge Function**: `agent-process-post` relies entirely on Vercel API to populate `pending_token_metadata`. If that insert fails silently, there's no backup.

2. **No pre-insert before mint generation**: The Vercel API inserts into `pending_token_metadata` AFTER generating the mint keypair (line 413), but the mint address is needed for the insert. This is correct but creates a very tight timing window.

3. **Silent failure handling**: If the `pending_token_metadata` insert fails, it logs a warning but doesn't retry or propagate the error.

---

## Solution

### Fix 1: Add Redundant Pending Metadata Insert in Edge Function

Modify `agent-process-post` to insert into `pending_token_metadata` AFTER receiving the mint address from Vercel API but BEFORE returning success. This acts as a safety net.

**File:** `supabase/functions/agent-process-post/index.ts`

**Location:** After line 1019 (after receiving confirmed mint address)

```typescript
// After: console.log(`[agent-process-post] ✅ Token confirmed on-chain: ${result.mintAddress}`);

// === SAFETY NET: Ensure pending metadata exists for external indexers ===
// The Vercel API should have already inserted this, but we upsert as backup
try {
  await supabase
    .from("pending_token_metadata")
    .upsert({
      mint_address: result.mintAddress,
      name: cleanName,
      ticker: cleanSymbol,
      description: parsed.description || `${cleanName} - Launched via TUNA Agents`,
      image_url: finalImageUrl,
      website_url: websiteForOnChain || communityUrl,
      twitter_url: twitterForOnChain || postUrl,
      telegram_url: parsed.telegram || null,
      discord_url: parsed.discord || null,
      creator_wallet: parsed.wallet || null,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour (longer than Vercel's 30 min)
    }, { onConflict: 'mint_address' });
  
  console.log(`[agent-process-post] ✅ Pending metadata safety net inserted for ${result.mintAddress}`);
} catch (pendingErr) {
  console.warn(`[agent-process-post] ⚠️ Pending metadata safety insert failed (non-fatal):`, pendingErr);
}
```

### Fix 2: Extend Pending Metadata Expiry

Change the `expires_at` from 30 minutes to 2 hours in the Vercel API to give more buffer time.

**File:** `api/pool/create-fun.ts`

**Location:** Line 426

```typescript
// Before:
expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry

// After:
expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hour expiry
```

### Fix 3: Add Periodic Cleanup Job (Future Enhancement)

Create a scheduled cleanup function to delete expired entries. This prevents table bloat but isn't causing the current issue.

---

## Technical Summary

| Change | File | Purpose |
|--------|------|---------|
| Add redundant upsert after launch confirmation | `agent-process-post/index.ts` | Safety net if Vercel insert fails |
| Extend expiry to 2 hours | `api/pool/create-fun.ts` | More buffer for slow indexers |

---

## Immediate Workaround

For the already-launched token, the metadata IS correct in our database. The issue is external platform caching. Options:
1. Wait for cache expiry (typically 1-24 hours depending on platform)
2. Use platform-specific cache refresh tools if available (Solscan has a refresh button on token pages)
3. The `token-metadata` endpoint is returning correct data with `Cache-Control: public, max-age=3600` which should trigger refreshes

