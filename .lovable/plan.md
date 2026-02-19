
## Complete Claw Mode Rebrand — Full Platform Redesign

This is the full audit and implementation plan to rename every "TUNA / OpenTuna" reference to "Claw Mode", apply the dark template aesthetic (inspired by Photon/pump.fun dark UI), update all branding assets (favicon, OG image, logo), and ensure no page, popup, error message, or piece of content is missed.

---

### PART 1 — Asset Replacement (Logo, Favicon, OG Image)

The uploaded pixel-art lobster image (`1287A70E-0A3B-469F-81B0-350EC2787E12.png`) becomes the new logo.

**Files to add/update:**
- Copy logo to `public/claw-logo.png` (main logo, used in header, footer, and all `tuna-logo.png` references)
- Copy logo to `public/favicon.png` (replaces existing favicon)
- Copy logo to `public/og-image.png` (replaces OG/Twitter card preview image)
- Copy logo to `src/assets/claw-logo.png` (for React component imports that import `tuna-logo.png` from assets)

**Where `/tuna-logo.png` is currently used (all must change):**
- `src/components/layout/AppHeader.tsx` → `HEADER_LOGO_SRC`
- `src/components/layout/Footer.tsx` → `<img src="/tuna-logo.png">`
- `src/pages/FunLauncherPage.tsx` → `HEADER_LOGO_SRC = "/tuna-logo.png"`
- `src/pages/TradePage.tsx` → `src="/tuna-logo.png"`
- `src/pages/TokenDetailPage.tsx` → `HEADER_LOGO_SRC = "/tuna-logo.png"`
- `src/pages/LaunchpadPage.tsx` → header logo
- `src/components/agents/AgentPlatformToken.tsx` → `src="/tuna-logo.png"`
- `src/components/agents/AgentIdeaGenerator.tsx` → `import tunaLogo from "@/assets/tuna-logo.png"`
- `src/components/launchpad/MemeLoadingAnimation.tsx` → `TUNA_LOGO_SRC = "/tuna-logo.png"`

---

### PART 2 — `index.html` Metadata (SEO, OG, Twitter Card)

**File: `index.html`**

Every TUNA/OpenTuna reference replaced:

| Field | Current | New |
|---|---|---|
| `<title>` | "Tuna AI Agent Operating System" | "Claw Mode — AI Agent Launchpad on Solana" |
| `<meta description>` | TUNA is the AI-powered token launchpad... | Claw Mode is the autonomous AI agent launchpad on Solana... |
| `<meta keywords>` | ...tuna.fun, TUNA... | ...clawmode, CLAW... |
| `<meta author>` | TUNA OS | Claw Mode |
| `og:site_name` | TUNA OS | Claw Mode |
| `og:title` | TUNA OS v3.1.0... | Claw Mode — AI Agent Launchpad on Solana |
| `og:description` | Where AI agents & humans launch... | Autonomous AI agents that launch tokens... |
| `og:image` | `https://tuna.fun/logo.png?v=4` | `/og-image.png` (new lobster logo) |
| `og:image:alt` | TUNA OS v3.1.0... | Claw Mode... |
| `twitter:site` | @buildtuna | @buildtuna (keep, same account) |
| `twitter:title` | TUNA OS v3.1.0... | Claw Mode — AI Agent Launchpad |
| `twitter:description` | Where AI agents & humans... | Autonomous AI agents... |
| `twitter:image` | `https://tuna.fun/logo.png?v=4` | `/og-image.png` |
| `<link rel="icon">` | `/favicon.png` | `/favicon.png` (same path, new image already copied) |
| JSON-LD `name` | OpenTuna | Claw Mode |
| JSON-LD creator `name` | OpenTuna | Claw Mode |

---

### PART 3 — Global Header (`AppHeader.tsx`)

**File: `src/components/layout/AppHeader.tsx`**

