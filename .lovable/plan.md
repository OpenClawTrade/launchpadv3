
# TUNA API Platform - Complete Third-Party Integration System

## Overview
Build a comprehensive API platform that allows any developer to create their own token launchpad using TUNA's infrastructure. The system will provide:
1. **Embeddable Widgets** - Drop-in iframe components
2. **Direct REST API** - Full programmatic control
3. **SDK/Code Snippets** - Copy-paste integration examples
4. **Documentation Page** - Interactive API reference

Revenue Model: API users earn **1.5% of trading fees**, platform keeps **0.5%** (from the 2% total trading fee).

---

## Current State Analysis

### ✅ Already Implemented:
- `api_accounts` table - API key management with wallet binding
- `api_launchpads` table - Custom launchpad configurations
- `api_usage_logs` table - Request tracking
- `api_fee_distributions` table - Fee split tracking
- `api-account` edge function - Account creation, key regeneration, verification
- `api-launchpad` edge function - Launchpad CRUD with Cloudflare DNS
- `api-tokens` edge function - Token linking to launchpads
- `api-analytics` edge function - Usage statistics
- `api-claim-fees` edge function - Fee withdrawal
- `api-design-generate` edge function - AI design generation
- Dashboard UI (`/api`) and Builder UI (`/api/builder`)

### ❌ Missing for Third-Party Integration:
1. **Token Launch API Endpoint** - Direct API endpoint for launching tokens programmatically
2. **Embeddable Widget System** - Iframe-based components for websites
3. **API Documentation Page** - Developer-facing docs with code examples
4. **Swap/Trade API** - Execute trades via API
5. **Webhook Support** - Notify external systems of events
6. **CORS Configuration** - Allow API calls from external domains

---

## Implementation Plan

### Phase 1: Core API Endpoints

#### 1.1 Create `api-launch-token` Edge Function
**File:** `supabase/functions/api-launch-token/index.ts`

Purpose: Allow API users to launch tokens directly via API with their key.

```text
POST /api-launch-token
Headers: x-api-key: <api_key>
Body: {
  "name": "MyToken",
  "ticker": "MTK",
  "description": "A fun meme coin",
  "imageUrl": "https://...",
  "websiteUrl": "https://...",
  "twitterUrl": "https://...",
  "telegramUrl": "https://...",
  "discordUrl": "https://...",
  "tradingFeeBps": 200  // 0.1%-10% range
}

Response: {
  "success": true,
  "tokenId": "uuid",
  "mintAddress": "base58...",
  "poolAddress": "base58...",
  "solscanUrl": "https://solscan.io/token/...",
  "tradeUrl": "https://axiom.trade/meme/..."
}
```

Implementation:
- Verify API key via `verify_api_key` RPC
- Call existing Vercel `/api/pool/create-fun` with `serverSideSign=true`
- Link token to API account's launchpad
- Track fee attribution to API account

#### 1.2 Create `api-swap` Edge Function
**File:** `supabase/functions/api-swap/index.ts`

Purpose: Get swap quotes and generate transactions for trading.

```text
POST /api-swap/quote
Headers: x-api-key: <api_key>
Body: {
  "poolAddress": "base58...",
  "inputMint": "So11111111111111111111111111111111111111112", // SOL
  "outputMint": "base58...", // Token mint
  "amount": "1000000000", // lamports
  "slippageBps": 100 // 1%
}

Response: {
  "inputAmount": "1000000000",
  "outputAmount": "50000000000000",
  "priceImpact": 0.5,
  "fee": "20000000", // 2% fee in lamports
  "unsignedTransaction": "base64..." // For external signing
}
```

#### 1.3 Create `api-webhooks` Edge Function
**File:** `supabase/functions/api-webhooks/index.ts`

Purpose: Manage webhook endpoints for event notifications.

Events supported:
- `token.created` - New token launched
- `token.graduated` - Token migrated to Raydium
- `trade.executed` - Swap completed
- `fees.accumulated` - Threshold reached for claiming

---

### Phase 2: Embeddable Widget System

#### 2.1 Create Widget Host Page
**File:** `src/pages/WidgetPage.tsx`

A standalone page that renders embeddable components based on URL parameters.

URL Structure:
```
/widget/launcher?apiKey=xxx&theme=dark&accentColor=%238B5CF6
/widget/trade?mintAddress=xxx&apiKey=xxx&theme=dark
/widget/token-list?launchpadId=xxx&limit=10
```

Features:
- Minimal bundle size (lazy load only needed components)
- PostMessage API for parent page communication
- Responsive sizing based on parent container
- Theme customization via URL params

#### 2.2 Create Widget Components

**TokenLauncherWidget** - Complete token launch form
- File upload or URL input for image
- Name, ticker, description fields
- Optional social links
- Trading fee slider (0.1% - 10%)
- Wallet connection via Phantom/Solflare

**TradePanelWidget** - Buy/sell interface for a token
- SOL input amount
- Token balance display
- Slippage settings
- Wallet integration

**TokenListWidget** - Display tokens from a launchpad
- Grid or list view
- Sorting options
- Click to trade integration

#### 2.3 Create Embed Code Generator
**File:** Update `src/pages/ApiDashboardPage.tsx`

Add new tab "Embed & Integrate" showing:
- iframe code snippets for each widget
- Customization options (theme, colors, size)
- Live preview panel

---

### Phase 3: API Documentation Page

#### 3.1 Create Documentation Page
**File:** `src/pages/ApiDocsPage.tsx`

Sections:
1. **Getting Started**
   - Create API account
   - Get API key
   - Authentication

