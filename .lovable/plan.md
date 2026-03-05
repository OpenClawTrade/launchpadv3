

## Change all `/launchpad/` links to `/trade/`

Migrate every navigation link and route definition from `/launchpad/:mintAddress` to `/trade/:mintAddress` across the entire codebase.

### Files to update

**1. Route definition — `src/App.tsx` (line 133)**
- Change `path="/launchpad/:mintAddress"` → `path="/trade/:mintAddress"`
- Add a redirect route from `/launchpad/:mintAddress` to `/trade/:mintAddress` for backwards compatibility

**2. Domain router — `src/components/DomainRouter.tsx` (line 23)**
- Update allowed path from `"/launchpad/"` → `"/trade/"`

**3. Launchpad components (6 files):**
- `src/components/launchpad/AxiomTokenRow.tsx` (lines 73-74) — `/launchpad/` → `/trade/`
- `src/components/launchpad/LaunchTokenForm.tsx` (line 186) — navigate to `/trade/`
- `src/components/launchpad/TunaPulse.tsx` (line 217) — `/trade/`
- `src/components/launchpad/CodexPairRow.tsx` (line 71) — `/trade/`
- `src/components/launchpad/KingOfTheHill.tsx` (line 119) — `/trade/`
- `src/components/launchpad/JustLaunched.tsx` (line 29) — `/trade/`
- `src/components/launchpad/TokenCard.tsx` (line 119) — `/trade/`
- `src/components/launchpad/TokenTable.tsx` (line 77) — `/trade/`

**4. Other pages (6 files):**
- `src/pages/TradingAgentProfilePage.tsx` (line 126) — `/trade/`
- `src/pages/EarningsPage.tsx` (line 168) — `/trade/`
- `src/pages/SubClawPage.tsx` (line 243) — `/trade/`
- `src/pages/PortfolioPage.tsx` (lines 147, 208) — `/trade/`
- `src/pages/AgentDashboardPage.tsx` (line 461) — `/trade/`
- `src/pages/FunLauncherPage.tsx` — `/trade/`

**5. Other components (4 files):**
- `src/components/LaunchCountdown.tsx` (line 67) — `/trade/`
- `src/components/trading/CreateTradingAgentModal.tsx` (line 397) — `/trade/`
- `src/components/clawbook/TokenStatsHeader.tsx` (line 130) — `/trade/`
- `src/components/clawbook/NoCommunityFound.tsx` (line 34) — `/trade/`
- `src/components/panel/PanelPortfolioTab.tsx` (lines 91, 128) — `/trade/`

All changes are simple string replacements of `/launchpad/` → `/trade/` in link targets and navigate calls. The route in App.tsx will also get a redirect from the old path for any existing shared links.

