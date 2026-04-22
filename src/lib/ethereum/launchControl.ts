// Constants & ABIs used by the /launchnow control center.
// Mainnet only.

import { type Address } from "viem";

export const UNISWAP_V2_FACTORY: Address = "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f";
export const UNISWAP_V2_ROUTER: Address = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";
export const WETH: Address = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
export const DEAD_ADDRESS: Address = "0x000000000000000000000000000000000000dEaD";

// Minimal ERC20 ABI — covers what most launches expose.
export const ERC20_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  // Common ownable + anti-bot patterns:
  { type: "function", name: "renounceOwnership", stateMutability: "nonpayable", inputs: [], outputs: [] },
  // Public state for the standard anti-bot pattern (used by /launchnow to show live status)
  { type: "function", name: "limited", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "uniswapV2Pair", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "maxHoldingAmount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "minHoldingAmount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "setRule",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_limited", type: "bool" },
      { name: "_uniswapV2Pair", type: "address" },
      { name: "_maxHoldingAmount", type: "uint256" },
      { name: "_minHoldingAmount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const UNISWAP_V2_FACTORY_ABI = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "address" }],
  },
] as const;

export const UNISWAP_V2_PAIR_ABI = [
  { type: "function", name: "getReserves", stateMutability: "view", inputs: [], outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }] },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "nonces", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "DOMAIN_SEPARATOR", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  {
    type: "function",
    name: "permit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export const UNISWAP_V2_ROUTER_ABI = [
  {
    type: "function",
    name: "addLiquidityETH",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountTokenDesired", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "removeLiquidityETHSupportingFeeOnTransferTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "liquidity", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "removeLiquidityETHWithPermitSupportingFeeOnTransferTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "liquidity", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "approveMax", type: "bool" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const ETHERSCAN_TX = (h: string) => `https://etherscan.io/tx/${h}`;
export const ETHERSCAN_ADDR = (a: string) => `https://etherscan.io/address/${a}`;
export const ETHERSCAN_TOKEN = (a: string) => `https://etherscan.io/token/${a}`;
export const ETHERSCAN_VERIFY = (a: string) =>
  `https://etherscan.io/verifyContract?a=${a}`;
export const DEXSCREENER_URL = (a: string) => `https://dexscreener.com/ethereum/${a}`;
export const UNISWAP_ADD_URL = (a: string) =>
  `https://app.uniswap.org/positions/create/v2?currencyA=NATIVE&currencyB=${a}`;
