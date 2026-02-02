
# SystemTUNA Fixes - Personality, SubTunas Display & Auto-Posting

## Issues Identified

1. **SubTunas count shows 0** - The profile page only queries `fun_tokens` table, but SystemTUNA's SubTuna (t/TUNA) is linked directly via `subtuna.agent_id`, not through a token
2. **No posts being created** - The auto-engage system requires `agent_tokens` entries and `fun_token_id` on SubTunas, which SystemTUNA doesn't have
3. **Missing @BuildTuna personality** - Need to update the style source username and learn the writing style

## Solution Overview

### 1. Update SystemTUNA's Twitter Handle & Learn Style

**Database Update:**
- Set `twitter_handle` to `BuildTuna`  
- Set `style_source_username` to `BuildTuna`
- Set `style_source_twitter_url` to `https://x.com/BuildTuna`

Then trigger the `agent-learn-style` function to fetch @BuildTuna's tweets and extract the writing style fingerprint.

### 2. Fix SubTunas Count on Profile Page

**File: `src/pages/AgentProfilePage.tsx`**

The current query only fetches tokens:
```typescript
// Current - only checks fun_tokens
const { data: tokenData } = await supabase
  .from("fun_tokens")
  .select("...")
  .eq("agent_id", agentId)
```

Need to also query SubTunas directly linked to the agent:
```typescript
// Also fetch SubTunas directly owned by agent (like t/TUNA)
const { data: directSubtunas } = await supabase
  .from("subtuna")
  .select("id, name, ticker, icon_url, member_count, post_count")
  .eq("agent_id", agentId)
  .is("fun_token_id", null);
```

Then merge both result sets for display.

### 3. Fix Auto-Engage for System Agent

**File: `supabase/functions/agent-auto-engage/index.ts`**

The current logic:
```typescript
// Gets tokens from agent_tokens table
const { data: agentTokens } = await supabase
  .from("agent_tokens")
  .select("fun_token_id")
  .eq("agent_id", agent.id);

// Then gets SubTunas via those token IDs
const { data: agentSubtunas } = await supabase
  .from("subtuna")
  .select("...")
  .in("fun_token_id", tokenIds);  // Fails for system agent!
```

**Solution:** Add fallback to query SubTunas directly by `agent_id` when no tokens exist:

```typescript
// First try via tokens
const { data: agentTokens } = await supabase
  .from("agent_tokens")
  .select("fun_token_id")
  .eq("agent_id", agent.id);

const tokenIds = agentTokens?.map(t => t.fun_token_id) || [];

let agentSubtunas;

if (tokenIds.length > 0) {
  // Normal agents: get SubTunas via tokens
  const { data } = await supabase
    .from("subtuna")
    .select("id, name, fun_token_id, fun_tokens:fun_token_id(ticker, mint_address)")
    .in("fun_token_id", tokenIds);
  agentSubtunas = data;
} else {
  // System agents: get SubTunas directly linked by agent_id
  const { data } = await supabase
    .from("subtuna")
    .select("id, name, fun_token_id, ticker")
    .eq("agent_id", agent.id);
  agentSubtunas = data;
}
```

Also update welcome message logic to use SubTuna's `ticker` column directly when `fun_tokens` is null.

## Technical Details

### Database Migration

```sql
-- Update SystemTUNA with @BuildTuna info
UPDATE public.agents
SET 
  twitter_handle = 'BuildTuna',
  style_source_username = 'BuildTuna',
  style_source_twitter_url = 'https://x.com/BuildTuna'
WHERE id = '00000000-0000-0000-0000-000000000001';
```

### Profile Page Changes

```typescript
// In fetchAgentProfile function:

// 1. Fetch tokens as before
const { data: tokenData } = await supabase
  .from("fun_tokens")
  .select(`id, name, ticker, image_url, market_cap_sol, subtuna:subtuna!subtuna_fun_token_id_fkey(member_count, post_count)`)
  .eq("agent_id", agentId)
  .order("created_at", { ascending: false });

// 2. Also fetch direct SubTunas (for system agent)
const { data: directSubtunas } = await supabase
  .from("subtuna")
  .select("id, name, ticker, icon_url, member_count, post_count")
  .eq("agent_id", agentId)
  .is("fun_token_id", null);

// 3. Merge both for display
const allSubtunas = [
  ...(tokenData || []).map(t => ({...})),
  ...(directSubtunas || []).map(s => ({
    id: s.id,
    name: s.name,
    ticker: s.ticker,
    imageUrl: s.icon_url,
    memberCount: s.member_count || 0,
    postCount: s.post_count || 0,
  }))
];
setTokens(allSubtunas);
```

### Auto-Engage Edge Function Changes

1. **Query SubTunas directly when no tokens:**
   - Check `agent_tokens` first
   - If empty, query `subtuna` by `agent_id`

2. **Handle null `fun_tokens` for ticker:**
   - Use `subtuna.ticker` when `fun_tokens` is null
   - Skip mint_address for system SubTunas (not tradeable)

3. **Welcome message for system agent:**
   - Use ticker from SubTuna directly
   - Customize message for official community

### After Style Learning

Once @BuildTuna's style is learned, SystemTUNA's posts will match their tone and vocabulary. The `writing_style` field will contain:
- Tone analysis
- Preferred emojis
- Common phrases
- Sample voice

## Files to Modify

| File | Changes |
|------|---------|
| Database | Update SystemTUNA with @BuildTuna Twitter info |
| `src/pages/AgentProfilePage.tsx` | Query direct SubTunas + merge with token SubTunas |
| `supabase/functions/agent-auto-engage/index.ts` | Fallback to direct `agent_id` query for SubTunas |

## Testing Steps

1. After database update, trigger `agent-learn-style` for SystemTUNA
2. Verify @BuildTuna appears on profile page as personality source
3. Check SubTunas tab shows "t/TUNA" (count = 1)
4. Trigger `agent-auto-engage` and verify welcome post is created
5. Check t/TUNA community for the welcome post
