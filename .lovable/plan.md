
## Redesign: Professional "Create Token" Popup

### The Problem

The current dialog looks unprofessional because of two layered issues:

1. **Double-wrapped container**: The `DialogContent` has its own background/border, AND the `TokenLauncher` inside it renders another `gate-card` (with its own border, header, padding). This creates a box-within-a-box that looks broken.

2. **Wrong theme accent**: The previous fix used green `#4ade80` accents, but the app's design system uses **red `#e84040`** (as defined in `gate-theme.css`: `--gate-primary: 0 84% 60%`). The dialog should match the actual app theme.

3. **Radix default styling bleeds through**: The `DialogContent` from Radix has its own `bg-background`, `rounded-lg`, padding and close button which conflict with the custom styling.

### The Fix — Two Parts

#### Part 1 — `TokenLauncher.tsx`: Extract card wrapper into a "bare" variant

Add a `bare?: boolean` prop to `TokenLauncher`. When `bare={true}` (used inside the dialog), skip the `<Card className="gate-card">` wrapper and render just the inner content directly. This eliminates the double-border/double-background issue.

```
Before (inside dialog):
  DialogContent (dark bg, border)
    └── Card.gate-card (another dark bg, another border)
          └── content

After:
  DialogContent (styled shell)
    └── content (no wrapping card)
```

#### Part 2 — `FunLauncherPage.tsx`: Restyle the Dialog shell to match app theme

The redesigned modal shell:

```
┌──────────────────────────────────────────────┐  ← red (#e84040) top accent line (2px)
│ [🚀] CREATE TOKEN              [Launch Agent] [X] │  ← header: near-black bg
│ ────────────────────────────────────────────── │  ← 1px border-bottom
│                                                │
│  [Random] [Describe] [Realistic] [Custom]      │  ← mode tabs (from TokenLauncher)
│  [Phantom] [Holders]                           │
│                                                │
│         < form content >                       │  ← scrollable body
│                                                │
└──────────────────────────────────────────────┘
```

**Specific styling changes:**
- `background: #0a0a0b` (true terminal black matching `gate-bg-card`)
- `border: 1px solid #1c1c1f` (matching `gate-border`)
- `border-radius: 6px` (matching app's flat `--gate-radius-xl: 6px`, NOT 12px)
- Top accent line: `background: linear-gradient(90deg, #e84040, #c42c2c, transparent)` (red brand color)
- Left border on header: `border-left: 3px solid #e84040`
- Box shadow: `0 0 60px rgba(232,64,64,0.06), 0 24px 48px rgba(0,0,0,0.9)`
- Header: `background: #0d0d0f`, sticky, `border-bottom: 1px solid #1c1c1f`
- Scrollable body: `overflow-y: auto`, no extra padding beyond what `TokenLauncher` already provides
- Remove Radix's default close button (`[cmdk-dialog-overlay]`) by hiding via CSS override
- Max width: `700px`, full mobile width with `calc(100vw - 1rem)` 
- Max height: `90vh`, body scrolls independently

**Header contents (left → right):**
- `🚀` emoji + `CREATE TOKEN` in white (uppercase, bold, 14px)
- Subtitle: `Launch on Solana` in muted monospace
- Right side: Red "Launch Agent" button (`/agents` link) + X close button

### Technical Notes

- `TokenLauncher` already has 6 mode tabs (Random, Describe, Realistic, Custom, Phantom, Holders) — these don't need to be reimplemented in the dialog, they're already inside the component
- The `gate-card` wrapping in `TokenLauncher` provides `gate-card-header` (with "Launch Meme Coin" title + "Launch Agent" button) and `gate-card-body` — when `bare={true}`, we skip the outer `<Card>` but can keep the inner structure, or remove the redundant header since the dialog already has one
- The Radix `DialogContent` has a built-in close button (`DialogClose`) — we'll hide it with `[&>button:first-child]:hidden` and render our own styled X button inside the header

### Files Changed

| File | Change |
|---|---|
| `src/components/launchpad/TokenLauncher.tsx` | Add `bare?: boolean` prop; when true, skip `<Card className="gate-card">` outer wrapper and the internal header (since dialog provides it) |
| `src/pages/FunLauncherPage.tsx` | Restyle `DialogContent` block (lines 462–505) with red terminal theme, remove double-container, pass `bare` prop to `TokenLauncher` |

No CSS file changes needed — all styling is inline to avoid specificity conflicts with Radix overrides.
