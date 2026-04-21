// ============================================================================
// PopShiba V2 — UNCX-locking suite bytecode
// ============================================================================
//
// These two contracts MUST be compiled from `contracts/PopShibaLauncherV2.sol`
// and `contracts/PopShibaFeeVaultV2.sol` (Solidity 0.8.20, optimizer 200 runs)
// and the runtime+ctor bytecode pasted below before the admin "Deploy V2 Suite"
// button is enabled.
//
// Why this is a manual paste step (same as V1):
//   - Deno edge functions don't ship a Solidity compiler.
//   - Compile in Remix/Foundry once, paste hex strings here. ~5 min.
//
// Format: just the hex (no leading "0x"), exactly like the V1 files in
// precompiled_bytecode.ts and launcher_bytecode.ts.
//
// Constructor args (auto-encoded by index.ts, do NOT include in the hex below):
//   PopShibaFeeVaultV2(address platformTreasury)
//   PopShibaLauncherV2(address cloneFactory, address feeVault)
//
// After deployment, admin must:
//   1. Call FeeVaultV2.setLauncher(launcherV2Address)   ← enables registerLockedToken()
//   2. (optional) Update eth_deployments.uncx_lock_fee_wei from launcher.uncxLockFeeWei()
// ============================================================================

export const POPSHIBA_FEE_VAULT_V2_BYTECODE = ""; // PASTE COMPILED HEX HERE

export const POPSHIBA_LAUNCHER_V2_BYTECODE = ""; // PASTE COMPILED HEX HERE

export const V2_BYTECODE_READY =
  POPSHIBA_FEE_VAULT_V2_BYTECODE.length > 0 && POPSHIBA_LAUNCHER_V2_BYTECODE.length > 0;
