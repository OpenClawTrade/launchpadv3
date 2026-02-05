
## What’s actually happening (based on what we can verify)
- The **off-chain metadata JSON is correct and publicly reachable** (your site reads it fine).
- Example for `APBYK...`:
  - Metadata endpoint returns `image`, `external_url`, and socials correctly.
  - The image URL is also publicly reachable.
- However, **Solscan is still showing the placeholder icon**, which strongly suggests **external indexers are not consuming the URI we’re giving them**, or they are refusing to fetch it (common if the URI is not a static `*.json` file or if it’s a “dynamic function URL”).

Because your goal is “fix future launches”, the most reliable fix is to stop using a dynamic function URL as the on-chain URI and instead set the on-chain URI to a **static `.json` file in public storage**.

This avoids all the “indexer decided not to fetch it” cases.

---

## Goal
For every new token launch:
1. Create a **static metadata JSON file** at a public, stable URL ending in `.json`
2. Set the **on-chain metadata URI** to that static `.json` URL (within the 200-char Metaplex limit)
3. Keep the existing `token-metadata` function for:
   - in-app reads / fallback
   - old tokens that already point to it

---

## Implementation approach (future launches only)

### A) Change the on-chain metadata URI to a static storage URL
**File:** `lib/meteora.ts`  
**Change:**
- Replace:
  - `https://.../functions/v1/token-metadata/<mint>`
- With:
  - `https://.../storage/v1/object/public/post-images/token-metadata/<mint>.json`

Why:
- Many explorers/indexers are far more consistent with static `.json` assets than dynamic endpoints.
- Storage URLs are simple and “asset-like”.
- Still under Metaplex URI length limit (<= 200 chars).

Notes:
- We’ll keep using the existing public bucket (`post-images`) and just add a new folder path (`token-metadata/`).
- No database schema changes needed.

---

### B) Upload the metadata JSON file *before* sending on-chain transactions
This is critical because some indexers fetch the URI immediately after mint/metadata account creation.

We’ll generate a Metaplex-compatible JSON object that includes at minimum:
- `name`, `symbol`, `description`, `image`
- `external_url`
- `properties.files[]` with correct `type` based on file extension
- `extensions` and `properties.links` for socials
- (Optional but recommended for compatibility) `seller_fee_basis_points: 0`

**File:** `api/pool/create-fun.ts`  
**Where:** Right where it already “pre-populates pending metadata” (before tx broadcast).  
**Add:**
- Build the JSON payload from the same values you already insert into `pending_token_metadata`:
  - `name`, `ticker`, `description`, `imageUrl`, `finalWebsiteUrl`, `finalTwitterUrl`, `creator_wallet`
- Upload to storage:
  - Bucket: `post-images`
  - Path: `token-metadata/${mintAddress}.json`
  - Content-Type: `application/json`
  - `upsert: true`
  - Cache control: short (e.g. `max-age=60`) during the first minutes, then we can optionally overwrite later with a longer cache (optional refinement)

Why do this here:
- This is the earliest point where we reliably know the mint address AND haven’t broadcasted yet.

---

### C) Ensure all launch paths get the same fix
You have multiple ways to create tokens. Anything that uses `lib/meteora.ts` to set the URI must also ensure the JSON file exists.

We’ll update these Node endpoints similarly:

1) **Phantom-signed launches**
- **File:** `api/pool/create-phantom.ts`
- Add the same “upload metadata JSON before returning transactions”.
- Reason: tokens created via Phantom signing will still have their on-chain URI set by `lib/meteora.ts`, so the `.json` must exist.

2) **Client-signed pool creation**
- **File:** `api/pool/create.ts`
- Same upload step before returning serialized transactions.

This keeps behavior consistent no matter how the token is launched.

---

### D) Add a small diagnostics tool (so we stop guessing)
Even though you only asked for “future launches”, adding diagnostics prevents this from recurring silently.

**Add a backend function** (new) e.g. `onchain-metadata-debug` that:
- Accepts a mint address
- Derives the Metaplex Metadata PDA
- Fetches account data via `HELIUS_RPC_URL`
- Decodes and returns:
  - `name`, `symbol`, `uri`, `isMutable`, `updateAuthority`
- This lets us immediately confirm on-chain is pointing to the intended `.json`.

This is a one-time “trust but verify” tool we can keep for future troubleshooting.

---

## Testing / Acceptance criteria
After implementing:
1. Launch a new token normally (any path).
2. Confirm the on-chain metadata `uri` equals:
   - `.../storage/v1/object/public/post-images/token-metadata/<mint>.json`
3. Open that URL in a browser and confirm it returns valid JSON with `image` populated.
4. Within a few minutes, verify on:
   - Solscan token page: image no longer placeholder, metadata populated
   - Axiom / other terminals: image/info present
5. Regression check: existing tokens still load in-app (they will, since in-app uses DB / `token-metadata`).

---

## Files expected to change
- `lib/meteora.ts` (change the URI format)
- `api/pool/create-fun.ts` (upload metadata JSON before tx broadcast)
- `api/pool/create.ts` (upload metadata JSON before returning txs)
- `api/pool/create-phantom.ts` (upload metadata JSON before returning txs)
- Add new backend function: `supabase/functions/onchain-metadata-debug/index.ts` (diagnostics)

---

## Why this will stop the “3 days / 100 attempts” loop
Right now you’re doing the hard part (storing correct metadata + serving correct JSON), but the **weak link is relying on indexers to happily consume a dynamic function URL**.

Switching to a static `.json` asset URL makes the metadata look like what most indexers are optimized for:
- stable URL
- `.json` suffix
- simple CDN asset

This is the highest-probability “works everywhere” fix for future launches.
