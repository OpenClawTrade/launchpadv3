

# Plan: Create Admin Key Export Function

## Overview
Build a secure admin-only edge function to decrypt and return the trading agent's private key for verification purposes.

---

## Implementation Steps

### 1. Create Admin Export Edge Function
**File**: `supabase/functions/admin-export-wallet/index.ts`

- Accept trading agent ID and admin secret
- Decrypt the `wallet_private_key_encrypted` using `WALLET_ENCRYPTION_KEY`
- Return the private key in base58 format (importable to Phantom/Solflare)
- Require `TWITTER_BOT_ADMIN_SECRET` for authorization

### 2. Security Measures
- Admin secret required for access
- Log all export attempts
- Return key only once per request (no caching)

---

## Technical Details

The decryption logic already exists in other functions and follows this pattern:

```typescript
async function decryptPrivateKey(encryptedKey: string): Promise<string> {
  const encryptionKey = Deno.env.get("WALLET_ENCRYPTION_KEY");
  // SHA-256 hash of key
  // AES-256-GCM decrypt with IV from first 12 bytes
  // Return base58-encoded secret key
}
```

---

## Usage

After deployment, you can call:
```
POST /functions/v1/admin-export-wallet
{
  "agentId": "1776eabc-5e58-46e2-be1d-5300dd202b51",
  "adminSecret": "[your admin secret]"
}
```

Response will contain the base58 private key you can import into any Solana wallet.

---

## Alternative: Manual Verification

If you prefer, I can also just call the decrypt function via an existing edge function and return the key directly in the response for this one-time verification.

