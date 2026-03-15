
Goal: fix two issues fast and decisively:
1) King of the Hill quick-buy amount must be editable and persisted for future trades.
2) Alpha Tracker must reliably show token images for the latest trades (target: visible icon for each of last 20 rows, with snapshots).

Plan

1) Make King of the Hill quick buy editable + persistent
- File: `src/components/launchpad/KingOfTheHill.tsx`
- Replace the current read-only quick-buy state with editable state:
  - `quickBuyAmount`, `quickBuyInput`, `editingQuickBuy`
  - validation: positive decimal only
- Add a compact inline editor in the KOTH header (same visual style family as existing Pulse quick-buy controls).
- Persist value to `localStorage` key `pulse-quick-buy-amount` on save (blur/Enter).
- Keep value synced on mount and after edits so all KOTH cards use the updated amount immediately.
- Pass `chain` through to `PulseQuickBuyButton` from KOTH so quick-buy path is correct on both Solana and BNB.

2) Rebuild Alpha Tracker token-image resolution pipeline (waterfall + caching)
- File: `src/hooks/useAlphaTrades.ts`
- Keep current DB lookups (`tokens`, `fun_tokens`, `claw_tokens`) as first priority.
- Add metadata enrichment for unresolved Solana mints via existing backend function `fetch-token-metadata`.
- Build deterministic fallback candidates per trade:
  - Solana: DB image → metadata image → DexScreener → identicon
  - BNB: DB image → DexScreener (bsc) → 1inch CDN → PancakeSwap CDN → identicon
- Return both:
  - primary `token_image_url`
  - `token_image_fallbacks` array for UI-level failover
- Add lightweight in-hook caching for unresolved mints so repeated polling doesn’t repeatedly fetch same missing metadata.

3) Update Alpha UI renderers to use resilient image component
- Files:
  - `src/pages/AlphaTrackerPage.tsx`
  - `src/components/home/AlphaSection.tsx`
- Replace raw `<img>` usage with `OptimizedTokenImage` so URL normalization + fallback sequencing works consistently.
- Feed `fallbackSrc` with `token_image_fallbacks`.
- Keep compact text fallback only as final safety net (no broken-image blanks).

4) Verification workflow with snapshots (explicitly requested)
- After implementation, run a strict visual verification loop on `/alpha-tracker`:
  - Check latest 20 rows.
  - Requirement: each row has a visible icon (real logo preferred; deterministic fallback if source fails).
- Capture snapshots each iteration until 20/20 rows show an icon.
- If any row fails:
  - inspect failed URL pattern
  - adjust fallback ordering/resolution
  - retake snapshot and repeat
- Also verify KOTH quick-buy persistence:
  - edit value
  - refresh
  - confirm value is retained and used by KOTH quick-buy buttons.

Technical details
- Affected files:
  - `src/components/launchpad/KingOfTheHill.tsx`
  - `src/hooks/useAlphaTrades.ts`
  - `src/pages/AlphaTrackerPage.tsx`
  - `src/components/home/AlphaSection.tsx`
- No database migration required for this fix.
- Existing backend metadata function (`fetch-token-metadata`) is reused; no new backend endpoint needed.
- Acceptance criteria:
  - KOTH quick-buy amount editable and persisted for future sessions/trades.
  - Alpha Tracker latest 20 rows render icons without broken-image states.
  - Snapshot proof captured after final pass.
