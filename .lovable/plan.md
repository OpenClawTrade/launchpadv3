

# Fix: METEORA_API_URL Missing Protocol + Retry Failed Launch

## Root Cause

The `METEORA_API_URL` secret is set to `clawmode.vercel.app` without the `https://` prefix. This causes an `Invalid URL` error when `agent-process-post` tries to call `clawmode.vercel.app/api/pool/create-fun`.

The `@sandracinca` tweet (`!clawmode dog`) was correctly detected but the token launch failed at the API call step. It is now stuck as `status: "failed"` in the database, so every scan skips it.

## Fix Steps

### 1. Update the `METEORA_API_URL` secret
Change from `clawmode.vercel.app` to `https://clawmode.vercel.app`

Also update `VITE_METEORA_API_URL` if it has the same issue.

### 2. Add URL protocol safety net in `agent-process-post`
Add a guard at line ~1890 to auto-prepend `https://` if the URL does not start with `http`:

```typescript
let meteoraApiUrl =
  Deno.env.get("METEORA_API_URL") ||
  Deno.env.get("VITE_METEORA_API_URL") ||
  "https://tunalaunch.vercel.app";

// Safety: ensure URL has protocol
if (!meteoraApiUrl.startsWith("http")) {
  meteoraApiUrl = `https://${meteoraApiUrl}`;
}
```

### 3. Reset the failed `@sandracinca` record so it gets retried
Run a database update to change the status from `failed` back to `pending` (or delete the record) so the next scan cycle will re-process it:

```sql
DELETE FROM agent_social_posts
WHERE post_id = '2024831108160860668'
AND post_author = 'sandracinca'
AND status = 'failed';
```

### 4. Add the same URL safety net in other edge functions
Apply the same `https://` guard to:
- `claw-trading-create/index.ts` (uses hardcoded `tunalaunch.vercel.app` -- already has `https://`, OK)
- `api-launch-token/index.ts`
- `fun-sniper-buy/index.ts`
- `fun-sniper-sell/index.ts`

## Expected Result

After the secret is fixed and the failed record is deleted:
1. Next scan cycle picks up the `@sandracinca` tweet again
2. Token launches successfully via `https://clawmode.vercel.app/api/pool/create-fun`
3. Reply is sent to `@sandracinca` confirming the launch

