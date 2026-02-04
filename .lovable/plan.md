

# Trading Agents Full Implementation Plan

## Executive Summary
This plan implements the complete Trading Agents system with real Jupiter DEX execution, automated cron scheduling, AES-256 wallet encryption, and a creation form UI - while keeping the page in beta mode (not prominently published).

---

## Current State Analysis

### What Exists (Working)
- Database schema: `trading_agents`, `trading_agent_positions`, `trading_agent_trades`, `trading_agent_strategy_reviews`
- Edge functions: `trading-agent-create`, `trading-agent-execute`, `trading-agent-monitor`, `trading-agent-list`
- AI analysis and learning logic
- SubTuna community integration for trade posts
- UI page at `/agents/trading`

### What's Missing/Broken
1. **Real Jupiter swaps** - Trades are simulated (position created but no on-chain execution)
2. **Wallet decryption** - No function to decrypt private keys for signing
3. **Wallet encryption** - Uses weak XOR (needs AES-256)
4. **Cron automation** - No scheduled jobs for execute/monitor
5. **Agent creation UI** - Button says "Coming Soon"
6. **Pump.fun price fetching** - Uses approximate calculation, not real API data

---

## Implementation Tasks

### Phase 1: Security - AES-256 Wallet Encryption

**Files to modify:**
- `supabase/functions/trading-agent-create/index.ts`

**Changes:**
Replace XOR encryption with Web Crypto API AES-256-GCM:

```text
Implementation:
1. Create aesEncrypt() using crypto.subtle.encrypt with AES-GCM
2. Use API_ENCRYPTION_KEY secret (already exists) as encryption key 
3. Generate random 12-byte IV per encryption
4. Store as: base64(iv + ciphertext)
5. Create aesDecrypt() function for trading-agent-execute/monitor
```

---

### Phase 2: Real Jupiter DEX Integration

**Files to modify:**
- `supabase/functions/trading-agent-execute/index.ts`
- `supabase/functions/trading-agent-monitor/index.ts`

**trading-agent-execute changes (buy side):**

```text
After AI selects a token:
1. Decrypt agent's wallet private key using aesDecrypt()
2. Create Keypair from decrypted secret
3. Call Jupiter quote API: GET /quote?inputMint=SOL&outputMint={token}&amount={lamports}
4. Call Jupiter swap API: POST /swap with quote + agent wallet
5. Sign transaction with agent's keypair
6. Send via Helius RPC with skipPreflight
7. Confirm transaction
8. Record signature in trading_agent_trades table
9. Update position with actual tokens received
```

**trading-agent-monitor changes (sell side):**

```text
When SL/TP triggered:
1. Decrypt agent's wallet private key
2. Call Jupiter quote: inputMint={token}&outputMint=SOL&amount={tokens}
3. Execute swap transaction
4. Sign with agent keypair
5. Send and confirm
6. Record signature and actual SOL received
7. Update position/trade records
```

**Price fetching improvement:**
```text
Replace approximate pump.fun price calculation with:
1. Jupiter price API: GET /price?ids={mint}
2. Fallback to pump.fun API with proper parsing
3. Cache prices for 30s to avoid rate limits
```

---

### Phase 3: Cron Job Automation

**Database changes (via SQL insert tool):**

```sql
-- Trading agent execute every 5 minutes
SELECT cron.schedule(
  'trading-agent-execute-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://ptwytypavumcrbofspno.supabase.co/functions/v1/trading-agent-execute',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
    body:=concat('{"trigger": "cron", "time": "', now(), '"}')::jsonb
  );
  $$
);

-- Trading agent monitor every minute
SELECT cron.schedule(
  'trading-agent-monitor-1min', 
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://ptwytypavumcrbofspno.supabase.co/functions/v1/trading-agent-monitor',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
    body:=concat('{"trigger": "cron", "time": "', now(), '"}')::jsonb
  );
  $$
);
```

---

### Phase 4: Agent Creation UI

**New file:**
- `src/components/trading/CreateTradingAgentModal.tsx`

**Modify:**
- `src/pages/TradingAgentsPage.tsx`
- `src/hooks/useTradingAgents.ts`

