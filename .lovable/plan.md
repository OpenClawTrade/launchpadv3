

# SystemTUNA Avatar & Agent Token Avatar Update Plan

## Overview

This plan:
1. Updates SystemTUNA's avatar to use the provided tuna sushi image
2. Modifies agent avatar display logic to use the token's image (`fun_tokens.image_url`) when available
3. Updates all UI components that display agent avatars

## Current State

- **Agents table** already has an `avatar_url` column
- **SystemTUNA** exists with `id = 00000000-0000-0000-0000-000000000001` but has no avatar set
- Agent avatars currently show:
  - A robot emoji on profile pages
  - First initial with colored background in other components
- Agent-launched tokens are stored in `fun_tokens` with `agent_id` linking them

## Technical Implementation

### 1. Upload SystemTUNA Avatar

Copy the uploaded tuna avatar image to the public folder:

```
lov-copy user-uploads://tuna-avatar-2.png public/images/system-tuna-avatar.png
```

### 2. Database Update - Set SystemTUNA Avatar

SQL migration to update SystemTUNA's avatar:

```sql
UPDATE public.agents
SET avatar_url = '/images/system-tuna-avatar.png'
WHERE id = '00000000-0000-0000-0000-000000000001';
```

### 3. Create Utility Function for Agent Avatars

Create a helper function that returns the appropriate avatar URL for an agent:

```typescript
// src/lib/agentAvatars.ts

// System agent uses static avatar
export const SYSTEM_TUNA_ID = "00000000-0000-0000-0000-000000000001";
export const SYSTEM_TUNA_AVATAR = "/images/system-tuna-avatar.png";

/**
 * Get avatar URL for an agent
 * Priority: agent.avatar_url > first launched token image > fallback initial
 */
export function getAgentAvatarUrl(
  agentId: string,
  agentAvatarUrl?: string | null,
  tokenImageUrl?: string | null
): string | null {
  // SystemTUNA always uses the static avatar
  if (agentId === SYSTEM_TUNA_ID) {
    return SYSTEM_TUNA_AVATAR;
  }
  // Use agent's own avatar if set
  if (agentAvatarUrl) {
    return agentAvatarUrl;
  }
  // Fall back to token image
  if (tokenImageUrl) {
    return tokenImageUrl;
  }
  return null;
}
```

### 4. Update AgentProfilePage.tsx

Modify the profile page to:
1. Fetch the agent's avatar and first token image
2. Display the avatar image instead of robot emoji

```tsx
// Add to state
const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

// In fetchAgentProfile, after getting agent data:
// Get first token for avatar fallback
const { data: firstToken } = await supabase
  .from("fun_tokens")
  .select("image_url")
  .eq("agent_id", agentId)
  .order("created_at", { ascending: true })
  .limit(1)
  .maybeSingle();

setAvatarUrl(
  getAgentAvatarUrl(agentId, agentData.avatar_url, firstToken?.image_url)
);

// Replace robot emoji with:
{avatarUrl ? (
  <img
    src={avatarUrl}
    alt={agent.name}
    className="w-20 h-20 rounded-full object-cover border-4 border-[hsl(var(--tunabook-bg-card))] shadow-lg"
  />
) : (
  <div className="w-20 h-20 rounded-full bg-[hsl(var(--tunabook-agent-badge))] flex items-center justify-center text-white text-3xl font-bold border-4 border-[hsl(var(--tunabook-bg-card))] shadow-lg">
    {agent.name.charAt(0).toUpperCase()}
  </div>
)}
```

### 5. Update RecentAgentsStrip.tsx

Modify to accept and display avatar/token image:

```tsx
// Update interface
interface Agent {
  id: string;
  name: string;
  createdAt: string;
  twitterHandle?: string;
  walletAddress: string;
  avatarUrl?: string | null;       // Add
  tokenImageUrl?: string | null;   // Add
}

// Replace initial display with:
const avatar = getAgentAvatarUrl(agent.id, agent.avatarUrl, agent.tokenImageUrl);

{avatar ? (
  <img
    src={avatar}
    alt={agent.name}
    className="tunabook-agent-avatar w-10 h-10 rounded-full object-cover"
  />
) : (
  <div className={cn("tunabook-agent-avatar", colorClass)}>
    {initial}
  </div>
)}
```

### 6. Update AgentLeaderboardPage.tsx

Add avatar display to leaderboard entries:

```tsx
// Update query to include avatar and token image
const { data: tokensData } = await supabase
  .from("fun_tokens")
  .select("agent_id, volume_24h_sol, market_cap_sol, image_url")
  .in("agent_id", agentIds);

// Map first token image per agent
const firstTokenImageByAgent: Record<string, string> = {};
(tokensData || []).forEach(t => {
  if (t.agent_id && t.image_url && !firstTokenImageByAgent[t.agent_id]) {
    firstTokenImageByAgent[t.agent_id] = t.image_url;
  }
});

// Add to LeaderboardAgent interface
interface LeaderboardAgent {
  // ... existing
  avatarUrl?: string | null;
}

// In render, add avatar before agent name:
{avatar ? (
  <img src={avatar} className="w-8 h-8 rounded-full object-cover" />
) : (
  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
    <span className="text-sm font-bold">{agent.name.charAt(0)}</span>
  </div>
)}
```

### 7. Update TunaPostCard.tsx

Pass avatar URL through agent prop and display it:

```tsx
// Update agent interface
agent?: {
  id: string;
  name: string;
  avatarUrl?: string | null;  // Add
};

// Add avatar display next to agent name in meta line:
{isAgentPost && agent && (
  <Link to={`/agent/${agent.id}`} className="flex items-center gap-1 hover:underline">
    {agent.avatarUrl && (
      <img
        src={agent.avatarUrl}
        alt=""
        className="w-4 h-4 rounded-full object-cover"
      />
    )}
    <span className="font-medium text-[hsl(var(--tunabook-agent-badge))]">
      {agent.name}
    </span>
    <AgentBadge />
  </Link>
)}
```

### 8. Update AgentTokenCard.tsx

Display agent avatar next to agent name:

```tsx
// Update props to include avatar
interface AgentTokenCardProps {
  // ... existing
  agentAvatarUrl?: string | null;  // Add
}

// Replace Bot icon with avatar if available:
<span className="flex items-center gap-1">
  {agentAvatarUrl ? (
    <img src={agentAvatarUrl} className="w-4 h-4 rounded-full object-cover" />
  ) : (
    <Bot className="h-3 w-3" />
  )}
  {agentName}
</span>
```

## File Changes Summary

| File | Change |
|------|--------|
| `public/images/system-tuna-avatar.png` | New - Copy uploaded image |
| `supabase/migrations/[new].sql` | Update SystemTUNA avatar_url |
| `src/lib/agentAvatars.ts` | New - Avatar utility functions |
| `src/pages/AgentProfilePage.tsx` | Fetch & display avatar image |
| `src/components/tunabook/RecentAgentsStrip.tsx` | Accept & display avatar |
| `src/pages/AgentLeaderboardPage.tsx` | Fetch & display avatar |
| `src/components/tunabook/TunaPostCard.tsx` | Display agent avatar |
| `src/components/agents/AgentTokenCard.tsx` | Display agent avatar |

## Data Flow

```text
For SystemTUNA:
  agents.avatar_url → /images/system-tuna-avatar.png ✓

For other agents:
  1. Check agents.avatar_url (if manually set)
  2. Fall back to fun_tokens.image_url (first launched token)
  3. Fall back to first initial with colored background
```

