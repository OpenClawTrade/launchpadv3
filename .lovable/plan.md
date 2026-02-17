

## Add Solana Wallet Adapter to the Migration Page

### Overview

Replace the Privy-based "Connect Wallet" on the `/migrate` page with the standard **Solana Wallet Adapter**, which natively supports Phantom, Solflare, Backpack, and other popular Solana wallets -- including mobile deep-link support.

### What Changes

**1. Install new dependencies**
- `@solana/wallet-adapter-base`
- `@solana/wallet-adapter-react`
- `@solana/wallet-adapter-react-ui`
- `@solana/wallet-adapter-wallets` (includes Phantom, Solflare, Backpack, etc.)

**2. Create a lightweight Solana Wallet Adapter provider for the migrate page**
- New file: `src/providers/SolanaWalletAdapterProvider.tsx`
- Wraps `ConnectionProvider` + `WalletProvider` + `WalletModalProvider`
- Uses the same Helius RPC URL already configured in the project
- Only used on the migrate page, keeping it isolated from the rest of the app's Privy auth

**3. Update the Migration Page**
- File: `src/pages/MigratePage.tsx`
- Remove the dependency on `useAuth()` for `solanaAddress` and `login`
- Instead, use `useWallet()` from `@solana/wallet-adapter-react` to get the connected wallet's public key
- Replace the "Connect Wallet" button with the Wallet Adapter's `WalletMultiButton` component, which shows a wallet selection modal supporting all popular Solana wallets
- Wrap the migrate page content with the new `SolanaWalletAdapterProvider`

**4. Import wallet adapter styles**
- Import `@solana/wallet-adapter-react-ui/styles.css` for the wallet modal UI

### Technical Details

```text
Before:
  MigratePage --> useAuth() (Privy) --> solanaAddress

After:
  SolanaWalletAdapterProvider
    --> MigratePage --> useWallet() --> publicKey.toBase58()
```

- The wallet adapter only provides address lookup (no transaction signing needed on this page)
- Mobile users can connect via Phantom/Solflare mobile apps through deep links
- The rest of the app continues using Privy for authentication -- this change is scoped to `/migrate` only
- The ledger lookup logic stays exactly the same, just the source of the wallet address changes

