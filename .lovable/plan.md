
# Fix Token Metadata & Enable pump.fun Fee Sharing

## Problem Summary

Three critical issues need to be addressed:

1. **Missing Website/Twitter URLs** - Tokens launched via TUNA launchpad have NULL `website_url` and `twitter_url`, causing on-chain metadata to show no socials on Axiom/DEXTools
2. **Base64 Images in Database** - AI-generated images are being stored as base64 strings directly in the database, violating storage policy
3. **pump.fun Fee Sharing Not Enabled** - Tokens launched via PumpPortal default to "Not Shareable", meaning creator fees cannot be collected until manually enabled

## Root Cause Analysis

### Issue 1: Missing Socials

| Flow | What Happens |
|------|--------------|
| TUNA UI Launch | `fun-generate` returns `websiteUrl: null, twitterUrl: null` → `create-fun.ts` stores NULL → `token-metadata` returns empty socials |
| Agent/X Launch | `agent-process-post` sets `websiteUrl: communityUrl, twitterUrl: postUrl` → passes to `create-fun.ts` → stored correctly |

The TUNA launchpad UI does not auto-populate socials like the agent flow does.

### Issue 2: Base64 Images

The `fun-generate` function returns base64-encoded images from the AI Gateway. When passed directly to `create-fun.ts` without uploading to storage first, these base64 strings get stored in the `image_url` column.

### Issue 3: pump.fun Fee Sharing

PumpPortal API's `create` action does not enable fee sharing by default. A separate `set_params` instruction must be sent to the pump.fun program after token creation.

## Solution

### Fix 1: Auto-Populate Socials for TUNA Launchpad

Modify `api/pool/create-fun.ts` to set default `websiteUrl` and `twitterUrl` when not provided:

```typescript
// After line 238 (after extracting params from request)
// Auto-populate socials if not provided
const finalWebsiteUrl = websiteUrl || `https://tuna.fun/t/${ticker.toUpperCase()}`;
const finalTwitterUrl = twitterUrl || "https://x.com/BuildTuna";
```

Then use `finalWebsiteUrl` and `finalTwitterUrl` throughout the function instead of the raw values.

### Fix 2: Prevent Base64 Images in Database

Modify `api/pool/create-fun.ts` to validate image URLs and reject base64:

```typescript
// After line 246 (validation section)
// Reject base64 images - they must be uploaded to storage first
if (imageUrl && imageUrl.startsWith('data:')) {
  return res.status(400).json({ 
    error: 'Base64 images not allowed. Please upload to storage first.' 
  });
}
```

Also ensure `fun-phantom-create` edge function uploads base64 images before calling `create-fun.ts`.

### Fix 3: Enable pump.fun Fee Sharing via set_params

Add a second transaction immediately after token creation in `pump-agent-launch/index.ts`:

```typescript
// After line 256 (after createResult.signature confirmation)

// Step 2b: Enable fee sharing via set_params instruction
console.log("[pump-agent-launch] Enabling fee sharing via set_params...");

const enableFeeSharing = await fetch(`${PUMPPORTAL_API_URL}?api-key=${pumpPortalApiKey}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    publicKey: deployerPublicKey,
    action: "setParams", 
    mint: mintAddress,
    priorityFee: 0.0005,
    pool: "pump",
  }),
});

if (enableFeeSharing.ok) {
  const setParamsResult = await enableFeeSharing.json();
  console.log("[pump-agent-launch] Fee sharing enabled:", setParamsResult.signature);
} else {
  // Log but don't fail - token was already created
  console.error("[pump-agent-launch] Failed to enable fee sharing:", await enableFeeSharing.text());
}
```

If PumpPortal doesn't support `setParams` action, we need to build the instruction manually using the pump.fun program directly with discriminator `[27, 234, 178, 52, 147, 2, 187, 141]`.

## Technical Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `api/pool/create-fun.ts` | Add default socials, reject base64 images |
| `supabase/functions/pump-agent-launch/index.ts` | Add set_params call after token creation |
| `supabase/functions/fun-phantom-create/index.ts` | Ensure base64 images are uploaded before launch |

### Database Cleanup

After deployment, fix existing tokens with missing socials:

```sql
-- Backfill website_url for TUNA tokens without one
UPDATE fun_tokens 
SET website_url = 'https://tuna.fun/t/' || ticker
WHERE website_url IS NULL 
  AND launchpad_type = 'tuna';

-- Backfill twitter_url for TUNA tokens without one  
UPDATE fun_tokens 
SET twitter_url = 'https://x.com/BuildTuna'
WHERE twitter_url IS NULL 
  AND launchpad_type = 'tuna';
```

### pump.fun set_params Instruction (if PumpPortal doesn't support it)

Build the instruction manually:

```typescript
import { TransactionInstruction, PublicKey } from "@solana/web3.js";

const PUMP_FUN_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const SET_PARAMS_DISCRIMINATOR = Buffer.from([27, 234, 178, 52, 147, 2, 187, 141]);

function createSetParamsInstruction(
  global: PublicKey,
  user: PublicKey,
  feeRecipient: PublicKey,
  feeBasisPoints: number = 100 // 1% creator fee
): TransactionInstruction {
  const data = Buffer.concat([
    SET_PARAMS_DISCRIMINATOR,
    feeRecipient.toBuffer(),
    // Additional parameters as needed based on IDL
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: global, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // Additional accounts as per IDL
    ],
    programId: PUMP_FUN_PROGRAM_ID,
    data,
  });
}
```

## Impact

| Issue | Before | After |
|-------|--------|-------|
| Missing socials | Tokens show no links on Axiom/DEXTools | Auto-populated with SubTuna community + @BuildTuna |
| Base64 images | Stored in DB causing bloat | Rejected; must upload to storage |
| Fee sharing | Disabled by default; requires manual enable | Enabled immediately after launch |

## Deployment Order

1. Deploy `create-fun.ts` changes (auto-socials, reject base64)
2. Deploy `pump-agent-launch` changes (set_params)
3. Run database cleanup SQL
4. Test new token launch to verify metadata and fee sharing
