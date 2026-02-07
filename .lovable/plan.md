
# OpenTuna Full Launch Implementation Plan

## Executive Summary

OpenTuna is **90% ready for full launch**. The core infrastructure is production-grade with 27 edge functions, complete database schema, and a unified SDK. This plan completes the remaining UI wiring, adds real activity feeds, and provides a comparison with OpenClaw for the launch announcement.

---

## What's Missing for Full Launch

### Critical (Must Fix Now)

| Issue | Current State | Fix Required |
|-------|---------------|--------------|
| **API Key "Generate" button not wired** | Button exists but onClick is empty | Connect to `opentuna-api-key-create` edge function |
| **API Key "View All" button not wired** | Button exists but onClick is empty | Add modal to list existing keys |
| **Activity Feed is placeholder** | Static "Activity will appear here" | Wire to `opentuna_sonar_pings` table |
| **WALLET_ENCRYPTION_KEY missing** | Needed for trading | (Secret exists but may need verification) |

### Infrastructure Already Complete

All edge functions are deployed:
- `opentuna-api-key-create` 
- `opentuna-api-key-validate`
- `opentuna-api-key-revoke`
- `opentuna-fin-trade` (Jupiter V6 + Jito ready)
- `opentuna-fin-bash` (sandboxed execution)
- `opentuna-fin-browse` (HTTP/Browserless)
- Plus 21 more...

Secrets configured: `HELIUS_RPC_URL` 

---

## Part 1: API Key Management System

### 1.1 New Hook: `useOpenTunaApiKeys`

Add to `src/hooks/useOpenTuna.ts`:

```typescript
// Types
export interface OpenTunaApiKey {
  id: string;
  agent_id: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  total_requests: number;
  is_active: boolean;
  created_at: string;
}

// Fetch API keys for an agent
export function useOpenTunaApiKeys(agentId: string | null) {
  return useQuery({
    queryKey: ['opentuna-api-keys', agentId],
    queryFn: async () => {
      if (!agentId) return [];
      
      const { data, error } = await supabase
        .from('opentuna_api_keys')
        .select('*')
        .eq('agent_id', agentId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as OpenTunaApiKey[];
    },
    enabled: !!agentId,
  });
}

// Mutation: Generate API key
export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (params: { agentId: string; name?: string }) => {
      const { data, error } = await supabase.functions.invoke('opentuna-api-key-create', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['opentuna-api-keys', variables.agentId] });
      toast({
        title: "API Key Generated!",
        description: "Copy it now - it won't be shown again.",
      });
    },
  });
}

// Mutation: Revoke API key
export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (params: { keyId: string; agentId: string }) => {
      const { data, error } = await supabase.functions.invoke('opentuna-api-key-revoke', {
        body: { keyId: params.keyId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['opentuna-api-keys', variables.agentId] });
      toast({
        title: "Key Revoked",
        description: "This API key can no longer be used.",
      });
    },
  });
}
```

### 1.2 API Key Management Modal Component

Create `src/components/opentuna/OpenTunaApiKeyModal.tsx`:

- Modal dialog showing existing keys (prefix only: `ota_live_abc123...`)
- "Generate New Key" button that calls the hook
- One-time display of full key with copy button
- Revoke button for each active key
- Shows usage stats (total requests, last used)

### 1.3 Wire OpenTunaHub Buttons

Update `src/components/opentuna/OpenTunaHub.tsx` lines 238-245:

```typescript
// Import the new hooks and modal
const [showApiKeyModal, setShowApiKeyModal] = useState(false);
const [newApiKey, setNewApiKey] = useState<string | null>(null);

const createKeyMutation = useCreateApiKey();

const handleGenerateKey = async () => {
  if (!selectedAgentId) {
    toast.error("Select an agent first");
    return;
  }
  const result = await createKeyMutation.mutateAsync({ 
    agentId: selectedAgentId 
  });
  setNewApiKey(result.apiKey);
  setShowApiKeyModal(true);
};
```

---

## Part 2: Real Activity Feed

### 2.1 New Hook: `useRecentActivity`

Add to `src/hooks/useOpenTuna.ts`:

```typescript
// Fetch recent activity across all user's agents
export function useRecentActivity(agentIds: string[], limit = 10) {
  return useQuery({
    queryKey: ['opentuna-recent-activity', agentIds],
    queryFn: async () => {
      if (agentIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('opentuna_sonar_pings')
        .select(`
          id,
          agent_id,
          action,
          reasoning,
          executed_at,
          success,
          cost_sol,
          opentuna_agents!inner(name)
        `)
        .in('agent_id', agentIds)
        .order('executed_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data;
    },
    enabled: agentIds.length > 0,
    refetchInterval: 30000, // Refresh every 30s
  });
}
```

### 2.2 Activity Feed Component

Update the "Recent Activity" section in `OpenTunaHub.tsx` (lines 426-439):

```typescript
// Replace static placeholder with real data
const agentIds = agents.map(a => a.id);
const { data: recentActivity, isLoading: isLoadingActivity } = useRecentActivity(agentIds);

// Render activity cards
{recentActivity?.map((ping) => (
  <div key={ping.id} className="flex items-center gap-3 py-2 border-b border-cyan-500/10">
    <div className={cn(
      "w-2 h-2 rounded-full",
      ping.success ? "bg-green-400" : "bg-red-400"
    )} />
    <div className="flex-1">
      <p className="text-sm">{ping.action}</p>
      <p className="text-xs text-muted-foreground">{ping.reasoning?.slice(0, 60)}...</p>
    </div>
    <span className="text-xs text-muted-foreground">
      {formatDistanceToNow(new Date(ping.executed_at), { addSuffix: true })}
    </span>
  </div>
))}
```

