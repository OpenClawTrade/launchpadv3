

# Trading Agent 67 - Critical Fix Required

## Summary

**The 0.58 SOL balance claim is incorrect.** On-chain verification shows the agent wallet actually has **2.0831 SOL**. However, trades ARE failing completely due to a deprecated API.

---

## The Real Problem: Jupiter V6 API Sunset

Jupiter has **deprecated and sunset the v6 API** (`quote-api.jup.ag/v6`). The new v1 API requires:
1. New endpoint: `https://api.jup.ag/swap/v1/`
2. **API key required** via `x-api-key` header

Current logs show both endpoints failing:
- Primary (`quote-api.jup.ag/v6`): DNS failures and 530 errors (sunset)
- Fallback (`public.jupiterapi.com/v6`): 404 errors

---

## Evidence

| Check | Result |
|-------|--------|
| Database `trading_capital_sol` | 2.0831 SOL |
| On-chain via Helius RPC | 2.0831 SOL |
| Position sizing calculation | Working (0.25 SOL for 2 SOL tier) |
| Jupiter v6 endpoint | **DEPRECATED** - returning DNS/530 errors |

Logs confirm trades attempt but fail at Jupiter:
```
[trading-agent-execute] Swap failed for 67 Agent: All Jupiter quote endpoints failed
Jupiter endpoint https://quote-api.jup.ag/v6 failed: dns error
Jupiter endpoint https://public.jupiterapi.com/v6 returned 404
```

---

## Required Fix

### Step 1: Obtain Jupiter API Key

Jupiter now requires registration at `https://portal.jup.ag` to get an API key. This is a **free tier** available for basic usage.

### Step 2: Add Secret to Project

Add `JUPITER_API_KEY` to the project secrets.

### Step 3: Migrate to V1 API

Update `trading-agent-execute/index.ts` and `trading-agent-monitor/index.ts`:

**FROM (deprecated):**
```typescript
const JUPITER_ENDPOINTS = [
  'https://quote-api.jup.ag/v6',
  'https://public.jupiterapi.com/v6',
];

// Quote call
const quoteUrl = `${endpoint}/quote?inputMint=...`;
const response = await fetch(quoteUrl);

// Swap call  
const response = await fetch(`${endpoint}/swap`, {...});
```

**TO (current API):**
```typescript
const JUPITER_BASE_URL = 'https://api.jup.ag/swap/v1';

// All calls need x-api-key header
const jupiterApiKey = Deno.env.get("JUPITER_API_KEY");

// Quote call
const quoteUrl = `${JUPITER_BASE_URL}/quote?inputMint=...`;
const response = await fetch(quoteUrl, {
  headers: { 'x-api-key': jupiterApiKey }
});

// Swap call
const response = await fetch(`${JUPITER_BASE_URL}/swap`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'x-api-key': jupiterApiKey 
  },
  body: JSON.stringify({...})
});
```

---

## Technical Changes

| File | Changes |
|------|---------|
| `trading-agent-execute/index.ts` | Migrate to v1 API, add x-api-key header |
| `trading-agent-monitor/index.ts` | Migrate to v1 API, add x-api-key header |
| Secrets | Add `JUPITER_API_KEY` |

---

## Immediate Action Required

**You need to:**
1. Go to https://portal.jup.ag and register for a free API key
2. Provide the API key so I can add it as a secret
3. Then I can implement the API migration

Without a Jupiter API key, trading agents **cannot execute any trades** - this is the root cause of Agent 67 being stuck.

---

## Clarification on "0.58 SOL"

The wallet balance is verified at **2.08 SOL**. If you're seeing 0.58 SOL somewhere:
- It may be a cached/stale UI value
- It may be a different wallet/agent  
- It may be an old historical balance

The database and blockchain both confirm 2.0831 SOL in wallet `3uapiJAaVTr1BUcubDFBy7Q1nmdBJ9XdkgcdxWwoGZN8`.

