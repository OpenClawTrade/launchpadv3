
# Fix: Prevent SubTuna Communities for Non-Agent Tokens

## Problem Summary

Tokens launched via the standard UI (like WARP) are incorrectly showing SubTuna community pages even though:
1. They have no `agent_id`
2. No actual `subtuna` record exists in the database

**Root Causes:**

| Issue | Location | Impact |
|-------|----------|--------|
| Virtual community fallback | `useSubTuna.ts` lines 125-144 | Any token ticker renders as a "community" |
| Auto-populated website URL | `create-fun.ts`, `fun-create/index.ts` | On-chain metadata points to `/t/:ticker` for all tokens |

---

## Solution

### Phase 1: Frontend – Stop Rendering Virtual Communities

**File: `src/hooks/useSubTuna.ts`**

Change the fallback logic to return `null` instead of a virtual object when no real `subtuna` record exists. This will cause `SubTunaPage` to show "Community Not Found" and guide users to the correct trade page.

**Current behavior (lines 125-144):**
```typescript
if (error || !subtuna) {
  // Returns a fake community object from token data
  return {
    id: "",
    name: `t/${funToken.ticker}`,
    memberCount: 0,
    postCount: 0,
    ...
  };
}
```

**New behavior:**
```typescript
if (error || !subtuna) {
  // No real SubTuna community exists - return null
  // This makes SubTunaPage show "Community Not Found"
  return null;
}
```

---

### Phase 2: Frontend – Better "Not Found" UX

**File: `src/pages/SubTunaPage.tsx`**

Enhance the "Community Not Found" section to provide a helpful redirect:

```typescript
if (!subtuna) {
  // Check if a token exists for this ticker
  const { data: token } = await supabase
    .from("fun_tokens")
    .select("mint_address")
    .ilike("ticker", ticker)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // If token exists, show a link to the trade page instead
  return (
    <div>
      <h2>No Community Yet</h2>
      <p>This token doesn't have an AI-powered community.</p>
      {token?.mint_address && (
        <Link to={`/launchpad/${token.mint_address}`}>
          <Button>Trade ${ticker} instead</Button>
        </Link>
      )}
    </div>
  );
}
```

---

### Phase 3: Backend – Conditional Website URL

Stop auto-populating the SubTuna URL for non-agent token launches.

**Files to update:**

| File | Change |
|------|--------|
| `api/pool/create-fun.ts` | Only use SubTuna URL if `agentId` is provided |
| `supabase/functions/fun-create/index.ts` | Same conditional logic |
| `supabase/functions/api-launch-token/index.ts` | Same conditional logic |

**Example fix for `fun-create/index.ts`:**
```typescript
// Only use SubTuna URL for agent launches
const finalWebsiteUrl = websiteUrl 
  || (agentId ? `https://tuna.fun/t/${ticker.toUpperCase()}` : undefined);
const finalTwitterUrl = twitterUrl || 'https://x.com/BuildTuna';
```

This ensures:
- Agent-launched tokens get the community URL in metadata
- Standard UI launches do NOT get auto-populated community URLs

---

### Phase 4: Navigation – Enforce Agent-Only SubTuna Links

The current navigation logic in `TokenCard`, `TokenTable`, `KingOfTheHill`, and `JustLaunched` is **correct**—it only links to `/t/:ticker` when `agent_id` exists or `launchpad_type === 'pumpfun'`. No changes needed here.

However, we should verify there are no other entry points creating SubTuna links for non-agent tokens.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/hooks/useSubTuna.ts` | Return `null` instead of virtual community when no `subtuna` record exists |
| `src/pages/SubTunaPage.tsx` | Improve "Not Found" UX with redirect to trade page |
| `api/pool/create-fun.ts` | Only auto-populate SubTuna URL when `agentId` is present |
| `supabase/functions/fun-create/index.ts` | Same conditional logic |
| `supabase/functions/api-launch-token/index.ts` | Same conditional logic |

---

## Expected Outcome

- Navigating to `/t/WARP` shows "No Community Yet" with a "Trade $WARP" button
- New non-agent tokens won't have `/t/:ticker` in their on-chain metadata
- Agent-launched tokens continue to work as expected with real communities
- Clear separation between AI-powered communities and standard token listings