2. **Endpoints Reference**
   - Token Launch
   - Swap/Trade
   - Token List
   - Fee Claims
   - Webhooks

3. **Widget Integration**
   - iframe Embed (simplest)
   - JavaScript SDK (advanced)
   - React Component (for React apps)

4. **Code Examples**
   - HTML/JavaScript
   - Python
   - Node.js
   - cURL

5. **Fee Structure**
   - Trading fees (2% total: 1.5% to API user, 0.5% to platform)
   - No upfront costs
   - Claiming thresholds

#### 3.2 Interactive API Playground
Within the docs page:
- Request builder with live execution
- Response viewer
- API key input (for testing)

---

### Phase 4: Database Updates

#### 4.1 Add Webhook Configuration Table
```sql
CREATE TABLE api_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_account_id UUID REFERENCES api_accounts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Only service role can access
ALTER TABLE api_webhooks ENABLE ROW LEVEL SECURITY;
```

#### 4.2 Add Token Attribution to API Account
Update token creation to track which API account launched it:
```sql
ALTER TABLE tokens ADD COLUMN api_account_id UUID REFERENCES api_accounts(id);
ALTER TABLE fun_tokens ADD COLUMN api_account_id UUID REFERENCES api_accounts(id);
```

---

### Phase 5: Configuration Updates

#### 5.1 Update `supabase/config.toml`
Add new edge functions:
```toml
[functions.api-launch-token]
verify_jwt = false

[functions.api-swap]
verify_jwt = false

[functions.api-webhooks]
verify_jwt = false
```

#### 5.2 Add Route for Docs and Widget Pages
Update `src/App.tsx`:
```tsx
<Route path="/api/docs" element={<ApiDocsPage />} />
<Route path="/widget/:type" element={<WidgetPage />} />
```

---

## Technical Details

### Widget iframe Integration Example

For API users to embed on their website:

```html
<!-- Token Launcher Widget -->
<iframe 
  src="https://tuna.fun/widget/launcher?apiKey=YOUR_API_KEY&theme=dark"
  width="100%" 
  height="600"
  frameborder="0"
  allow="clipboard-write"
></iframe>

<!-- Trade Panel Widget -->
<iframe 
  src="https://tuna.fun/widget/trade?mintAddress=TOKEN_MINT&apiKey=YOUR_API_KEY"
  width="400" 
  height="500"
  frameborder="0"
></iframe>
```

### JavaScript SDK (Future)

```javascript
import { TunaSDK } from '@tuna/sdk';

const tuna = new TunaSDK({ apiKey: 'YOUR_API_KEY' });

// Launch a token
const result = await tuna.launchToken({
  name: 'MyToken',
  ticker: 'MTK',
  image: fileInput.files[0],
});

console.log(result.mintAddress);
```

### REST API Flow
```text
1. Developer signs up at tuna.fun/api
2. Connects wallet, gets API key
3. Uses API key in x-api-key header
4. Calls endpoints to launch tokens, execute trades
5. Fees accumulate in their account
6. Claims fees when threshold reached (>0.01 SOL)
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/api-launch-token/index.ts` | Create | Direct token launch endpoint |
| `supabase/functions/api-swap/index.ts` | Create | Swap quote and transaction builder |
| `supabase/functions/api-webhooks/index.ts` | Create | Webhook management |
| `src/pages/ApiDocsPage.tsx` | Create | Developer documentation |
| `src/pages/WidgetPage.tsx` | Create | Widget host for iframes |
| `src/components/widgets/TokenLauncherWidget.tsx` | Create | Embeddable launcher |
| `src/components/widgets/TradePanelWidget.tsx` | Create | Embeddable trade panel |
| `src/components/widgets/TokenListWidget.tsx` | Create | Embeddable token list |
| `src/pages/ApiDashboardPage.tsx` | Modify | Add embed code generator tab |
| `src/App.tsx` | Modify | Add routes for docs and widgets |
| `supabase/config.toml` | Modify | Register new edge functions |
| Migration | Create | Add webhooks table and token attribution columns |

---

## User Flow Example

### For a Non-Technical User (HTML Website):
1. Go to `tuna.fun/api`, connect wallet
2. Get API key (copy and save)
3. Go to "Embed & Integrate" tab
4. Select "Token Launcher Widget"
5. Customize colors to match their site
6. Copy the `<iframe>` code
7. Paste into their HTML website
8. Users visiting their site can now launch tokens
9. API owner earns 1.5% of all trading fees

### For a Developer (REST API):
1. Create account, get API key
2. Read docs at `tuna.fun/api/docs`
3. Integrate API calls into their app:
   - `POST /api-launch-token` to create tokens
   - `POST /api-swap/quote` to get quotes
   - `POST /api-swap/execute` to build transactions
4. Handle webhooks for real-time updates
5. Claim fees via dashboard or API

---

## Security Considerations

1. **API Key Validation** - All endpoints verify key hash before processing
2. **Rate Limiting** - Implement per-key rate limits (100 requests/min default)
3. **CORS** - Allow requests from any origin (public API)
4. **Webhook Secrets** - HMAC signature verification for webhook payloads
5. **Input Validation** - Strict validation on all user inputs
6. **Fee Attribution** - Cryptographic binding of tokens to API accounts

---

## Summary

This plan creates a complete self-serve platform where anyone can:
1. Sign up and get an API key (free)
2. Embed widgets OR use REST API
3. Launch tokens on their own site/app
4. Earn 1.5% of all trading fees
5. Claim earnings to their wallet

The implementation leverages existing infrastructure (Vercel pool creation, Meteora SDK) while adding the API abstraction layer and embeddable widgets for maximum flexibility.
