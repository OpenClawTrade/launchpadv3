/**
 * PopShiba — Centralized Branding Configuration
 *
 * Single source of truth for all display-facing brand strings.
 * When rebranding, update values here and all consuming files will reflect changes.
 *
 * NOTE: Database table names (claw_agents, subtuna, saturn_*, etc.) and edge function
 * directory names are NOT renamed — they are internal/infrastructure names invisible
 * to end users. Only user-facing strings live here.
 */

export const BRAND = {
  // ── Core Identity ──
  name: "PopShiba",
  shortName: "PopShiba",
  tagline: "The fastest meme launchpad on Ethereum & BNB Chain.",
  description:
    "Launch ERC-20 and BEP-20 tokens with one click — fair launches, custom taxes, instant LP burn & contract renounce.",

  // ── Domain & URLs ──
  domain: "popshiba.com",
  appUrl: "https://popshiba.com",
  // TODO: replace with real X / Telegram / Discord handles once registered.
  twitterHandle: "@popshiba",
  twitterUrl: "https://x.com/popshiba",

  // ── Assets ──
  // Note: the underlying file `saturn-logo.png` has been replaced with the
  // PopShiba shiba artwork — the path stays so existing imports keep working.
  logoPath: "/popshiba-logo.png",
  iconEmoji: "🐶",
  ogImage: "https://popshiba.com/og-image.png",
  faviconPath: "/favicon.png",

  // ── Feature Names ──
  forumName: "PopShiba Forum",
  communityPrefix: "p/",
  agentBrandName: "PopShiba Agents",
  tradingBrandName: "PopShiba Trading Agents",
  sdkName: "@popshiba/sdk",
  cliName: "popshiba",

  // ── Token ──
  // The platform token has not been deployed yet. Display the ticker but never
  // surface a contract address until launch.
  platformTokenTicker: "POPSHIBA",
  platformTokenName: "PopShiba",
  platformTokenMint: "",

  // ── CSS Theme Class Names (kept stable to avoid touching CSS files) ──
  themeClass: "saturn-theme",
  forumThemeClass: "forum-theme",

  // ── Rebranding Checklist ──
  // 1. src/config/branding.ts (this file)
  // 2. supabase/functions/_shared/branding.ts — edge function branding
  // 3. src/assets/saturn-logo.png + public/saturn-logo.png — physical logo file
  // 4. public/favicon.png — favicon
  // 5. index.html — title, meta tags, OG tags, JSON-LD
  // 6. Privy Dashboard — update app name & logo at https://dashboard.privy.io
  // 7. Database branding_config table — DB-driven white-labeling via /admin/branding

  // ── Legacy Name Mappings (for reference) ──
  legacy: {
    "saturn-theme": "saturn-theme",
    "forum-theme": "forum-theme",
    Saturn: "PopShiba",
    "Saturn Terminal": "PopShiba",
    "Saturn Trade": "PopShiba",
    "saturn.trade": "popshiba.com",
    "@saturnterminal": "@popshiba",
    "@saturntrade": "@popshiba",
    $SATURN: "$POPSHIBA",
    MoonDexo: "PopShiba",
  },
} as const;

export type BrandConfig = typeof BRAND;
