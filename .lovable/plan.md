
## Goal
Stop X-triggered launches from ever producing tokens with missing/blank image + missing socials, and add end-to-end logging so we can pinpoint exactly where/why an image didn’t get hosted (even when it was attached).

## What I found (root causes)
### 1) Your example token is fine in our metadata endpoint, but Axiom can still look blank
- The token you linked (`dbc_pool_address = 7fVpz2...`, mint `3J2Kvy...`) currently returns correct metadata from our `token-metadata` backend function (image + website + twitter).
- If Axiom showed it blank at some point, that’s consistent with “bad first fetch” (e.g., image URL was a `t.co` shortlink or not hosted yet) and Axiom caching its first result. We can’t force Axiom to re-index, but we can ensure future launches are correct on the very first fetch.

### 2) Tokens are being created with base64 images + missing socials in the database
I queried recent `fun_tokens` and found multiple rows where:
- `image_url` is a huge `data:image/png;base64,...`
- `website_url` and `twitter_url` are NULL  
This is exactly the “metadata exists but not uploading properly” symptom: the image never got converted to a permanently hosted URL, so external indexers often show nothing.

### 3) The X launch pipeline is split, and one path can still launch without a properly hosted image
There are multiple X-related launch paths in the project:
- A newer “agent” pipeline (`agent-scan-*` → `agent-process-post`) that is supposed to re-host images to storage and block launches if image hosting fails.
- An older/parallel pipeline (`twitter-mention-launcher`) that:
  - takes `mention.mediaUrls?.[0]` as-is (may be `t.co`)
  - can generate an AI image if none detected
  - calls the on-chain creation even if the final image is missing or not hosted
  - does not do robust image re-hosting
This older/parallel path is the most likely reason you’re seeing “it launched but metadata image/socials are missing.”

## Decisions (based on what you told me)
- X launches must require a user-attached image (no AI fallback).
- If the tweet has an image but hosting fails, the launch must be blocked (not “launch anyway”).
- Social metadata should be consistently set the way you expect (at minimum: website defaults to token page/community page, twitter defaults to the source tweet URL).

## Implementation approach
### Phase 1 — Make X launches “image-first and hosted-or-blocked”
#### 1.1 Update `supabase/functions/twitter-mention-launcher/index.ts`
Changes:
- Require an explicit trigger command (support both aliases):
  - `!tunalaunch` and `!launchtuna` (case-insensitive)
- Require attached image:
  - If `mention.mediaUrls?.[0]` missing → reply with “attach an image” instructions and do not launch.
- Remove AI image generation fallback entirely (no `generateTokenImage`).
- Re-host the attached image before launching:
  - Use a dedicated “rehost” helper:
    - follow redirects (handles `t.co`)
    - verify content-type is `image/*`
    - upload bytes to storage bucket `post-images`
    - return a permanent public URL
- Pass only the hosted URL into `/api/pool/create-fun` (never `t.co`, never base64).
- Enforce socials passed into create-fun:
  - `twitterUrl` = `https://x.com/{user}/status/{tweetId}`
  - `websiteUrl` = `https://tuna.fun/t/{TICKER}` (or your canonical token/community URL pattern)

Why this fixes it:
- The token can’t be created until we have a stable hosted image URL.
- The very first metadata fetch by external indexers will see the real hosted image.

#### 1.2 Add a hard backstop in `api/pool/create-fun.ts`
Changes:
- Reject launches that don’t provide an `imageUrl` (empty/null):
  - return `400` with a clear error.
- Keep the existing base64 rejection.
- Keep socials auto-population (website + twitter) but ensure it never receives empty strings.

Why:
- Even if another path regresses, the on-chain creation endpoint becomes “cannot launch without an image.”

### Phase 2 — Add detailed logging “for every launch” (your request)
We’ll log each stage so we can answer: “tweet had an image, why didn’t it get uploaded?”