**Modal features:**
```text
Form fields:
- Name (optional - AI generates if empty)
- Ticker (optional - AI generates if empty)  
- Description (optional)
- Avatar upload
- Strategy selector: Conservative/Balanced/Aggressive
- Personality prompt (optional - affects AI decisions)

On submit:
1. Get user wallet from Privy
2. Call trading-agent-create edge function
3. Show success with wallet address to fund
4. Navigate to agent profile page
```

**Hook addition:**
```typescript
export function useCreateTradingAgent() {
  const mutation = useMutation({
    mutationFn: async (data: CreateAgentInput) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trading-agent-create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(data),
        }
      );
      return response.json();
    }
  });
  return mutation;
}
```

---

### Phase 5: Trending Token Data Source

**File to modify:**
- `supabase/functions/pumpfun-trending-sync/index.ts` (ensure it populates `pumpfun_trending_tokens`)

**Verify/enhance:**
```text
1. Sync trending tokens from pump.fun every 5 minutes
2. Store: mint_address, name, symbol, price_sol, liquidity_sol, holder_count, token_score
3. trading-agent-execute queries this table for trade candidates
```

---

## Technical Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                        CRON SCHEDULER                           │
│  trading-agent-execute (5min) │ trading-agent-monitor (1min)    │
└────────────────┬────────────────────────────┬───────────────────┘
                 │                            │
                 ▼                            ▼
┌────────────────────────────┐  ┌────────────────────────────────┐
│  TRADING-AGENT-EXECUTE     │  │  TRADING-AGENT-MONITOR         │
│  ─────────────────────     │  │  ──────────────────────        │
│  1. Get active agents      │  │  1. Get open positions         │
│  2. Fetch trending tokens  │  │  2. Fetch current prices       │
│  3. AI token analysis      │  │  3. Check SL/TP thresholds     │
│  4. Decrypt wallet         │  │  4. If triggered:              │
│  5. Jupiter buy swap       │  │     - Decrypt wallet           │
│  6. Record position        │  │     - Jupiter sell swap        │
│  7. Post to SubTuna        │  │     - Update stats & patterns  │
└────────────────────────────┘  │     - Post to SubTuna          │
                                │  5. Trigger strategy review    │
                                └────────────────────────────────┘
                                           │
                                           ▼
                              ┌────────────────────────────┐
                              │      JUPITER DEX API       │
                              │  Quote → Swap → Sign → Send│
                              └────────────────────────────┘
```

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/trading-agent-create/index.ts` | Modify | Replace XOR with AES-256 encryption |
| `supabase/functions/trading-agent-execute/index.ts` | Modify | Add Jupiter swap, wallet decryption, real execution |
| `supabase/functions/trading-agent-monitor/index.ts` | Modify | Add Jupiter sell swap, wallet decryption |
| `src/components/trading/CreateTradingAgentModal.tsx` | Create | Agent creation form modal |
| `src/pages/TradingAgentsPage.tsx` | Modify | Wire up creation modal |
| `src/hooks/useTradingAgents.ts` | Modify | Add useCreateTradingAgent mutation |
| Database (cron jobs) | Insert | Schedule trading-agent-execute and monitor |

---

## Safety Measures

1. **Position size limits**: Max 25% of capital per trade (aggressive strategy)
2. **Gas reserve**: Always keep 0.1 SOL for transaction fees
3. **Cooldown**: 60-second minimum between trades per agent
4. **Max positions**: Strategy-based limits (2/3/5)
5. **Capital threshold**: 0.5 SOL minimum to activate trading
6. **Transaction retries**: Max 3 attempts with exponential backoff
7. **Slippage**: 5% (500 bps) default on Jupiter swaps

---

## Beta Mode (Not Published)

The page remains accessible at `/agents/trading` but:
- Not linked in main navigation prominently
- "Create Agent" button enables creation but includes beta disclaimer
- No marketing/announcement until proven stable

---

## Deployment Order

1. Deploy encryption updates to trading-agent-create
2. Deploy Jupiter integration to trading-agent-execute
3. Deploy Jupiter integration to trading-agent-monitor
4. Create cron jobs via SQL
5. Deploy UI components
6. Test with small capital agent

