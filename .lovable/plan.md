

## Two Changes: Public User Profiles + Discover Page Fix

### 1. Public User Profile Page (`/profile/:username`)

Create a new page at `/profile/:usernameOrWallet` that displays any user's public profile with trading data, styled like the reference screenshot (dark terminal aesthetic with retro uppercase headings).

**New file: `src/pages/UserProfilePage.tsx`**
- Resolve user by username or wallet address from `profiles` table
- Display profile header: avatar, display name, username, wallet (truncated), verified badge, bio, join date
- Stats row: Coins Held, Coins Created, Followers, Following (from `profiles` counts + `follows` + `fun_tokens` tables)
- **Tokens tab**: Query `fun_tokens` where `creator_wallet` matches the profile's wallet — show tokens they created with market cap, status
- **Trades tab**: Query `launchpad_transactions` where `user_profile_id` matches — show recent buy/sell trades with token name, SOL amount, time
- Follow/Unfollow button (if authenticated and viewing another user)
- Uses `LaunchpadLayout` for consistent site chrome

**Style** (matching reference screenshot):
- Dark card backgrounds with subtle borders
- Uppercase bold section headers (POINTS → TOKENS, TRADES)
- Monospace values, compact data rows
- Cover banner area + avatar overlapping it

**Route addition in `src/App.tsx`:**
- Add `<Route path="/profile/:identifier" element={<UserProfilePage />} />`
- Lazy import the page

**New hook: `src/hooks/useUserProfile.ts`**
- Fetch profile by username or wallet
- Fetch created tokens count, trade history, follower/following counts

### 2. Discover Page: Filter Out Rugged Tokens

**File: `supabase/functions/dexscreener-trending/index.ts`**

In step 4 (merge and build response), add a filter after building results:
- Remove any token where `priceChange6h < -50` (hides -50% and worse)
- Re-rank remaining tokens sequentially (1, 2, 3...)

This is a server-side filter so the client receives clean data.

### Summary of files

| File | Action |
|------|--------|
| `src/pages/UserProfilePage.tsx` | Create — full public profile page |
| `src/hooks/useUserProfile.ts` | Create — data fetching hook |
| `src/App.tsx` | Edit — add `/profile/:identifier` route |
| `supabase/functions/dexscreener-trending/index.ts` | Edit — filter tokens with priceChange6h < -50, re-rank |

