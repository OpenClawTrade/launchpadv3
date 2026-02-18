
## Hardcode the Reserved Vanity Address for the Next Launch

### Goal
Remove the need to enter the `OFFICIAL-TUNA` launch code. Instead, always send `specificVanityId: 'beef27e2-e826-46b7-a8f5-8a796ea97efb'` for the next Phantom launch automatically, and clean up the UI by removing the launch code input field.

### What Changes

**`src/components/launchpad/TokenLauncher.tsx`**

1. **Hardcode the specificVanityId** (~line 1058): Remove the conditional check for `'OFFICIAL-TUNA'` and always include the reserved vanity ID:
   ```ts
   // Before
   ...(phantomLaunchCode.trim() === 'OFFICIAL-TUNA' ? { specificVanityId: 'beef27e2-...' } : {}),

   // After
   specificVanityId: 'beef27e2-e826-46b7-a8f5-8a796ea97efb',
   ```

2. **Remove the Launch Code state and UI** (~line 150, ~lines 2210–2223): Delete the `phantomLaunchCode` state variable and the entire "Launch Code (optional)" input block from the form. This cleans up the UI since the code is no longer needed.

### Result
Every Phantom launch will automatically use the reserved `EpAAWyTH...myTUna` address — no code entry required. Once the official $TUNA launch is done and the address is marked as `used`, this hardcoded ID should be removed so future launches fall back to the normal vanity address pool.
