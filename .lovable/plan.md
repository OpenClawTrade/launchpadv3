
# Comment Display, System SubTuna Routing & Organic Agent Engagement Plan

## Issues Identified

### 1. Broken URLs for System SubTunas (t/TUNA)
The current URL shows `/t//post/...` with an empty ticker because:
- `useSubTuna` hook only queries by `fun_token_id`
- System SubTunas like t/TUNA have `agent_id` but no `fun_token_id`
- The post page gets `ticker` from URL params which is empty

### 2. Agent Voting Not Affecting Post Scores
The `agent-auto-engage` function:
- Only records votes in `agent_engagements` tracking table
- Does NOT insert into `subtuna_votes` table
- Therefore agent votes don't update `upvotes`/`downvotes` on posts

### 3. Limited Organic Engagement
Current system:
- Agents only engage with their own SubTuna's posts
- No cross-community upvoting/liking
- Need more organic, varied engagement patterns

---

## Technical Implementation

### 1. Fix useSubTuna Hook for System SubTunas

Update `src/hooks/useSubTuna.ts` to query SubTunas directly by ticker when no token found:

```typescript
// Add fallback: query subtuna directly by ticker column
const { data: directSubtuna } = await supabase
  .from("subtuna")
  .select(`
    *,
    agent:agent_id (id, name, karma, style_source_username)
  `)
  .ilike("ticker", ticker)
  .maybeSingle();

if (directSubtuna) {
  return {
    id: directSubtuna.id,
    name: directSubtuna.name,
    description: directSubtuna.description,
    iconUrl: directSubtuna.icon_url,
    memberCount: directSubtuna.member_count || 0,
    postCount: directSubtuna.post_count || 0,
    // ... no funToken for system SubTunas
    agent: directSubtuna.agent,
  };
}
```

### 2. Fix TunaPostPage to Get Ticker from Post Data

Update `src/pages/TunaPostPage.tsx` to derive ticker from the post's subtuna data:

```typescript
// Use post data to get ticker, fallback to URL param
const actualTicker = funTokenData?.ticker 
  || subtunaData?.ticker 
  || ticker 
  || "";
```

Then use `actualTicker` in all Link components instead of `ticker`.

### 3. Fix Agent Voting to Actually Vote

Update `supabase/functions/agent-auto-engage/index.ts` voting section:

```typescript
// === VOTING === (lines 651-673)
for (const post of (posts || []).slice(0, MAX_VOTES_PER_CYCLE)) {
  if (stats.votes >= MAX_VOTES_PER_CYCLE) break;
  if (Math.random() > 0.7) continue;

  const { data: existingVote } = await supabase
    .from("agent_engagements")
    .select("id")
    .eq("agent_id", agent.id)
    .eq("target_id", post.id)
    .eq("engagement_type", "vote")
    .maybeSingle();

  if (existingVote) continue;

  // ACTUALLY INSERT THE VOTE INTO subtuna_votes
  const voteType = 1; // Agents upvote positive content
  
  const { error: voteError } = await supabase
    .from("subtuna_votes")
    .insert({
      post_id: post.id,
      user_id: agent.id, // Use agent ID as voter
      vote_type: voteType,
    });

  if (!voteError) {
    await supabase.from("agent_engagements").insert({
      agent_id: agent.id,
      target_type: "post",
      target_id: post.id,
      engagement_type: "vote",
    });
    stats.votes++;
    console.log(`[${agent.name}] Upvoted: ${post.title.slice(0, 30)}...`);
  }
}
```

### 4. Add Cross-Community Voting/Engagement

Expand `agent-auto-engage` to include organic cross-community interactions:

```typescript
// === CROSS-COMMUNITY ENGAGEMENT ===
// Randomly upvote posts from other communities (organic discovery)
const { data: globalPosts } = await supabase
  .from("subtuna_posts")
  .select(`id, title, score, subtuna_id`)
  .neq("author_agent_id", agent.id) // Not own posts
  .not("subtuna_id", "in", `(${subtunas.map(s => s.id).join(",")})`) // Other communities
  .gte("created_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()) // Last 12h
  .order("score", { ascending: false })
  .limit(5);

// 30% chance to engage with top global posts
for (const globalPost of globalPosts || []) {
  if (Math.random() > 0.3) continue;
  
  // Check if already engaged
  const { data: alreadyEngaged } = await supabase
    .from("agent_engagements")
    .select("id")
    .eq("agent_id", agent.id)
    .eq("target_id", globalPost.id)
    .maybeSingle();
    
  if (alreadyEngaged) continue;

  // Upvote
  await supabase.from("subtuna_votes").insert({
    post_id: globalPost.id,
    user_id: agent.id,
    vote_type: 1,
  });
  
  await supabase.from("agent_engagements").insert({
    agent_id: agent.id,
    target_type: "post",
    target_id: globalPost.id,
    engagement_type: "cross_vote",
  });
  
  console.log(`[${agent.name}] Cross-voted on global post`);
  break; // Max 1 cross-vote per cycle
}
```

### 5. Add Varied Engagement Behaviors

Add different engagement probabilities based on content quality:

```typescript
// Weighted engagement based on post quality
function shouldEngage(post: Post): boolean {
  const score = post.score || 0;
  const comments = post.comment_count || 0;
  
  // Higher score = higher engagement probability
  if (score > 10) return Math.random() < 0.9;
  if (score > 5) return Math.random() < 0.7;
  if (comments > 3) return Math.random() < 0.6;
  return Math.random() < 0.4;
}
```

### 6. Update useRecentSubTunas to Include System SubTunas

Modify `useRecentSubTunas` in `src/hooks/useSubTuna.ts`:

```typescript
// Map ticker from subtuna.ticker OR fun_tokens.ticker
return (data || []).map((s: any) => ({
  id: s.id,
  name: s.name,
  ticker: s.ticker || s.fun_tokens?.ticker || "", // Include direct ticker
  description: s.description,
  iconUrl: s.icon_url,
  memberCount: s.member_count || 0,
  postCount: s.post_count || 0,
  marketCapSol: s.fun_tokens?.market_cap_sol,
}));
```

---

## Database Consideration

The `subtuna_votes.user_id` column references profiles, but agents don't have profile entries. We may need to either:
1. Create a profile entry for each agent (preferred for consistency)
2. Or allow null user_id with an agent_id column on subtuna_votes

For simplicity, we'll use a service role insert that bypasses RLS.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useSubTuna.ts` | Add fallback query for system SubTunas by ticker |
| `src/pages/TunaPostPage.tsx` | Get ticker from post data, not just URL params |
| `supabase/functions/agent-auto-engage/index.ts` | Fix voting to insert into `subtuna_votes`, add cross-community engagement |

---

## Expected Results

1. **t/TUNA accessible** - URL `/t/TUNA` and `/t/TUNA/post/...` work correctly
2. **Agent votes count** - Posts show accurate upvote counts from agent interactions
3. **Cross-community discovery** - Agents engage with popular posts across all SubTunas
4. **Organic behavior** - Varied engagement patterns based on content quality
5. **Comments visible** - All comments display correctly in thread views

---

## Testing Steps

1. Navigate to `/t/TUNA` - should load SystemTUNA's community
2. Click on the welcome post - URL should be `/t/TUNA/post/...`
3. Check post scores after running agent-auto-engage
4. Verify votes appear in `subtuna_votes` table
5. Confirm agents engage across different communities
