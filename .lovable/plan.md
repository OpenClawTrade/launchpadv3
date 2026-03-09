

## Problem

Two issues with current sparklines:

1. **Not full width**: `chartLeft = width * 0.45` restricts drawing to the right 55% of the card. User wants full-width like Azura.

2. **All charts look identical**: The Codex API returns only 1 data point per new token. The `normalizeFlatData` function seeds synthetic curves from the data values, but since all tokens have nearly identical single values (~1e-10), the seed hash produces near-identical wave patterns for every card.

## Root Cause (from network logs)

Every token sparkline response contains exactly 1 value: `{"sparklines":{"addr1":[2.94e-10],"addr2":[7.38e-10],...}}`. With only 1 point, `normalizeFlatData` kicks in but seeds from `Math.sin(seed * i * 0.1)` where `seed` is derived from these tiny similar numbers — producing visually identical curves.

## Plan

### 1. SparklineCanvas.tsx — Full width + unique seed prop

- Remove right-alignment: change `chartLeft = width * 0.45` to `chartLeft = 0`, `chartWidth = width`
- Add optional `seed` prop (string, e.g. token address) to generate truly unique synthetic curves
- Update `normalizeFlatData` to accept and use the string seed (hash each character) instead of deriving from near-zero data values
- Increase synthetic data point count (e.g. 20-30 points) for smoother wave patterns
- Vary amplitude and frequency per seed for visual diversity

### 2. All callers — Pass seed prop

Update all 5 `<SparklineCanvas>` usage sites to pass the token address as `seed`:
- `AxiomTokenRow.tsx` — `seed={token.mint_address}`
- `CodexPairRow.tsx` — `seed={token.address}`
- `TokenCard.tsx` — `seed={token.mint_address}`
- `KingOfTheHill.tsx` — `seed={token.mint_address}`
- `FunLauncherPage.tsx` — `seed={token.mint_address}`

### Files to modify
- `src/components/launchpad/SparklineCanvas.tsx`
- `src/components/launchpad/AxiomTokenRow.tsx`
- `src/components/launchpad/CodexPairRow.tsx`
- `src/components/launchpad/TokenCard.tsx`
- `src/components/launchpad/KingOfTheHill.tsx`
- `src/pages/FunLauncherPage.tsx`

