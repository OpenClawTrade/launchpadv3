// Constants & ABIs used by the /launchnow control center.
// Mainnet only.

import { type Address } from "viem";

export const UNISWAP_V2_FACTORY: Address = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
export const UNISWAP_V2_ROUTER: Address = "0x7a250d5630B4cF539739dF2C5dacb4c659F2488D";
export const WETH: Address = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
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
] as const;

export const ETHERSCAN_TX = (h: string) => `https://etherscan.io/tx/${h}`;
export const ETHERSCAN_ADDR = (a: string) => `https://etherscan.io/address/${a}`;
export const ETHERSCAN_TOKEN = (a: string) => `https://etherscan.io/token/${a}`;
export const ETHERSCAN_VERIFY = (a: string) =>
  `https://etherscan.io/verifyContract?a=${a}`;
export const DEXSCREENER_URL = (a: string) => `https://dexscreener.com/ethereum/${a}`;
export const UNISWAP_ADD_URL = (a: string) =>
  `https://app.uniswap.org/positions/create/v2?currencyA=NATIVE&currencyB=${a}`;
