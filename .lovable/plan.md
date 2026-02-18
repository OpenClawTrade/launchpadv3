
## Add Matrix Background to All Pages

The Matrix rain background from Claw Mode will be applied globally across every page in the app by mounting it once at the root level in `App.tsx`, underneath all routes.

### Approach

The `MatrixBackground` component is a fixed-position canvas (`position: fixed; z-index: 0`) with `pointer-events: none`, so it is already designed to sit passively behind all content without interfering with any interactions. It just needs to be rendered once at the app root level.

**No changes needed to any individual page file.**

### Files to Change

**`src/App.tsx`**
- Import `MatrixBackground` from `@/components/claw/MatrixBackground`
- Render it once inside the `ErrorBoundary`, outside of `<Routes>`, so it persists across all route navigations without remounting

**`src/App.css`** (minor)
- Remove the `max-width: 1280px` and `padding` from `#root` that could clip the full-screen canvas — or just leave it, since the canvas is `fixed` and ignores the `#root` box model entirely. No change needed here.

### Technical Details

```text
App.tsx structure after change:

<ErrorBoundary>
  <MatrixBackground />          ← Added here (fixed, z-index 0, pointer-events-none)
  <BrowserRouter>
    <DomainRouter />
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        ... all routes unchanged ...
      </Routes>
    </Suspense>
  </BrowserRouter>
</ErrorBoundary>
```

The canvas is already coded with:
- `position: fixed` and `inset-0` — covers the full viewport always
- `pointer-events: none` — never blocks clicks or interactions
- `z-index: 0` — sits behind all page content
- Auto-resizes on window resize
- Renders at ~12fps to stay lightweight
- Mixes green Matrix rain characters (katakana + digits) with occasional 🦞 lobster emojis

The `/claw` page already has its own `<MatrixBackground />` render — it will now receive a second instance. To avoid double-rendering on `/claw`, the component in `ClawModePage.tsx` will be removed since the global one covers it.

### Summary of Changes

| File | Change |
|---|---|
| `src/App.tsx` | Add `<MatrixBackground />` once at root level |
| `src/pages/ClawModePage.tsx` | Remove the now-redundant local `<MatrixBackground />` |
