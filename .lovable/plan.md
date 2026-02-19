
## Update X_BEARER_TOKEN for @clawmode

### What This Does

Updates the `X_BEARER_TOKEN` secret with the new Bearer Token from the `@clawmode` X Developer App. This is used exclusively for **reading** — searching for `!clawmode` mentions and tweets via the Official X API (`GET /2/tweets/search/recent`).

### The Value to Set

```
AAAAAAAAAAAAAAAAAAAAAE%2Fd7gEAAAAAYEC8pc69sLkuR%2B1Jn7L0kCe1Q48%3DecSX94x9wF2GjBZYuXstrH3aCoQJHPVrJ75Q9D1gXZTbclsAYu
```

Note: This appears to be URL-encoded. The decoded form is:
```
AAAAAAAAAAAAAAAAAAAAAFd7gEAAAAAYEC8pc69sLkuR+1Jn7L0kCe1Q48=ecSX94x9wF2GjBZYuXstrH3aCoQJHPVrJ75Q9D1gXZTbclsAYu
```

The X API Bearer Token is typically sent as-is (URL-encoded form is fine — the HTTP client handles decoding automatically), so we store it exactly as provided.

### Steps

1. Update `X_BEARER_TOKEN` secret with the value provided above
2. No code changes required — the scanner already uses `X_BEARER_TOKEN` for the official read path
3. Next step after this: provide the `X_FULL_COOKIE` string from the `@clawmode` browser session so posting replies via twitterapi.io works correctly

### What Happens After

The `agent-scan-twitter` function reads the `X_BEARER_TOKEN` on every invocation. No redeployment is needed — secrets are injected at runtime. The next scan cycle will automatically use the new `@clawmode` Bearer Token for searching `!clawmode` mentions.

### Still Needed After This

- `X_FULL_COOKIE` — full cookie string from `@clawmode` browser session (for posting replies via twitterapi.io)
