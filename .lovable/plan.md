
# Plan: PUMP Agents - pump.fun Integration

## Overview

This plan adds a **"PUMP Agents"** section to launch AI-generated tokens on **pump.fun** via the PumpPortal API. Tokens launched on pump.fun will be displayed alongside TUNA tokens with a distinctive green pump.fun icon.

---

## Database Changes

### Migration: Add `launchpad_type` to `fun_tokens`

```sql
-- Add launchpad type to distinguish token platforms
ALTER TABLE fun_tokens 
ADD COLUMN IF NOT EXISTS launchpad_type text DEFAULT 'tuna';

-- Add pump.fun specific fields
ALTER TABLE fun_tokens
ADD COLUMN IF NOT EXISTS pumpfun_bonding_curve text,
ADD COLUMN IF NOT EXISTS pumpfun_creator text,
ADD COLUMN IF NOT EXISTS pumpfun_signature text;

-- Add comment for documentation
COMMENT ON COLUMN fun_tokens.launchpad_type IS 'Platform: tuna or pumpfun';
```

---

## New Files

### 1. Edge Function: `supabase/functions/pump-agent-launch/index.ts`

Creates tokens on pump.fun via PumpPortal API:

- Accepts token metadata (name, symbol, description, image)
- Uploads image to pump.fun IPFS endpoint
- Creates token via `pumpportal.fun/api/trade`
- Performs initial dev buy (0.01 SOL by default, configurable)
- Records in `fun_tokens` with `launchpad_type: 'pumpfun'`
- Creates SubTuna community for the token
- Returns mint address and pump.fun trade URL

**Key flow:**
```text
1. Validate input (name, symbol, image)
2. Re-host image to Supabase if needed
3. Upload to pump.fun IPFS → get metadataUri
4. Generate fresh mint keypair
5. Call PumpPortal API with:
   - action: "create"
   - tokenMetadata: { name, symbol, uri }
   - mint: keypair secret
   - amount: 0.01 SOL (initial buy)
6. Wait for confirmation
7. Insert into fun_tokens with launchpad_type='pumpfun'
8. Create subtuna community
9. Return success with CA
```

### 2. Page: `src/pages/PumpAgentsPage.tsx`

New page at `/agents/pump` with:

- Same AI idea generator flow as existing
- One-click "Launch on pump.fun" button (green themed)
- Shows generated token metadata before launch
- Displays result with full CA and pump.fun trade link
- Pump.fun branding (dark with green accents)

### 3. Component: `src/components/agents/PumpAgentLauncher.tsx`

One-click launch component that:

- Uses existing `AgentIdeaGenerator` for meme generation
- Adds "Launch on pump.fun" button after generation
- Calls `pump-agent-launch` edge function
- Shows loading state and success/error feedback

### 4. Badge: `src/components/tunabook/PumpBadge.tsx`

Small green pump.fun badge component:

```tsx
export function PumpBadge({ className }: { className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full",
      "bg-[#00ff00]/20 text-[#00ff00] text-[10px] font-medium",
      className
    )}>
      <Rocket size={12} weight="fill" /> {/* or custom pump.fun SVG */}
      <span>pump.fun</span>
    </span>
  );
}
```

---

## Modified Files

### 1. `src/App.tsx` - Add Route

```tsx
const PumpAgentsPage = lazy(() => import("./pages/PumpAgentsPage"));

// In Routes:
<Route path="/agents/pump" element={<PumpAgentsPage />} />
```

### 2. `src/components/layout/LaunchpadLayout.tsx` - Add Nav Button

Add "PUMP Agents" button next to "TUNA Agents":

```tsx
<Link to="/agents/pump">
  <Button 
    size="sm" 
    className="bg-[#00ff00] hover:bg-[#00cc00] text-black rounded-lg h-9 px-3 text-sm font-medium gap-1.5"
  >
    <Rocket className="h-4 w-4" />
    PUMP Agents
  </Button>
</Link>
```

### 3. `src/components/launchpad/TokenCard.tsx` - Add pump.fun Badge

After the AI Agent badge, add pump.fun badge:

```tsx
{/* pump.fun badge */}
{token.launchpad_type === 'pumpfun' && (
  <span 
    className="flex items-center gap-0.5 bg-[#00ff00]/20 text-[#00ff00] px-1.5 py-0.5 rounded-full"
    title="pump.fun Token"
  >
    <Rocket className="h-3 w-3" />
    <span className="text-[10px] font-medium">pump</span>
  </span>
)}
```

### 4. `src/components/launchpad/TokenTable.tsx` - Add pump.fun Icon

Add pump.fun icon in both mobile and desktop views:

```tsx
{token.launchpad_type === 'pumpfun' && (
  <a 
    href={`https://pump.fun/${token.mint_address}`}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
    title="pump.fun Token"
    className="flex-shrink-0"
  >
    <Rocket className="h-3 w-3 text-[#00ff00] hover:text-[#00cc00]" />
  </a>
)}
```

### 5. `src/components/launchpad/KingOfTheHill.tsx` - Add pump.fun Badge

Display pump.fun badge on top token if applicable.

### 6. `src/components/tunabook/SubTunaCard.tsx` - Add pump.fun Icon

Show pump.fun icon next to community name for pumpfun tokens.

### 7. `src/components/tunabook/TunaPostCard.tsx` - Add Launchpad Indicator

Add small pump.fun indicator near the community link.

### 8. `src/components/tunabook/AgentBadge.tsx` - Add PumpBadge Export

Export the new PumpBadge component.

### 9. `supabase/functions/agent-tokens/index.ts` - Include launchpad_type

Add `launchpad_type` to the query and response:

```tsx
fun_tokens (
  id, name, ticker, mint_address, ...,
  launchpad_type  // NEW
)
```

### 10. `src/hooks/useAgentTokens.ts` - Add launchpad_type to Interface

```tsx
token: {
  // existing fields...
  launchpadType: string | null;  // NEW
}
```

### 11. `src/hooks/useFunTokens.ts` - Add launchpad_type

Include launchpad_type in token queries.

---

## Required Secrets

| Secret | Description |
|--------|-------------|
| `PUMPPORTAL_API_KEY` | API key from pumpportal.fun for token creation |
| `PUMP_DEPLOYER_PRIVATE_KEY` | Base58-encoded private key of funded Solana wallet (~0.1 SOL) |

---

## Trade Link Logic

For pump.fun tokens, clicking "Trade" should open pump.fun:

```tsx
const tradeUrl = token.launchpad_type === 'pumpfun'
  ? `https://pump.fun/${token.mint_address}`
  : `/launchpad/${token.mint_address}`;
```

This applies to:
- TokenCard (View button)
- TokenTable (row click)
- KingOfTheHill (Trade button)
- AgentTokenCard (View button)

---

## UI Flow

```text
User visits /agents/pump
       │
       ▼
┌─────────────────────────┐
│  Enter prompt or click  │
│  "Generate Random Idea" │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  AI generates:          │
│  • Token name/symbol    │
│  • Description          │
│  • TUNA-themed image    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Click "Launch on       │
│  pump.fun" (green btn)  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Edge function:         │
│  1. Upload to IPFS      │
│  2. Create via PumpPortal│
│  3. Initial 0.01 SOL buy│
│  4. Save to DB          │
│  5. Create SubTuna      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Success screen:        │
│  • Full CA displayed    │
│  • pump.fun trade link  │
│  • Copy CA button       │
│  • View community link  │
└─────────────────────────┘
```

---

## Visual Distinction

| Attribute | TUNA Tokens | pump.fun Tokens |
|-----------|-------------|-----------------|
| Badge Color | Purple (AI Agent) | Green (#00ff00) |
| Badge Icon | Bot/Robot | Rocket |
| Badge Text | "AI" | "pump" |
| Trade Link | tuna.fun/launchpad/:mint | pump.fun/:mint |
| Fee Info | 2% (80/20 split) | 1% (pump.fun takes all) |

---

## Files Summary

| File | Action |
|------|--------|
| **Database migration** | Add launchpad_type, pumpfun_* columns |
| `supabase/functions/pump-agent-launch/index.ts` | **CREATE** - Main launch function |
| `src/pages/PumpAgentsPage.tsx` | **CREATE** - New page |
| `src/components/agents/PumpAgentLauncher.tsx` | **CREATE** - Launch component |
| `src/components/tunabook/PumpBadge.tsx` | **CREATE** - Badge component |
| `src/App.tsx` | Add route |
| `src/components/layout/LaunchpadLayout.tsx` | Add nav button |
| `src/components/launchpad/TokenCard.tsx` | Add pump badge |
| `src/components/launchpad/TokenTable.tsx` | Add pump icon |
| `src/components/launchpad/KingOfTheHill.tsx` | Add pump badge |
| `src/components/tunabook/SubTunaCard.tsx` | Add pump icon |
| `src/components/tunabook/TunaPostCard.tsx` | Add launchpad indicator |
| `supabase/functions/agent-tokens/index.ts` | Include launchpad_type |
| `src/hooks/useAgentTokens.ts` | Add launchpad_type to type |
| `src/hooks/useFunTokens.ts` | Add launchpad_type to query |

---

## Next Steps After Approval

1. **Add secrets**: You'll need to add `PUMPPORTAL_API_KEY` and `PUMP_DEPLOYER_PRIVATE_KEY` via the secrets tool
2. Run database migration to add new columns
3. Create all new files
4. Update existing files with pump.fun icon/badge logic
5. Deploy edge functions
6. Test end-to-end with a small token launch
