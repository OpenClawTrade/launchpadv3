
# Redesign: Create Token Page — Professional Terminal Aesthetic

## Current State

The `LaunchTokenPage` and `LaunchTokenForm` are plain and unstyled — basic gray cards, no visual hierarchy, no brand identity. The uploaded screenshot reference shows a dark terminal-style UI with a structured sidebar layout. The project's established design language is: `#0a0a0a` background, `#e84040` red accents, monospace fonts, high-density data-forward layout.

## Goal

Transform the Create Token page into a sleek, professional terminal-style form that matches the Axiom/Claw Mode aesthetic — dark panels, red accents, structured sections with clear labels, and a compelling launch CTA.

---

## Files to Modify

- `src/pages/LaunchTokenPage.tsx` — Full page layout redesign (two-column on desktop, single column on mobile)
- `src/components/launchpad/LaunchTokenForm.tsx` — Full form reskin: terminal input style, red accents, structured step-by-step sections

---

## Design Blueprint

### Page Layout (`LaunchTokenPage.tsx`)

Replace the plain centered layout with a two-column terminal panel:

```text
┌─────────────────────────────────────────────────────────────┐
│  [←] CREATE TOKEN          [🚀 LAUNCH TOKEN]  [×]          │
│  monospace subtitle: Launch on Solana                       │
├────────────────────────────┬────────────────────────────────┤
│  LEFT COLUMN               │  RIGHT SIDEBAR                 │
│  ─ Token Image Upload      │  ─ Wallet Balance Card         │
│  ─ Name / Ticker fields    │  ─ Info box: fee breakdown     │
│  ─ Description             │  ─ Chain: Solana (live)        │
│  ─ Social Links (expand)   │  ─ Tip: min 0.5 SOL           │
│  ─ Fee Mode selector       │                               │
│  ─ Initial Buy input       │                               │
│  ─ CAPTCHA                 │                               │
│  ─ [LAUNCH TOKEN] button   │                               │
└────────────────────────────┴────────────────────────────────┘
```

### Visual Language

- **Background:** `#0a0a0a` (true black)
- **Panel borders:** `border border-[#e84040]/20` with subtle red glow on focus
- **Section headers:** monospace uppercase labels in `#e84040` with a left red border strip
- **Inputs:** `bg-[#111] border border-[#333]` → on focus `border-[#e84040]/60`
- **Submit button:** `bg-[#e84040] text-white font-mono uppercase tracking-widest` with hover glow
- **Image upload zone:** Dashed red border, drag-hover state
- **Fee mode cards:** Dark cards with red active border, icon badges

### Section-by-Section Changes in `LaunchTokenForm.tsx`

**Section 1 — Token Identity**
- Left: Large square image drop zone (128px) with upload icon + "DROP IMAGE" label
- Right: `TOKEN NAME` and `TICKER` stacked inputs with monospace placeholder text, character counters
- Full-width: `DESCRIPTION` textarea with char count

**Section 2 — Social Links**
- Collapsible with a clean expand chevron
- Grid of 4 inputs (Website, Twitter/X, Telegram, Discord) with branded icons
- Placeholder text styled like terminal commands: `https://...`

**Section 3 — Fee Distribution**
- Two option cards side by side:
  - `CREATOR REWARDS` — red accent, coins icon, "50% fees → you"
  - `HOLDER REWARDS` — green accent, users icon, "50% fees → top 50 holders" + NEW badge

**Section 4 — Initial Buy**
- Full-width SOL input with large SOL icon badge on left
- USD value shown right-aligned in muted text
- Preset quick-select buttons: `0.1`, `0.5`, `1.0`, `2.0` SOL

**Section 5 — Launch**
- Full-width red button: `🚀 LAUNCH TOKEN` in monospace uppercase
- Rate limit countdown shown as red timer block
- CAPTCHA sits above the button

### Right Sidebar Panel (Desktop Only)

A sticky info panel showing:
- `WALLET BALANCE` card (existing `WalletBalanceCard`)
- A dark info card:
  - Chain: Solana (green dot)
  - Platform fee: 1%
  - Creator fee: 50% of trading fees
  - Total supply: 1,000,000,000
- A tip card: "We recommend ≥ 0.5 SOL initial buy to avoid snipers"

---

## Technical Implementation

### `LaunchTokenPage.tsx`
- Change to `grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6` layout
- Move the `WalletBalanceCard` into the right column
- Add an info sidebar card listing platform specs
- Add the red left-border header strip with monospace title

### `LaunchTokenForm.tsx`
- Replace all `bg-card border-border rounded-2xl` → `bg-[#111] border border-[#222] rounded-lg`
- All section headers → `font-mono text-xs text-[#e84040] uppercase tracking-widest border-l-2 border-[#e84040] pl-2`
- All inputs → `bg-[#0a0a0a] border border-[#333] focus:border-[#e84040]/60 font-mono text-white rounded`
- Add SOL preset buttons (0.1 / 0.5 / 1.0 / 2.0) below the initial buy input
- Launch button → `bg-[#e84040] hover:bg-[#c73333] text-white font-mono uppercase tracking-widest h-14 rounded`
- Keep all existing logic/validation/hooks intact — this is purely a visual reskin
