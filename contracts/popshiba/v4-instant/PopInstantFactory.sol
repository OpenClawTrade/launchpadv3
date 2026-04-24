// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PopInstantToken} from "./PopInstantToken.sol";

interface IInstantHook {
    function registerPool(PoolId poolId, address token, address creator) external;
    function setCreatorByToken(address token, address creator) external;
}

/// @title PopInstantFactory
/// @notice Atomic instant-LP launch on Uniswap V4:
///   1. Deploy PopInstantToken (1B supply minted to factory).
///   2. Compute PoolKey with currency0=ETH, currency1=token.
///   3. Initialize the pool at the chosen `sqrtPriceX96`.
///   4. Unlock the PoolManager:
///      - Mint single-sided LP (token-only, ~96% supply) at out-of-range
///        ticks above the spot tick (tickSpacing=200, fee=0).
///      - Execute the dev's initial buy (>= 0.001 ETH) as an exact-input
///        swap, sending the bought tokens to the creator.
///   5. Register the pool with the singleton hook.
///
/// All in one transaction. No bonding curve, no graduation step.
contract PopInstantFactory {
    using PoolIdLibrary for PoolKey;

    IPoolManager public immutable poolManager;
    address      public immutable hook;
    address      public immutable treasury;

    int24  public constant TICK_SPACING = 200;
    uint24 public constant POOL_FEE     = 0;          // hook handles fees
    uint256 public constant LP_TOKENS   = 961_700_000e18;   // ~96.17% to LP
    uint256 public constant DEV_RESERVE =  38_300_000e18;   // ~3.83% kept for dev buy
    uint256 public constant MIN_INITIAL_BUY = 0.001 ether;

    event Launched(
        address indexed token,
        address indexed creator,
        PoolId  poolId,
        uint256 initialBuyEth,
        uint256 tokensToCreator,
        uint160 sqrtPriceX96
    );

    error InsufficientInitialBuy();
    error UnlockOnly();

    constructor(IPoolManager _pm, address _hook, address _treasury) {
        poolManager = _pm;
        hook = _hook;
        treasury = _treasury;
    }

    struct LaunchParams {
        string  name;
        string  symbol;
        uint160 sqrtPriceX96;   // initial price (token per ETH)
        int24   tickLower;      // out-of-range LP lower (above current tick)
        int24   tickUpper;      // out-of-range LP upper
    }

    function launch(LaunchParams calldata p) external payable returns (address tokenAddr, PoolId poolId) {
        if (msg.value < MIN_INITIAL_BUY) revert InsufficientInitialBuy();

        // 1. Deploy token, full supply to factory.
        tokenAddr = address(new PopInstantToken(p.name, p.symbol, address(this)));

        // 2. PoolKey: native ETH (0x0) is currency0 by lower-address rule.
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(tokenAddr),
            fee: POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(hook)
        });
        poolId = key.toId();

        // 3. Init pool at chosen sqrtPriceX96.
        poolManager.initialize(key, p.sqrtPriceX96);

        // 4. Register with hook BEFORE unlock so hook permits the deposit.
        IInstantHook(hook).registerPool(poolId, tokenAddr, msg.sender);
        IInstantHook(hook).setCreatorByToken(tokenAddr, msg.sender);

        // 5. Unlock PoolManager → seed LP + execute dev buy atomically.
        bytes memory data = abi.encode(key, p.tickLower, p.tickUpper, msg.sender, msg.value);
        poolManager.unlock(data);

        emit Launched(tokenAddr, msg.sender, poolId, msg.value, DEV_RESERVE, p.sqrtPriceX96);
    }

    struct UnlockCtx {
        PoolKey key;
        int24   tickLower;
        int24   tickUpper;
        address creator;
        uint256 ethBuy;
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert UnlockOnly();
        UnlockCtx memory c;
        (c.key, c.tickLower, c.tickUpper, c.creator, c.ethBuy) =
            abi.decode(raw, (PoolKey, int24, int24, address, uint256));
        address tokenAddr = Currency.unwrap(c.key.currency1);

        _seedSingleSidedLp(c, tokenAddr);
        _executeDevBuy(c, tokenAddr);
        return "";
    }

    function _seedSingleSidedLp(UnlockCtx memory c, address tokenAddr) internal {
        // Single-sided token deposit: the range is entirely *above* current
        // price, so only token (currency1) is required to mint the position.
        uint160 lo = TickMath.getSqrtPriceAtTick(c.tickLower);
        uint160 hi = TickMath.getSqrtPriceAtTick(c.tickUpper);
        // Use full LP_TOKENS as the amount1 input.
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount1(lo, hi, LP_TOKENS);

        (BalanceDelta delta, ) = poolManager.modifyLiquidity(
            c.key,
            ModifyLiquidityParams({
                tickLower: c.tickLower,
                tickUpper: c.tickUpper,
                liquidityDelta: int256(uint256(liquidity)),
                salt: bytes32(0)
            }),
            ""
        );
        // Settle the token leg owed to PM.
        int128 d1 = delta.amount1();
        if (d1 < 0) {
            uint256 owed = uint256(uint128(-d1));
            poolManager.sync(Currency.wrap(tokenAddr));
            // Token lives on this factory contract.
            (bool ok, ) = tokenAddr.call(
                abi.encodeWithSignature("transfer(address,uint256)", address(poolManager), owed)
            );
            require(ok, "lp tok xfer");
            poolManager.settle();
        }
        // amount0 (ETH) leg should be ~0 since range is fully above spot.
    }

    function _executeDevBuy(UnlockCtx memory c, address tokenAddr) internal {
        // Exact-input ETH → token swap. zeroForOne = true (ETH=cur0 → token=cur1).
        SwapParams memory sp = SwapParams({
            zeroForOne: true,
            amountSpecified: -int256(c.ethBuy), // negative = exact input
            sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
        });
        BalanceDelta swapDelta = poolManager.swap(c.key, sp, "");
        // Settle ETH owed.
        int128 d0 = swapDelta.amount0();
        if (d0 < 0) {
            uint256 owed = uint256(uint128(-d0));
            poolManager.settle{value: owed}();
        }
        // Take token output to the creator.
        int128 d1 = swapDelta.amount1();
        if (d1 > 0) {
            uint256 outAmt = uint256(uint128(d1));
            poolManager.take(Currency.wrap(tokenAddr), c.creator, outAmt);
        }
    }

    receive() external payable {}
}
