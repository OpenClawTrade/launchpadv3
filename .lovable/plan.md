
## Replace All `tuna.fun` → `ClawMode.fun` Site-Wide

### Scope

The domain `tuna.fun` appears in **~35 files** across frontend pages, edge functions, public assets, and SDK docs. Every occurrence will be replaced with `ClawMode.fun` (matching the casing convention — lowercase for URLs: `clawmode.fun`).

Note: subdomain patterns like `{subdomain}.tuna.fun` become `{subdomain}.clawmode.fun`.

---

### Frontend Pages — 8 files

**`src/pages/AgentConnectPage.tsx`**
- Line 285: `https://tuna.fun/skill.md` → `https://clawmode.fun/skill.md`
- Line 402: `https://tuna.fun/skill.md` → `https://clawmode.fun/skill.md`
- Line 403: `https://tuna.fun/skill.json` → `https://clawmode.fun/skill.json`
- Line 412: `https://tuna.fun/skill.md` → `https://clawmode.fun/skill.md`
- Line 421: `https://tuna.fun/skill.json` → `https://clawmode.fun/skill.json`
- Line 424: `https://tuna.fun/skill.md` → `https://clawmode.fun/skill.md`

**`src/pages/AgentDocsPage.tsx`**
- Line 44: `API_BASE_URL = "https://tuna.fun/functions/v1"` → `https://clawmode.fun/functions/v1`

**`src/pages/ApiDocsPage.tsx`**
- Line 953: `"launchpadUrl": "https://tuna.fun/fun/..."` → `https://clawmode.fun/fun/...`

**`src/pages/ApiDashboardPage.tsx`**
- Line 648: `*.tuna.fun` display text → `*.clawmode.fun`
- Line 955: `https://${lp.subdomain}.tuna.fun` → `https://${lp.subdomain}.clawmode.fun`
- Line 960: `{lp.subdomain}.tuna.fun` display → `{lp.subdomain}.clawmode.fun`

**`src/pages/ApiBuilderPage.tsx`**
- Line 345: `{subdomain}.tuna.fun` display → `{subdomain}.clawmode.fun`
- Line 463: `.tuna.fun` suffix label → `.clawmode.fun`

**`src/pages/WhitepaperPage.tsx`**
- Line 192: `https://tuna.fun/api/agents/launch` → `https://clawmode.fun/api/agents/launch`
- Line 357: `https://tuna.fun/api/agents/register` → `https://clawmode.fun/api/agents/register`
- Line 548: `https://tuna.fun/api` → `https://clawmode.fun/api`
- Line 724: `os.tuna.fun` → `os.clawmode.fun`
- Lines 1082–1085: All `https://tuna.fun/...` links → `https://clawmode.fun/...`

**`src/components/opentuna/OpenTunaHub.tsx`**
- Line 236: `https://tuna.fun/api/...` → `https://clawmode.fun/api/...`

**`src/components/DomainRouter.tsx`**
- Line 16: `"os.tuna.fun"` → `"os.clawmode.fun"`
- Line 16 comment: `os.tuna.fun` → `os.clawmode.fun`

---

### Edge Functions — 14 files

**`supabase/functions/agent-social-post/index.ts`**
- Line 197: `https://tuna.fun/tunabook/post/${post.id}` → `https://clawmode.fun/tunabook/post/${post.id}`

**`supabase/functions/agent-social-comment/index.ts`**
- Line 168: `https://tuna.fun/tunabook/post/${postId}` → `https://clawmode.fun/tunabook/post/${postId}`

**`supabase/functions/agent-discover/index.ts`**
- Lines 72–77: All `tuna.fun` skill file URLs → `clawmode.fun`

**`supabase/functions/agent-auto-engage/index.ts`**
- Line 281: `tuna.fun/launchpad/` → `clawmode.fun/launchpad/`
- Line 401: `tuna.fun` mention in prompt → `clawmode.fun`
- Line 412: `tuna.fun` in prompt → `clawmode.fun`
- Line 440: `tuna.fun` in SystemTUNA prompt → `clawmode.fun`

**`supabase/functions/agent-hourly-post/index.ts`**
- Line 100: `tuna.fun/agents` → `clawmode.fun/agents`

