

## Fix Pool Transaction Size for Phantom Lighthouse (Keep 2 Transactions)

### Problem
TX2 (Create Pool) uses 15+ accounts from Meteora's DBC protocol, pushing it near the 1232-byte Solana transaction limit. Phantom's Lighthouse can't inject protection instructions because there's no room. TX1 (Config) works fine since it's small.

### Solution: Address Lookup Tables (ALTs)

Use a pre-created Address Lookup Table containing all static/known addresses used in pool creation. This compresses 32-byte account references to 1-byte indices, saving ~300-400 bytes and leaving ample room for Lighthouse.

### Changes Required

#### 1. Create ALT Setup Script (`lib/addressLookupTable.ts`)
- New utility to create and extend an Address Lookup Table with all static addresses used across Meteora pool creation:
  - Token Program, Associated Token Program, System Program
  - WSOL mint, Meteora DBC program ID
  - Platform fee wallet, migration fee address
  - Metaplex Token Metadata program
  - Compute Budget program
- Store the ALT address as an environment variable (`ALT_ADDRESS`)
- One-time setup: create the ALT, extend it with addresses, wait for activation (1 slot)

#### 2. Update `lib/meteora.ts` - Convert to VersionedTransaction with ALT
- After building legacy `Transaction` objects, convert TX2 (Create Pool) to a `VersionedTransaction` using `MessageV0.compile()` with the ALT
- Fetch the ALT account from chain using `connection.getAddressLookupTable()`
- This compresses all matching account references automatically
- Keep TX1 as legacy (it's small enough) or convert both for consistency
- Keep dev buy merged into pool tx (2 transactions total, not 3)

#### 3. Update `api/pool/create-phantom.ts` - Return VersionedTransactions
- Serialize VersionedTransactions instead of legacy Transactions
- Update the response format to indicate versioned transactions
- Include the ALT address in the response so frontend can deserialize correctly

#### 4. Update `src/components/launchpad/TokenLauncher.tsx` - Handle VersionedTransactions
- Deserialize as `VersionedTransaction` instead of `Transaction`
- Phantom's `signTransaction` already supports VersionedTransaction
- After Phantom signs, apply ephemeral keypair signatures using `VersionedTransaction.sign()`
- Submit via `sendRawTransaction` as before

#### 5. Update `src/pages/ClaudeLauncherPage.tsx` - Same VersionedTransaction handling
- Mirror the TokenLauncher changes for consistency

### Static Addresses for ALT (approximately 10-12 addresses)

```text
- Token Program: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
- Associated Token Program: ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL  
- System Program: 11111111111111111111111111111111
- WSOL Mint: So11111111111111111111111111111111111111112
- Meteora DBC Program: dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN
- Metaplex Metadata Program: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
- Platform Fee Wallet: (from config)
- Migration Fee Address: (from SDK constant)
- Compute Budget Program: ComputeBudget111111111111111111111111111111
- Rent Sysvar: SysvarRent111111111111111111111111111111111
```

### Byte Savings Estimate
- Each address in ALT saves ~31 bytes (32-byte pubkey becomes 1-byte index)
- With 10 matching addresses: ~310 bytes saved
- Pool tx currently ~1100-1200 bytes, after ALT: ~800-900 bytes
- Leaves 300+ bytes for Lighthouse instructions

### Trade-offs
- Requires one-time ALT creation (a few SOL rent, done once)
- ALT must be activated before use (takes 1 slot after creation)
- VersionedTransaction is supported by all modern wallets including Phantom
- Dev buy stays merged into pool tx -- users still see only 2 signing prompts

### Implementation Order
1. Create ALT utility and deploy the lookup table on-chain
2. Update `lib/meteora.ts` to use VersionedTransaction with ALT
3. Update `api/pool/create-phantom.ts` to serialize versioned txs
4. Update frontend components to deserialize and sign versioned txs
5. Test end-to-end: both Phantom and Holders flows

