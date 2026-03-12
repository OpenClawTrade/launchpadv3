

## twitterapi.io Usage Audit

### Current API Call Volume

Here is the exact breakdown of your twitterapi.io consumption:

#### 1. `scan-kol-tweets` (KOL tweet scanner) -- THE MAIN OFFENDER
- **108 active KOLs**, scanned in batches of 20 per run
- **209 runs in the last 24 hours** (~1 run every 5 minutes, 24/7)
- Each run fetches **20 KOLs x 1 API call each = 20 calls/run**
- **Daily total: 209 x 20 = ~4,180 API calls/day**
- Full cycle to scan all 108 KOLs = ~6 runs = ~30 minutes
- This means **each KOL is scanned ~39 times/day** (every ~37 minutes)
- Endpoint used: `/twitter/user/last_tweets?count=20` (returns 20 tweets per call)

#### 2. `twitter-user-info` (Profile lookups from frontend)
- Only **5 cache misses in 7 days** (24hr cache TTL works well)
- Negligible cost

#### 3. `agent-scan-twitter` (Mention scanner / reply bot)
- Uses twitterapi.io for search (`/tweet/advanced_search`) and replies (`/tweet/reply`)
- **0 replies in 7 days** (posting is disabled)
- Search calls depend on cron frequency -- likely similar ~200+/day

#### 4. Other functions (agent-learn-style, claw-learn-voice, cache-kol-avatars, promote-post, etc.)
- Triggered manually or rarely, negligible

### Total Estimated: **~4,500-5,000+ API calls/day** to twitterapi.io

### Why It's 100x More Than Needed

The core problem: **scan-kol-tweets runs every 5 minutes scanning 20 KOLs each time, but only found 23 total contract tweets ever.** The hit rate is extremely low (~0.03%), meaning 99.97% of API calls return nothing useful.

### Reduction Plan

| Change | Impact | Saves |
|--------|--------|-------|
| **Reduce cron to every 15 min** (from 5 min) | 3x fewer runs | ~2,800 calls/day |
| **Reduce batch to 10 KOLs** per run (from 20) | 2x fewer per run | ~2,000 calls/day |
| **Skip KOLs scanned <30 min ago** | Already done via `order(last_scanned_at)` but limit is too high | Combined effect |
| **Reduce tweet count from 20 to 5** | Same API call cost (1 call) but less data transferred | Bandwidth only |
| **Tier KOLs: active vs passive** | High-activity KOLs every 15min, low-activity every 2hr | ~3,500 calls/day |

**Recommended combo**: Change cron to every 15 min + batch size to 10 = **~70 calls/day instead of ~4,200**. That's a **60x reduction** while still scanning every KOL within ~2.5 hours.

### Implementation Steps

1. **Update the cron schedule** for `scan-kol-tweets` from every 5 min to every 15 min (this is configured externally, not in code)
2. **Reduce `.limit(20)` to `.limit(10)`** in `scan-kol-tweets/index.ts` line 88
3. **Add a minimum re-scan interval**: Skip KOLs scanned less than 30 minutes ago (add a `WHERE last_scanned_at < now() - interval '30 minutes'` filter)
4. **Add same optimizations to `agent-scan-twitter`** if it also runs on cron
5. **Update branding checklist** to note twitterapi.io API key as a cost center

