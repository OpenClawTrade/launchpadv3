

## Fix: Remove Unused `getTreasuryKeypair()` Call Causing "Invalid character" Error

### Root Cause

In `api/pool/create-fun-mode.ts`, line 129 calls `getTreasuryKeypair()` which runs `bs58.decode()` on the `TREASURY_PRIVATE_KEY` environment variable. If that key contains any character not in the base58 alphabet, it throws `"Invalid character"` -- which gets caught by the generic catch block and returned as the 500 error.

**The treasury keypair is never used in this function.** All transactions use `phantomPubkey` as the fee payer, and the only ephemeral keypairs are `mintKeypair` and `positionNftMint` (both generated fresh). The treasury call is dead code that causes a crash.

### Fix

**File: `api/pool/create-fun-mode.ts`**

Remove line 129:
```
const treasuryKeypair = getTreasuryKeypair();
```

This single line removal eliminates the unnecessary base58 decode that is crashing the function. No other code references `treasuryKeypair`.

### Why This Works

- The function builds two transactions signed by ephemeral keypairs (mint + position NFT) and the user's Phantom wallet
- Treasury is not involved in FUN mode token creation
- Removing the call prevents the base58 decode error while changing zero functional behavior

