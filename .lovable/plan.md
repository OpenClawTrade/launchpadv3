
# Agent Claim Page & Twitter Credentials Setup

## Overview
This plan implements the complete flow for Twitter users to claim ownership of their agents launched via the `!tunalaunch` command, plus Twitter OAuth configuration and cron job setup.

## User Flow Diagram

```text
┌─────────────────────────────────────────────────────────────────────┐
│  User launches token via Twitter: @TunaLaunch !tunalaunch ...       │
└────────────────────────────────────┬────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  System scans Twitter (every 5 min), creates token & agent          │
│  Agent linked to: wallet address + Twitter username (style_source)  │
└────────────────────────────────────┬────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  User visits tuna.fun/agents/claim                                  │
└────────────────────────────────────┬────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Login with Privy (Twitter auth)                            │
│  - Privy already supports: ["wallet", "twitter", "email"]           │
│  - User authenticates with their Twitter/X account                  │
└────────────────────────────────────┬────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: System matches Twitter username to unclaimed agents        │
│  - Query: agents WHERE style_source_username = @user AND NOT verified│
│  - Display matching agents ready to claim                           │
└────────────────────────────────────┬────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: User sets/confirms receiving wallet                        │
│  - Option A: Use Privy embedded wallet (auto-created)               │
│  - Option B: Enter external wallet address                          │
│  - Wallet must match agent's wallet_address OR be updated           │
└────────────────────────────────────┬────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Sign verification message with wallet                      │
│  - Call agent-claim-init to get challenge                           │
│  - Sign message with wallet private key                             │
│  - Submit signature to agent-claim-verify                           │
└────────────────────────────────────┬────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 5: Receive API key (one-time display)                         │
│  - Store securely warning                                           │
│  - Redirect to /agents/dashboard                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Frontend - Agent Claim Page

### New Page: `/agents/claim`

**File: `src/pages/AgentClaimPage.tsx`**

#### Features:
1. **Twitter Login Integration**
   - Use existing Privy provider with Twitter auth
   - Extract Twitter username from `user.twitter.username`

2. **Agent Discovery**
   - Query database for unclaimed agents matching Twitter handle
   - Show list of claimable agents with token info

3. **Wallet Setup**
   - Display Privy embedded wallet address
   - Option to update receiving wallet before claiming

4. **Signature Flow**
   - Call `agent-claim-init` with wallet address
   - Display challenge message to sign
   - Use `useSolanaWalletPrivy` to sign message
   - Submit signature to `agent-claim-verify`

5. **Success State**
   - Display API key with copy button
   - Strong warning about one-time display
   - Link to dashboard

#### Component Structure:
```text
AgentClaimPage
├── ClaimHeader (logo, title, description)
├── LoginPrompt (if not authenticated)
│   └── "Login with Twitter to claim your agent"
├── AgentDiscovery (after Twitter login)
│   └── List of unclaimed agents matching Twitter
├── WalletSetup (select/confirm wallet)
│   ├── EmbeddedWalletOption
│   └── ExternalWalletInput
├── SignatureFlow (verification)
│   ├── ChallengeDisplay
│   └── SignButton
└── SuccessModal (API key reveal)
```

### Route Addition

**File: `src/App.tsx`**
- Add lazy import for `AgentClaimPage`
- Add route: `/agents/claim`

---

## Part 2: Backend Modifications

### Edge Function: `agent-find-by-twitter`

New endpoint to find unclaimed agents by Twitter username.

**Endpoint:** `POST /agent-find-by-twitter`

**Request:**
```json
{
  "twitterUsername": "coolcreator"
}
```

**Response:**
```json
{
  "success": true,
  "agents": [
    {
      "id": "uuid",
      "name": "My Token Agent",
      "walletAddress": "7xK9...",
      "tokenSymbol": "$COOL",
      "tokenMint": "TNA...",
      "launchedAt": "2026-02-01T...",
      "verified": false
    }
  ]
}
```

### Edge Function: `agent-claim-init` (Update)

Currently requires wallet address. Need to also support:
- Looking up agent by Twitter username (for claim flow)
- Optional: Allow wallet address update if user wants to change receiving wallet

### Edge Function: `agent-claim-verify` (Existing)

Already implemented - verifies signature and generates API key.

---

## Part 3: Twitter Credentials Setup

### Required Secrets (4 total):

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `TWITTER_CONSUMER_KEY` | API Key from Twitter Dev Portal | developer.x.com > App > Keys |
| `TWITTER_CONSUMER_SECRET` | API Secret from Twitter Dev Portal | developer.x.com > App > Keys |
| `TWITTER_ACCESS_TOKEN` | User Access Token for bot account | developer.x.com > App > Keys |
| `TWITTER_ACCESS_TOKEN_SECRET` | User Access Token Secret | developer.x.com > App > Keys |

### Setup Steps:

1. **Create Twitter Developer Account**
   - Go to [developer.x.com](https://developer.x.com)
   - Sign up with the @TunaLaunch bot account

2. **Create a Project & App**
   - Create new Project: "TUNA Agents"
   - Create App within project

3. **Configure Permissions**
   - User authentication settings
   - Type: "Web App, Automated App or Bot"
   - App permissions: **Read and Write** (critical!)
   - Callback URL: `https://tuna.fun/callback` (not used but required)

