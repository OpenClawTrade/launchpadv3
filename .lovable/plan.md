

## Investigation Results

That notification popup on the right side comes from **Sonner** (the toast library). It's triggered in `src/pages/ClawBookPage.tsx` (line 49) — a one-time "Claw Console is LIVE!" toast that fires 1.5 seconds after visiting the page, stored in `sessionStorage` so it only shows once per session.

The styling comes from `src/components/ui/sonner.tsx` which applies the dark glassmorphic theme to all Sonner toasts.

## Plan: Announcement System + Live Trade Notifications

### 1. Create a Global Announcement Toast System

**New file: `src/hooks/useAnnouncements.ts`**
- Query a new `announcements` table for active announcements
- Show each unseen announcement as a styled Sonner toast (with action button)
- Track seen announcements in `localStorage` by ID
- Run globally from `App.tsx` or `MainLayout` so it works on every page

**Database migration** — Create `announcements` table:
- `id`, `title`, `description`, `action_label`, `action_url`, `emoji`, `is_active`, `created_at`, `expires_at`
- No RLS needed (public read)
- You can insert new rows to create announcements — they'll show to all users automatically

### 2. Live Trade Notification Toasts

**New file: `src/hooks/useLiveTradeToasts.ts`**
- Subscribe to realtime `INSERT` events on `launchpad_transactions`
- On each new trade, fetch the token name (from cache or quick lookup) and the trader's wallet/username
- Show a compact Sonner toast: `"🟢 user123 bought 1.2 SOL of $TOKEN"` / `"🔴 user456 sold 0.5 SOL of $TOKEN"`
- Rate-limit to max 1 toast per 3 seconds to avoid spam during high volume
- Truncate wallet to `abc...xyz` format, use username if `user_profile_id` is available

**Integration**: Mount the hook in `MainLayout.tsx` so trade toasts appear globally across all pages.

### 3. Remove Hardcoded ClawBook Announcement

**File: `src/pages/ClawBookPage.tsx`**
- Remove the hardcoded "Claw Console is LIVE!" toast (lines 43-58) since announcements will now come from the database

### Files Summary

| File | Action |
|------|--------|
| `src/hooks/useAnnouncements.ts` | Create — DB-driven announcement toasts |
| `src/hooks/useLiveTradeToasts.ts` | Create — realtime trade notification toasts |
| `src/components/layout/MainLayout.tsx` | Edit — mount both hooks globally |
| `src/pages/ClawBookPage.tsx` | Edit — remove hardcoded announcement |
| Database migration | Create `announcements` table |

