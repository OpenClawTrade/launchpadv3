

## Plan: Fix Referral Link, Fee %, Missing Settings, and Token Holdings

### Issues Identified

1. **Referral link uses `window.location.origin`** (e.g., `lovableproject.com/link/96c119`) instead of `moondexo.com/link/96c119`
2. **Referral fee shows "5%"** but should be **"50%"**
3. **Admin section** — already correctly gated by `isAdmin` check in PanelPage.tsx (line 169). Only users in `user_roles` table with admin role see it. No change needed.
4. **Token holdings inaccurate/slow** — `TokenHoldingsList` uses the `fetch-wallet-holdings` edge function which goes through Helius. Need to add Alchemy Solana as a faster alternative or parallel provider.
5. **Profile edit settings missing from panel** — The `EditProfileModal` (used on UserProfilePage) has username, bio, location, website, cover photo, and verify account. The panel's `SettingsModal` only has display name, avatar, sounds, quick buy, and slippage. Need to add the missing fields.
6. **Profile link → Panel** — Already working (`handleProfileClick` navigates to `/panel` in HeaderWalletBalance.tsx line 121).

### Changes

**1. Fix referral link domain** — `src/hooks/useReferral.ts`
- Line 59-60: Change `${window.location.origin}/link/${referralCode}` to `https://${BRAND.domain}/link/${referralCode}` using the branding config.

**2. Fix referral fee percentage** — `src/components/panel/PanelUnifiedDashboard.tsx`
- Line 909: Change `5%` to `50%`
- Line 998: Change `5%` to `50%`

**3. Add missing profile settings to SettingsModal** — `src/components/settings/SettingsModal.tsx`
- Add username field (with `@` prefix, 30-day change restriction)
- Add bio textarea (160 char limit)
- Add location field
- Add website field
- Fetch full profile data (username, bio, location, website, username_changed_at) on mount
- Save all fields via the existing `update-profile` edge function (same as EditProfileModal uses)

**4. Improve token holdings speed** — `supabase/functions/fetch-wallet-holdings/index.ts`
- Add Alchemy Solana RPC as primary provider (`ALCHEMY_SOLANA_RPC_URL` secret), falling back to Helius if unavailable
- This mirrors the BSC pattern where Alchemy is primary with public fallback
- Will need to add the `ALCHEMY_SOLANA_RPC_URL` secret

**5. Add "Edit Profile" and "Verify" buttons to panel hero** — `src/components/panel/PanelUnifiedDashboard.tsx`
- Add an "Edit Profile" quick action button that opens the full `EditProfileModal`
- Import and wire up `EditProfileModal` and `VerifyAccountModal`
- Fetch full profile data (bio, location, website, username, cover_url, username_changed_at) for the edit modal

