
# Auto-Trading (No Popup) + Admin Wallet Setup

## What This Does
- Enables **one-click trading** by removing the Privy approval popup for embedded wallet transactions
- Prompts users to enable auto-trading on first login (or if they haven't enabled it yet)
- Adds your wallet as admin so you can access admin features

## Two Parts

### Part 1: Add Admin Role for Your Wallet

Since your wallet `6B19APooM4Vsk3CC2HZ1ubMm82s9wcgwVuB9xpYFMSP6` doesn't have a profile in the database yet, we need to:
1. Create a profile row for this wallet (via a database migration or by logging in first)
2. Add the admin role for that profile in `user_roles`

Since profile IDs are derived from Privy user IDs (deterministic UUID), the simplest approach is:
- Insert a profile with this wallet address via DB migration
- Add the admin role for that profile

Alternatively, we can update `useIsAdmin` to look up admin status directly by wallet address from a new `admin_wallets` table or just insert the profile + role once you log in and the `sync-privy-user` function runs.

**Recommended approach**: Run a DB migration that inserts the admin role linked to your wallet address. We'll also ensure the profile sync creates the profile on login, and add a fallback admin check by wallet address.

### Part 2: Enable Privy Delegated Actions (Auto-Signing)

Privy supports **delegated actions** via the `useHeadlessDelegatedActions` hook. This allows the app to sign transactions on behalf of the user without showing a popup.

#### How it works:
1. User logs in and gets an embedded Solana wallet
2. We prompt them (once) to "Enable Auto-Trading" which calls `delegateWallet({ address, chainType: 'solana' })`
3. Once delegated, all future transactions sign automatically -- no popup

#### Implementation:

**New file: `src/hooks/useDelegatedWallet.ts`**
- Uses `useHeadlessDelegatedActions` from `@privy-io/react-auth`
- Tracks delegation status in `localStorage` 
- Exposes `isDelegated`, `requestDelegation()`, and `needsDelegation` flags

**New file: `src/components/DelegationPrompt.tsx`**
- A modal/dialog shown after login when delegation hasn't been granted
- Explains what auto-trading means ("Trade with one click, no approval popups")
- "Enable Auto-Trading" button that calls `delegateWallet`
- "Maybe Later" dismiss option
- Shown once per session until enabled

**Modified: `src/providers/PrivyProviderWrapper.tsx`**
- No changes needed to Privy config (delegated actions work with existing embedded wallet setup)

**Modified: App layout or main wrapper**
- Mount `DelegationPrompt` so it appears when a logged-in user hasn't delegated yet

**Modified: `src/hooks/useSolanaWalletPrivy.ts`**
- Update `signAndSendTransaction` to use the delegated signing path when available (Privy handles this transparently once delegation is active)

---

## Technical Details

### Database Migration
```sql
-- Ensure profile exists for admin wallet (will be updated when user actually logs in)
INSERT INTO profiles (id, username, display_name, solana_wallet_address)
VALUES (gen_random_uuid(), 'admin_6B19', 'Admin', '6B19APooM4Vsk3CC2HZ1ubMm82s9wcgwVuB9xpYFMSP6')
ON CONFLICT (solana_wallet_address) DO NOTHING;

-- Add admin role (will reference the profile created above or after login)
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM profiles 
WHERE solana_wallet_address = '6B19APooM4Vsk3CC2HZ1ubMm82s9wcgwVuB9xpYFMSP6'
ON CONFLICT (user_id, role) DO NOTHING;
```

### Delegation Hook
```typescript
import { useHeadlessDelegatedActions } from '@privy-io/react-auth';

const { delegateWallet } = useHeadlessDelegatedActions();

// Call once per user to enable auto-signing:
await delegateWallet({ address: embeddedWalletAddress, chainType: 'solana' });
```

### Delegation Prompt Flow
```text
User logs in
    |
    v
Check: Has delegation been granted?
    |
   No --> Show "Enable Auto-Trading" dialog
    |         |
    |     User clicks "Enable"
    |         |
    |     Call delegateWallet()
    |         |
    |     Save to localStorage
    |
   Yes --> Normal app usage (trades sign automatically)
```

### Files Changed
1. **DB migration** -- insert profile + admin role for your wallet
2. **`src/hooks/useDelegatedWallet.ts`** -- new hook for delegation state
3. **`src/components/DelegationPrompt.tsx`** -- new auto-trading opt-in dialog  
4. **App layout** -- mount the delegation prompt for logged-in users
5. **`src/hooks/useSolanaWalletPrivy.ts`** -- minor update to leverage delegated signing
