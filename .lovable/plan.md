
## Axiom-Style Trading Page — Complete Redesign

### What the user sees now vs. what they want

**Current state:** A basic card-stacked layout with minimal styling — generic gray cards, simple tab UI, tiny fonts, no visual hierarchy. Looks like a default shadcn demo page.

**Target (Axiom-style, per uploaded screenshot):** Dark, information-dense terminal aesthetic with:
- True black/near-black background
- Token identity in a sticky top bar (avatar, name, ticker, status badge, actions)
- Stats ribbon (Market Cap, 24h Vol, Holders, Price) in a single horizontal row with monospace numbers
- Bonding curve as a sleek minimal progress bar with labels
- Trade panel: large full-width Buy/Sell toggle (no tabs, styled as segmented buttons), big input, preset SOL amounts as pill buttons, clean output box
- Wallet card positioned as a sidebar column beside the trade panel
- Social links row directly under token info (Website, Twitter, Solscan, Axiom button styled distinctly)
- Sharp, minimal borders with very slight glow on interactive elements
- IBM Plex Mono or similar for all numbers

---

### Files to change

**1. `src/pages/FunTokenDetailPage.tsx` — complete visual redesign**

Restructure the JSX into this layout:

```
┌──────────────────────────────────────────────────────┐
│ ← Back  [Avatar] Name  $TICKER  [Bonding badge]      │
│         Created by 0x1234...  • links row            │
│         Description (truncated)                       │
├──────────────────────────────────────────────────────┤
│ MKTCAP  │  24H VOL  │  HOLDERS  │  PRICE             │ ← stats ribbon
├──────────────────────────────────────────────────────┤
│ ⚡ Bonding Curve  ████████░░░░  0.0%     0.00 / 85 SOL│
├──────────────────────────────────────────────────────┤
│         TRADE PANEL (2/3 col)    │  WALLET (1/3 col) │
│                                   │                   │
│  [  BUY  ] [  SELL  ]             │  💳 Wallet        │
│  ┌──────────────────────────────┐ │  Balance: 0.0000  │
│  │  0.00                    SOL│ │  SOL              │
│  └──────────────────────────────┘ │                   │
│  [0.1] [0.5] [1 SOL] [5 SOL]     │  0x1234...        │
│                                   │  [Deposit][Export]│
│  ↓                                │                   │
│  ┌──────────────────────────────┐ │                   │
│  │  0                   TICKER │ │                   │
│  └──────────────────────────────┘ │                   │
│  Price impact: 0.00%              │                   │
│  Slippage: 5%  [0.5][1][2][5][10] │                   │
│                                   │                   │
│  [   BUY TICKER   ] ← green btn   │                   │
├──────────────────────────────────────────────────────┤
│ Contract: 0x1234...8765  [copy]   Pool: ...  │ Supply │
└──────────────────────────────────────────────────────┘
```

### Detailed Design Changes

**Token Header Section**
- Background: `bg-[#0a0a0a]` or `bg-background` — the existing dark theme
- Avatar: Larger (48px), squared with `rounded-xl`, border `border-border/50`
- Token name: `text-xl font-bold font-mono` 
- Ticker: Dimmer secondary text `text-muted-foreground`
- Status badge: Styled like Axiom — rounded pill, orange/amber for Bonding, green for Graduated
- Action icons: `RefreshCw`, `Copy`, `Share2` — ghost icon buttons grouped at right
- Social links: Small labeled buttons row — Website (Globe), Twitter (X icon), Solscan (ExternalLink), Axiom (custom green button matching the screenshot)

**Stats Ribbon**
- Replace 2x2 grid with 4-column horizontal bar
- Each stat: small all-caps gray label, large monospace value
- Dividers between stats via `divide-x divide-border`
- No card wrapper — direct row on a very slightly elevated `bg-[#111114]` strip
- Market cap in USD, Volume in SOL, Holders as integer, Price in full decimal

**Bonding Curve**
- Single line: `⚡ Bonding Curve` label left, `X.X%` right
- Below: custom styled `Progress` component — `h-1.5` track, primary color fill, glow shadow when near graduation
- Second line: `X.XX SOL raised` left · `Goal: 85 SOL` right
- `🔴 Live from Meteora` badge inline as a small dot

**Trade Panel — Axiom-style**
- Buy/Sell: Two full-width buttons side by side (not a radix Tabs component) — left button active = green tinted background, right = red when sell active
- Input: No border input, large `text-2xl` amount left, currency label right — dark inset style `bg-[#0d0d0d] border border-border/60`
- Quick amounts: `0.1 SOL`, `0.5 SOL`, `1 SOL`, `5 SOL` as small outlined pill buttons in a row (not full-width)
- Arrow: Minimal down arrow icon centered between inputs
- Output box: Same dark inset style, shows calculated output or quote
- Slippage: Instead of slider — preset pill buttons `0.5%`, `1%`, `2%`, `5%`, `10%` + custom input option
- Trade info: Compact rows — Price Impact, Route, Fee — `font-mono text-xs` values
- Action button: Full width, `h-14`, bold uppercase text — `BUY $TICKER` green / `SELL $TICKER` red with glow
- When not authenticated: Red "Connect Wallet" button matching existing primary color

**Wallet Card — Axiom sidebar style**
- Same `EmbeddedWalletCard` component — just used as-is in the right column
- No changes to wallet card functionality — just positioning

**Contract Info**
- Compact single card at bottom
- Monospace addresses, copy button, Solscan link

---

### Key implementation changes

**`FunTokenDetailPage.tsx`:**
1. Restructure layout: remove `space-y-6` stack, use proper section components
2. Stats: `grid-cols-4` with `divide-x` borders, no card wrapper
3. Trade panel: New inline slippage selector (pill buttons instead of slider)
4. BondingCurve section: Inline compact version
5. All numeric values: wrap in `font-mono` classes

**`TradePanelWithSwap.tsx`:**
1. Replace `Tabs` with styled button group for Buy/Sell
2. Replace `Slider` slippage with pill button preset selector  
3. Input: Redesigned dark inset box
4. Output: Matching dark inset box
5. Quick amounts: Pill style (rounded-full) not full outline buttons
6. Action button: Larger `h-14` with glow

**`UniversalTradePanel.tsx`:**
1. Same redesign as TradePanelWithSwap for consistency — same Buy/Sell button group, pill slippage, dark input boxes

---

### Files to be edited

| File | Change |
|---|---|
| `src/pages/FunTokenDetailPage.tsx` | Full layout redesign — Axiom-style header, stats ribbon, bonding section, 2/3+1/3 grid |
| `src/components/launchpad/TradePanelWithSwap.tsx` | Redesign trade UI — Buy/Sell buttons, pill slippage, dark inputs, large CTA |
| `src/components/launchpad/UniversalTradePanel.tsx` | Same redesign for consistency on graduated tokens |

No database changes. No new dependencies. No edge function changes.
