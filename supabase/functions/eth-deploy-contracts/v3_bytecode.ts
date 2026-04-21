// ============================================================================
// PopShiba V3 — Team Finance LP locking suite bytecode
// ============================================================================
// Compiled from contracts/popshiba/PopShibaFeeVaultV3.sol and PopShibaLauncherV3.sol
// Solidity 0.8.20, optimizer enabled (200 runs), viaIR: true, evmVersion: paris
//
// Constructor args (auto-encoded by index.ts, do NOT include in the hex below):
//   PopShibaFeeVaultV3(address platformTreasury)
//   PopShibaLauncherV3(address cloneFactory, address feeVault)
//
// After deployment, admin must:
//   1. Call FeeVaultV3.setLauncher(launcherV3Address)
//   2. (optional) Update eth_deployments.tf_lock_fee_wei from launcher.teamFinanceFeeWei()
//
// COMPILE & PASTE
//   - Use Remix or `solc --optimize --via-ir --evm-version paris` to compile
//   - Paste the runtime bytecode (no 0x prefix) into the two consts below
//   - Set V3_BYTECODE_READY = true
//   - Then click "Deploy V3 (Team Finance Locking)" in the admin panel.
// ============================================================================

export const POPSHIBA_FEE_VAULT_V3_BYTECODE = ""; // PASTE FeeVaultV3 runtime bytecode here

export const POPSHIBA_LAUNCHER_V3_BYTECODE = ""; // PASTE LauncherV3 runtime bytecode here

export const V3_BYTECODE_READY =
  POPSHIBA_FEE_VAULT_V3_BYTECODE.length > 100 &&
  POPSHIBA_LAUNCHER_V3_BYTECODE.length > 100;
