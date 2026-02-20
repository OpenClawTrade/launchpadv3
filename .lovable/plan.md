

## Fix: /trading-agents 404 Error

**Problem:** The Sidebar navigation links to `/trading-agents`, but no route exists for that path in `App.tsx`. The trading agents content lives at `/agents?tab=trading`.

**Solution:** Add a redirect route in `App.tsx` so `/trading-agents` redirects to `/agents?tab=trading` (same pattern already used for `/agents/trading`).

### Changes

**`src/App.tsx`**
- Add a new `<Route>` entry: `<Route path="/trading-agents" element={<Navigate to="/agents?tab=trading" replace />} />`
- Place it near the existing `/agents/trading` redirect (around line 137)

This is a one-line fix that follows the exact same redirect pattern already used in the codebase (e.g., `/agents/trading` redirects to `/agents?tab=trading`, `/portfolio` redirects to `/panel?tab=portfolio`).