- Replace `HEADER_LOGO_SRC = "/tuna-logo.png"` → `/claw-logo.png`
- Replace `alt="OpenTuna"` → `alt="Claw Mode"`
- Replace `aria-label="OpenTuna"` → `aria-label="Claw Mode"`
- Replace `<span className="text-lg font-bold">OpenTuna</span>` → `Claw Mode`
- Nav link `/opentuna` label "OpenTuna" → rename to `/opentuna` with label "SDK" (or keep route but change label)
- Mobile menu same changes

---

### PART 4 — Footer (`Footer.tsx`)

**File: `src/components/layout/Footer.tsx`**

- Replace `src="/tuna-logo.png"` → `/claw-logo.png`
- Replace `alt="OpenTuna"` → `alt="Claw Mode"`
- Replace `<span className="font-bold">OpenTuna</span>` → `Claw Mode`
- Replace `"TUNA Agents"` in product links → `Claw Agents`
- Replace `"OpenTuna SDK"` → `Claw SDK`
- Replace `© 2025 OpenTuna. All rights reserved.` → `© 2025 Claw Mode. All rights reserved.`
- "The AI Agent Operating System for autonomous trading and token launches on Solana." → "The autonomous AI agent launchpad on Solana."

---

### PART 5 — Home Page / Main Launcher (`FunLauncherPage.tsx`)

**File: `src/pages/FunLauncherPage.tsx`** (918 lines)

- `HEADER_LOGO_SRC = "/tuna-logo.png"` → `/claw-logo.png`
- All `alt="OpenTuna"` / `aria-label="OpenTuna"` → Claw Mode
- `<span className="text-lg font-bold">OpenTuna</span>` → Claw Mode
- Nav link label "OpenTuna" → "SDK"
- Mobile menu same

---

### PART 6 — Trade Page (`TradePage.tsx`)

**File: `src/pages/TradePage.tsx`**

- `src="/tuna-logo.png"` → `/claw-logo.png`
- `alt="TUNA"` → `alt="Claw Mode"`
- `"Start trading now on TUNA"` → `"Start trading now on Claw Mode"`
- `aria-label="TUNA"` → Claw Mode

---

### PART 7 — Token Detail Pages

**Files: `src/pages/TokenDetailPage.tsx`, `src/pages/FunTokenDetailPage.tsx`**

- `HEADER_LOGO_SRC = "/tuna-logo.png"` → `/claw-logo.png`
- `alt="TUNA"` → `alt="Claw Mode"`
- Header logo text "TUNA" → "Claw Mode"

---

### PART 8 — Agents Section

**Files: `src/components/agents/AgentHero.tsx`, `src/pages/TunaBookPage.tsx`, `src/components/agents/AgentPlatformToken.tsx`, `src/components/agents/AgentIdeaGenerator.tsx`**

- "Welcome to TUNA Agents" → "Welcome to Claw Agents"
- "TUNA Agents" tab label → "Claw Agents"
- `@BuildTuna` X handle references in code examples → `@buildclaw` (or keep @buildtuna but update the display text)
- `!tunalaunch` command in how-to cards → `!clawlaunch`
- `src="/tuna-logo.png"` / `import tunaLogo from "@/assets/tuna-logo.png"` → new claw logo
- `AgentPlatformToken` — `$TUNA` token name and description updated

---

### PART 9 — Agent MemeLoading Animation

**File: `src/components/launchpad/MemeLoadingAnimation.tsx`**

- `TUNA_LOGO_SRC = "/tuna-logo.png"` → `/claw-logo.png`
- `alt="TUNA"` → `alt="Claw Mode"`

---

### PART 10 — OpenTuna Page → Rebrand to "Claw SDK" / "OpenClaw"

**File: `src/pages/OpenTunaPage.tsx`** and all components in `src/components/opentuna/`

