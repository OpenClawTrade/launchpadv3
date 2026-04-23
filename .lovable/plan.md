

## Goal

Give every page in the app the **exact same header and footer** as the landing page (`/`), so navigation and branding feel identical everywhere — including admin, trade/ape, agents, whitepaper, leverage, etc.

## What "the landing page header/footer" actually is

The landing page (`/`) renders an **iframed `launch.html`** with its own internal nav + footer + sticky bottom bar. Outside the iframe, the canonical React equivalents that mirror it 1:1 are already built:

- **Header:** `PopshibaTopNav` (POPSHIBA logo, Home / Trade / Holders / Alpha / Tracker / Docs, Telegram + X icons, Connect, Create) — same one used by `HomePage` and `ApePage`.
- **Top footer block:** `PopshibaFooter` (dark band, "© 2026 POPSHIBA · NOT FINANCIAL ADVICE · DYOR, DEGEN").
- **Sticky bottom bar:** the existing React `Footer` (Tracker / + New Pairs popovers, 🚀 Launch / ⚡ Pulse, BTC/ETH/BNB tickers, Stable indicator) — this is the same widget that lives at the bottom of `launch.html`.

The plan standardises on this trio: `PopshibaTopNav` + page content + `PopshibaFooter` + `Footer` (sticky bar).

## Pages to convert

Today the app has three competing layouts. Everything in groups 2 and 3 will be rebuilt onto group 1's stack.

**Group 1 — Already correct (leave as-is, only verify):**
`HomePage`, `ApePage`, `PopshibaEarnings`, plus iframe pages (`PopshibaLaunchpadPage`, `PopshibaAlphaPage`, `PopshibaXTrackerPage`) where the iframe template already contains the matching nav/footer.

**Group 2 — Uses old `AppHeader` + `Sidebar` + legacy `Footer`. Strip sidebar, swap to `PopshibaTopNav` + `PopshibaFooter` + sticky `Footer`:**
`AdminPanelPage`, `AgentsPage`, `WhitepaperPage`, `CreateTokenPage`, `LaunchTokenPage`, `FunLauncherPage`, `GovernancePage`, `InvestigateTokenPage`, `MerchStorePage`, `PanelPage`, `SixtyNineListPage`, `TokenomicsPage`, `TrendingPage`, `TwitterBotAdminPage`, `WalletTrackerPage`.

**Group 3 — Uses `LaunchpadLayout` (which already provides `PopshibaTopNav` + `PopshibaFooter` but is missing the sticky bottom bar). Add sticky `Footer` to the layout once:**
`BagsAgentsPage`, `AgentDocsPage`, `DexListPage`, `PerpsPage`, `LeveragePage`, `MeteoritePage`, plus every other `LaunchpadLayout` consumer.

**Group 4 — Standalone / niche pages that currently have no shared chrome:** `BitcoinModePage`, `BitcoinTokenDetailPage`, `BtcMemeDetailPage`, `BtcMemeLaunchPage`, `BitcoinLaunchPage`, `LaunchNowPage`, `NotFound`, `BannerMakerPage`, `BrandAssetsPage`, `BrandingAdminPage`, `CareersPage`, `ConsolePage`, `DiscoverPage`, `EarningsPage`, `RewardsPage`, `PortfolioPage`, `XTrackerPage`, `XBotAdminPage`, `XPostRestylerPage`, plus all admin sub-pages (`SaturnAdminLaunchPage`, `MevAdminPage`, `BatchLaunchAdminPage`, `DeployerDustAdminPage`, `TreasuryAdminPage`, `VanityAdminPage`, `AssistedSwapsAdminPage`, `InfluencerRepliesAdminPage`, `PromoMentionsAdminPage`, `AgentLogsAdminPage`, `SaturnForumAdminPage`, `DexListingAdminTab`, `SellAllPage`, `CompressedDistributePage`, `DecompressPage`, `TunnelDistributePage`, `VanityGeneratorPage`, `ClaudeLauncherPage`, `FollowerScanPage`, `PartnerFeesPage`, `PublicDeployPage`, `ReferralRedirectPage`, `SaturnCommunityPage`, `SaturnPostPage`, `SaturnForumPage`, `SaturnModePage`, `BondingCurveLabPage`, `AICollabPage`, `AgentConnectPage`, `AgentDashboardPage`, `AgentLeaderboardPage`, `AgentProfilePage`, `TradingAgentProfilePage`, `TradingAgentsPage`, `TradePage`, `TokenDetailPage`, `FunTokenDetailPage`, `FunModePage`, `AlphaTrackerPage`, `AllTokensPage`, `LaunchpadTemplatePage`, `TATWhitepaperPage`, `WidgetPage`, `V2BitcoinModePage`, `V2BtcMemeDetailPage`, `V2BtcMemeLaunchPage`, `UserProfilePage`. Wrap each in `LaunchpadLayout` (which now also renders the sticky bar).

## Implementation steps

1. **Update `LaunchpadLayout`** so it always renders the canonical trio:
   ```
   PopshibaTopNav  →  <main>{children}</main>  →  PopshibaFooter  →  Footer (sticky bar)
   ```
   - Keep its existing `hideFooter` / `noPadding` props for the rare pages (Leverage terminal) that need a flush layout, but `hideFooter` will only hide the dark `PopshibaFooter` band, never the sticky bar.
   - Remove the orange `#f5a524` body background override so the chrome inherits the same look as `/`.

2. **Remove the old chrome from every Group 2 page**: delete the `Sidebar`, `AppHeader`, the `md:ml-[48px]` wrapper, and the legacy `<Footer />` import; replace the outer JSX with `<LaunchpadLayout>...</LaunchpadLayout>`. The page's inner content/markup stays exactly the same.

3. **Wrap every Group 4 page** in `<LaunchpadLayout>`. Pages that currently render full-bleed terminals (BTC, Trade, TokenDetail) get `<LaunchpadLayout noPadding>` so their internal grids aren't disturbed.

4. **Fix `ApePage`** to use `LaunchpadLayout` too instead of hand-rolling `PopshibaTopNav` + `Footer`, so it stays in lockstep with everything else automatically.

5. **Delete the now-unused global `<StickyStatsFooter />`** mounted in `App.tsx` (it's the cream Pulse-only bar the user already complained about) — the sticky bar is provided per-layout now, so the global one is redundant and conflicts.

6. **Iframe pages** (`PopshibaLaunchpadPage`, `PopshibaAlphaPage`, `PopshibaXTrackerPage`): leave their internal `launch.html` / `alpha.html` / `x-tracker.html` headers and footers alone — they already match by design. Do NOT wrap them in `LaunchpadLayout` (would double up the chrome).

7. **Admin pages** specifically: same treatment as the rest. The "admin" nav state is already inside the page body, so wrapping in `LaunchpadLayout` only changes the surrounding chrome, not the admin tabs.

## Out of scope

- No visual redesign of `PopshibaTopNav`, `PopshibaFooter`, or the sticky `Footer` — they're already pixel-matched to `launch.html`.
- No changes to the iframe templates themselves.
- Sidebar (`Sidebar.tsx`) and `AppHeader.tsx` files stay on disk but become unused; safe to leave for now to avoid surprise breakage in any lazy-loaded route I might miss.

