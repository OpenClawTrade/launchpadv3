

# Panel Button: Auth-First Flow

## What Changes

Both the **header Panel button** and the **sidebar Panel link** should check authentication first. If the user is not logged in, open the Privy login popup instead of navigating. After successful login, redirect to `/panel`.

## Implementation

### 1. AppHeader.tsx -- Replace `<Link>` with `<button>`

Change the Panel `<Link to="/panel">` (lines 78-85) to a `<button>` that:
- Calls `useAuth()` to check `isAuthenticated` and get `login()`
- If authenticated: uses `navigate("/panel")` immediately
- If not authenticated: calls `login()`, then uses a `useEffect` watching `isAuthenticated` to navigate to `/panel` once login completes

### 2. Sidebar.tsx -- Auth-gated Panel nav item

The Panel entry in `NAV_LINKS` needs special handling since `SidebarContent` currently renders all items as plain `<Link>`. Two options:

- **Approach:** Import `useAuth` into `SidebarContent`. For the Panel item specifically, render a `<button>` instead of `<Link>` that checks auth and either navigates or opens Privy login. A `useEffect` watches `isAuthenticated` + a pending flag to auto-navigate after login succeeds.

### 3. Shared hook: `usePanelNav()`

To avoid duplicating auth-gate logic, create a small hook:

```
src/hooks/usePanelNav.ts
```

This hook:
- Gets `isAuthenticated`, `login` from `useAuth()`
- Gets `navigate` from `react-router-dom`
- Tracks a `pendingPanel` ref
- Returns `goToPanel()` function that either navigates or logs in
- Has a `useEffect` that navigates to `/panel` when `isAuthenticated` flips to `true` while `pendingPanel` is set

### Technical Details

**Files to create:**
- `src/hooks/usePanelNav.ts` -- shared auth-gated navigation hook

**Files to modify:**
- `src/components/layout/AppHeader.tsx` -- replace Panel `<Link>` with `<button>` using `usePanelNav()`
- `src/components/layout/Sidebar.tsx` -- special-case the Panel nav item to use `usePanelNav()` instead of `<Link>`

**Hook implementation (usePanelNav):**
```typescript
export function usePanelNav() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const pendingRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && pendingRef.current) {
      pendingRef.current = false;
      navigate("/panel");
    }
  }, [isAuthenticated, navigate]);

  const goToPanel = useCallback(() => {
    if (isAuthenticated) {
      navigate("/panel");
    } else {
      pendingRef.current = true;
      login();
    }
  }, [isAuthenticated, login, navigate]);

  return { goToPanel };
}
```

**AppHeader change:** The Panel `<Link>` becomes:
```tsx
<button onClick={goToPanel} className="...same styles...">
  <img src={clawLogo} ... /> Panel
</button>
```

**Sidebar change:** In the `NAV_LINKS.map()`, when `useClaw` is true, render a `<button onClick={goToPanel}>` instead of `<Link to={to}>` with identical styling.

