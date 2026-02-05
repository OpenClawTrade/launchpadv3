

# Add AI Generate Button for Trading Agent Character

## Summary
Add a "Generate" button using the TUNA logo that creates a complete trading agent character with name, ticker, avatar, and a **professional trading-themed description** that always explains the strategy and what the agent will do. No emojis, professional mode only.

---

## Implementation

### 1. New Edge Function: `trading-agent-generate`

**File:** `supabase/functions/trading-agent-generate/index.ts`

Creates a complete trading agent character concept:

**Text Generation Prompt (Professional, No Emojis):**
```text
Generate a professional trading agent identity for a ${strategy} strategy autonomous trading bot.

Requirements:
- Name: A professional trading-themed name (e.g., "AlphaQuant", "Sentinel", "VeloTrade")
- Ticker: 3-5 uppercase characters derived from the name
- Description: A professional 2-3 sentence description that:
  1. Explains the trading strategy (stop-loss, take-profit, position sizing)
  2. Describes what this agent will do (scan for opportunities, manage risk, execute trades)
  3. Uses professional financial terminology
  4. NO EMOJIS - strictly professional tone

Strategy details for ${strategy}:
- Conservative: 10% stop-loss, 25% take-profit, max 2 positions, focuses on steady gains
- Balanced: 20% stop-loss, 50% take-profit, max 3 positions, moderate risk-reward
- Aggressive: 30% stop-loss, 100% take-profit, max 5 positions, high conviction plays

Return JSON: { "name": "...", "ticker": "...", "description": "..." }
```

**Example Generated Descriptions:**

- **Conservative:** "Sentinel employs a disciplined conservative trading strategy with strict risk parameters. Operating with a 10% stop-loss and 25% take-profit threshold, this agent maintains a maximum of 2 concurrent positions while scanning Solana markets for high-probability setups with favorable risk-reward profiles."

- **Balanced:** "VeloTrade executes a balanced trading approach optimized for consistent growth. With 20% stop-loss protection and 50% profit targets, this agent manages up to 3 positions simultaneously, analyzing market trends and token fundamentals to identify opportunities with asymmetric upside potential."

- **Aggressive:** "ApexHunter pursues an aggressive high-conviction trading strategy targeting exponential returns. Configured with 30% stop-loss tolerance and 100% take-profit objectives, this agent actively manages 5 positions while seeking early-stage tokens with strong momentum and breakout potential."

**Image Generation:**
```text
Create a professional trading AI agent mascot inspired by tuna fish themes.

Style requirements:
- Professional trading aesthetic with subtle chart/data elements
- Teal/cyan primary color palette (TUNA brand)
- Clean, modern design suitable for a financial platform
- ${strategy} personality: conservative=calm/analytical, balanced=confident/focused, aggressive=determined/bold
- Single character, centered, solid dark background
- No text, no logos, cartoon style with professional finish
```

### 2. Update Frontend Modal

**File:** `src/components/trading/CreateTradingAgentModal.tsx`

**New State:**
```typescript
const [isGenerating, setIsGenerating] = useState(false);
const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
```

**New Generate Function:**
```typescript
const handleGenerate = async () => {
  setIsGenerating(true);
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trading-agent-generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          strategy: form.getValues('strategy'),
          personalityPrompt: form.getValues('personalityPrompt'),
        }),
      }
    );
    const result = await response.json();
    if (result.success) {
      form.setValue('name', result.name);
      form.setValue('ticker', result.ticker);
      form.setValue('description', result.description);
      setGeneratedAvatar(result.avatarUrl);
    }
  } catch (error) {
    toast({ title: 'Generation failed', variant: 'destructive' });
  } finally {
    setIsGenerating(false);
  }
};
```

**UI Changes:**

Add Generate button with TUNA logo after strategy selection:

```text
┌─────────────────────────────────────────┐
│  [Strategy Cards: Con / Bal / Agg]      │
├─────────────────────────────────────────┤
│  ┌──────────┐  ┌─────────────────────┐  │
│  │  Avatar  │  │ [🐟 Generate]       │  │
│  │ Preview  │  │ Uses TUNA style     │  │
│  │ (or bot) │  │ Professional mode   │  │
│  └──────────┘  └─────────────────────┘  │
├─────────────────────────────────────────┤
│  Name          │  Ticker               │
├─────────────────────────────────────────┤
│  Description (professional, no emojis) │
├─────────────────────────────────────────┤
│  Personality Hint (optional)            │
├─────────────────────────────────────────┤
│  [Cancel]  [Create Agent]               │
└─────────────────────────────────────────┘
```

The Generate button:
- Uses the TUNA logo (`/tuna-logo.png`) as the icon
- Located prominently after strategy selection
- Generates all fields at once based on selected strategy
- Shows loading spinner while generating
- Populates: name, ticker, description, avatar preview

### 3. Update Hook and Types

**File:** `src/hooks/useTradingAgents.ts`

Add `avatarUrl` to `CreateAgentInput`:
```typescript
export interface CreateAgentInput {
  name?: string;
  ticker?: string;
  description?: string;
  strategy: "conservative" | "balanced" | "aggressive";
  personalityPrompt?: string;
  creatorWallet?: string;
  avatarUrl?: string; // NEW - for generated avatar
}
```

---

## Technical Details

### Edge Function Implementation

**File:** `supabase/functions/trading-agent-generate/index.ts`

```text
Flow:
1. Accept: { strategy, personalityPrompt? }
2. Build professional prompt with strategy details
3. Call Lovable AI (gemini-2.5-flash) for text generation
4. Extract JSON: { name, ticker, description }
5. Call Lovable AI (gemini-2.5-flash-image) for avatar
6. Upload image to Supabase storage (trading-agents bucket)
7. Return: { success, name, ticker, description, avatarUrl }
```

**Professional Description Requirements:**
- Always explains the exact strategy parameters (SL/TP/positions)
- Describes what the agent does (scans, analyzes, executes)
- Uses financial terminology (risk-reward, conviction, momentum)
- No emojis, no casual language
- 2-3 sentences, informative and concise

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/trading-agent-generate/index.ts` | Create | AI generation endpoint |
| `src/components/trading/CreateTradingAgentModal.tsx` | Modify | Add Generate button, avatar preview |
| `src/hooks/useTradingAgents.ts` | Modify | Add avatarUrl to CreateAgentInput |

---

## Result

Users can click "Generate" to instantly create a professional trading agent character with:
- Trading-themed name (AlphaQuant, Sentinel, ApexHunter)
- Appropriate ticker symbol
- Professional description explaining strategy and agent behavior
- TUNA-styled avatar matching the strategy personality

All generated content is fully editable before final creation.

