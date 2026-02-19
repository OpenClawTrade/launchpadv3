
## King of the Claws + New Lobster Logo

### Overview

Three grouped changes:
1. Copy the uploaded pixel-art lobster as the new main logo and favicon
2. Rename "King of the Hill" → "King of the Claws" everywhere it appears
3. Replace the yellow Crown icon with a small lobster image in the section header

---

### Part 1 — Copy the Image to Project

The uploaded image at `user-uploads://16EF63C6-A7F6-411C-BFBE-2BF4D9F64E20-2.png` needs to land in **two places**:

| Copy destination | Used by |
|---|---|
| `public/claw-logo.png` | All existing `src="/claw-logo.png"` references (Sidebar, Footer, TradePage, TokenDetailPage, LaunchpadPage, AgentPlatformToken, MemeLoadingAnimation) — no code changes needed, they already point here |
| `public/favicon.png` | `index.html` `<link rel="icon" href="/favicon.png">` — already wired, no HTML change needed |
| `src/assets/claw-logo.png` | `AgentIdeaGenerator.tsx` which imports it as an ES6 module |

This single file copy (same image to all three paths) updates every logo and favicon site-wide with zero code changes.

---

### Part 2 — Rename "King of the Hill" → "King of the Claws"

Two files contain the visible text:

**`src/components/launchpad/KingOfTheHill.tsx` (line 118)**
```tsx
// Before
King of the Hill

// After
King of the Claws
```

**`src/pages/FunLauncherPage.tsx` (line 282)**
```tsx
// Before
<span ...>King of the Hill</span>

// After
<span ...>King of the Claws</span>
```

---

### Part 3 — Replace Crown Icon with Lobster Image

**`src/components/launchpad/KingOfTheHill.tsx` (lines 116–120)**

Replace the `<Crown className="w-3.5 h-3.5 text-yellow-400" />` icon with a small `<img>` of the lobster:

```tsx
// Before
<Crown className="w-3.5 h-3.5 text-yellow-400" />
<span ...>King of the Hill</span>

// After
<img src="/claw-logo.png" alt="Claw" className="w-4 h-4 object-contain" />
<span ...>King of the Claws</span>
```

**`src/pages/FunLauncherPage.tsx` (line 281)**

Same replacement for the Crown icon in the inline strip:

```tsx
// Before
<Crown className="h-3.5 w-3.5 text-yellow-400" />
<span ...>King of the Hill</span>

// After
<img src="/claw-logo.png" alt="Claw" className="h-4 w-4 object-contain" />
<span ...>King of the Claws</span>
```

Also remove the now-unused `Crown` import from the imports of each file if it's not used elsewhere.

---

### Bonus — Fix index.html Twitter meta (while we're there)

Lines 32–33 still say `@buildtuna`. Updating to `@clawmode` as per the pending social handle rename:
```html
<meta name="twitter:site" content="@clawmode" />
<meta name="twitter:creator" content="@clawmode" />
```
Also line 69: `"sameAs": ["https://twitter.com/clawmode"]`

---

### Files Changed

| File | Change |
|---|---|
| `public/claw-logo.png` | Replaced with new lobster pixel-art image |
| `public/favicon.png` | Replaced with new lobster pixel-art image |
| `src/assets/claw-logo.png` | Replaced with new lobster pixel-art image |
| `src/components/launchpad/KingOfTheHill.tsx` | "King of the Hill" → "King of the Claws"; Crown → lobster img |
| `src/pages/FunLauncherPage.tsx` | "King of the Hill" → "King of the Claws"; Crown → lobster img |
| `index.html` | `@buildtuna` → `@clawmode` in Twitter meta tags |

No database changes. No new dependencies.
