

# Fix: Remove Base/EVM Errors from Agent Claim Flow

## Problem
When visiting the **Solana-only** `/agents/claim` page, you're seeing console errors related to Base chain:
- `Failed to load resource: 403` from `api.web3modal.org`
- `Failed to load resource: 400` from `pulse.walletconnect.org`
- `[Reown Config] Failed to fetch remote project configuration`

This happens because:
1. **EvmWalletProvider wraps the entire app** – even Solana-only pages initialize WalletConnect
2. **Invalid WalletConnect project ID** – `'tuna-launchpad-base'` is a placeholder, not a real WalletConnect Cloud ID

## Solution

**Make EVM wallet loading conditional** – only initialize the EVM provider when user is on a Base/EVM chain route.

### Changes

1. **Create a lazy EVM wrapper** that only mounts when needed

2. **Update `App.tsx`** to conditionally render `EvmWalletProvider`:
   - Use `ChainContext` to detect if user is on an EVM chain
   - Only mount the EVM provider when `chain === 'base'` (or other EVM chains)
   - Solana routes skip EVM initialization entirely

3. **Alternatively (simpler approach)**: Suppress WalletConnect initialization errors by providing a valid project ID or removing the EVM provider from global scope until Base launchpad goes live

### Recommended Approach

Since **Base launchpad is not live yet** (gated with "Coming Soon"), the cleanest solution is to:
- Remove `EvmWalletProvider` from the global `App.tsx` wrapper
- Only include it in Base-specific routes/components when needed

---

## Technical Implementation

### Step 1: Remove global EVM provider from App.tsx
```tsx
// Before (current)
<EvmWalletProvider>
  <PrivyProviderWrapper>
    ...
  </PrivyProviderWrapper>
</EvmWalletProvider>

// After
<PrivyProviderWrapper>
  ...
</PrivyProviderWrapper>
```

### Step 2: Add EVM provider only to Base routes
When Base launchpad goes live, wrap only the Base-specific pages:
```tsx
<Route 
  path="/launch/base" 
  element={
    <EvmWalletProvider>
      <FunLauncherPage />
    </EvmWalletProvider>
  } 
/>
```

### Step 3: (Future) Get a real WalletConnect project ID
When Base is ready, register at [WalletConnect Cloud](https://cloud.walletconnect.com/) to get a valid project ID and replace the placeholder.

---

## Result
- ✅ No more WalletConnect errors on `/agents`, `/agents/claim`, and other Solana pages
- ✅ Faster page loads (no EVM initialization overhead)
- ✅ Clean console logs for debugging

