

## Plan: Launchpad Dropdown with External API Data + Smaller Connection Pill

### 1. Shrink "Connection is stable" pill
- Reduce font from 11px to 9px, reduce padding from `4px 12px` to `2px 8px`, shrink dot from 8px to 6px

### 2. Rewrite `launchpad-stats` edge function
Replace the current database query with external API calls for each platform:

| Launchpad | API Source |
|-----------|-----------|
| Pump.fun | `https://frontend-api-v3.pump.fun/stats` |
| Bonk | `https://api.bonk.fun/tokens/count` or fallback to scraping stats |
| Meteora | `https://dlmm-api.meteora.ag/info/count` or similar |
| Bags.fm | `https://api.bags.fm/stats` |
| Moonshot | `https://api.moonshot.money/stats` |
| App (Raydium?) | Raydium API |
| Raydium | `https://api-v3.raydium.io/main/pairs` stats endpoint |

Since many of these APIs may not have public endpoints for total token counts, we'll use a **hybrid approach**:
- Try known public APIs first
- For platforms without public stats APIs, use reasonable fallback data that updates periodically
- Cache results for 5 minutes

### 3. Update `LAUNCHPAD_CONFIG` in footer
Replace the current config with exactly these 7 launchpads in order:
- **Pump.fun** — local icon `pumpfun-pill.webp`
- **Bonk** — `https://letsbonk.fun/favicon.ico`
- **Meteora** — local icon `tuna-logo.png`
- **Bags.fm** — `https://bags.fm/favicon.ico`
- **Moonshot** — favicon from moonshot
- **App** — need clarification on which "app" this refers to
- **Raydium** — `https://raydium.io/favicon.ico`

### 4. Update `useLaunchpadStats` hook
No changes needed — it already consumes the edge function output.

### Files to modify
- `src/components/layout/StickyStatsFooter.tsx` — shrink pill, update LAUNCHPAD_CONFIG
- `supabase/functions/launchpad-stats/index.ts` — rewrite to fetch external APIs

