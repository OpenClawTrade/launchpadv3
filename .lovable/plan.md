
## Fix "Create Token" — No Page Refresh + Styled Dialog

### Root Cause

Both buttons use a plain HTML `<a href="/?create=1">` anchor tag instead of React Router's `<Link>`. A bare `<a>` tag causes a **full browser page reload**, which means the SPA state is wiped and the `?create=1` query param reads correctly only after reload — making the dialog flicker open after a hard refresh. On other pages (Agents, Trending, etc.) it navigates away entirely to `/` before the dialog can open.

---

### Fix 1 — Stop the Page Reload (Sidebar + AppHeader)

**`src/components/layout/Sidebar.tsx`**

Change:
```tsx
<a href="/?create=1" onClick={onLinkClick} ...>
```
To:
```tsx
<Link to="/?create=1" onClick={onLinkClick} ...>
```
Import `Link` from `react-router-dom` (it's already imported).

**`src/components/layout/AppHeader.tsx`**

Change:
```tsx
<a href="/?create=1" ...>
```
To:
```tsx
<Link to="/?create=1" ...>
```
Import `Link` from `react-router-dom`.

This alone fixes the page refresh — React Router handles `?create=1` as a client-side navigation.

---

### Fix 2 — Style the Dialog (FunLauncherPage)

The current dialog at lines 462–471 is bare-bones:
```tsx
<DialogContent className="!max-w-2xl !w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto p-0"
  style={{ background: "#141414", border: "1px solid #2a2a2a" }}>
  <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3"
    style={{ background: "#141414", borderBottom: "1px solid #2a2a2a" }}>
    <h2 className="text-[15px] font-bold text-white">Create Token</h2>
  </div>
  <div className="p-4">
    <TokenLauncher ... />
  </div>
</DialogContent>
```

Replace with a polished dark modal:

- **Gradient header bar** — `#141414` → `#1a1a1a` gradient with green `#4ade80` accent left-border
- **Rocket emoji + title** styled with the green brand color
- **Subtle green glow** on the dialog border (`box-shadow: 0 0 40px rgba(74,222,128,0.08)`)
- **Proper close button** — styled X icon in top-right matching app theme
- **Max width 680px**, `border-radius: 12px`, scroll contained inside
- **Header sticky** with a thin `#4ade80` top border line for brand identity

#### New Dialog Structure:
```
┌─────────────────────────────────────────────┐  ← green top border line
│ 🚀 Create Token                          [X] │  ← dark header (#1a1a1a)
│ ─────────────────────────────────────────── │  ← separator
│                                             │
│         < TokenLauncher form >              │  ← scrollable body
│                                             │
└─────────────────────────────────────────────┘
```

---

### Files to Change

| File | Change |
|---|---|
| `src/components/layout/Sidebar.tsx` | `<a href>` → `<Link to>` for Create Token button |
| `src/components/layout/AppHeader.tsx` | `<a href>` → `<Link to>` for Create Token button |
| `src/pages/FunLauncherPage.tsx` | Restyle the Create Token `<Dialog>` block (lines 461–471) |

No other files need changes. The `TokenLauncher` component itself is untouched — only its container dialog gets the visual upgrade.
