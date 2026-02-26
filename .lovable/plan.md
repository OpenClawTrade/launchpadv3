
# Show Token Detail Page Without Trading for Punch Tokens

## Overview
The "View Token" button after a punch launch already navigates to `/launchpad/${mintAddress}`, which loads `FunTokenDetailPage`. Punch tokens are stored in `fun_tokens` with `launchpad_type: "punch"`, so the page can detect them and hide trading UI.

## Changes

### 1. Hide trading panels for punch tokens (`src/pages/FunTokenDetailPage.tsx`)
- Detect punch tokens via `(token as any).launchpad_type === 'punch'`
- When detected, skip rendering `TradeSection` in all three layouts (phone, tablet, desktop)
- Hide the phone bottom BUY/SELL bar for punch tokens
- On mobile, remove the "trade" tab option -- default to "chart" tab instead
- Show a small info banner in place of the trade panel: "Trading coming soon for Punch tokens"

### 2. Adjust layouts for no-trade mode
- **Phone**: Only show "chart" and "comments" tabs (no "trade" tab). Default to "chart"
- **Tablet**: Remove the right sidebar trade column, let chart/info take full width (12 cols)
- **Desktop**: Chart takes 9 cols, info/comments sidebar stays at 3 cols, but no trade panel below chart

### Technical Details
- Add a boolean `const isPunchToken = (token as any).launchpad_type === 'punch'` near the existing flags
- Conditionally render `TradeSection` and `EmbeddedWalletCard` only when `!isPunchToken`
- Change mobile tab type to exclude 'trade' when `isPunchToken`, defaulting `mobileTab` to 'chart'
- Hide the fixed bottom BUY/SELL bar when `isPunchToken`
- All other elements (chart, token details, contract, description, comments, bonding progress) remain visible
