

## Full Rebrand: Claw Mode → Saturn Trade

This is a comprehensive rebrand touching 100+ files across the codebase. The uploaded logo will be copied as the new brand asset. Here is every file that needs changes, organized by category.

---

### 1. Logo & Assets

| Action | File |
|--------|------|
| Copy uploaded logo | `user-uploads://FullLogo_Transparent.png` → `src/assets/saturn-logo.png` AND `public/saturn-logo.png` |
| Update favicon | `public/favicon.png` (replace or re-reference to saturn logo) |
| Update OG image | `public/og-image.png` (replace with Saturn Trade branded image) |

Old assets (`claw-logo.png`, `tuna-logo.png`) can remain but will no longer be referenced.

---

### 2. HTML & SEO (`index.html`)

- Title → `Saturn Trade — The Fastest Trading Platform`
- All `<meta>` descriptions → Saturn Trade branding
- `og:title`, `og:description`, `og:image`, `twitter:title`, `twitter:description`, `twitter:image` → Saturn Trade
- `og:site_name` → `Saturn Trade`
- JSON-LD structured data → Saturn Trade
- Twitter handles (`@punchitsol`) → update if new handle provided, otherwise keep
- Canonical URL → update if new domain provided

---

### 3. Layout Components (logo imports + display text)

| File | Changes |
|------|---------|
| `src/components/layout/Sidebar.tsx` | Logo import, alt text |
| `src/components/layout/AppHeader.tsx` | Logo import, alt text, X link |
| `src/components/layout/Footer.tsx` | Logo src, all "Claw Mode" text, copyright, X link, nav labels ("Claw Agents" → "Agents", "Claw SDK" → "SDK") |
| `src/components/layout/StickyStatsFooter.tsx` | Uses `useClawStats` (internal, keep hook name or rename) |

---

### 4. Page Files — Logo & Branding Text

| File | Changes |
|------|---------|
| `src/pages/FunLauncherPage.tsx` | Any "Claw" references in UI text |
| `src/pages/EarningsPage.tsx` | Logo import, "CLAW" text, alt text |
| `src/pages/TokenDetailPage.tsx` | Logo src, "Claw Mode" alt/text, share text |
| `src/pages/LaunchpadPage.tsx` | `HEADER_LOGO_SRC` path |
| `src/pages/PortfolioPage.tsx` | Logo import |
| `src/pages/ConsolePage.tsx` | Logo import |
| `src/pages/PanelPage.tsx` | Logo import |
| `src/pages/ApiDashboardPage.tsx` | Logo import |
| `src/pages/BagsAgentsPage.tsx` | Logo import, "Claw Mode" text, X link |
| `src/pages/GovernancePage.tsx` | "Claw Mode" text in descriptions |
| `src/pages/ClawModePage.tsx` | Full "CLAW MODE" branding, hero text |
| `src/pages/ClawBookPage.tsx` | Any "ClawBook" display text |
| `src/pages/SubClawPage.tsx` | Display text |
| `src/pages/ClawPostPage.tsx` | Display text |
| `src/pages/ClawSDKPage.tsx` | Display text |
| `src/pages/AdminPanelPage.tsx` | Tab labels ("ClawBook", "Claw Launch"), password |
| `src/pages/ClawAdminLaunchPage.tsx` | Admin UI text |
| `src/pages/ClawBookAdminPage.tsx` | Admin UI text |
| `src/pages/AgentLogsAdminPage.tsx` | "!clawmode Mentions" text |
| `src/pages/TunnelDistributePage.tsx` | Admin password "claw" |
| `src/pages/WhitepaperPage.tsx` | Any Claw/Tuna branding |
| `src/pages/TokenomicsPage.tsx` | Any Claw branding |
| `src/pages/CareersPage.tsx` | Any Claw branding |
| `src/pages/TradingAgentsPage.tsx` | Any Claw references |
| `src/pages/DiscoverPage.tsx` | Any Claw references |
| `src/pages/TradePage.tsx` | Any Claw references |

---

### 5. Claw Components Directory (`src/components/claw/`)

| File | Changes |
|------|---------|
| `ClawHero.tsx` | "CLAW MODE" title, 🦞 emoji → 🪐, descriptions |
| `ClawStatsBar.tsx` | Display text |
| `ClawTokenGrid.tsx` | "Claw Tokens" heading, 🦞 emoji |
| `ClawTradingSection.tsx` | Display text |
| `ClawBidCard.tsx` | Display text |
| `ClawBribeSection.tsx` | Display text |
| `ClawForumSection.tsx` | Display text |
| `ClawAgentSection.tsx` | Display text |
| `ClawAdminLaunchPanel.tsx` | Display text |
| `ClawSDK*.tsx` (all 12 files) | Display text, CSS class references |
| `MatrixBackground.tsx` | If any Claw text |

---

### 6. ClawBook Components (`src/components/clawbook/`)

All 18 files — rename display text from "ClawBook"/"SubClaw" to "Saturn" equivalents (e.g., "Communities").

---

### 7. Other Components

| File | Changes |
|------|---------|
| `src/components/launchpad/CreateTokenModal.tsx` | "@clawmode !clawmode" example text |
| `src/components/launchpad/MemeLoadingAnimation.tsx` | Logo src, "Claw Mode" alt |
| `src/components/launchpad/KingOfTheHill.tsx` | Logo src |
| `src/components/launchpad/LaunchpadBadge.tsx` | tuna-logo reference |
| `src/components/trading/CreateTradingAgentModal.tsx` | Logo import |
| `src/components/agents/AgentIdeaGenerator.tsx` | Logo import |
| `src/components/console/ConsoleDrawer.tsx` | Logo import |
| `src/components/DelegationPrompt.tsx` | Any Claw text |
| `src/providers/PrivyProviderWrapper.tsx` | Logo import, Privy app name |

---

### 8. Hooks — Display Text Only (internal names preserved for backend compatibility)

| File | Changes |
|------|---------|
| `src/hooks/useSubTuna.ts` | "CLAW" display strings, logo path |
| `src/hooks/useClawTokenData.ts` | Keep token CA, update comments |
| `src/hooks/useClawBribe.ts` | 🦞 emoji in toast |
| Other `useClaw*.ts` hooks | Internal — no user-facing text to change |

---

### 9. CSS Theme (`src/styles/claw-theme.css`)

- All CSS class names (`claw-*`) stay as-is (renaming would break every usage)
- Update any visible text/comments referencing "Claw"

---

### 10. Edge Functions (Supabase)

Edge function **directory names and API endpoints stay unchanged** — renaming them would break all existing API consumers and require config.toml updates. Only user-visible strings inside them change:

| File | Changes |
|------|---------|
| `supabase/functions/agent-process-post/index.ts` | "!clawmode" trigger text, "Claw Mode" in responses, lobster references |
| `supabase/functions/claw-agent-bid/index.ts` | Log messages only |
| Other `claw-*` functions | Log messages referencing "Claw" |

---

### 11. Public Files

| File | Changes |
|------|---------|
| `public/robots.txt` | If it references claw domains |
| `public/sitemap.xml` | If it references claw domains |

---

### Summary

- **~80+ source files** with text/import changes
- **Logo asset** copied to `src/assets/saturn-logo.png` and `public/saturn-logo.png`
- **index.html** fully rebranded for X/Telegram link previews
- **No file/directory renames** for components, hooks, or edge functions (would break imports and APIs)
- **CSS class names** (`claw-*`) preserved to avoid mass breakage
- **Internal variable names** and **query keys** preserved for stability

This will be done in batches, prioritizing user-visible surfaces first (index.html, layout, main pages).