---

## Part 3: Add WALLET_ENCRYPTION_KEY Secret

For real trading execution, the `opentuna-fin-trade` edge function needs `WALLET_ENCRYPTION_KEY` to decrypt agent private keys.

**Action**: Add secret via Lovable Cloud Secrets:
- Name: `WALLET_ENCRYPTION_KEY`
- Value: 32+ character secure random string

---

## Part 4: Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useOpenTuna.ts` | Add `useOpenTunaApiKeys`, `useCreateApiKey`, `useRevokeApiKey`, `useRecentActivity` hooks |
| `src/components/opentuna/OpenTunaHub.tsx` | Wire "Generate" and "View Keys" buttons, replace activity placeholder |
| `src/components/opentuna/OpenTunaApiKeyModal.tsx` | **NEW** - Modal for key management |

---

## Part 5: OpenTuna vs OpenClaw Comparison

### Naming Comparison

| Concept | OpenClaw | OpenTuna |
|---------|----------|----------|
| Heartbeat/Autonomy | `Heartbeat` | `Sonar` |
| Identity/Soul | `Soul` | `DNA` |
| Capabilities | `Skills` | `Fins` |
| Teams | `Swarm` | `Schools` |
| Payments | `x402` | `SchoolPay` |
| Memory | `Memory` | `Deep Memory` |
| Onboarding | `openclaw onboard` | `Hatch` (60 seconds) |

### Technical Advantages

| Aspect | OpenClaw | OpenTuna |
|--------|----------|----------|
| **Deployment** | Self-hosted (hours of DevOps) | Cloud-native (60-second Hatch) |
| **Key Storage** | Plaintext `.md` files | AES-256-GCM encrypted vault |
| **Shell Access** | Full local access (dangerous) | Sandboxed Deno subprocess |
| **Trading** | Manual/external integrations | Jupiter V6 + Jito MEV built-in |
| **Memory Search** | SQLite local | pgvector hybrid (vector + keyword) |
| **Social** | Gateway only | TunaNet (X, Telegram, SubTuna native) |

---

## Part 6: Launch Announcement Tweet

### Recommended Tweet (Technical Comparison)

```
OpenTuna is LIVE 🐟

We rebuilt autonomous agents for Solana:

🦞 OpenClaw → 🐟 OpenTuna
Heartbeat → Sonar 🔊
Soul → DNA 🧬
Skills → Fins 🦈
Swarm → Schools 🏫
x402 → SchoolPay 💸

The difference:
✅ 60-second cloud deployment
✅ AES-256-GCM vault (not plaintext)
✅ Jupiter V6 + Jito MEV protection
✅ pgvector hybrid memory

SDK: npm install @opentuna/sdk

tuna.fun/opentuna 🎣
```

### Alternative (Value-Focused)

```
Introducing OpenTuna — Autonomous Agents for Solana 🐟

OpenClaw showed what's possible.
We built what's production-ready.

▸ Hatch in 60 seconds (not hours)
▸ Vault-secured keys (not .md files)
▸ Real trading (Jupiter + Jito)
▸ Deep Memory (vector + keyword)
▸ SchoolPay (agent-to-agent SOL)

Same 6 primitives. Cloud-first security.

tuna.fun/opentuna 🎣
```

---

## Implementation Order

1. **Add new hooks** to `useOpenTuna.ts` (~5 min)
2. **Create API Key Modal** component (~10 min)
3. **Wire Hub buttons** to real functionality (~5 min)
4. **Replace activity placeholder** with real feed (~5 min)
5. **Add WALLET_ENCRYPTION_KEY** secret (~1 min)
6. **Test full flow**: Hatch → DNA → Sonar → Generate Key → Trade

Total estimated time: **~30 minutes**

---

## Technical Details

### Edge Function Endpoints (Already Deployed)

| Endpoint | Purpose |
|----------|---------|
| `opentuna-api-key-create` | Generate new SDK API key |
| `opentuna-api-key-validate` | Validate key on SDK requests |
| `opentuna-api-key-revoke` | Revoke existing key |
| `opentuna-fin-trade` | Jupiter V6 + Jito trading |
| `opentuna-fin-bash` | Sandboxed shell commands |
| `opentuna-fin-browse` | Browser automation |

### Database Tables (Already Created)

| Table | Purpose |
|-------|---------|
| `opentuna_api_keys` | SDK access keys (SHA-256 hashed) |
| `opentuna_agent_integrations` | Per-agent integration status |
| `opentuna_sonar_pings` | Activity log for feed |

---

## Summary

OpenTuna has achieved **functional parity with OpenClaw** across all 6 core primitives. The remaining work is purely UI wiring (no new backend needed):

1. Connect "Generate API Key" button → `opentuna-api-key-create`
2. Add modal to display and manage keys
3. Replace activity placeholder with real sonar pings
4. Verify `WALLET_ENCRYPTION_KEY` secret for trading

After these changes, OpenTuna will be **fully functional and ready for public launch**.
