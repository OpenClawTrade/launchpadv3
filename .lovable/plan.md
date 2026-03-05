

## Professional Axiom-Style Terminal Upgrade

This is a large feature covering: Axiom-style column headers with P1/P2/P3 wallet presets, a full Filters dialog, token card social icons + holders + pro traders, and improved Migrated tab visibility.

### 1. Axiom-Style Column Headers (AxiomTerminalGrid.tsx)

Replace current `PulseColumnHeader` with Axiom's exact header bar layout:

```text
| ⚡ 0.5 | ☰ | P1  P2  P3 |  New Pairs  | ⚡ 0.4 | ☰ | P1  P2  P3 |  Final Stretch  | ⚡ 0.5 | ☰ | P1  P2  P3 |  Migrated  |
```

Each column header shows:
- Lightning bolt + quick buy amount (editable per-wallet preset)
- Hamburger menu icon
- P1 / P2 / P3 wallet preset buttons (stored in localStorage per column)
- Column label (no count numbers visible by default)
- Filter icon (opens the Filters dialog scoped to that column)

P1/P2/P3 represent wallet presets -- clicking one selects it as the active quick-buy wallet. Store as `pulse-wallet-p1`, `pulse-wallet-p2`, `pulse-wallet-p3` in localStorage. For now these are UI-only placeholders since wallet management is separate.

### 2. Filters Dialog (new component: `PulseFiltersDialog.tsx`)

A Dialog/Sheet matching the Axiom screenshots exactly, with 3 column tabs at the top (New Pairs, Final Stretch, Migrated -- each with count badge) and 4 content tabs:

**Protocols tab**: Checkbox grid of launchpad protocols (Pump, Dynamic BC, Meteora AMM, Raydium, etc.) -- filters by `launchpad_type` or Codex `launchpadName`.

**Audit tab**: Min/Max range inputs for:
- Age (with m/h/d unit selector)
- Top 10 Holders %
- Dev Holding % (max default 0)
- Snipers %, Insiders %, Bundle %
- Holders (min/max)
- Pro Traders (min/max)

**$ Metrics tab**: Min/Max range inputs for:
- Liquidity ($)
- Volume ($)
- Market Cap ($)
- B. Curve %
- Global Fees Paid (SOL)
- Txns, Num Buys, Num Sells

**Socials tab**: Toggle filters for has Twitter, has Website, has Telegram.

Bottom bar: Import / Export / Share / Apply All buttons.

Filter state stored in React context or lifted to `TradePage.tsx`. On "Apply All", the filter predicates are applied to `filteredTokens` in each column of `AxiomTerminalGrid`. Each column can have independent filter configs (per the column tabs in the dialog).

### 3. Token Card Enhancements (AxiomTokenRow.tsx + CodexPairRow.tsx)

**Social icons row** -- show conditionally with proper icons:
- X/Twitter icon (only if `twitter_url` exists) -- already present
- Globe/Website icon (only if `website_url` exists) -- already present
- Telegram icon (MessageCircle, only if telegram URL exists)
- Remove placeholder social icons that show for all cards

**Holders display**:
- Show `Users` icon + holder count in the social row (already partially there, clean up duplicates)

**Pro Traders**:
- New concept: count of users from our platform who traded this token
- Requires a new DB query or edge function: count distinct `user_id` from `trades` or `swaps` table where `mint_address` matches
- For now, create a hook `useProTradersCount` that queries trades grouped by mint_address
- Display with a distinct icon (e.g., `ShieldCheck` or `Crown`) + count next to holders

**Clean up duplicates**: Currently holders are shown in both Line 2 and Line 3 of the card -- consolidate to one location.

### 4. Migrated Tab Visibility

- Make the Migrated tab/column header more prominent with a brighter accent color (shift from current blue to a more vivid blue/purple)
- On mobile tab bar, increase font weight for Migrated
- On desktop, use a slightly different background tint for the Migrated column header

### 5. Database Requirements

Need to check if there's a trades/swaps table to query pro traders count. If not, we'll create a `token_trades` table or use existing transaction logging to count platform users per token. If no trade logging exists, the Pro Traders count will show "0" initially and we'll add a note about implementing trade tracking.

### Files to Create/Modify

- **New**: `src/components/launchpad/PulseFiltersDialog.tsx` -- full filter dialog
- **New**: `src/components/launchpad/PulseColumnHeaderBar.tsx` -- Axiom-style header with P1/P2/P3
- **New**: `src/hooks/useProTradersCount.ts` -- hook to count platform traders per token
- **New**: `src/hooks/usePulseFilters.ts` -- filter state management
- **Modify**: `src/components/launchpad/AxiomTerminalGrid.tsx` -- integrate new headers, filters, pass filter state
- **Modify**: `src/components/launchpad/AxiomTokenRow.tsx` -- add social icons, holders, pro traders
- **Modify**: `src/components/launchpad/CodexPairRow.tsx` -- same card enhancements
- **Modify**: `src/pages/TradePage.tsx` -- lift filter state, pass to grid
- **Modify**: `src/index.css` -- new styles for header bar, filter dialog
- **Possible migration**: Create `token_pro_traders` view or query against existing swap/trade data

