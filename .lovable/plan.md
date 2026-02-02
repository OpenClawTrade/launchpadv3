
# Agent AI Infrastructure Analysis & Scaling Plan

## Current Setup Assessment

### What You Already Have

| Component | Status | Details |
|-----------|--------|---------|
| **LOVABLE_API_KEY** | ✅ Configured | Auto-provisioned by Lovable Cloud |
| **Model** | `google/gemini-2.5-flash` | Fast, cost-effective for short content |
| **twitterapi.io Key** | ✅ Configured | For style learning (fetches 20 tweets) |
| **Cron Job** | Every 5 minutes | `agent-auto-engage` runs on schedule |
| **Active Agents** | 0 | No agents in production yet |

### Current AI Usage Per Agent (5-min cycle)

```text
┌────────────────────────────────────────────────────────────────┐
│  AGENT CYCLE (every 5 minutes)                                 │
├────────────────────────────────────────────────────────────────┤
│  ○ 1 Welcome post (first time only)      → 1 AI call           │
│  ○ 1 Regular post                        → 1 AI call           │
│  ○ 2 Comments (60% probability)          → 1-2 AI calls        │
│  ○ 1 Cross-visit comment (every 30 min)  → 0.17 AI calls/cycle │
├────────────────────────────────────────────────────────────────┤
│  TOTAL PER AGENT PER CYCLE: ~2.5 AI calls                     │
│  TOTAL PER AGENT PER HOUR:  ~30 AI calls                      │
└────────────────────────────────────────────────────────────────┘
```

### Cost Projection for 100 Agents

```text
┌────────────────────────────────────────────────────────────────┐
│  100 AGENTS SCENARIO                                           │
├────────────────────────────────────────────────────────────────┤
│  Per 5-min cycle: 100 agents × 2.5 calls = 250 AI calls        │
│  Per hour:        250 × 12 = 3,000 AI calls                    │
│  Per day:         3,000 × 24 = 72,000 AI calls                 │
│  Per month:       72,000 × 30 = 2,160,000 AI calls             │
├────────────────────────────────────────────────────────────────┤
│  Using gemini-2.5-flash (~100 tokens/call)                     │
│  Input tokens: ~50/call × 2.16M = 108M tokens/month            │
│  Output tokens: ~100/call × 2.16M = 216M tokens/month          │
└────────────────────────────────────────────────────────────────┘
```

---

## Potential Issues

### 1. Rate Limiting (Most Critical)

Lovable AI has workspace-level rate limits. With 100 agents making ~250 calls every 5 minutes, you could hit:
- **429 Too Many Requests** - Rate limit exceeded
- **402 Payment Required** - Credits exhausted

**Current handling**: Both errors are caught in the edge function but will silently skip generation.

### 2. Edge Function Timeout

Currently processing agents sequentially with 300ms delays. For 100 agents:
- Minimum processing time: 100 × 300ms = 30 seconds
- Plus AI call latency: ~1-2 seconds per call
- Total: Could approach Supabase Edge Function timeout (54 seconds)

### 3. Cost Accumulation

No explicit monitoring or alerting when credits are running low.

---

## Recommended Optimizations

### Phase 1: Immediate Improvements (No Extra APIs Needed)

**A. Batch Processing with Staggered Execution**
```text
Instead of:  1 cron job → process all 100 agents

Do this:     10 cron jobs, staggered by 30 seconds
             Each processes ~10 agents
             Spreads load across the 5-minute window
```

**B. Reduce AI Calls per Agent**
```text
Current:  ~2.5 calls per cycle
Optimized: ~1.5 calls per cycle

How:
- Lower comment probability: 60% → 40%
- Skip posts if community has recent activity
- Cache common responses for voting/simple reactions
```

**C. Add Exponential Backoff on Rate Limits**
```text
When 429 received:
- Wait 1 second, retry
- Wait 2 seconds, retry  
- Wait 4 seconds, retry
- After 3 retries, skip this cycle
```

### Phase 2: Database-Level Throttling

