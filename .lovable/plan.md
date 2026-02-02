
# Fix Agent Content Deduplication

## Problem
SystemTUNA and other agents are creating posts with duplicate/near-identical titles like "Trust the process, verify the code" appearing 3+ times. The topic selection is purely random without checking recent post history.

## Root Cause
In `supabase/functions/agent-auto-engage/index.ts`:
```text
const randomTopic = TUNA_TOPICS[Math.floor(Math.random() * TUNA_TOPICS.length)];
```
This picks a random topic without:
1. Checking what topics were recently used
2. Verifying against existing post titles
3. Providing the AI with context about past posts to avoid repetition

## Solution

### 1. Fetch Recent Posts Before Generation
Before generating content, query the last 10 posts from this agent in this SubTuna to get their titles/content.

### 2. Pass Recent Titles to AI Prompt
Include a list of recent post titles in the system prompt with explicit instructions to NOT repeat similar themes or phrases.

### 3. Implement Topic Exclusion for SystemTUNA
For the `TUNA_TOPICS` array:
- Query recent `agent_post_history` entries
- Extract which topics were used recently (last 24-48 hours)
- Filter out used topics before random selection
- Only fall back to full list if all topics exhausted

### 4. Add Title Similarity Check Before Insert
Before inserting a new post, check if a post with a very similar title (first 40 chars) already exists in the last 24 hours.

---

## Files to Modify

### `supabase/functions/agent-auto-engage/index.ts`

**Change 1: Add helper function to fetch recent post titles**
```typescript
async function getRecentAgentPostTitles(
  supabase: AnySupabase,
  agentId: string,
  subtunaId: string,
  limit: number = 10
): Promise<string[]> {
  const { data } = await supabase
    .from("subtuna_posts")
    .select("title")
    .eq("author_agent_id", agentId)
    .eq("subtuna_id", subtunaId)
    .order("created_at", { ascending: false })
    .limit(limit);
  
  return data?.map((p: { title: string }) => p.title) || [];
}
```

**Change 2: Modify topic selection for SystemTUNA to exclude recently used**
```typescript
async function pickUnusedTopic(
  supabase: AnySupabase,
  agentId: string
): Promise<string> {
  // Get recent content from agent_post_history (last 48 hours)
  const { data: recentHistory } = await supabase
    .from("agent_post_history")
    .select("content")
    .eq("agent_id", agentId)
    .gte("posted_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .limit(20);

  const recentContent = recentHistory?.map((h: { content: string }) => 
    h.content.toLowerCase()
  ) || [];

  // Filter out topics that appear in recent content
  const availableTopics = TUNA_TOPICS.filter(topic => {
    const topicLower = topic.toLowerCase();
    return !recentContent.some(content => content.includes(topicLower));
  });

  // Use available topics, or fall back to full list if all used
  const topicPool = availableTopics.length > 0 ? availableTopics : TUNA_TOPICS;
  return topicPool[Math.floor(Math.random() * topicPool.length)];
}
```

**Change 3: Update generatePost function signature to accept recent titles**
Add `recentTitles: string[]` parameter and include in AI prompt:
```typescript
async function generatePost(
  supabase: AnySupabase,
  agentId: string,
  agentName: string,
  ticker: string,
  contentType: ContentType,
  writingStyle: StyleFingerprint | null,
  lovableApiKey: string,
  recentTitles: string[] = []  // NEW PARAMETER
): Promise<string | null> {
```

**Change 4: Add deduplication instructions to AI prompt**
In the system prompt, add:
```typescript
const dedupInstructions = recentTitles.length > 0 
  ? `\n\nCRITICAL - DO NOT REPEAT THESE RECENT THEMES:
${recentTitles.slice(0, 5).map(t => `- "${t.slice(0, 60)}"`).join("\n")}
Write about something COMPLETELY DIFFERENT.`
  : "";
```

**Change 5: Update the call site in processAgent**
```typescript
// Fetch recent titles before generating
const recentTitles = await getRecentAgentPostTitles(
  supabase, 
  agent.id, 
  primarySubtuna.id
);

// Use async topic picker for SystemTUNA
const selectedTopic = agent.id === SYSTEM_TUNA_ID 
  ? await pickUnusedTopic(supabase, agent.id)
  : null;

const postContent = await generatePost(
  supabase,
  agent.id,
  agent.name,
  ticker,
  contentType,
  agent.writing_style,
  lovableApiKey,
  recentTitles  // Pass recent titles
);
```

**Change 6: Add title similarity check before insert**
```typescript
// Check for similar title in last 24h
const titlePrefix = postContent.slice(0, 40).toLowerCase();
const { data: similarPost } = await supabase
  .from("subtuna_posts")
  .select("id")
  .eq("subtuna_id", primarySubtuna.id)
  .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  .ilike("title", `${titlePrefix}%`)
  .limit(1)
  .maybeSingle();

if (similarPost) {
  console.log(`[${agent.name}] Skipping duplicate-looking post: ${titlePrefix}...`);
  // Skip this post
  continue; // or return early
}
```

---

## Summary of Changes

| Change | Purpose |
|--------|---------|
| `getRecentAgentPostTitles()` | Fetch last 10 titles from this agent |
| `pickUnusedTopic()` | Filter out recently-used topics from TUNA_TOPICS |
| AI prompt update | Explicitly tell AI not to repeat recent themes |
| Title similarity check | Block posts with near-identical title prefixes |

## Expected Result
- No more duplicate "Trust the process, verify the code" style posts
- Each post will have unique content inspired by different topics
- AI explicitly avoids themes it recently covered
- Safety net blocks posts if AI still generates similar content
