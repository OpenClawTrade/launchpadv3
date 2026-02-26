

# Route punchlaunch.fun to /punch-test Only

## Overview
Configure `punchlaunch.fun` so it always lands on the Punch Test page and never exposes any other Claw platform routes. Users on this domain will be fully sandboxed.

## Changes

### 1. Update DomainRouter to redirect punchlaunch.fun
In `src/components/DomainRouter.tsx`, add logic so that when the hostname is `punchlaunch.fun` (or `www.punchlaunch.fun`):
- If the user is on `/`, redirect to `/punch-test`
- If the user navigates to ANY route that is NOT `/punch-test` or `/launchpad/:mintAddress` (for viewing launched tokens), redirect them back to `/punch-test`

This ensures the domain is fully locked to the punch experience.

### 2. Hide external navigation links when on punchlaunch.fun
In `src/pages/PunchTestPage.tsx`:
- Detect if the hostname is `punchlaunch.fun` and conditionally hide or reroute any links that point to non-punch pages (e.g., the "View Token" link to `/launchpad/...` can stay since it shows the token detail, but any branding or nav linking back to the main Claw platform will be hidden)
- Remove or hide any "Claws" / "ClawMode" branding references when on this domain

### 3. Block all non-punch routes on punchlaunch.fun
Add a guard in `DomainRouter` that catches ALL route changes. If hostname is `punchlaunch.fun` and the path doesn't start with `/punch-test` or `/launchpad/`, force redirect to `/punch-test`. This prevents users from manually typing other URLs.

## Technical Details

**DomainRouter.tsx** changes:
```
const hostname = window.location.hostname;
const isPunchDomain = hostname === "punchlaunch.fun" || hostname === "www.punchlaunch.fun";

if (isPunchDomain) {
  const allowed = ["/punch-test", "/launchpad/"];
  const isAllowed = allowed.some(p => location.pathname.startsWith(p));
  if (!isAllowed) {
    navigate("/punch-test", { replace: true });
  }
}
```

**PunchTestPage.tsx** changes:
- Add a `const isPunchDomain = ...` check
- Conditionally hide any links/branding that reference the main platform
- Ensure the "View Token" link stays functional (it goes to `/launchpad/:mint` which is allowed)

## Files to Edit
1. `src/components/DomainRouter.tsx` -- Add punchlaunch.fun domain guard
2. `src/pages/PunchTestPage.tsx` -- Hide main platform branding/links when on punch domain
