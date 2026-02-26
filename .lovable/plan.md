

# Fix Launch Guard and Rate Limit Race Condition

## Problem 1: Launches without wallet
The client-side code (lines 150-156 of PunchTestPage) correctly blocks launches when no wallet is entered. The server-side also validates the wallet (line 56 of punch-launch). However, the edge function can still be called directly via HTTP without going through the UI, bypassing client checks. The server validation is present but the real issue is Problem 2.

## Problem 2: Rate limit race condition (10 tokens instead of max ~3/hour)
The rate limit record is inserted at **line 185** -- AFTER all the heavy work (AI name generation, image generation, image upload, on-chain token creation). This means multiple concurrent requests all pass the rate limit check before any single one writes its record. This is how 10 tokens got launched.

**Current flow:**
1. Check rate limit (passes for all concurrent requests)
2. Generate AI name (~2-5s)
3. Generate AI image (~5-10s)
4. Upload image
5. Create on-chain token
6. **Insert rate limit record** (too late!)
7. Save to database

## Fix

### File: `supabase/functions/punch-launch/index.ts`

**Move rate limit insert to BEFORE any work is done** (right after the rate limit check passes, before AI generation). This closes the race window:

1. Check rate limit
2. **Insert rate limit record immediately** (blocks concurrent requests)
3. Proceed with AI generation, image, on-chain creation
4. If anything fails, optionally clean up the rate limit record (or leave it -- failed attempts still count as rate-limited)

Additionally, add an atomic "insert-if-not-exists" approach using a unique constraint or a SELECT FOR UPDATE pattern to prevent even the tiniest race window. Since we're using Supabase, we'll use a simple approach: insert the rate limit record first and rely on the timing.

### Changes:
- Move `await supabase.from("launch_rate_limits").insert(...)` from line 185 to right after the rate limit check (after line 53), before any AI/creation work begins
- This ensures concurrent requests are blocked because the record exists before any slow operations start

No other files need changes -- the client-side wallet validation is already correct.