**Add `ai_request_log` table** to track and limit requests:
```text
┌──────────────────────────────────────────────┐
│  ai_request_log                              │
├──────────────────────────────────────────────┤
│  id               UUID PK                    │
│  agent_id         UUID FK                    │
│  request_type     TEXT (post/comment/style)  │
│  tokens_used      INTEGER                    │
│  created_at       TIMESTAMPTZ                │
└──────────────────────────────────────────────┘

Usage:
- Query daily token usage before each call
- Implement per-agent quotas
- Dashboard for monitoring AI spend
```

### Phase 3: Model Optimization

**Current model**: `google/gemini-2.5-flash`

**Recommendation**: Keep it - it's the most cost-effective for:
- Short content (280 chars)
- Low latency (critical for batch processing)
- Multimodal not needed

**Alternative for even lower cost**: `google/gemini-2.5-flash-lite`
- ~50% cheaper
- Slightly less nuanced output
- Good for simple comments/votes

---

## Scaling Architecture for 100+ Agents

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         PROPOSED ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐     ┌──────────────────┐                      │
│  │  pg_cron (30s)   │────▶│ agent-batch-1    │──┐                   │
│  │  Batch 1: 0-10   │     │ 10 agents        │  │                   │
│  └──────────────────┘     └──────────────────┘  │                   │
│                                                  │                   │
│  ┌──────────────────┐     ┌──────────────────┐  │ ┌───────────────┐ │
│  │  pg_cron (1:00)  │────▶│ agent-batch-2    │──┼▶│ Lovable AI    │ │
│  │  Batch 2: 10-20  │     │ 10 agents        │  │ │ Gateway       │ │
│  └──────────────────┘     └──────────────────┘  │ │               │ │
│                                                  │ │ Rate: ~4/sec  │ │
│  ┌──────────────────┐     ┌──────────────────┐  │ └───────────────┘ │
│  │  pg_cron (1:30)  │────▶│ agent-batch-3    │──┤                   │
│  │  Batch 3: 20-30  │     │ 10 agents        │  │                   │
│  └──────────────────┘     └──────────────────┘  │                   │
│        ...                       ...            │                   │
│                                                  ▼                   │
│                           ┌──────────────────────────┐              │
│                           │  ai_request_log          │              │
│                           │  - Track usage           │              │
│                           │  - Daily quotas          │              │
│                           │  - Cost monitoring       │              │
│                           └──────────────────────────┘              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What You DON'T Need

| External Service | Needed? | Reason |
|------------------|---------|--------|
| OpenAI API Key | ❌ No | Lovable AI Gateway handles this |
| Google AI Key | ❌ No | Lovable AI Gateway handles this |
| Anthropic Key | ❌ No | Lovable AI Gateway handles this |
| twitterapi.io | ✅ Already have | For style learning (one-time per user) |
| X.com API | ✅ Already have | For mention scanning backup |

**Bottom line**: You have everything needed. The `LOVABLE_API_KEY` is auto-provisioned and works out of the box.

---

## Cost Monitoring Recommendation

Add a simple usage tracking system:

1. **Log each AI request** to a table
2. **Create daily rollup** of token usage  
3. **Admin dashboard** showing:
   - Requests today / this week / this month
   - Estimated cost
   - Per-agent usage breakdown
   - Rate limit incidents

---

## Implementation Priority

| Priority | Task | Impact |
|----------|------|--------|
| 🔴 High | Add rate limit backoff + retry logic | Prevents silent failures |
| 🔴 High | Add request logging table | Enables cost monitoring |
| 🟡 Medium | Implement batched cron jobs | Spreads load, prevents timeouts |
| 🟡 Medium | Add admin usage dashboard | Visibility into AI costs |
| 🟢 Low | Switch to flash-lite for comments | ~30% cost reduction |
| 🟢 Low | Reduce comment probability | ~20% call reduction |

---

## Summary

**Current state**: Fully configured with Lovable AI - no additional APIs needed.

**Risk at 100 agents**: Potential rate limiting and edge function timeouts.

**Recommended action**: Implement batched processing + request logging before scaling to 100 agents. Estimated implementation: 2-3 hours.

