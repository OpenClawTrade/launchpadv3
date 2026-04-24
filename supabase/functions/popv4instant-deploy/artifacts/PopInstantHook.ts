// Auto-generated from forge build of contracts/popshiba/v4-instant/PopInstantHook.sol
// Inlined as a TS module so Deno's edge bundler picks it up.
const artifact = {
  "abi": [
    {
      "type": "constructor",
      "inputs": [
        {
          "name": "_pm",
          "type": "address",
          "internalType": "contract IPoolManager"
        },
        {
          "name": "_factory",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "_treasury",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "receive",
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "FACTORY",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "TREASURY",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "afterAddLiquidity",
      "inputs": [
        {
          "name": "sender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "key",
          "type": "tuple",
          "internalType": "struct PoolKey",
          "components": [
            {
              "name": "currency0",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "currency1",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "fee",
              "type": "uint24",
              "internalType": "uint24"
            },
            {
              "name": "tickSpacing",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "hooks",
              "type": "address",
              "internalType": "contract IHooks"
            }
          ]
        },
        {
          "name": "params",
          "type": "tuple",
          "internalType": "struct ModifyLiquidityParams",
          "components": [
            {
              "name": "tickLower",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "tickUpper",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "liquidityDelta",
              "type": "int256",
              "internalType": "int256"
            },
            {
              "name": "salt",
              "type": "bytes32",
              "internalType": "bytes32"
            }
          ]
        },
        {
          "name": "delta0",
          "type": "int256",
          "internalType": "BalanceDelta"
        },
        {
          "name": "delta1",
          "type": "int256",
          "internalType": "BalanceDelta"
        },
        {
          "name": "hookData",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        },
        {
          "name": "",
          "type": "int256",
          "internalType": "BalanceDelta"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "afterDonate",
      "inputs": [
        {
          "name": "sender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "key",
          "type": "tuple",
          "internalType": "struct PoolKey",
          "components": [
            {
              "name": "currency0",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "currency1",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "fee",
              "type": "uint24",
              "internalType": "uint24"
            },
            {
              "name": "tickSpacing",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "hooks",
              "type": "address",
              "internalType": "contract IHooks"
            }
          ]
        },
        {
          "name": "amount0",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "amount1",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "hookData",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "afterInitialize",
      "inputs": [
        {
          "name": "sender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "key",
          "type": "tuple",
          "internalType": "struct PoolKey",
          "components": [
            {
              "name": "currency0",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "currency1",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "fee",
              "type": "uint24",
              "internalType": "uint24"
            },
            {
              "name": "tickSpacing",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "hooks",
              "type": "address",
              "internalType": "contract IHooks"
            }
          ]
        },
        {
          "name": "sqrtPriceX96",
          "type": "uint160",
          "internalType": "uint160"
        },
        {
          "name": "tick",
          "type": "int24",
          "internalType": "int24"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "afterRemoveLiquidity",
      "inputs": [
        {
          "name": "sender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "key",
          "type": "tuple",
          "internalType": "struct PoolKey",
          "components": [
            {
              "name": "currency0",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "currency1",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "fee",
              "type": "uint24",
              "internalType": "uint24"
            },
            {
              "name": "tickSpacing",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "hooks",
              "type": "address",
              "internalType": "contract IHooks"
            }
          ]
        },
        {
          "name": "params",
          "type": "tuple",
          "internalType": "struct ModifyLiquidityParams",
          "components": [
            {
              "name": "tickLower",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "tickUpper",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "liquidityDelta",
              "type": "int256",
              "internalType": "int256"
            },
            {
              "name": "salt",
              "type": "bytes32",
              "internalType": "bytes32"
            }
          ]
        },
        {
          "name": "delta0",
          "type": "int256",
          "internalType": "BalanceDelta"
        },
        {
          "name": "delta1",
          "type": "int256",
          "internalType": "BalanceDelta"
        },
        {
          "name": "hookData",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        },
        {
          "name": "",
          "type": "int256",
          "internalType": "BalanceDelta"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "afterSwap",
      "inputs": [
        {
          "name": "sender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "key",
          "type": "tuple",
          "internalType": "struct PoolKey",
          "components": [
            {
              "name": "currency0",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "currency1",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "fee",
              "type": "uint24",
              "internalType": "uint24"
            },
            {
              "name": "tickSpacing",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "hooks",
              "type": "address",
              "internalType": "contract IHooks"
            }
          ]
        },
        {
          "name": "params",
          "type": "tuple",
          "internalType": "struct SwapParams",
          "components": [
            {
              "name": "zeroForOne",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "amountSpecified",
              "type": "int256",
              "internalType": "int256"
            },
            {
              "name": "sqrtPriceLimitX96",
              "type": "uint160",
              "internalType": "uint160"
            }
          ]
        },
        {
          "name": "delta",
          "type": "int256",
          "internalType": "BalanceDelta"
        },
        {
          "name": "hookData",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        },
        {
          "name": "",
          "type": "int128",
          "internalType": "int128"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "beforeAddLiquidity",
      "inputs": [
        {
          "name": "sender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "key",
          "type": "tuple",
          "internalType": "struct PoolKey",
          "components": [
            {
              "name": "currency0",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "currency1",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "fee",
              "type": "uint24",
              "internalType": "uint24"
            },
            {
              "name": "tickSpacing",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "hooks",
              "type": "address",
              "internalType": "contract IHooks"
            }
          ]
        },
        {
          "name": "params",
          "type": "tuple",
          "internalType": "struct ModifyLiquidityParams",
          "components": [
            {
              "name": "tickLower",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "tickUpper",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "liquidityDelta",
              "type": "int256",
              "internalType": "int256"
            },
            {
              "name": "salt",
              "type": "bytes32",
              "internalType": "bytes32"
            }
          ]
        },
        {
          "name": "hookData",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "beforeDonate",
      "inputs": [
        {
          "name": "sender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "key",
          "type": "tuple",
          "internalType": "struct PoolKey",
          "components": [
            {
              "name": "currency0",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "currency1",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "fee",
              "type": "uint24",
              "internalType": "uint24"
            },
            {
              "name": "tickSpacing",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "hooks",
              "type": "address",
              "internalType": "contract IHooks"
            }
          ]
        },
        {
          "name": "amount0",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "amount1",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "hookData",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "beforeInitialize",
      "inputs": [
        {
          "name": "sender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "key",
          "type": "tuple",
          "internalType": "struct PoolKey",
          "components": [
            {
              "name": "currency0",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "currency1",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "fee",
              "type": "uint24",
              "internalType": "uint24"
            },
            {
              "name": "tickSpacing",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "hooks",
              "type": "address",
              "internalType": "contract IHooks"
            }
          ]
        },
        {
          "name": "sqrtPriceX96",
          "type": "uint160",
          "internalType": "uint160"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "beforeRemoveLiquidity",
      "inputs": [
        {
          "name": "sender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "key",
          "type": "tuple",
          "internalType": "struct PoolKey",
          "components": [
            {
              "name": "currency0",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "currency1",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "fee",
              "type": "uint24",
              "internalType": "uint24"
            },
            {
              "name": "tickSpacing",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "hooks",
              "type": "address",
              "internalType": "contract IHooks"
            }
          ]
        },
        {
          "name": "params",
          "type": "tuple",
          "internalType": "struct ModifyLiquidityParams",
          "components": [
            {
              "name": "tickLower",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "tickUpper",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "liquidityDelta",
              "type": "int256",
              "internalType": "int256"
            },
            {
              "name": "salt",
              "type": "bytes32",
              "internalType": "bytes32"
            }
          ]
        },
        {
          "name": "hookData",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "beforeSwap",
      "inputs": [
        {
          "name": "sender",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "key",
          "type": "tuple",
          "internalType": "struct PoolKey",
          "components": [
            {
              "name": "currency0",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "currency1",
              "type": "address",
              "internalType": "Currency"
            },
            {
              "name": "fee",
              "type": "uint24",
              "internalType": "uint24"
            },
            {
              "name": "tickSpacing",
              "type": "int24",
              "internalType": "int24"
            },
            {
              "name": "hooks",
              "type": "address",
              "internalType": "contract IHooks"
            }
          ]
        },
        {
          "name": "params",
          "type": "tuple",
          "internalType": "struct SwapParams",
          "components": [
            {
              "name": "zeroForOne",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "amountSpecified",
              "type": "int256",
              "internalType": "int256"
            },
            {
              "name": "sqrtPriceLimitX96",
              "type": "uint160",
              "internalType": "uint160"
            }
          ]
        },
        {
          "name": "hookData",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes4",
          "internalType": "bytes4"
        },
        {
          "name": "",
          "type": "int256",
          "internalType": "BeforeSwapDelta"
        },
        {
          "name": "",
          "type": "uint24",
          "internalType": "uint24"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "claimCreator",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "claimTreasury",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "creatorByToken",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "creatorEthOwed",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "creatorOf",
      "inputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "PoolId"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "creatorTokenOwed",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getHookPermissions",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct Hooks.Permissions",
          "components": [
            {
              "name": "beforeInitialize",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterInitialize",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "beforeAddLiquidity",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterAddLiquidity",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "beforeRemoveLiquidity",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterRemoveLiquidity",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "beforeSwap",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterSwap",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "beforeDonate",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterDonate",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "beforeSwapReturnDelta",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterSwapReturnDelta",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterAddLiquidityReturnDelta",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "afterRemoveLiquidityReturnDelta",
              "type": "bool",
              "internalType": "bool"
            }
          ]
        }
      ],
      "stateMutability": "pure"
    },
    {
      "type": "function",
      "name": "lifetimeCreatorEth",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "lifetimeTreasuryEth",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "poolManager",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IPoolManager"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "registerPool",
      "inputs": [
        {
          "name": "poolId",
          "type": "bytes32",
          "internalType": "PoolId"
        },
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "creator",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setCreatorByToken",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "creator",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "tokenOf",
      "inputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "PoolId"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "treasuryEthOwed",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "treasuryTokenOwed",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "event",
      "name": "CreatorClaimed",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "creator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "ethAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tokenAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "FeeAccrued",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "feeInEth",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        },
        {
          "name": "totalFee",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "creatorShare",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "treasuryShare",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "PoolRegistered",
      "inputs": [
        {
          "name": "poolId",
          "type": "bytes32",
          "indexed": true,
          "internalType": "PoolId"
        },
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "creator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "TreasuryClaimed",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "treasury",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "ethAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tokenAmount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "HookNotImplemented",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotFactory",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotInitialized",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotPoolManager",
      "inputs": []
    }
  ],
  "bytecode": "0x60e0604052346102ef57604051601f61175c38819003918201601f19168301916001600160401b038311848410176102f3578084926060946040528339810103126102ef578051906001600160a01b03821682036102ef5761006f604061006860208401610327565b9201610327565b916080525f6101a061007f610307565b8281528260208201528260408201528260608201528260808201528260a08201528260c08201528260e0820152826101008201528261012082015282610140820152826101608201528261018082015201525f6101a06100dd610307565b828152600160208201528260408201528260608201528260808201528260a0820152600160c0820152600160e082015282610100820152826101208201528261014082015260016101608201528261018082015201526120003016158015906102de575b80156102d1575b80156102c4575b80156102b7575b80156102aa575b801561029a575b801561028a575b801561027e575b8015610272575b8015610266575b8015610256575b801561024a575b801561023e575b61022b5760a05260c052604051611420908161033c823960805181818161029a0152818161031c0152818161036e01528181610711015281816107b20152818161093201528181610a0201528181610cd90152818161118201526112ca015260a0518181816101aa015281816108620152610c53015260c051818181610b7c01528181610bbc01528181610c100152610c970152f35b630732d7b560e51b5f523060045260245ffd5b50600130161515610195565b5060023016151561018e565b5060043016151560011415610187565b50600830161515610180565b50601030161515610179565b50602030161515610172565b506040301615156001141561016b565b5060803016151560011415610164565b506101003016151561015d565b5061020030161515610156565b506104003016151561014f565b5061080030161515610148565b506110003016151560011415610141565b5f80fd5b634e487b7160e01b5f52604160045260245ffd5b604051906101c082016001600160401b038111838210176102f357604052565b51906001600160a01b03821682036102ef5756fe608080604052600436101561001c575b50361561001a575f80fd5b005b5f3560e01c908163025bfb4314610d1a5750806321d0ee7014610cc6578063259982e514610cc65780632d2c556514610c825780632dd3100014610c3e57806346f61ca814610af0578063575e24b4146109aa57806362470028146109725780636c2bbe7e1461079f5780636fe7e6eb146108f757806372383d291461082d57806396600bfd146107f55780639f063efc1461079f578063a8509c9414610767578063b47b2fb1146106b9578063b6a8b0fa14610287578063bab3a15114610681578063bae667bc1461064f578063c4e833ce146104e7578063d65c7f301461039d578063dc4c90d314610359578063dc98354e146102eb578063e1b4af6914610287578063e49c64ba1461024f578063e5950b9214610217578063efe7f4be146101865763ff94e4f314610151575f61000f565b34610182576020366003190112610182576004355f525f602052602060018060a01b0360405f205416604051908152f35b5f80fd5b346101825760403660031901126101825761019f610d59565b6101a7610d6f565b907f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03163303610208576001600160a01b039081165f90815260086020526040902080546001600160a01b03191692909116919091179055005b631966391b60e11b5f5260045ffd5b34610182576020366003190112610182576001600160a01b03610238610d59565b165f526002602052602060405f2054604051908152f35b34610182576020366003190112610182576001600160a01b03610270610d59565b165f526006602052602060405f2054604051908152f35b346101825761029536610ea7565b5050507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316330392506102dc91505057630a85dc2960e01b5f5260045ffd5b63570c108560e11b5f5260045ffd5b346101825760e036600319011261018257610304610d59565b5060a036602319011261018257610319610e81565b507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031633036102dc57630a85dc2960e01b5f5260045ffd5b34610182575f366003190112610182576040517f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168152602090f35b34610182576020366003190112610182576103b6610d59565b6001600160a01b038181165f8181526008602052604090205490911633036104b4575f81815260026020908152604080832080546004909352908320805491849055929092559283610496575b8161043d575b5060405192835260208301527f12df0dd0c40fd8b2d7a8bfe76f895569f17b2b6e7cce2a5c5d2efc8f08031fdd60403393a3005b60405163a9059cbb60e01b6020820190815233602483015260448201849052610490925f92839290839061047e81606481015b03601f198101835282610f4c565b51925af161048a610f6e565b50610fe4565b83610409565b6104af5f80808088335af16104a9610f6e565b50610fad565b610403565b60405162461bcd60e51b815260206004820152600b60248201526a3737ba1031b932b0ba37b960a91b6044820152606490fd5b34610182575f366003190112610182575f6101a060405161050781610eff565b8281528260208201528260408201528260608201528260808201528260a08201528260c08201528260e0820152826101008201528261012082015282610140820152826101608201528261018082015201526101c0602060405161056a81610eff565b5f81528181019060018252604081015f8152606082015f8152608083015f815260a084015f815260c085016001815260e0860190600182526101008701925f84526101208801945f86526101408901965f88526101608a019860018a526101a06101808c019b5f8d52019b5f8d526040519d8e915f835251151591015251151560408d015251151560608c015251151560808b015251151560a08a015251151560c089015251151560e08801525115156101008701525115156101208601525115156101408501525115156101608401525115156101808301525115156101a0820152f35b34610182576020366003190112610182576004355f526001602052602060018060a01b0360405f205416604051908152f35b34610182576020366003190112610182576001600160a01b036106a2610d59565b165f526003602052602060405f2054604051908152f35b3461018257610160366003190112610182576106d3610d59565b5060a03660231901126101825760603660c3190112610182576101443567ffffffffffffffff81116101825761070d903690600401610d85565b50507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031633036102dc57604061074d6101243561103c565b82516001600160e01b03199092168252600f0b6020820152f35b34610182576020366003190112610182576001600160a01b03610788610d59565b165f526007602052602060405f2054604051908152f35b34610182576107ad36610e17565b5050507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316330393506102dc9250505057630a85dc2960e01b5f5260045ffd5b34610182576020366003190112610182576001600160a01b03610816610d59565b165f526005602052602060405f2054604051908152f35b3461018257606036600319011261018257600435610849610d6f565b6044356001600160a01b038116929190839003610182577f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03163303610208575f8281526020818152604080832080546001600160a01b031990811688179091556001909252822080549091166001600160a01b039390931692831790559091907ffafdbdd88ac30f0aa936e576be61816ea751908540523fa81b80c4a406ad7bec9080a4005b346101825761010036600319011261018257610911610d59565b5060a036602319011261018257610926610e81565b5061092f610e97565b507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031633036102dc57604051636fe7e6eb60e01b8152602090f35b34610182576020366003190112610182576001600160a01b03610993610d59565b165f526004602052602060405f2054604051908152f35b3461018257610140366003190112610182576109c4610d59565b5060a03660231901126101825760603660c3190112610182576101243567ffffffffffffffff8111610182576109fe903690600401610d85565b50507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031633036102dc57604051610a3c81610f30565b6024356001600160a01b03811681036101825781526044356001600160a01b038116810361018257602082015260643562ffffff811681036101825760408201526084358060020b810361018257606082015260a435906001600160a01b03821682036101825760a0916080820152205f525f60205260018060a01b0360405f20541615610ae15760606040516315d7892d60e21b81525f60208201525f6040820152f35b6321c4e35760e21b5f5260045ffd5b3461018257602036600319011261018257610b09610d59565b6001600160a01b0381165f81815260036020908152604080832080546005909352908320805491849055929092559283610c06575b81610ba0575b5060405192835260208301527ff95cf8ae943ed4142be3104f64b6b65b0e35b1fac0ee6a0b79e97fcb4b183203604060018060a01b037f00000000000000000000000000000000000000000000000000000000000000001693a3005b60405163a9059cbb60e01b602082019081526001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016602483015260448201849052610c00925f92839290839061047e8160648101610470565b83610b44565b610c395f808080887f00000000000000000000000000000000000000000000000000000000000000005af16104a9610f6e565b610b3e565b34610182575f366003190112610182576040517f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168152602090f35b34610182575f366003190112610182576040517f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168152602090f35b3461018257610cd436610db3565b5050507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316330391506102dc905057630a85dc2960e01b5f5260045ffd5b34610182576020366003190112610182576020906001600160a01b03610d3e610d59565b165f9081526008835260409020546001600160a01b03168152f35b600435906001600160a01b038216820361018257565b602435906001600160a01b038216820361018257565b9181601f840112156101825782359167ffffffffffffffff8311610182576020838186019501011161018257565b90610160600319830112610182576004356001600160a01b0381168103610182579160a060231982011261018257602491608060c3198301126101825760c491610144359067ffffffffffffffff821161018257610e1391600401610d85565b9091565b906101a0600319830112610182576004356001600160a01b0381168103610182579160a060231982011261018257602491608060c3198301126101825760c49161014435916101643591610184359067ffffffffffffffff821161018257610e1391600401610d85565b60c435906001600160a01b038216820361018257565b60e435908160020b820361018257565b610120600319820112610182576004356001600160a01b0381168103610182579160a06023198301126101825760249160c4359160e43591610104359067ffffffffffffffff821161018257610e1391600401610d85565b6101c0810190811067ffffffffffffffff821117610f1c57604052565b634e487b7160e01b5f52604160045260245ffd5b60a0810190811067ffffffffffffffff821117610f1c57604052565b90601f8019910116810190811067ffffffffffffffff821117610f1c57604052565b3d15610fa8573d9067ffffffffffffffff8211610f1c5760405191610f9d601f8201601f191660200184610f4c565b82523d5f602084013e565b606090565b15610fb457565b60405162461bcd60e51b8152602060048201526008602482015267195d1a081cd95b9960c21b6044820152606490fd5b15610feb57565b60405162461bcd60e51b81526020600482015260086024820152671d1bdac81cd95b9960c21b6044820152606490fd5b9190820180921161102857565b634e487b7160e01b5f52601160045260245ffd5b9060a0366023190112610182576040519161105683610f30565b6024356001600160a01b0381168103610182578084526044356001600160a01b038116810361018257602085015260643562ffffff811681036101825760408501526084358060020b810361018257606085015260a4356001600160a01b038116810361018257608085015260a05f94205f52600160205260018060a01b0360405f2054169182156113ac5760c43591821580158403610182576001600160a01b0382169182900361018257839115826113e2575b84156113c6575b5050156113be5760801d5b600f0b5f8112156113ac576f7fffffffffffffffffffffffffffffff198114611028576001600160801b03905f0316607d810290808204607d14901517156110285761271090049384156113ac578460011c808603918683116110285783156112c7577f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316803b156112c357818091606460405180948193630b0d9c0960e01b83528160048401523060248401528d60448401525af180156112b8576112a0575b50917f3c89164a6c3632aaef9b6a0585915c7bf250bd57bdbbfa3e5e2b921c89280b7d93916040848760809652600260205281812061122684825461101b565b9055878152600360205281812061123e85825461101b565b9055878152600660205281812061125684825461101b565b905587815260076020522061126c83825461101b565b90555b604051921515835287602084015260408301526060820152a263b47b2fb160e01b916001600160801b0316600f0b90565b6112ab828092610f4c565b6112b5575f6111e6565b80fd5b6040513d84823e3d90fd5b5080fd5b927f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316929091833b15610182575f8094606460405180978193630b0d9c0960e01b83528b60048401523060248401528d60448401525af19384156113a1577f3c89164a6c3632aaef9b6a0585915c7bf250bd57bdbbfa3e5e2b921c89280b7d9560809561138e575b60409150878152600460205281812061137184825461101b565b905587815260056020522061138783825461101b565b905561126f565b505f61139991610f4c565b60405f611357565b6040513d5f823e3d90fd5b5063b47b2fb160e01b93505f92915050565b600f0b61111d565b91935090816113d9575b50915f80611112565b9050155f6113d0565b93508361110b56fea26469706673582212200944ef5b88691720d139973eca26fbecf00f7df5657dfa9ed10ea2f7977d597b64736f6c634300081a0033",
  "deployedBytecode": "0x608080604052600436101561001c575b50361561001a575f80fd5b005b5f3560e01c908163025bfb4314610d1a5750806321d0ee7014610cc6578063259982e514610cc65780632d2c556514610c825780632dd3100014610c3e57806346f61ca814610af0578063575e24b4146109aa57806362470028146109725780636c2bbe7e1461079f5780636fe7e6eb146108f757806372383d291461082d57806396600bfd146107f55780639f063efc1461079f578063a8509c9414610767578063b47b2fb1146106b9578063b6a8b0fa14610287578063bab3a15114610681578063bae667bc1461064f578063c4e833ce146104e7578063d65c7f301461039d578063dc4c90d314610359578063dc98354e146102eb578063e1b4af6914610287578063e49c64ba1461024f578063e5950b9214610217578063efe7f4be146101865763ff94e4f314610151575f61000f565b34610182576020366003190112610182576004355f525f602052602060018060a01b0360405f205416604051908152f35b5f80fd5b346101825760403660031901126101825761019f610d59565b6101a7610d6f565b907f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03163303610208576001600160a01b039081165f90815260086020526040902080546001600160a01b03191692909116919091179055005b631966391b60e11b5f5260045ffd5b34610182576020366003190112610182576001600160a01b03610238610d59565b165f526002602052602060405f2054604051908152f35b34610182576020366003190112610182576001600160a01b03610270610d59565b165f526006602052602060405f2054604051908152f35b346101825761029536610ea7565b5050507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316330392506102dc91505057630a85dc2960e01b5f5260045ffd5b63570c108560e11b5f5260045ffd5b346101825760e036600319011261018257610304610d59565b5060a036602319011261018257610319610e81565b507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031633036102dc57630a85dc2960e01b5f5260045ffd5b34610182575f366003190112610182576040517f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168152602090f35b34610182576020366003190112610182576103b6610d59565b6001600160a01b038181165f8181526008602052604090205490911633036104b4575f81815260026020908152604080832080546004909352908320805491849055929092559283610496575b8161043d575b5060405192835260208301527f12df0dd0c40fd8b2d7a8bfe76f895569f17b2b6e7cce2a5c5d2efc8f08031fdd60403393a3005b60405163a9059cbb60e01b6020820190815233602483015260448201849052610490925f92839290839061047e81606481015b03601f198101835282610f4c565b51925af161048a610f6e565b50610fe4565b83610409565b6104af5f80808088335af16104a9610f6e565b50610fad565b610403565b60405162461bcd60e51b815260206004820152600b60248201526a3737ba1031b932b0ba37b960a91b6044820152606490fd5b34610182575f366003190112610182575f6101a060405161050781610eff565b8281528260208201528260408201528260608201528260808201528260a08201528260c08201528260e0820152826101008201528261012082015282610140820152826101608201528261018082015201526101c0602060405161056a81610eff565b5f81528181019060018252604081015f8152606082015f8152608083015f815260a084015f815260c085016001815260e0860190600182526101008701925f84526101208801945f86526101408901965f88526101608a019860018a526101a06101808c019b5f8d52019b5f8d526040519d8e915f835251151591015251151560408d015251151560608c015251151560808b015251151560a08a015251151560c089015251151560e08801525115156101008701525115156101208601525115156101408501525115156101608401525115156101808301525115156101a0820152f35b34610182576020366003190112610182576004355f526001602052602060018060a01b0360405f205416604051908152f35b34610182576020366003190112610182576001600160a01b036106a2610d59565b165f526003602052602060405f2054604051908152f35b3461018257610160366003190112610182576106d3610d59565b5060a03660231901126101825760603660c3190112610182576101443567ffffffffffffffff81116101825761070d903690600401610d85565b50507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031633036102dc57604061074d6101243561103c565b82516001600160e01b03199092168252600f0b6020820152f35b34610182576020366003190112610182576001600160a01b03610788610d59565b165f526007602052602060405f2054604051908152f35b34610182576107ad36610e17565b5050507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316330393506102dc9250505057630a85dc2960e01b5f5260045ffd5b34610182576020366003190112610182576001600160a01b03610816610d59565b165f526005602052602060405f2054604051908152f35b3461018257606036600319011261018257600435610849610d6f565b6044356001600160a01b038116929190839003610182577f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03163303610208575f8281526020818152604080832080546001600160a01b031990811688179091556001909252822080549091166001600160a01b039390931692831790559091907ffafdbdd88ac30f0aa936e576be61816ea751908540523fa81b80c4a406ad7bec9080a4005b346101825761010036600319011261018257610911610d59565b5060a036602319011261018257610926610e81565b5061092f610e97565b507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031633036102dc57604051636fe7e6eb60e01b8152602090f35b34610182576020366003190112610182576001600160a01b03610993610d59565b165f526004602052602060405f2054604051908152f35b3461018257610140366003190112610182576109c4610d59565b5060a03660231901126101825760603660c3190112610182576101243567ffffffffffffffff8111610182576109fe903690600401610d85565b50507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031633036102dc57604051610a3c81610f30565b6024356001600160a01b03811681036101825781526044356001600160a01b038116810361018257602082015260643562ffffff811681036101825760408201526084358060020b810361018257606082015260a435906001600160a01b03821682036101825760a0916080820152205f525f60205260018060a01b0360405f20541615610ae15760606040516315d7892d60e21b81525f60208201525f6040820152f35b6321c4e35760e21b5f5260045ffd5b3461018257602036600319011261018257610b09610d59565b6001600160a01b0381165f81815260036020908152604080832080546005909352908320805491849055929092559283610c06575b81610ba0575b5060405192835260208301527ff95cf8ae943ed4142be3104f64b6b65b0e35b1fac0ee6a0b79e97fcb4b183203604060018060a01b037f00000000000000000000000000000000000000000000000000000000000000001693a3005b60405163a9059cbb60e01b602082019081526001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016602483015260448201849052610c00925f92839290839061047e8160648101610470565b83610b44565b610c395f808080887f00000000000000000000000000000000000000000000000000000000000000005af16104a9610f6e565b610b3e565b34610182575f366003190112610182576040517f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168152602090f35b34610182575f366003190112610182576040517f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03168152602090f35b3461018257610cd436610db3565b5050507f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316330391506102dc905057630a85dc2960e01b5f5260045ffd5b34610182576020366003190112610182576020906001600160a01b03610d3e610d59565b165f9081526008835260409020546001600160a01b03168152f35b600435906001600160a01b038216820361018257565b602435906001600160a01b038216820361018257565b9181601f840112156101825782359167ffffffffffffffff8311610182576020838186019501011161018257565b90610160600319830112610182576004356001600160a01b0381168103610182579160a060231982011261018257602491608060c3198301126101825760c491610144359067ffffffffffffffff821161018257610e1391600401610d85565b9091565b906101a0600319830112610182576004356001600160a01b0381168103610182579160a060231982011261018257602491608060c3198301126101825760c49161014435916101643591610184359067ffffffffffffffff821161018257610e1391600401610d85565b60c435906001600160a01b038216820361018257565b60e435908160020b820361018257565b610120600319820112610182576004356001600160a01b0381168103610182579160a06023198301126101825760249160c4359160e43591610104359067ffffffffffffffff821161018257610e1391600401610d85565b6101c0810190811067ffffffffffffffff821117610f1c57604052565b634e487b7160e01b5f52604160045260245ffd5b60a0810190811067ffffffffffffffff821117610f1c57604052565b90601f8019910116810190811067ffffffffffffffff821117610f1c57604052565b3d15610fa8573d9067ffffffffffffffff8211610f1c5760405191610f9d601f8201601f191660200184610f4c565b82523d5f602084013e565b606090565b15610fb457565b60405162461bcd60e51b8152602060048201526008602482015267195d1a081cd95b9960c21b6044820152606490fd5b15610feb57565b60405162461bcd60e51b81526020600482015260086024820152671d1bdac81cd95b9960c21b6044820152606490fd5b9190820180921161102857565b634e487b7160e01b5f52601160045260245ffd5b9060a0366023190112610182576040519161105683610f30565b6024356001600160a01b0381168103610182578084526044356001600160a01b038116810361018257602085015260643562ffffff811681036101825760408501526084358060020b810361018257606085015260a4356001600160a01b038116810361018257608085015260a05f94205f52600160205260018060a01b0360405f2054169182156113ac5760c43591821580158403610182576001600160a01b0382169182900361018257839115826113e2575b84156113c6575b5050156113be5760801d5b600f0b5f8112156113ac576f7fffffffffffffffffffffffffffffff198114611028576001600160801b03905f0316607d810290808204607d14901517156110285761271090049384156113ac578460011c808603918683116110285783156112c7577f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316803b156112c357818091606460405180948193630b0d9c0960e01b83528160048401523060248401528d60448401525af180156112b8576112a0575b50917f3c89164a6c3632aaef9b6a0585915c7bf250bd57bdbbfa3e5e2b921c89280b7d93916040848760809652600260205281812061122684825461101b565b9055878152600360205281812061123e85825461101b565b9055878152600660205281812061125684825461101b565b905587815260076020522061126c83825461101b565b90555b604051921515835287602084015260408301526060820152a263b47b2fb160e01b916001600160801b0316600f0b90565b6112ab828092610f4c565b6112b5575f6111e6565b80fd5b6040513d84823e3d90fd5b5080fd5b927f00000000000000000000000000000000000000000000000000000000000000006001600160a01b0316929091833b15610182575f8094606460405180978193630b0d9c0960e01b83528b60048401523060248401528d60448401525af19384156113a1577f3c89164a6c3632aaef9b6a0585915c7bf250bd57bdbbfa3e5e2b921c89280b7d9560809561138e575b60409150878152600460205281812061137184825461101b565b905587815260056020522061138783825461101b565b905561126f565b505f61139991610f4c565b60405f611357565b6040513d5f823e3d90fd5b5063b47b2fb160e01b93505f92915050565b600f0b61111d565b91935090816113d9575b50915f80611112565b9050155f6113d0565b93508361110b56fea26469706673582212200944ef5b88691720d139973eca26fbecf00f7df5657dfa9ed10ea2f7977d597b64736f6c634300081a0033"
}
 as const;
export default artifact;
