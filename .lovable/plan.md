

# Add 5000+ Follower Minimum Filter for Auto-Replies

## Background

### Community Post Status
The test post to TUNALISHOUS community failed with **Error 440** (User is not authorized). I attempted to join the community first, but the `community/join` endpoint returned **404 Not Found** - this endpoint does not exist in twitterapi.io.

**Conclusion**: twitterapi.io only supports READ operations for communities (info, tweets, members, moderators). Write operations (join, post) are not supported. This is an API limitation that cannot be worked around.

### Current Auto-Reply Filtering
The current code in `promo-mention-scan/index.ts`:
1. Skips replies and retweets
2. Requires verification badge (blue/gold/business/government)  
3. Only checks followers (1000+) for `$SOL-only` mentions
4. Skips bot usernames

**Problem**: Verified accounts with very low followers (12, 16, 38, 71) are being queued for replies. These represent low-quality engagement.

---

## Implementation Plan

### File to Modify
`supabase/functions/promo-mention-scan/index.ts`

### Changes

**Add constant at top of file (around line 15)**
```typescript
const MIN_FOLLOWER_COUNT = 5000; // Minimum followers for quality engagement
```

**Modify filter logic (lines 189-202)**

Current code:
```typescript
// Skip unverified
if (!hasVerificationBadge(tweet)) {
  debug.skipped++;
  continue;
}

// For $SOL-only mentions, require 1000+ followers
if (isOnlySolCashtagMention(tweet.text)) {
  const followers = getFollowerCount(tweet);
  if (followers < 1000) {
    debug.skipped++;
    continue;
  }
}
```

New code:
```typescript
// Skip unverified
if (!hasVerificationBadge(tweet)) {
  debug.skipped++;
  continue;
}

// Require minimum 5000 followers for quality engagement
const followers = getFollowerCount(tweet);
if (followers < MIN_FOLLOWER_COUNT) {
  debug.skipped++;
  continue;
}
```

---

## Impact Analysis

### Accounts Currently Queued That Would Be Filtered

| Account | Followers | Status After Change |
|---------|-----------|---------------------|
| @reelclaw | 71 | Filtered out |
| @runtimeking | 16 | Filtered out |
| @jackiechen1009 | 12 | Filtered out |
| @George123255 | 38 | Filtered out |
| @jrwhale | 2,222 | Filtered out |
| @ankushKun_ | 1,928 | Filtered out |
| @tewglocks | 3,048 | Filtered out |

### Accounts That Would Still Qualify

| Account | Followers | Status |
|---------|-----------|--------|
| @vincent_koc | 11,070 | Quality engagement |
| @Mortezabihzadeh | 12,573 | Quality engagement |
| @SandiH_eth | 144,186 | Quality engagement |
| @Definews_Info | 70,570 | Quality engagement |
| @chaxbtbg | 33,353 | Quality engagement |

---

## Execution Steps

1. Edit `supabase/functions/promo-mention-scan/index.ts`
2. Add `MIN_FOLLOWER_COUNT = 5000` constant
3. Replace conditional `$SOL-only` check with global follower check
4. Deploy edge function automatically

---

## Community Posting Alternative

Since twitterapi.io cannot join or post to communities, alternatives would be:
1. **Manual posting** - Log into the X account manually and join the community, then post
2. **Different API** - Use official Twitter API v2 with OAuth 2.0 (requires Twitter API access approval for community features)
3. **Browser automation** - Use Puppeteer/Playwright (complex, against ToS)

For now, community posting remains a manual operation.