The `/opentuna` route and all OpenTuna components contain extensive TUNA branding:
- Page title: "OpenTuna" → "OpenClaw" (or "Claw SDK")
- All `OpenTuna` class names and display text → OpenClaw
- API key modal: `npm install @opentuna/sdk` → kept as-is (this is a real package name, or update to `@openclaw/sdk`)
- `new OpenTuna({ apiKey: '...' })` → update text
- Tab labels (Hub, Hatch, DNA, etc.) — no branding, keep as-is
- Back link label → "Back to Claw Mode"
- `OpenTunaHub` hero text if it mentions TUNA

---

### PART 11 — Whitepaper Page

**File: `src/pages/WhitepaperPage.tsx`** (1121 lines)

Significant content changes:
- `"Back to TUNA"` → `"Back to Claw Mode"`
- `"TUNA Protocol Whitepaper"` title → `"Claw Mode Protocol Whitepaper"`
- `"The AI-Powered Token Launchpad for Solana"` subtitle → updated
- Section 13 title "OpenTuna Agent OS" → "OpenClaw Agent OS"
- All `https://tuna.fun` API URLs → `https://clawmode.lovable.app` (or keep tuna.fun if still active)
- `!tunalaunch` command → `!clawlaunch`
- `HIGH-PERFORMANCE MINING via ... "TUNA" suffix` → `"CLAW" suffix`
- `npm install @opentuna/sdk` → `@openclaw/sdk`
- `new OpenTuna(...)` → `new OpenClaw(...)`

---

### PART 12 — Promote Modal

**File: `src/components/launchpad/PromoteModal.tsx`**

- `@BuildTuna's X account` → `@BuildClaw's X account` (or keep @buildtuna as the actual social)
- `setTweetUrl(https://twitter.com/buildtuna/status/...)` — keep as real URL, update display text only

---

### PART 13 — Careers Page

**File: `src/pages/CareersPage.tsx`**

- "Back to TUNA" link label → "Back to Claw Mode"
- Any mention of "TUNA" in job descriptions → "Claw Mode"
- Footer already handled globally

---

### PART 14 — Migrate Page

**File: `src/pages/MigratePage.tsx`**

- "OpenTuna — API/SDK Platform" → "OpenClaw — API/SDK Platform"
- "build on TUNA infrastructure" → "build on Claw Mode infrastructure"

---

### PART 15 — API Docs Page

**File: `src/pages/ApiDocsPage.tsx`**

- `TUNA Launchpad API` → `Claw Mode Launchpad API`
- `"TUNA ecosystem"` → `"Claw Mode ecosystem"`
- Code block content: API endpoint URLs remain functional but labels updated
- `tuna.fun` references in code comments → `clawmode.lovable.app`

---

### PART 16 — LaunchpadPage (Legacy)

**File: `src/pages/LaunchpadPage.tsx`**

- Logo alt "TUNA" → "Claw Mode"
- "Be the first to launch a token on TUNA!" → "on Claw Mode!"

---

### PART 17 — Fun Mode / Password Gate

**File: `src/components/launchpad/TokenLauncher.tsx`**

- Password check `funPasswordInput.toLowerCase().trim() === "tuna"` — keep or change to `"claw"` (if the user wants to update the secret password too)

---

### PART 18 — CSS Branding (`.opentuna-*` classes)

**File: `src/index.css`**

The `.opentuna-card`, `.opentuna-gradient-text`, `.opentuna-glow`, `.opentuna-button` CSS classes are used in the opentuna components. These will be renamed to `.openclaw-card` etc. or left as-is since they're internal class names that don't appear in UI text.

The comment `/* OpenTuna Theme - TUNA Brand Colors */` → `/* OpenClaw Theme */`

---

### PART 19 — CSS comment in `index.css`

Line 17: `/* TUNA Design System - Gate.io Inspired Professional Theme */` → `/* Claw Mode Design System */`

---

### PART 20 — Template Visual Redesign

Inspired by the dark Photon/pump.fun UI in the reference images — clean dark cards, compact rows, darker backgrounds, green/cyan accent on market data. The current design is already close (dark theme, red primary). Key visual adjustments:

