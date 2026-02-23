

## Make `promo-mention-reply` and `x-manual-reply` Use the Exact Same Reply Method as the Working Launcher

The `twitter-mention-launcher` posts replies successfully. The other two functions (`promo-mention-reply` and `x-manual-reply`) use different cookie handling and fetch methods. We will copy the launcher's exact `postReply` pattern into both.

### What the working launcher does (lines 958-1012)

```text
1. parseCookieString(X_FULL_COOKIE) -> raw cookie object
2. btoa(JSON.stringify(cookies))    -> base64 encode
3. Plain fetch() call               -> no timeout wrapper
4. Checks result.status === "error" -> catches 200-but-failed responses
```

### What's different in promo-mention-reply

| Aspect | Working Launcher | promo-mention-reply |
|--------|-----------------|---------------------|
| Cookie encoding | `parseCookieString` then `btoa(JSON.stringify)` | `buildLoginCookiesBase64FromEnv` (different parsing logic) |
| Fetch | Plain `fetch` | `fetchWithTimeout` with 20s timeout |
| Error detection | Checks `result.status === "error"` | Only checks `response.ok` |

### What's different in x-manual-reply

| Aspect | Working Launcher | x-manual-reply |
|--------|-----------------|----------------|
| Cookie encoding | `parseCookieString` then `btoa(JSON.stringify)` | `buildLoginCookiesBase64FromEnv` (different parsing logic) |
| Error detection | Checks `result.status === "error"` | Only checks `res.ok` |

### Changes

#### 1. `supabase/functions/promo-mention-reply/index.ts`

- **Replace `postReply` function (lines 226-278)** with the exact same pattern from the launcher:
  - Use `parseCookieString(cookie)` then `btoa(JSON.stringify(cookies))`
  - Use plain `fetch` instead of `fetchWithTimeout`
  - Add `result.status === "error"` check
  - Extract reply ID using `result.tweet_id || result.data?.id`

#### 2. `supabase/functions/x-manual-reply/index.ts`

- **Replace the cookie handling and fetch call (lines 113-145)** with the launcher's pattern:
  - Use `parseCookieString` then `btoa(JSON.stringify)` instead of `buildLoginCookiesBase64FromEnv`
  - Add `result.status === "error"` check after the fetch

#### 3. Both files: Remove unused code

- Remove `buildLoginCookiesBase64FromEnv` function from both files since it's no longer needed
- Remove `fetchWithTimeout` function from `promo-mention-reply` (only used for the reply call; the AI call can keep it or also switch to plain fetch)

All three reply functions will then use the identical authentication and posting logic that is proven to work in the launcher.
