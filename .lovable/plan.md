
# Claw Mode Landing Page with Lobster Branding

## Overview
Create a standalone landing page at `/claw` that combines all TUNA Agents and Trading Agents content into one page, restyled with the OpenClaw color scheme (dark space background, red/coral accents, teal highlights). The lobster emoji will be used extensively as the brand icon, favicon, and logo throughout the page. A Matrix-style falling characters animation will run across the entire background.

## New Files

### 1. `src/pages/ClawModePage.tsx`
The main page component containing:
- Matrix canvas background (full-screen, behind all content)
- Custom header with lobster emoji logo, "CLAW MODE" branding, and navigation back to main site
- Hero section with large lobster emoji, "CLAW MODE" title in red gradient, subtitle about autonomous AI agents
- Stats bar (reusing `useAgentStats` + `useTradingAgents` data) styled with red/teal accents
- "How It Works" cards (Twitter, Telegram, API launch methods) restyled -- all TUNA mentions replaced with Claw branding
- Platform token section restyled
- Top tokens by market cap grid
- All tokens grid with filters (New/Hot/MCap/Volume + platform filter)
- Full Trading Agents section: strategy cards, active/funding/top tabs, Fear and Greed gauge, create agent card
- Footer with Claw branding and lobster emoji

### 2. `src/components/claw/MatrixBackground.tsx`
Canvas-based Matrix rain effect:
- Green (#00ff41) falling katakana + numeric characters
- Interspersed with lobster emojis falling in the matrix rain
- Semi-transparent (opacity ~0.03-0.05) so content remains readable
- Performance-optimized with requestAnimationFrame
- Fixed positioning, z-index 0, all content above

### 3. `src/components/claw/ClawHeader.tsx`
Standalone header for the Claw page:
- Lobster emoji as logo with "CLAW MODE" text
- Navigation links (Trade, Agents, API)
- Back to main site link
- Red/coral accent colors matching OpenClaw

### 4. `src/components/claw/ClawHero.tsx`
Hero section:
- Large lobster emoji (animated pulse/glow)
- "CLAW MODE" heading with red-to-coral gradient text (matching OpenClaw's red heading style)
- Subtitle: "Autonomous AI agents that launch tokens and trade on Solana"
- Quick stat chips with lobster emojis: "80% fees", "2% trading fee", "Free to launch"

### 5. `src/components/claw/ClawStatsBar.tsx`
Stats overview restyled:
- Same data from `useAgentStats` hook
- Red/teal glowing card borders
- Lobster emoji decorating section headers

### 6. `src/components/claw/ClawAgentSection.tsx`
Combined TUNA Agents content:
- How to launch cards (Twitter/Telegram/API) restyled with red/teal
- Technical specs collapsible
- All `!tunalaunch` replaced with `!clawlaunch`, `@BuildTuna` with `@ClawMode`
- Lobster emoji in section headers

### 7. `src/components/claw/ClawTokenGrid.tsx`
Token grid wrapper:
- Reuses `useAgentTokens` hook and `AgentTokenCard` component
- Platform filter tabs restyled in red/teal
- Sort tabs (New/Hot/MCap/Volume) with claw theme colors

### 8. `src/components/claw/ClawTradingSection.tsx`
Trading agents section:
- Strategy selector cards (red/teal/amber)
- Active/Funding/Top tabs reusing `useTradingAgents` hooks
- Reuses `TradingAgentCard`, `FearGreedGauge`, `CreateTradingAgentModal`
- Create agent card with claw/lobster branding
- Technical architecture sidebar

### 9. `src/styles/claw-theme.css`
Custom CSS theme:
- Color variables matching OpenClaw (dark bg #0a0a0f, red primary #ef4444, teal secondary #22d3ee, coral accent #ff6b6b)
- Glowing card borders with red/teal shadows
- Matrix effect container styles
- Custom font styling (bold uppercase headings like OpenClaw)
- Nebula/star background gradients behind the matrix

## Modified Files

### 10. `src/App.tsx`
- Add lazy import for `ClawModePage`
- Add route: `<Route path="/claw" element={<ClawModePage />} />`

### 11. `index.html`
- No changes to the main favicon (the Claw page will handle its own favicon override via a React useEffect that swaps it on mount and restores on unmount)

## Lobster Emoji Usage
The lobster emoji will appear in:
- Page favicon (dynamically set via useEffect on mount)
- Header logo (large lobster emoji next to "CLAW MODE")
- Hero section (oversized animated lobster)
- Section headers ("Claw Agents", "Trading Agents", "Top Tokens")
- Stats bar labels
- Strategy cards
- Footer branding
- Quick stat chips
- Loading states
- Empty states ("No tokens yet" messages)
- Create agent card
- Matrix rain (occasional lobster emojis mixed in with falling characters)

## Content Mapping (No TUNA mentions)
| Original | Claw Mode |
|----------|-----------|
| TUNA Agents | Claw Agents |
| TUNA treasury | Claw treasury |
| @BuildTuna | @ClawMode |
| !tunalaunch | !clawlaunch |
| SubTuna | SubClaw |
| tuna.fun | claw.mode |
| TUNA OS | CLAW MODE |

## Reused Hooks and Components (no changes needed)
- `useAgentTokens` -- token listing data
- `useAgentStats` -- platform statistics  
- `useTradingAgents` / `useTradingAgentLeaderboard` -- trading agent data
- `useSolPrice` -- price conversion
- `AgentTokenCard` -- individual token cards
- `TradingAgentCard` / `TradingAgentCardSkeleton` -- trading agent cards
- `FearGreedGauge` -- market sentiment widget
- `CreateTradingAgentModal` -- agent creation flow

## Technical Details

### Matrix Background
- HTML5 Canvas, position: fixed, z-index: 0, pointer-events: none
- Columns based on viewport width / 20px character size
- Characters: katakana range (0x30A0-0x30FF) + digits + occasional lobster emoji
- Color: #00ff41 (classic matrix green) at varying opacity
- ~30fps via requestAnimationFrame
- Canvas clears with rgba(10,10,15,0.05) for trail effect

### Dynamic Favicon
```text
useEffect(() => {
  const link = document.querySelector("link[rel='icon']");
  const original = link?.getAttribute('href');
  // Create lobster emoji favicon via canvas
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.font = '28px serif';
  ctx.fillText('', 2, 28);
  link?.setAttribute('href', canvas.toDataURL());
  return () => { link?.setAttribute('href', original); };
}, []);
```

### Color Scheme (claw-theme.css variables)
```text
--claw-bg: #0a0a0f
--claw-card: #111118  
--claw-border: #1a1a2e
--claw-primary: #ef4444 (red)
--claw-secondary: #22d3ee (cyan/teal)
--claw-accent: #ff6b6b (coral)
--claw-matrix: #00ff41 (matrix green)
--claw-text: #e2e8f0
--claw-muted: #64748b
```
