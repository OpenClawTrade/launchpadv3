

## Show "Done" After Decompression and Prevent Re-decompress

### What Changes
After a token is successfully decompressed, instead of showing the "Decompress" button again, the UI will show a "Done" badge with a checkmark. The button will be disabled/replaced so the user cannot trigger decompression again.

### Technical Details

**File: `src/pages/DecompressPage.tsx`**

1. Add a new state to track which mints have been successfully decompressed:
   ```
   const [decompressedMints, setDecompressedMints] = useState<Set<string>>(new Set());
   ```

2. After successful decompression (where the toast "Decompression complete!" fires), add the mint to the set:
   ```
   setDecompressedMints(prev => new Set(prev).add(balance.mint));
   ```

3. In the balances rendering section, check if a mint is in the decompressed set. If so, replace the "Decompress" button with a green "Done" indicator (Check icon + "Done" text). If not, show the normal "Decompress" button.

4. Also skip re-checking balances after decompression (remove the `await checkBalances()` call at the end) to avoid re-fetching and showing stale compressed balances that haven't been pruned from the indexer yet -- this is what causes the issue in the screenshot where it still shows 30M tokens after decompressing.

