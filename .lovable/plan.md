

# Punch Launch Updates

## Overview
Multiple changes needed: fix token metadata (X link + website), fix domain routing for punchlaunch.fun, update HTML meta tags, fix market data display, and add proper favicon.

---

## 1. Fix Token Metadata (X link + Website)

**File: `supabase/functions/punch-launch/index.ts`**

Update the Vercel payload and database insert to use the correct X link and website:
- Change `twitterUrl` from `"https://x.com/clawmode"` to `"https://x.com/punchitsol/status/2026923770934407218"`
- Add `websiteUrl: "https://punchlaunch.fun"` to the Vercel payload
- Update the `fun_tokens` insert to use the same twitter_url and add `website_url: "https://punchlaunch.fun"`
- Update description from "ClawMode" reference to "Punch Launch"

---

## 2. Domain Routing - Show as Main Page (not /punch-test)

**File: `src/components/DomainRouter.tsx`**

When visiting punchlaunch.fun, redirect to `/punch-test` but make it feel like the main page. Currently it redirects to `/punch-test` which shows in the URL bar. Change the routing so:
- Root `/` on punchlaunch.fun renders PunchTestPage directly
- Update allowed paths to include `/`

**File: `src/App.tsx`**

Add a route that renders PunchTestPage at `/` conditionally when on punchlaunch.fun domain, OR change DomainRouter to redirect to `/` and add a domain-aware root route.

Simpler approach: Keep the redirect to `/punch-test` but that's what the user sees in the URL. The user wants it to NOT show `/punch-test` in the URL. So we should:
- In DomainRouter: redirect to `/` instead of `/punch-test`
- In App.tsx routes: add logic so that on punchlaunch.fun domain, the `/` route renders PunchTestPage instead of the normal Index page

---

## 3. HTML Meta Tags for punchlaunch.fun

Since this is a single-page app sharing one `index.html`, we need to dynamically set meta tags when on the punchlaunch.fun domain. This will be done in the PunchTestPage component using `useEffect` to update document title and meta tags:

**File: `src/pages/PunchTestPage.tsx`**

Add a `useEffect` that:
- Sets `document.title = "Punch and Launch"`
- Updates OG/Twitter meta tags for the punch branding
- Sets description to "Punch the Viral Monkey Launchpad"
- Updates twitter:site to `@punchitsol`
- Updates og:image and twitter:image to the punch logo image

The user needs to provide a logo image, OR we can use an existing punch-related image from the project. The user mentioned "this logo" but didn't attach one. We'll use the existing monkey/punch imagery or ask.

**File: `index.html`**

No changes needed here since we'll handle it dynamically.

---

## 4. Favicon for punchlaunch.fun

Dynamic favicon change in PunchTestPage useEffect - swap the favicon link href when on punchlaunch.fun domain. The user said "this logo" but no image was attached. We'll need to use an existing image or the user needs to provide one.

---

## 5. Fix Market Data (MarketCap + Holders)

The Codex API works correctly (verified). The issue is in the `usePunchMarketData` hook:

**File: `src/hooks/usePunchMarketData.ts`**

The problem: the initial fetch useEffect depends on `tokens.length` but doesn't include `fetchBatch` in deps. Also, the `tokens` array passed from `PunchTokenFeed` is recreated every render (via `.filter().map()`), causing the polling useEffects to constantly reset intervals.

Fixes:
- Stabilize the tokens input using `useMemo` in PunchTokenFeed or serialize addresses for comparison
- Ensure the initial fetch fires properly by including `fetchBatch` in dependencies
- Add console logging to debug if data comes back empty

**File: `src/components/punch/PunchTokenFeed.tsx`**

Memoize the tokens array passed to `usePunchMarketData` using `useMemo` to prevent unnecessary re-renders and interval resets.

---

## Technical Summary

| File | Change |
|------|--------|
| `supabase/functions/punch-launch/index.ts` | Update twitter_url, add website_url, fix description |
| `src/components/DomainRouter.tsx` | Redirect punchlaunch.fun to `/` instead of `/punch-test` |
| `src/App.tsx` | Conditionally render PunchTestPage at `/` for punchlaunch.fun |
| `src/pages/PunchTestPage.tsx` | Dynamic meta tags, title, favicon for punch branding |
| `src/hooks/usePunchMarketData.ts` | Fix dependency issues causing data not to load |
| `src/components/punch/PunchTokenFeed.tsx` | Memoize tokens array for stable hook input |

