# TUNA Project - Secrets Backup Template

**IMPORTANT**: You must manually record these values. Secret values are encrypted and cannot be exported automatically.

## How to Get Your Secret Values

1. Go to **Project Settings → Secrets** in Lovable
2. For each secret, you'll need to re-obtain the value from the original source
3. Record them in this document for safe keeping

---

## API Keys & Services

| Secret Name | Value (RECORD MANUALLY) | Source |
|-------------|------------------------|--------|
| API_ENCRYPTION_KEY | `_________________________` | Self-generated encryption key |
| BAGS_API_KEY | `_________________________` | Bags API dashboard |
| CLOUDFLARE_API_TOKEN | `_________________________` | Cloudflare dashboard |
| CLOUDFLARE_ZONE_ID | `_________________________` | Cloudflare dashboard |
| COLOSSEUM_API_KEY | `_________________________` | Colosseum platform |
| DUNE_API_KEY | `_________________________` | Dune Analytics dashboard |
| HELIUS_API_KEY | `_________________________` | Helius dashboard |
| HELIUS_RPC_URL | `_________________________` | Helius dashboard |
| LOVABLE_API_KEY | `_________________________` | Lovable (auto-managed) |
| METEORA_API_URL | `_________________________` | Meteora API docs |
| PUMPPORTAL_API_KEY | `_________________________` | PumpPortal dashboard |
| VERCEL_API_TOKEN | `_________________________` | Vercel dashboard |

---

## Privy Authentication

| Secret Name | Value (RECORD MANUALLY) | Source |
|-------------|------------------------|--------|
| PRIVY_APP_ID | `_________________________` | Privy dashboard |
| PRIVY_APP_SECRET | `_________________________` | Privy dashboard |
| VITE_PRIVY_APP_ID | `_________________________` | Same as PRIVY_APP_ID |

---

## Twitter/X API Credentials

| Secret Name | Value (RECORD MANUALLY) | Source |
|-------------|------------------------|--------|
| TWITTER_CONSUMER_KEY | `_________________________` | Twitter Developer Portal |
| TWITTER_CONSUMER_SECRET | `_________________________` | Twitter Developer Portal |
| TWITTER_ACCESS_TOKEN | `_________________________` | Twitter Developer Portal |
| TWITTER_ACCESS_TOKEN_SECRET | `_________________________` | Twitter Developer Portal |
| TWITTER_BOT_ADMIN_SECRET | `_________________________` | Self-generated |
| TWITTER_PROXY | `_________________________` | Proxy service |
| TWITTERAPI_IO_KEY | `_________________________` | TwitterAPI.io |

---

## X Account Session Credentials

| Secret Name | Value (RECORD MANUALLY) | Source |
|-------------|------------------------|--------|
| X_ACCOUNT_EMAIL | `_________________________` | Your X account email |
| X_ACCOUNT_PASSWORD | `_________________________` | Your X account password |
| X_ACCOUNT_USERNAME | `_________________________` | Your X account username |
| X_AUTH_TOKEN | `_________________________` | Browser cookies |
| X_BEARER_TOKEN | `_________________________` | Browser network inspector |
| X_CT0 | `_________________________` | Browser cookies |
| X_CT0_TOKEN | `_________________________` | Browser cookies |
| X_FULL_COOKIE | `_________________________` | Browser cookies |
| X_TOTP_SECRET | `_________________________` | 2FA setup |

---

## Wallet Private Keys (CRITICAL - KEEP SECURE!)

| Secret Name | Value (RECORD MANUALLY) | Notes |
|-------------|------------------------|-------|
| PUMP_DEPLOYER_PRIVATE_KEY | `_________________________` | Main deployer wallet |
| SNIPER_PRIVATE_KEY | `_________________________` | Sniper bot wallet |
| TREASURY_PRIVATE_KEY | `_________________________` | Treasury wallet |

---

## Feature Flags

| Secret Name | Value (RECORD MANUALLY) | Notes |
|-------------|------------------------|-------|
| ENABLE_PROMO_MENTIONS | `_________________________` | true/false |
| ENABLE_X_POSTING | `_________________________` | true/false |

---

## Frontend Environment Variables (VITE_*)

| Secret Name | Value (RECORD MANUALLY) | Notes |
|-------------|------------------------|-------|
| VITE_HELIUS_API_KEY | `_________________________` | Same as HELIUS_API_KEY |
| VITE_HELIUS_RPC_URL | `_________________________` | Same as HELIUS_RPC_URL |
| VITE_METEORA_API_URL | `_________________________` | Same as METEORA_API_URL |
| VITE_PRIVY_APP_ID | `_________________________` | Same as PRIVY_APP_ID |

---

## Total: 39 Secrets

### Categories Summary:
- **API Keys & Services**: 12
- **Privy Authentication**: 3
- **Twitter API**: 7
- **X Account Session**: 9
- **Wallet Private Keys**: 3
- **Feature Flags**: 2
- **Frontend Variables**: 4

---

## Security Notes

1. **NEVER** commit this file with real values to a public repository
2. Store this document in a secure password manager
3. Wallet private keys should be stored in a hardware wallet if possible
4. Consider rotating API keys after recording them
5. X session credentials expire - you may need to refresh them

---

## How to Restore Secrets

1. Create a new Lovable project
2. Go to **Project Settings → Secrets**
3. Add each secret using the values recorded above
4. Secrets will be automatically available to edge functions
