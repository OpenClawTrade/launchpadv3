
## Add Whitepaper to Sidebar + Fix TUNA Branding in WhitepaperPage

### What's needed

**1. Sidebar navigation (`src/components/layout/Sidebar.tsx`)**

The `NAV_LINKS` array currently has 6 items (Home, Trending, Terminal, Agents, SDK, Tokenomics) but is missing a Whitepaper entry. The route `/whitepaper` already exists and is registered in `App.tsx`.

Add a "Whitepaper" entry using the `FileText` icon from lucide-react (existing dependency, no install needed):

```ts
const NAV_LINKS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/trending", label: "Trending", icon: TrendingUp },
  { to: "/trade", label: "Terminal", icon: BarChart2 },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/opentuna", label: "SDK", icon: Code2 },
  { to: "/tokenomics", label: "Tokenomics", icon: PieChart },
  { to: "/whitepaper", label: "Whitepaper", icon: FileText },  // ← ADD
];
```

Also add `FileText` to the import line from `lucide-react`.

---

**2. Fix TUNA branding in `WhitepaperPage.tsx` (lines 1105–1106)**

The document footer at the bottom of the whitepaper page still reads:

```
"This whitepaper is a living document and will be updated as the TUNA platform evolves."
"© 2026 TUNA Protocol. All rights reserved."
```

Replace both with Claw Mode branding:

```
"This whitepaper is a living document and will be updated as the Claw Mode platform evolves."
"© 2026 Claw Mode. All rights reserved."
```

---

### Files changed

| File | Change |
|---|---|
| `src/components/layout/Sidebar.tsx` | Add `FileText` import + Whitepaper entry to `NAV_LINKS` |
| `src/pages/WhitepaperPage.tsx` | Fix 2 lines of TUNA → Claw Mode branding in the document footer |

No database changes. No new dependencies.
