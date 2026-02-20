

# Professional NFA Page Redesign + Persistent Wallet Bar

## Overview
Two major improvements: (1) Redesign the NFA tab to match OpenSea's premium NFT collection page aesthetic, and (2) Add a persistent wallet info bar across all Panel tabs showing balance, address copy, deposit, and export key features.

---

## Part 1: Persistent Wallet Bar in Panel Header

### What
Add a wallet info strip below the "PANEL" heading in `PanelPage.tsx` that appears on **every tab**. It shows:
- SOL balance (live-updating every 15s)
- Truncated address with copy button
- Deposit button (opens QR modal)
- Export Key button (opens Privy export flow)
- Solscan link

### Technical Approach
- Create a new component `src/components/panel/PanelWalletBar.tsx`
- Uses `useSolanaWalletWithPrivy` for balance fetching and `usePrivy().exportWallet` for key export
- Reuses deposit QR dialog and export dialog patterns from `EmbeddedWalletCard.tsx`
- Compact horizontal strip design: `[SOL icon] 0.4521 SOL | Hx8k...9aVr [copy] [deposit] [export] [solscan]`
- Glassmorphism card style matching the premium Web3 aesthetic
- Render it in `PanelPage.tsx` between the header and the tabs, so it persists across all tab switches

### Design
- Dark glass card: `bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl`
- Balance in large mono font with SOL suffix
- Buttons: ghost/outline style, small icons
- Mobile responsive: stacks vertically on small screens

---

## Part 2: NFA Tab OpenSea-Inspired Redesign

### Current State
Basic list view with a hero section, progress bar, How It Works section, fee structure cards, and a simple mint list.

### New Design (OpenSea Collection Page Style)

#### A. Hero Banner Section
- Full-width gradient banner at top (dark navy to emerald gradient with subtle grid pattern)
- Large centered NFA collection icon (64x64 with glow effect)
- Collection title "Non-Fungible Agents" in bold
- Subtitle with verified badge icon
- Stats row below: `Items: 1,000 | Minted: X | Owners: Y | Floor: 1 SOL`
- Each stat in its own mini column with label above and value below, separated by thin dividers

#### B. Live Mint Section (replaces basic progress card)
- Premium card with inner glow border
- "LIVE MINT" badge with pulsing green dot
- Batch number prominently displayed
- Custom animated progress bar (emerald gradient with shimmer animation)
- Large "X / 1,000" counter
- Slots remaining callout
- Prominent mint button with hover animation (scale + glow)
- Price tag: "1 SOL" with SOL icon

#### C. About Section (replaces How It Works)
- Two-column layout on desktop, single column mobile
- Left: "About" text description of the NFA collection
- Right: "Details" card with key-value pairs (Contract, Chain, Token Standard, Mint Price) styled like OpenSea's details panel

#### D. Activity/Properties Section
- Tabs within the NFA tab: "My NFAs" | "How It Works" | "Fee Structure"
- **My NFAs**: Grid layout (2 cols mobile, 3 cols desktop) showing NFA cards with:
  - Agent image (or placeholder with gradient)
  - Agent name
  - Slot number badge
  - Status badge (minted/pending/active)
  - Hover lift effect
- **How It Works**: Timeline/stepper layout (vertical line connecting steps) instead of plain list
- **Fee Structure**: Horizontal bar chart visualization instead of 4 grid boxes

---

## Files to Create/Modify

### New Files
1. **`src/components/panel/PanelWalletBar.tsx`** -- Persistent wallet strip component with balance, copy, deposit QR, export key, and Solscan link

### Modified Files
1. **`src/pages/PanelPage.tsx`** -- Import and render `PanelWalletBar` between header and tabs
2. **`src/components/panel/PanelNfaTab.tsx`** -- Complete redesign with OpenSea-inspired layout

### Technical Details

**PanelWalletBar.tsx:**
- Imports: `useSolanaWalletWithPrivy`, `usePrivy`, `useAuth`, QRCode, Dialog components
- State: balance, copied, showQR, showExport, confirmText, depositSuccess, balanceAtOpen
- Balance polling: fetch on mount + every 15s interval
- Deposit: QR dialog with address copy and live deposit detection (poll every 3s when open)
- Export: Dialog with "EXPORT" confirmation text, calls `exportWallet()`
- Layout: flex row with items-center, responsive (flex-col on mobile)

**PanelNfaTab.tsx redesign:**
- Remove the existing monolithic layout
- Add internal tab state for "My NFAs" / "How It Works" / "Fees" sub-sections
- Hero: `div` with gradient background, stats row using flex with gap-8
- Mint section: Card with relative positioning for glow effects, custom Progress with emerald gradient
- NFA grid: CSS grid `grid-cols-2 md:grid-cols-3` with cards that have `hover:scale-[1.02]` and `hover:shadow-lg` transitions
- Timeline: Vertical line with connected dots for each step
- Fee bars: Horizontal bars with percentage widths and labels

**PanelPage.tsx changes:**
- Import `PanelWalletBar`
- Place `<PanelWalletBar />` right after the Panel Header div (line 88) and before the Tabs div
- Only render when `isAuthenticated` (already gated by the outer conditional)

