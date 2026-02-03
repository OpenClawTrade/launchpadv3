
# Investigation: Walletless Token Launch Claim Flow

## Summary

I investigated whether tokens launched from X (Twitter) without a wallet address show up in the claim page. **I found a bug that causes some walletless tokens to be skipped.**

## Current Data Status

Looking at your database, I found:

| Token | Twitter User | `creator_wallet` | `agent.style_source_username` | Claimable? |
|-------|-------------|-----------------|-------------------------------|------------|
| My Token | HASAN90099009 | NULL | NULL | ❌ No |
| fire 🔥 | HASAN90099009 | NULL | NULL | ❌ No |
| TESTUNA | Sergej94p | NULL | NULL | ❌ No |
| CrabClaws | stillwrkngonit | NULL | `stillwrkngonit` | ✅ Yes |

Most recent walletless launches have agents with `style_source_username = NULL`, meaning they won't appear in the claim page.

---

## The Bug

### Location: `agent-find-by-twitter/index.ts` (lines 260-261)

```typescript
const wallet = post.wallet_address || token.creator_wallet;
if (!wallet) continue;  // ⚠️ BUG: Skips walletless tokens!
```

When both `wallet_address` and `creator_wallet` are NULL, Strategy 2 (social posts lookup) **skips the token entirely** instead of grouping it by Twitter username.

### Why This Happens

1. User tweets `!tunalaunch` without a wallet address
2. System creates agent with placeholder wallet: `TUNA_NO_WALLET_abc123`
3. Agent's `style_source_username` should be set to Twitter username (sometimes NULL due to timing)
4. Strategy 1 looks for agents by `style_source_username` → may not find if NULL
5. Strategy 2 finds the `agent_social_posts` record → but skips it because no wallet

---

## The Fix

Update `agent-find-by-twitter` to:
1. Remove the `if (!wallet) continue` skip logic
2. Group walletless tokens by `post_author` (Twitter username) instead of wallet
3. Create claimable entries based on username match

### Code Change

```text
// Instead of skipping when no wallet:
const wallet = post.wallet_address || token.creator_wallet;

// Group by username when walletless
if (!wallet) {
  // Use post_author as the grouping key for walletless tokens
  const username = post.post_author?.toLowerCase();
  if (username === normalizedUsername) {
    // Add to username-based group for claiming
  }
  continue;
}
```

---

## Technical Details

### Current Flow (Broken for some tokens)

```text
User tweets !tunalaunch (no wallet)
         │
         ▼
┌─────────────────────────────────────┐
│ agent-process-post                  │
│ Creates agent with placeholder      │
│ wallet: TUNA_NO_WALLET_xxx          │
│ Sets style_source_username          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ agent_social_posts table            │
│ - post_author: "username"           │
│ - wallet_address: NULL              │
│ - fun_token_id: <uuid>              │
└──────────────┬──────────────────────┘
               │
    User visits /agents/claim
               │
               ▼
┌─────────────────────────────────────┐
│ agent-find-by-twitter               │
│ Strategy 1: agents.style_source_    │
│   username → may be NULL ❌         │
│ Strategy 2: social_posts →          │
│   skips if no wallet ❌             │
└─────────────────────────────────────┘
               │
               ▼
      Token NOT found in claim page
```

### Fixed Flow

```text
User tweets !tunalaunch (no wallet)
         │
         ▼
┌─────────────────────────────────────┐
│ agent-find-by-twitter               │
│ Strategy 1: agents by username ✅   │
│ Strategy 2: social_posts by         │
│   post_author (walletless OK) ✅    │
│ Strategy 3: Group by username       │
│   when no wallet present ✅         │
└─────────────────────────────────────┘
               │
               ▼
      Token appears in claim page ✅
```

---

## Files to Modify

1. **`supabase/functions/agent-find-by-twitter/index.ts`**
   - Add Strategy 3: Group walletless tokens by `post_author`
   - Remove the `if (!wallet) continue` skip logic
   - Create pseudo-agents for username-based token groups

2. **Optional Enhancement: `supabase/functions/agent-process-post/index.ts`**
   - Ensure `style_source_username` is always set on agent creation
   - Could also store `post_author` in a more accessible way

---

## Summary

The walletless launch flow is **mostly working**, but there's a bug where Strategy 2 in `agent-find-by-twitter` skips tokens when both `wallet_address` and `creator_wallet` are NULL. The fix is to group these tokens by the Twitter username (`post_author`) instead of requiring a wallet address.
