

## Admin-Only Phantom Launch Tab in Panel

### What
Add a new "Phantom" tab to the Panel page that is only visible to admins. It will embed the existing `TokenLauncher` component (which already has full Phantom launch support) pre-set to Phantom mode, allowing admins to launch tokens directly from the Panel.

### Changes

**1. `src/pages/PanelPage.tsx`**
- Import `useIsAdmin` hook and the `Ghost` (or similar) icon from lucide
- Lazy-import a new `PanelPhantomTab` component
- Read `isAdmin` from `useIsAdmin(solanaAddress)`
- Conditionally render a new `<PanelTab value="phantom" ...>` after the "Launches" tab, only when `isAdmin` is true
- Add the corresponding `<TabsContent value="phantom">` rendering `<PanelPhantomTab />`

**2. `src/components/panel/PanelPhantomTab.tsx`** (new file)
- Simple wrapper that renders `TokenLauncher` with:
  - `onLaunchSuccess` callback (shows toast or refetches)
  - `onShowResult` callback (shows launch result inline)
  - Force the launcher into Phantom mode by default (the component's `generatorMode` state initializes to "random" -- we'll either pass a prop or create a thin wrapper that only renders the Phantom section)
- Since `TokenLauncher` is a 2900-line monolith and doesn't accept a `defaultMode` prop, the cleanest approach is to create `PanelPhantomTab` that imports `TokenLauncher` with `bare={true}` and manually sets the mode. However, `bare` only hides the header -- it doesn't force phantom mode.
- **Better approach**: Create `PanelPhantomTab` as a standalone component that directly uses `usePhantomWallet` and reuses the Phantom launch logic (the `handlePhantomLaunch` callback pattern from `TokenLauncher`). But this would duplicate ~500 lines.
- **Simplest approach**: Import `TokenLauncher` as-is with `bare={true}`, and add a new optional prop `defaultMode` to `TokenLauncher` that sets the initial `generatorMode` state. This is a 1-line change in `TokenLauncher`.

### Implementation Steps

1. **Modify `TokenLauncher`** -- Add optional `defaultMode` prop to `TokenLauncherProps`. Use it as the initial value for `generatorMode` state. When `defaultMode` is `"phantom"`, also hide the mode selector tabs so users can't switch away.

2. **Create `PanelPhantomTab.tsx`** -- Renders `TokenLauncher` with `bare={true}` and `defaultMode="phantom"`, plus simple `onLaunchSuccess` and `onShowResult` handlers (toast + optional inline result display).

3. **Update `PanelPage.tsx`** -- Add admin-gated Phantom tab with `useIsAdmin` check.

### Technical Details

- `TokenLauncherProps` gets: `defaultMode?: "phantom" | "holders" | "random" | ...` 
- In `TokenLauncher`, line ~106: `useState(defaultMode || "random")`
- When `defaultMode === "phantom"`, hide the mode selector row so only Phantom UI shows
- `PanelPhantomTab` will show a launch result card (mint address, solscan link) after successful launch
- Admin check uses existing `useIsAdmin(solanaAddress)` hook which queries `user_roles` table via `has_role` RPC

