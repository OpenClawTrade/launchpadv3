// Auto-included Solidity sources for the PopShiba Ethereum suite.
// Bytecode is left as a runtime-resolvable placeholder — the deploy function
// must compile via the user's local `forge build` artifacts and paste in here.
// For now we ship the SOURCES (used by Etherscan verification) and EMPTY ABI
// stubs that callers can populate after running `forge inspect`.
//
// IMPORTANT: Before running eth-deploy-contracts, paste compiled bytecode +
// ABI from `contracts/popshiba/out/*.json` into the constants below. See
// the README in contracts/popshiba for the one-line forge command.

import { POPSHIBA_TOKEN_ARTIFACT } from "./artifacts/PopShibaToken.ts";
import { POPSHIBA_CLONE_FACTORY_ARTIFACT } from "./artifacts/PopShibaCloneFactory.ts";
import { POPSHIBA_FEE_VAULT_ARTIFACT } from "./artifacts/PopShibaFeeVault.ts";

export const POPSHIBA_TOKEN_BYTECODE = POPSHIBA_TOKEN_ARTIFACT.bytecode as `0x${string}`;
export const POPSHIBA_TOKEN_ABI = POPSHIBA_TOKEN_ARTIFACT.abi;

export const POPSHIBA_CLONE_FACTORY_BYTECODE = POPSHIBA_CLONE_FACTORY_ARTIFACT.bytecode as `0x${string}`;
export const POPSHIBA_CLONE_FACTORY_ABI = POPSHIBA_CLONE_FACTORY_ARTIFACT.abi;

export const POPSHIBA_FEE_VAULT_BYTECODE = POPSHIBA_FEE_VAULT_ARTIFACT.bytecode as `0x${string}`;
export const POPSHIBA_FEE_VAULT_ABI = POPSHIBA_FEE_VAULT_ARTIFACT.abi;

// Solidity source for Etherscan verification — must match the deployed bytecode EXACTLY
export const POPSHIBA_TOKEN_SOURCE = POPSHIBA_TOKEN_ARTIFACT.source;
export const POPSHIBA_CLONE_FACTORY_SOURCE = POPSHIBA_CLONE_FACTORY_ARTIFACT.source;
export const POPSHIBA_FEE_VAULT_SOURCE = POPSHIBA_FEE_VAULT_ARTIFACT.source;
