

## Fix: Reduce 30-Second Delay on Decompress Page

### Root Cause
When the user clicks "Decompress", the code dynamically imports **4 large SDK bundles from esm.sh** before doing anything. These imports are ~2-5MB total and happen every single click (browser may cache after first load, but initial load is brutal).

After that, it also:
1. Creates an ATA transaction, signs it, sends it, and **waits for confirmation**
2. Fetches compressed token accounts
3. Then finally builds the decompress transaction and shows the wallet prompt

### Fix Strategy

**1. Preload SDKs on page mount instead of on click**
- Move the 4 dynamic imports into a `useEffect` that runs when the page loads
- Store the loaded modules in a `useRef` so they're ready instantly when the user clicks "Decompress"
- Show a subtle loading indicator while SDKs load in the background

**2. Use installed packages instead of esm.sh imports**
- `@solana/web3.js` and `@solana/spl-token` are already installed as project dependencies
- Import them directly instead of fetching from esm.sh, eliminating 2 of the 4 remote loads
- Only the Light Protocol packages (`stateless.js`, `compressed-token`) need remote loading

**3. Combine ATA + Decompress into one transaction**
- Instead of sending a separate ATA creation transaction, waiting for confirmation, then building the decompress transaction, combine both instructions into a single transaction
- This eliminates one full round-trip (sign + send + confirm), saving ~10-15 seconds

### Technical Changes

**File: `src/pages/DecompressPage.tsx`**

- Add a `useEffect` + `useRef` to preload the Light Protocol SDKs on mount
- Replace `esm.sh` imports of `@solana/web3.js` and `@solana/spl-token` with direct imports from installed packages
- Merge the ATA instruction and decompress instructions into a single transaction so the user only sees one wallet prompt
- Add a loading state (e.g., "Preparing SDK...") on mount so the user knows when the tool is ready

### Expected Result
- **Before**: ~30 seconds from click to wallet prompt
- **After**: ~2-5 seconds (just RPC calls to fetch proofs + build transaction), assuming SDKs preloaded during page load

