

# Fix Community Join Using V2 Endpoint with Full Cookie

## Problem

The current code uses the wrong endpoint and parameter name:
- **Wrong endpoint**: `/twitter/community/join` (returns 404)
- **Correct endpoint**: `/twitter/join_community_v2`
- **Wrong param**: `login_cookies` (plural)
- **Correct param**: `login_cookie` (singular)

## Changes to Make

### File: `supabase/functions/test-community/index.ts`

**Change 1: Fix Join endpoint URL (line 70)**
```typescript
// Before
const response = await fetch(`${TWITTERAPI_BASE}/twitter/community/join`, {

// After  
const response = await fetch(`${TWITTERAPI_BASE}/twitter/join_community_v2`, {
```

**Change 2: Fix parameter name for Join (line 77)**
```typescript
// Before
body: JSON.stringify({
  login_cookies: loginCookies,  // plural - WRONG
  community_id: COMMUNITY_ID,
  proxy: proxyUrl,
}),

// After
body: JSON.stringify({
  login_cookie: loginCookies,   // singular - CORRECT for V2
  community_id: COMMUNITY_ID,
  proxy: proxyUrl,
}),
```

**Change 3: Add V2 login action for fresh cookie (optional fallback)**

Add a new action block that can obtain a fresh login cookie using account credentials if the existing cookie fails:

```typescript
// ===== ACTION: V2 Login (get fresh login cookie) =====
if (action === "login") {
  const username = Deno.env.get("X_ACCOUNT_USERNAME");
  const email = Deno.env.get("X_ACCOUNT_EMAIL");
  const password = Deno.env.get("X_ACCOUNT_PASSWORD");
  const totpSecret = Deno.env.get("X_TOTP_SECRET");
  
  console.log(`[test-community] Performing V2 login for ${username}...`);
  
  const response = await fetch(`${TWITTERAPI_BASE}/twitter/user_login_v2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      user_name: username,
      email: email,
      password: password,
      proxy: proxyUrl,
      totp_secret: totpSecret,
    }),
  });

  const responseText = await response.text();
  console.log(`[test-community] Login response: ${response.status}`);
  
  results.status = response.status;
  results.response = JSON.parse(responseText);
  // Response contains login_cookie that can be stored/used
}
```

## Testing After Deploy

1. **Join the community**:
   ```
   POST /test-community
   Body: {"action": "join"}
   ```

2. **Post to community** (after joined):
   ```
   POST /test-community  
   Body: {"action": "post", "text": "Hello from TUNA!"}
   ```

3. **Fallback - V2 login** (if cookie expired):
   ```
   POST /test-community
   Body: {"action": "login"}
   ```

## Summary

| Line | Current | Fixed |
|------|---------|-------|
| 70 | `/twitter/community/join` | `/twitter/join_community_v2` |
| 77 | `login_cookies` (plural) | `login_cookie` (singular) |
| New | - | Add `login` action for fresh V2 cookie |

The full cookie from `X_FULL_COOKIE` is already being parsed and base64 encoded correctly - only the endpoint and parameter name need fixing.

