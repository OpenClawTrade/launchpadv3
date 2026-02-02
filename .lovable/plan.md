
## Fix SystemTUNA Avatar in Top AI Agents Section

### Problem
The "Top AI Agents" leaderboard in the right sidebar always shows colored initials instead of actual avatar images. SystemTUNA should display its dedicated avatar (`/images/system-tuna-avatar.png`), and other agents should show their `avatar_url` or token image when available.

### Root Cause
The `TunaBookRightSidebar` component has two issues:
1. **Missing data**: The database query doesn't fetch `avatar_url` from the `agents` table
2. **Missing logic**: The render code doesn't use the `getAgentAvatarUrl()` helper that handles SystemTUNA's special case

### Comparison
The `RecentAgentsStrip` component already does this correctly - it fetches avatar data, uses the helper function, and conditionally renders an `<img>` or colored initials.

---

### Implementation

**File:** `src/components/tunabook/TunaBookRightSidebar.tsx`

#### 1. Import the avatar helper
```typescript
import { getAgentAvatarUrl } from "@/lib/agentAvatars";
```

#### 2. Update the database query to include `avatar_url`
```typescript
const { data, error } = await supabase
  .from("agents")
  .select("id, name, karma, total_tokens_launched, wallet_address, avatar_url")
  .eq("status", "active")
  .order("karma", { ascending: false })
  .limit(5);
```

#### 3. Update the render logic to show avatar images
```typescript
{topAgents.map((agent, index) => {
  const colorClass = avatarColors[index % avatarColors.length];
  const initial = agent.name.charAt(0).toUpperCase();
  const rank = index + 1;
  const avatarUrl = getAgentAvatarUrl(agent.id, agent.avatar_url, null);

  return (
    <Link ...>
      {/* Rank Badge */}
      <div className={cn("tunabook-rank-badge", getRankBadgeClass(rank))}>
        {rank}
      </div>
      
      {/* Avatar - image or fallback to initials */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={agent.name}
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className={cn("tunabook-agent-avatar w-8 h-8 text-sm", colorClass)}>
          {initial}
        </div>
      )}
      
      {/* ... rest of component */}
    </Link>
  );
})}
```

#### 4. Update cache key for immediate refresh
Change queryKey from `["top-agents-leaderboard"]` to `["top-agents-leaderboard-v2"]` to bust cached data.

---

### Summary

| Change | Purpose |
|--------|---------|
| Add `avatar_url` to SELECT | Fetch avatar data from database |
| Import `getAgentAvatarUrl` | Use helper that handles SystemTUNA special case |
| Conditional render `<img>` vs initials | Display actual avatars when available |
| Update queryKey | Force cache refresh for immediate effect |

After this fix, SystemTUNA will display its proper avatar image (`/images/system-tuna-avatar.png`) and other agents will show their avatars if set.
