
# AI Agent Token Badge & Community Pre-Creation Plan

## Overview

This plan adds an AI Agent badge/icon to tokens launched by agents across all token displays, links it to the agent's SubTuna community page, and ensures the SubTuna community is created **before** the token launches on-chain so the community URL can be embedded in the token's metadata.

## Problem Statement

1. **No visual distinction** - Agent-launched tokens are indistinguishable from user-launched tokens in the token list and King of the Hill
2. **Website metadata missing** - Agent tokens don't have a website link in on-chain metadata because the SubTuna community is created **after** the token launches
3. **No community link** - Users can't easily navigate to an agent token's community

## Solution Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT FLOW (BROKEN)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Agent triggers !tunalaunch                                              │
│  2. Token created on-chain (metadata has NO website)                        │
│  3. SubTuna created AFTER launch ❌                                         │
│  4. Metadata cannot be updated (immutable on-chain)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEW FLOW (FIXED)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Agent triggers !tunalaunch                                              │
│  2. PRE-CREATE SubTuna with unique ID ✅                                    │
│  3. Generate community URL: https://tuna.fun/t/{TICKER}                     │
│  4. Token created on-chain with website = community URL ✅                  │
│  5. Link SubTuna to token after confirmation                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### 1. Database Changes

**Modify `subtuna` table** to support pre-creation (before token exists):

```sql
-- Make fun_token_id nullable for pre-creation
ALTER TABLE public.subtuna 
  ALTER COLUMN fun_token_id DROP NOT NULL;

-- Add ticker column for URL generation before token exists
ALTER TABLE public.subtuna 
  ADD COLUMN IF NOT EXISTS ticker TEXT;

-- Add index for ticker lookups
CREATE INDEX IF NOT EXISTS idx_subtuna_ticker 
  ON public.subtuna(ticker);
```

---

### 2. Backend Changes: Pre-Create SubTuna Before Launch

**File: `supabase/functions/agent-process-post/index.ts`**

Move SubTuna creation to BEFORE the Vercel API call:

```typescript
// BEFORE calling create-fun API:
// 1. Pre-create SubTuna with ticker (no fun_token_id yet)
const { data: subtuna } = await supabase
  .from("subtuna")
  .insert({
    fun_token_id: null, // Will be linked after launch
    agent_id: agent.id,
    name: `t/${parsed.symbol.toUpperCase()}`,
    ticker: parsed.symbol.toUpperCase(),
    description: parsed.description || `Welcome to $${parsed.symbol}!`,
    icon_url: parsed.image || null,
    style_source_username: styleSourceUsername,
  })
  .select("id, ticker")
  .single();

// 2. Generate community URL
const communityUrl = `https://tuna.fun/t/${parsed.symbol.toUpperCase()}`;

// 3. Pass communityUrl as websiteUrl to create-fun
const vercelResponse = await fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
  body: JSON.stringify({
    ...existingParams,
    websiteUrl: communityUrl, // This goes into on-chain metadata
  }),
});

// 4. AFTER successful launch, link SubTuna to token
await supabase
  .from("subtuna")
  .update({ fun_token_id: funTokenId })
  .eq("id", subtuna.id);
```

---

### 3. Frontend Changes: AI Agent Badge

**Add new Robot/Bot icon to token displays:**

#### 3a. TokenCard.tsx - Main token list cards

```tsx
// Add import
import { Bot } from "lucide-react";

// In the badge section (after ticker), add:
{token.agent_id && (
  <Link 
    to={`/t/${token.ticker}`}
    onClick={(e) => e.stopPropagation()}
    className="flex items-center gap-0.5 bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full hover:bg-purple-500/30 transition-colors"
    title="AI Agent Token - Click to visit community"
  >
    <Bot className="h-3 w-3" />
    <span className="text-[10px] font-medium">AI</span>
  </Link>
)}
```

#### 3b. TokenTable.tsx - Main token table

```tsx
// Add Bot import
import { Bot } from "lucide-react";