**Color Scheme (already done for Claw):**
- Deep black background (`240 20% 4%`) — already set ✓
- Red/coral primary (`0 84% 60%`) — already set ✓
- Teal secondary (`187 80% 53%`) — already set ✓
- Nebula gradient effect — already set ✓

**Layout adjustments to match template:**
- Token rows in lists: tighter padding, smaller avatars (32px), column layout matching Photon (name | price | change | volume | MC | buy button)
- Token cards: more compact, dark card background, subtle border
- Launch form: contained on left side, token list on right — current layout already similar

---

### PART 21 — Public Files Rename

- `public/TUNA_WHITEPAPER.md` → Keep (backend file, not user-visible)
- `public/tuna-logo.png` → Keep (for backward compatibility), but all code references updated to `claw-logo.png`

---

### PART 22 — `sitemap.xml`

**File: `public/sitemap.xml`**

- Any `tuna.fun` URLs → updated to `clawmode.lovable.app`

---

### Summary of All Files Modified

| # | File | Change Type |
|---|---|---|
| 1 | `index.html` | Title, meta, OG, Twitter Card — full rebrand |
| 2 | `public/favicon.png` | Replaced with pixel lobster logo |
| 3 | `public/og-image.png` | Replaced with pixel lobster logo |
| 4 | `public/claw-logo.png` | NEW — pixel lobster logo |
| 5 | `src/assets/claw-logo.png` | NEW — pixel lobster logo (React imports) |
| 6 | `src/components/layout/AppHeader.tsx` | Logo + all text |
| 7 | `src/components/layout/Footer.tsx` | Logo + all text |
| 8 | `src/pages/FunLauncherPage.tsx` | Logo + header text |
| 9 | `src/pages/TradePage.tsx` | Logo + text |
| 10 | `src/pages/TokenDetailPage.tsx` | Logo + text |
| 11 | `src/pages/FunTokenDetailPage.tsx` | Logo + text |
| 12 | `src/pages/LaunchpadPage.tsx` | Logo + text |
| 13 | `src/pages/TunaBookPage.tsx` | "TUNA Agents" → "Claw Agents" throughout |
| 14 | `src/pages/WhitepaperPage.tsx` | All TUNA/OpenTuna text |
| 15 | `src/pages/OpenTunaPage.tsx` | OpenTuna → OpenClaw everywhere |
| 16 | `src/pages/CareersPage.tsx` | Back link + descriptions |
| 17 | `src/pages/MigratePage.tsx` | OpenTuna → OpenClaw |
| 18 | `src/pages/ApiDocsPage.tsx` | API names + descriptions |
| 19 | `src/components/agents/AgentHero.tsx` | "TUNA Agents" → "Claw Agents", @BuildTuna |
| 20 | `src/components/agents/AgentPlatformToken.tsx` | Logo + $TUNA text |
| 21 | `src/components/agents/AgentIdeaGenerator.tsx` | Logo import + @BuildTuna + !tunalaunch |
| 22 | `src/components/launchpad/MemeLoadingAnimation.tsx` | Logo |
| 23 | `src/components/launchpad/PromoteModal.tsx` | @BuildTuna display text |
| 24 | `src/components/opentuna/OpenTunaApiKeyModal.tsx` | SDK text |
| 25 | `src/components/opentuna/OpenTunaHatch.tsx` | "OpenTuna agent" text |
| 26 | `src/components/opentuna/OpenTunaDocs.tsx` | All OpenTuna text |
| 27 | `src/index.css` | Comment updates |
| 28 | `public/sitemap.xml` | URL updates |

### Execution Order

1. Copy logo asset files (new pixel lobster) to `public/` and `src/assets/`
2. Update `index.html` (SEO + OG metadata)
3. Update `AppHeader.tsx` and `Footer.tsx` (global header/footer — appears on every page)
4. Update all page files (FunLauncherPage, TradePage, TokenDetailPage, etc.)
5. Update all component files (agents, launchpad, opentuna)
6. Update CSS comments
7. Update `sitemap.xml`
