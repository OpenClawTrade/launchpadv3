

# Plan: Update Agent Docs & Fix Remaining Old Login Pattern

## Overview

Update the Agent Documentation page to reflect current system capabilities and fix the remaining edge function (`twitter-auto-reply`) that still uses the old login pattern.

---

## Part 1: Documentation Updates

### Files to Modify: `src/pages/AgentDocsPage.tsx` & `public/skill.md`

### 1.1 Update Version Badge
- Change `v3.0.0` → `v3.1.0` to reflect recent walletless launch and feedback improvements

### 1.2 Walletless Launch Clarification (AgentDocsPage.tsx)

**Current** (line ~422):
```
<li>• <strong>wallet</strong> — Payout wallet</li>
```

**Update to**:
```
<li>• <strong>wallet</strong> — Payout wallet (optional - claim via X OAuth later)</li>
```

Add a callout in the X launch section explaining:
> **No wallet required!** Launch your token without including a wallet address. Verify ownership later at `/agents/claim` by logging in with the same X account.

### 1.3 Add "Missing Fields Feedback" Feature

In the "How it works" section, add:
> If your `!tunalaunch` is missing required fields (name, symbol, or image), our bot will reply with specific instructions on what to add.

### 1.4 Update Claim Flow Documentation (line ~674-689)

Add explanation that claim matching works by X username:
> When you launch via X, your Twitter handle is recorded. At claim time, simply login with X OAuth - we automatically match tokens to your username.

### 1.5 Update skill.md 

Update the Twitter launch section to note:
- `wallet` field is optional (claim via OAuth)
- Bot provides helpful feedback for incomplete launch requests

---

## Part 2: Fix `twitter-auto-reply` Old Login Pattern

### File: `supabase/functions/twitter-auto-reply/index.ts`

**Status**: This cron is currently **disabled**, but should be fixed for when it's re-enabled.

### Current Problem (lines 254-377)
```typescript
// Current: Uses dynamic login every run
const loginBody = { user_name, email, password, proxy, totp_code };
await fetch(`${TWITTERAPI_BASE}/twitter/user_login_v2`, ...);
```

### Fix Approach

Add static session support (same pattern as `agent-scan-twitter`):

```typescript
// 1. Add cookie parsing helpers at top
function parseCookieString(raw: string): Record<string, string> { ... }
function buildLoginCookiesBase64FromEnv(args) { ... }

// 2. Check for static session first
const X_FULL_COOKIE = Deno.env.get("X_FULL_COOKIE");
const X_AUTH_TOKEN = Deno.env.get("X_AUTH_TOKEN");
const X_CT0_TOKEN = Deno.env.get("X_CT0_TOKEN");

const staticCookies = buildLoginCookiesBase64FromEnv({
  xFullCookie: X_FULL_COOKIE,
  xAuthToken: X_AUTH_TOKEN,
  xCt0Token: X_CT0_TOKEN,
});

let loginCookies: string;
if (staticCookies) {
  // Use pre-authenticated session (NO LOGIN TRIGGERED)
  loginCookies = staticCookies;
  console.log("[twitter-auto-reply] ✅ Using static session cookies");
} else {
  // Fallback to dynamic login (original behavior)
  // ... existing login code ...
}
```

### Benefits
- No more "suspicious login" alerts when cron runs
- Session stays active without re-authentication
- Matches the pattern now used in `agent-scan-twitter` and `twitter-mention-launcher`

---

## Part 3: Clean Up Test Functions (Optional)

### Files: `test-twitter-reply/index.ts`

This test function still has the old `getLoginCookies()` dynamic login as one of its test methods (M1, M3, M5). Since it's a test function that intentionally tests multiple approaches, it can remain as-is or be updated to prioritize static session testing.

**Recommendation**: Leave as-is since it's a diagnostic tool.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/pages/AgentDocsPage.tsx` | Version bump, walletless emphasis, feedback feature, claim flow clarity |
| `public/skill.md` | Add wallet optional note, feedback feature mention |
| `supabase/functions/twitter-auto-reply/index.ts` | Add static session support to prevent unnecessary logins |

## Technical Notes

### Static Session Flow
```text
┌─────────────────────────────────────┐
│ Edge Function Starts                │
├─────────────────────────────────────┤
│ Check: X_FULL_COOKIE exists?        │
│   Yes → Parse to base64, use it     │
│   No  → Check X_AUTH_TOKEN + X_CT0  │
│         → Build cookies, use them   │
│         → If neither: fallback to   │
│           dynamic login (last resort)│
└─────────────────────────────────────┘
```

### Environment Variables Used
- `X_FULL_COOKIE` — Complete browser cookie string (preferred)
- `X_AUTH_TOKEN` — Individual auth_token value
- `X_CT0_TOKEN` — Individual ct0 CSRF token
- `TWITTER_PROXY` — Required for twitterapi.io

