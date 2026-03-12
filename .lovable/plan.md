

## Plan: Rewrite Documentation Page for Multi-Chain Coverage

### Issues Found
1. **Wrong ticker**: Page never mentions $MOON — needs to reference it as the platform token
2. **Solana-only**: No mention of BNB Chain, PancakeSwap graduation, OpenOcean routing, or Split Vault fee system
3. **Outdated URLs**: Links section points to `saturntrade.lovable.app` and `x.com/saturntrade` instead of `moondexo.com` and `x.com/moondexo`
4. **Subtitle wrong**: Says "The Fastest AI-Powered Trading Terminal on Solana" — should be multi-chain
5. **Missing features**: Discover page, Tokens page, Merch page not mentioned
6. **Stale details**: Infrastructure section lists only Helius — should include Alchemy as primary RPC
7. **Template string bugs**: Lines 29 and 548 use `${BRAND.name}` (template literal syntax) inside JSX — should be `{BRAND.name}`

### Changes — Single File: `src/pages/WhitepaperPage.tsx`

Full rewrite of all content sections:

**Header**: Fix to "MoonDexo Documentation" with subtitle "Multi-Chain AI Trading Terminal — Solana & BNB Chain". Token: $MOON.

**Table of Contents** — Updated to 10 sections matching actual features from sidebar:
1. Platform Overview (multi-chain, $MOON token)
2. Pulse Trading Terminal (Solana + BNB columns, Codex/DexScreener data)
3. Token Launchpad (Solana: Meteora DBC; BNB: SaturnPortal bonding curve with ~16 BNB graduation)
4. Tokens & Discover (token browser, trending, DexScreener integration)
5. AI Trading Agents (strategies, voice fingerprinting)
6. Alpha Tracker (smart money tracking)
7. X Tracker (KOL monitoring)
8. Leverage Trading (Aster DEX on BNB Chain)
9. Fee Architecture (Solana fee split + BNB Split Vault with 1% platform + up to 8% creator)
10. Technical Infrastructure & Security (dual-chain stack: Alchemy + Helius RPC, Privy auth, OpenOcean for BNB swaps, Jupiter for Solana)

**Links section**: Updated to use `BRAND.domain`, `BRAND.twitterUrl`

**Fix JSX bugs**: `${BRAND.name}` → `{BRAND.name}` on lines 29 and 548