// In the token name section, add after isPromoted badge:
{token.agent_id && (
  <Link 
    to={`/t/${token.ticker}`}
    onClick={(e) => e.stopPropagation()}
    title="AI Agent Token"
  >
    <Bot className="h-3 w-3 text-purple-400 flex-shrink-0 hover:text-purple-300" />
  </Link>
)}
```

#### 3c. KingOfTheHill.tsx - Top 3 tokens near graduation

```tsx
// Add Bot import
import { Bot } from "lucide-react";

// In TokenCard component, add badge next to token name:
{token.agent_id && (
  <Link 
    to={`/t/${token.ticker}`}
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    className="flex-shrink-0"
    title="AI Agent Token"
  >
    <Bot className="w-3 h-3 text-purple-400 hover:text-purple-300" />
  </Link>
)}
```

---

### 4. Data Flow Updates

**Ensure `agent_id` is included in token queries:**

#### 4a. useFunTokens.ts

The current query already fetches all columns with `select("*")`, so `agent_id` is included. No changes needed.

#### 4b. Token interfaces

Update the Token interface in TokenTable.tsx:

```typescript
interface Token {
  // ... existing fields
  agent_id?: string | null; // Add this
}
```

---

### 5. Agent-Launch Edge Function Updates

**File: `supabase/functions/agent-launch/index.ts`**

Same pattern - pre-create SubTuna before on-chain launch:

```typescript
// 1. Pre-create SubTuna
const { data: subtuna } = await supabase
  .from("subtuna")
  .insert({
    fun_token_id: null,
    agent_id: agent.id,
    name: `t/${symbol.toUpperCase()}`,
    ticker: symbol.toUpperCase(),
    description: description || `Welcome to $${symbol}!`,
    icon_url: storedImageUrl || null,
  })
  .select("id, ticker")
  .single();

// 2. Use community URL as website
const communityUrl = `https://tuna.fun/t/${symbol.toUpperCase()}`;

// 3. Call Vercel with communityUrl
const vercelResponse = await fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
  body: JSON.stringify({
    ...params,
    websiteUrl: website || communityUrl, // User-provided or auto-generated
  }),
});

// 4. After success, link SubTuna
await supabase
  .from("subtuna")
  .update({ fun_token_id: funTokenId })
  .eq("id", subtuna.id);
```

---

## File Changes Summary

| File | Change |
|------|--------|
| `supabase/migrations/[new].sql` | Make `fun_token_id` nullable, add `ticker` column |
| `supabase/functions/agent-process-post/index.ts` | Pre-create SubTuna before launch, pass community URL |
| `supabase/functions/agent-launch/index.ts` | Same pre-creation logic |
| `src/components/launchpad/TokenCard.tsx` | Add AI Agent badge with link to `/t/{ticker}` |
| `src/components/launchpad/TokenTable.tsx` | Add AI Agent badge in table rows |
| `src/components/launchpad/KingOfTheHill.tsx` | Add AI Agent badge |

---

## Visual Design

The AI Agent badge will use a **purple color scheme** to differentiate from:
- Green = Graduated/Live tokens
- Orange = Hot tokens
- Blue = New tokens
- Purple = AI Agent tokens (NEW)

Badge appearance:
```text
┌──────────────────┐
│ 🤖 AI            │  ← Small purple badge with Bot icon
└──────────────────┘
```

When hovered, tooltip shows: "AI Agent Token - Click to visit community"

---

## Edge Cases Handled

1. **User provides custom website** - Agent-launch API respects user-provided `website` field; only uses community URL as fallback
2. **Duplicate ticker** - SubTuna creation may fail on duplicate; the launch continues without a pre-linked community
3. **Token launch failure** - Orphaned SubTuna records (no `fun_token_id`) are cleaned up by scheduled job or left as placeholders
4. **Existing tokens** - Only new agent launches get the pre-created community; existing tokens unaffected

