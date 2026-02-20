

# Show X Creator Info on Token Detail Page

## Problem
Token pages (`/launchpad/:mintAddress`) show "by Unknown" instead of the X (Twitter) username of whoever launched the coin. We need to show:
- X username (linked to their profile, opens in new tab)
- Link to the original launch post/tweet
- Profile image fetched via Twitter API
- Blue checkmark (verified badge) if the user has one

## Data Flow

The `agent_social_posts` table already stores `post_author` (X username) and `post_url` (link to the launch tweet) for every token launch. We just need to:
1. Fetch this data alongside the token
2. Create a backend function to look up X profile image + verified status via the Twitter API (using the existing `X_BEARER_TOKEN` secret)
3. Display it all in the UI

---

## Technical Changes

### 1. New Edge Function: `twitter-user-info`
**File:** `supabase/functions/twitter-user-info/index.ts`

A simple lookup endpoint that takes a Twitter username and returns profile image URL and verified status using the official Twitter API v2 (`GET https://api.x.com/2/users/by/username/:username?user.fields=profile_image_url,verified,verified_type`).

- Uses the existing `X_BEARER_TOKEN` secret
- Caches results in a new `twitter_profile_cache` table (to avoid hitting rate limits on repeat page loads)
- Cache TTL: 24 hours
- Returns: `{ username, profileImageUrl, verified, verifiedType }`

### 2. Database: `twitter_profile_cache` table
Simple cache table with columns:
- `username` (text, primary key)
- `profile_image_url` (text)
- `verified` (boolean)
- `verified_type` (text, nullable -- "blue", "business", "government")
- `updated_at` (timestamp)

No RLS needed -- accessed only from edge function via service role.

### 3. Update `useFunToken` hook
**File:** `src/hooks/useFunToken.ts`

After fetching the token, also query `agent_social_posts` to get the `post_author` and `post_url` for that token:

```
const { data: socialPost } = await supabase
  .from('agent_social_posts')
  .select('post_author, post_url')
  .eq('fun_token_id', token.id)
  .eq('status', 'completed')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

Return these as part of the token data (`launchAuthor`, `launchPostUrl`).

### 4. New hook: `useTwitterProfile`
**File:** `src/hooks/useTwitterProfile.ts`

A small React Query hook that calls the `twitter-user-info` edge function for a given username. Returns `{ profileImageUrl, verified, verifiedType, isLoading }`.

- Only fires when username is provided
- Stale time: 5 minutes (leverages backend cache)

### 5. Update Token Detail Page
**File:** `src/pages/FunTokenDetailPage.tsx`

Replace the "by Unknown" / "by {wallet}" section (lines 295-301) with a richer creator display:

- If `launchAuthor` exists (X username):
  - Show profile image (from `useTwitterProfile`) as a small avatar
  - Show `@username` as a link to `https://x.com/{username}` (target="_blank")
  - Show blue checkmark icon next to name if verified
  - Show "View Post" link to `launchPostUrl` (target="_blank")
- If no `launchAuthor` but `creator_wallet` exists:
  - Show truncated wallet as before
- Fallback: "Unknown"

## Files Summary

| Action | File |
|--------|------|
| Create | `supabase/functions/twitter-user-info/index.ts` |
| Create | `src/hooks/useTwitterProfile.ts` |
| Modify | `src/hooks/useFunToken.ts` -- add social post join |
| Modify | `src/pages/FunTokenDetailPage.tsx` -- creator display |
| Migration | Create `twitter_profile_cache` table |