#### 2.1 Use existing tables where possible, add a minimal event log table if needed
Options:
- Minimal schema change (recommended): create a new table `x_launch_events` (or `social_launch_events`) with:
  - `platform` (twitter)
  - `post_id` (tweet id)
  - `stage` (detected | image_found | image_fetch_ok | image_upload_ok | create_token_ok | failed)
  - `details` (JSON with URLs, content-type, byte size, durations, error message)
  - `created_at`
- No schema change fallback: store detailed stage traces in:
  - `x_pending_requests` status + existing fields (but it’s not enough to store stage-by-stage),
  - and/or `agent_social_posts.error_message` (works, but is messy and harder to query).

I recommend the tiny `x_launch_events` table because it is clean, queryable, and makes /admin diagnostics straightforward.

#### 2.2 Write logs at each critical point in `twitter-mention-launcher`
Stages logged:
- tweet detected (tweet id, author, raw image URL)
- image URL classification (pbs vs t.co vs unknown)
- image fetch status (HTTP code, content-type)
- upload status (storage path, public URL)
- create-fun request/response (status code, mint, pool)
- failure (exact error + stage)

### Phase 3 — Surface the diagnostics in `/admin/agent-logs`
#### 3.1 Update `src/pages/AgentLogsAdminPage.tsx`
- Add an “X Launch Diagnostics” panel (or a tab) that shows:
  - tweet id, author, created_at
  - original image URL
  - hosted image URL (click to open)
  - stage timeline + errors
- If we add `x_launch_events`, this tab reads directly from it (latest 100-200).

Why:
- You’ll be able to see in one place whether the failure was:
  - image URL extraction (no media found)
  - fetch failing (403/timeout)
  - upload failing (bucket/permissions)
  - create-fun failing (validation)
  - metadata serving/caching issues

### Phase 4 — Tighten the “agent” pipeline to accept your alias and reduce false misses
If you’re actually using `agent-scan-*` + `agent-process-post` for some launches, we should also:
- Accept `!launchtuna` as an alias wherever `!tunalaunch` is checked (scanner + validator).
- Stop discarding `t.co` at the scan stage; let the re-hosting step follow redirects instead of skipping it.
- Improve `rehostImageIfNeeded` fetch headers (add `User-Agent`, stronger Accept, maybe retry) to reduce random CDN failures.

## Testing plan (end-to-end)
1) Post on X tagging the bot with only:
- `!LAUNCHTUNA` (or `!tunalaunch`)  
- and a single attached image
2) Confirm in backend logs:
- stage shows image fetched + uploaded
- create-fun called with hosted URL
3) Confirm token metadata endpoint:
- `token-metadata/<mint>` returns `image` as hosted URL and includes socials
4) Confirm Axiom link:
- new token shows image + links from the start (first index)

## Files expected to change
Backend:
- `supabase/functions/twitter-mention-launcher/index.ts` (strict image required + rehost + stage logging)
- `api/pool/create-fun.ts` (hard “image required” backstop)
- (Optional but recommended) database migration for `x_launch_events` table
- (Optional) `supabase/functions/agent-scan-mentions/index.ts` and `supabase/functions/agent-scan-twitter/index.ts` (alias support + pass image reliably)
- (Optional) `supabase/functions/agent-process-post/index.ts` (redirect-friendly rehost + better retries/logs)

Admin UI:
- `src/pages/AgentLogsAdminPage.tsx` (show diagnostics)

## Risks / gotchas
- Some X image URLs can return 403 without a browser-like User-Agent; we’ll mitigate with headers + retries.
- Redirect chains (t.co → pbs) must be followed and validated by content-type.
- If storage bucket permissions are misconfigured, uploads will fail; the diagnostics will make that instantly obvious.

## Outcome
- A token can no longer be launched from X unless:
  1) an image is attached
  2) the image is successfully re-hosted to permanent storage
  3) socials are populated consistently
- Every launch attempt will produce a searchable stage-by-stage trail so we can immediately identify why an upload failed.