**`supabase/functions/api-launch-token/index.ts`**
- Line 206: `https://tuna.fun/fun/` → `https://clawmode.fun/fun/`

**`supabase/functions/api-launchpad/index.ts`**
- Line 232: `${subdomain}.tuna.fun` → `${subdomain}.clawmode.fun`

**`supabase/functions/api-deploy/index.ts`**
- Line 195: `${launchpad.subdomain}.tuna.fun` → `${launchpad.subdomain}.clawmode.fun`
- Line 254: `${launchpad.subdomain}.tuna.fun` → `${launchpad.subdomain}.clawmode.fun`

**`supabase/functions/bags-agent-launch/index.ts`**
- Line 108: `https://tuna.fun/t/${ticker}` → `https://clawmode.fun/t/${ticker}`

**`supabase/functions/subtuna-crosspost-x/index.ts`**
- Line 162: `https://tuna.fun/t/${subtuna.ticker}` → `https://clawmode.fun/t/${subtuna.ticker}`

**`supabase/functions/colosseum-submit/index.ts`**
- Lines 138–141: All `tuna.fun` links → `clawmode.fun`
- Line 202: `https://tuna.fun/og-image.png` → `https://clawmode.fun/og-image.png`

**`supabase/functions/colosseum-bridge/index.ts`**
- Lines 65–67: All `tuna.fun` links → `clawmode.fun`

**`supabase/functions/colosseum-auto-engage/index.ts`**
- Lines 15–27: All `tuna.fun` mentions in comment templates → `clawmode.fun`

**`supabase/functions/opentuna-fin-browse/index.ts`**
- Line 301: User-Agent string `+https://tuna.fun` → `+https://clawmode.fun`

---

### Public Assets — 5 files

**`public/skill.md`**
- Lines 5–7: `homepage`, `connect`, `discovery` URLs
- Lines 70–72: skill file URLs in JSON response examples
- Line 162: `tradeUrl` example

**`public/skill.json`**
- Lines 5–8: `homepage`, `documentation`, `connect`, `skill_file`
- Lines 83–84: `companion_files` heartbeat/rules URLs

**`public/TUNA_WHITEPAPER.md`**
- All `tuna.fun` occurrences (~10) → `clawmode.fun`

**`public/robots.txt`**
- Line 17: `Sitemap: https://tuna.fun/sitemap.xml` → `https://clawmode.fun/sitemap.xml`

**`public/sdk/README.md`**
- All `tuna.fun` badge/link references (~8) → `clawmode.fun`

**`public/sdk/src/index.ts`**
- Line 8: `BASE_URL = 'https://tuna.fun/api'` → `https://clawmode.fun/api`

**`public/sdk/package.json`**
- Line 22: `"homepage": "https://tuna.fun"` → `https://clawmode.fun`

---

### SDK Docs — 4 files

**`sdk/src/index.ts`**
- Line 132: `BASE_URL = 'https://tuna.fun/api'` → `https://clawmode.fun/api`

**`sdk/docs/API.md`**
- Lines 211–214: All `tuna.fun` links → `clawmode.fun`

**`sdk/package.json`**
- Line 95: `"homepage": "https://tuna.fun/opentuna"` → `https://clawmode.fun/opentuna`

**`sdk/README.md`**
- Lines 5–8, 270–273: All `tuna.fun` badge/link references → `clawmode.fun`

**`sdk/examples/basic-launch.ts`**
- Lines 61, 100–101: `tuna.fun/t/AGENT`, `tuna.fun/token/...`, `tuna.fun/t/AGENT` → `clawmode.fun`

---

### Technical Notes

- All replacements are pure string substitutions — `tuna.fun` → `clawmode.fun`
- No logic changes in any file
- Edge functions redeploy automatically
- The `index.html` canonical URL and OG/Twitter URLs already correctly point to `clawmode.lovable.app` — once the custom domain `clawmode.fun` is connected in Lovable settings, those should be updated to `clawmode.fun` too. For now those remain as-is since the custom domain isn't configured yet.
- Total: ~35 files, ~200 individual URL replacements
