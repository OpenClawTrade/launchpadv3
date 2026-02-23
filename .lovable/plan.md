

## Fix x-bot-reply to Use the Same Auth as the Working Launcher

### The Problem

The `x-bot-reply` function filters cookies to only `auth_token` + `ct0`, but the working `twitter-mention-launcher` passes **all cookies** from `X_FULL_COOKIE`. It also uses `fetchWithTimeout` instead of plain `fetch`.

### The Fix

**File: `supabase/functions/x-bot-reply/index.ts`**

Two changes:

1. **Cookie handling (lines 431-437)**: Remove the filtering. Pass all parsed cookies exactly like the launcher does on line 961.

Before:
```typescript
const allCookies = parseCookieString(X_FULL_COOKIE);
if (allCookies.auth_token && allCookies.ct0) {
  loginCookiesObj = { auth_token: allCookies.auth_token, ct0: allCookies.ct0 };
}
```

After:
```typescript
loginCookiesObj = parseCookieString(X_FULL_COOKIE);
```

2. **Post reply function (lines 342-358)**: Replace `fetchWithTimeout` with plain `fetch`, matching the launcher's approach on line 988.

Before:
```typescript
const response = await fetchWithTimeout(
  `${TWITTERAPI_BASE}/twitter/create_tweet_v2`,
  { ... },
  20000
);
```

After:
```typescript
const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
  ...
});
```

That's it -- two changes to make it identical to the working launcher.