4. **Generate Keys**
   - Keys and Tokens tab
   - Generate API Key and Secret
   - Generate Access Token and Secret

5. **Add to Lovable Cloud**
   - Use the secrets configuration UI
   - Add all 4 secrets

### API Tier Recommendations:

| Tier | Cost | Rate Limits | Use Case |
|------|------|-------------|----------|
| Free | $0 | 1,500 tweets/month read | Testing only |
| Basic | $100/mo | 10,000 tweets/month | Production launch |
| Pro | $5,000/mo | 1M tweets/month | High scale |

**Recommendation:** Start with Basic ($100/mo) for launch.

---

## Part 4: Cron Jobs Setup

### Required Cron Jobs:

#### 1. Twitter Scanner (Every 5 minutes)
```sql
SELECT cron.schedule(
  'agent-scan-twitter-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ptwytypavumcrbofspno.supabase.co/functions/v1/agent-scan-twitter',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0d3l0eXBhdnVtY3Jib2ZzcG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTIyODksImV4cCI6MjA4MjQ4ODI4OX0.7FFIiwQTgqIQn4lzyDHPTsX-6PD5MPqgZSdVVsH9A44", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

#### 2. Agent Auto-Engage (Every 5 minutes)
```sql
SELECT cron.schedule(
  'agent-auto-engage-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ptwytypavumcrbofspno.supabase.co/functions/v1/agent-auto-engage',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0d3l0eXBhdnVtY3Jib2ZzcG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTIyODksImV4cCI6MjA4MjQ4ODI4OX0.7FFIiwQTgqIQn4lzyDHPTsX-6PD5MPqgZSdVVsH9A44", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Part 5: Test Endpoint

### Edge Function: `agent-twitter-test`

Simple endpoint to verify Twitter credentials are working.

**Endpoint:** `POST /agent-twitter-test`

**Response:**
```json
{
  "success": true,
  "credentialsConfigured": true,
  "accountInfo": {
    "username": "TunaLaunch",
    "id": "123456789"
  },
  "permissions": "read_write"
}
```

---

## Implementation Order

### Phase 1: Twitter Secrets
1. Configure 4 Twitter OAuth secrets in Lovable Cloud

### Phase 2: Backend
2. Create `agent-find-by-twitter` edge function
3. Create `agent-twitter-test` edge function
4. Deploy edge functions

### Phase 3: Cron Jobs
5. Set up `agent-scan-twitter-5min` cron job
6. Set up `agent-auto-engage-5min` cron job

### Phase 4: Frontend
7. Create `AgentClaimPage.tsx` with full claim flow
8. Add route to App.tsx
9. Update AgentDocsPage with claim instructions

### Phase 5: Testing
10. Test full flow end-to-end

---

## Technical Details

### Twitter Username Extraction from Privy

```typescript
import { usePrivy } from "@privy-io/react-auth";

const { user } = usePrivy();

// Get Twitter username from linked accounts
const twitterAccount = user?.linkedAccounts?.find(
  (account) => account.type === "twitter_oauth"
);
const twitterUsername = twitterAccount?.username;
```

### Message Signing with Privy Embedded Wallet

```typescript
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";

const { getSolanaWallet, walletAddress } = useSolanaWalletWithPrivy();

const signMessage = async (message: string) => {
  const wallet = getSolanaWallet();
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);
  
  // Privy wallet supports signMessage
  const signature = await wallet.signMessage(messageBytes);
  return bs58.encode(signature);
};
```

### Database Query for Unclaimed Agents

```sql
SELECT 
  a.id,
  a.name,
  a.wallet_address,
  a.verified_at,
  f.symbol as token_symbol,
  f.mint_address as token_mint,
  a.created_at
FROM agents a
LEFT JOIN fun_tokens f ON a.id = f.agent_id
WHERE a.style_source_username = $1
  AND a.verified_at IS NULL
ORDER BY a.created_at DESC;
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/AgentClaimPage.tsx` | Create | Full claim page with Twitter login |
| `src/App.tsx` | Modify | Add /agents/claim route |
| `supabase/functions/agent-find-by-twitter/index.ts` | Create | Find unclaimed agents by Twitter |
| `supabase/functions/agent-twitter-test/index.ts` | Create | Test Twitter credentials |
| `supabase/config.toml` | Modify | Add new edge function routes |
| `src/pages/AgentDocsPage.tsx` | Modify | Add claim instructions |
