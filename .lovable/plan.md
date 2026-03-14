

## Wrap Rewards Page in LaunchpadLayout

The `/rewards` page currently renders as a standalone page with no sidebar, header, or footer — it uses raw `min-h-screen` containers. Every other page in the app wraps its content in `<LaunchpadLayout>`, which provides the sidebar, header, and footer.

### Changes

**File: `src/pages/RewardsPage.tsx`**
- Import `LaunchpadLayout` from `@/components/layout/LaunchpadLayout`
- Wrap every return path (unauthenticated, X not linked, loading, not joined, main dashboard) inside `<LaunchpadLayout>`
- Remove the `min-h-screen` classes from the inner containers since the layout already handles full-height rendering
- Remove the `pt-20 md:pt-24` padding from the main dashboard view (the layout's `<main>` already has `p-4`)

This is a straightforward wrapper change — no logic or data flow modifications needed.

