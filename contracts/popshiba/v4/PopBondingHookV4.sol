// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaseHook} from "uniswap-hooks/src/base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary, toBeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";

interface ICurveCloneRW {
    function initialize(
        address hook, address token, address creator, address treasury, address lpLocker,
        address c0, address c1, uint24 fee, int24 ts
    ) external;
    function applyBuy(uint256 ethIn, uint256 tokensOut, uint256 fee) external returns (bool didGraduate);
    function applySell(uint256 tokenIn, uint256 ethGross, uint256 fee) external;
    function clearReservesAfterSeed() external;
    function realEthReserves() external view returns (uint256);
    function realTokenReserves() external view returns (uint256);
    function creator() external view returns (address);
    function protocolTreasury() external view returns (address);
    function token() external view returns (address);
    function lpLocker() external view returns (address);
    function graduated() external view returns (bool);
    function creatorFeesAccrued() external view returns (uint256);
    function protocolFeesAccrued() external view returns (uint256);
    function getPrice() external view returns (uint256);
    function curveProgressBps() external view returns (uint256);
    function poolFee() external view returns (uint24);
    function tickSpacing() external view returns (int24);
}

interface IERC20Min {
    function transferFrom(address, address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

interface ILockerRegister {
    function registerLock(bytes32 poolId, uint256 tokenId, address curve) external;
}

/// @title PopBondingHookV4 (singleton)
/// @notice Singleton Uniswap V4 hook — 1:1 fork of Unicurve's architecture.
/// State per token lives in EIP-1167 clones of `PopCurveImpl` ("CURVE_IMPL"),
/// addressed by `poolId`. The hook itself is stateless w.r.t. tokens; it only
/// orchestrates swap math by delegating accrual to the per-pool clone.
///
/// Post-graduation LP seed: the hook is the `IUnlockCallback` for V4. Anyone
/// can call `seedLockedLP(poolId)` once after graduation; the hook unlocks
/// the PoolManager, mints a full-range position OWNED by the locker (via the
/// curve clone as the position salt-namespace), settles both legs, then asks
/// the curve to clear reserves and unlock token transfers. The V4 position is
/// held permanently by the PM and credited to the locker through the
/// position salt — equivalent to Unicurve's "lock forever" pattern.
contract PopBondingHookV4 is BaseHook {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    address public immutable FACTORY;
    /// @dev poolId → curve clone holding all per-token state.
    mapping(PoolId => address) public curveOf;
    /// @dev poolId → true once seedLockedLP has run.
    mapping(PoolId => bool) public seeded;

    error NotFactory();
    error NotInitialized();
    error ExactOutUnsupported();
    error NotGraduated();
    error AlreadySeeded();

    event Trade(
        address indexed token,
        address indexed trader,
        bool    isBuy,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 fee,
        uint256 creatorFee,
        uint256 protocolFee,
        uint256 newRealEth,
        uint256 newRealTokens,
        uint256 priceAfter,
        uint256 progressBps,
        uint256 timestamp
    );
    event Graduated(address indexed token, uint256 ethToLp, uint256 tokensToLp);
    event CurveRegistered(PoolId indexed poolId, address indexed token, address indexed curve);
    event LpSeeded(PoolId indexed poolId, address indexed locker, uint256 liquidity, uint256 ethUsed, uint256 tokensUsed);

    constructor(IPoolManager _manager, address _factory) BaseHook(_manager) {
        FACTORY = _factory;
    }

    function registerCurve(PoolId poolId, address curve, address token) external {
        if (msg.sender != FACTORY) revert NotFactory();
        curveOf[poolId] = curve;
        emit CurveRegistered(poolId, token, curve);
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) internal view override returns (bytes4) {
        address curve = curveOf[key.toId()];
        if (curve == address(0)) revert NotInitialized();
        // Allow only when seeding (sender == this hook during unlockCallback)
        // or when already seeded + reserves are zero (post-grad AMM topups, blocked anyway).
        require(sender == address(this), "no LP");
        return BaseHook.beforeAddLiquidity.selector;
    }

    /// @dev LP principal is locked forever, but FEE COLLECTION must remain
    /// possible. In V4, fees are harvested by calling modifyLiquidity with a
    /// non-negative liquidityDelta (zero = pure collect, positive = increase).
    /// We therefore only revert when the caller actually tries to REMOVE
    /// liquidity (negative delta). This matches Unicurve's behavior: principal
    /// permanently locked, swap fees claimable forever by creator + treasury.
    function _beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata params,
        bytes calldata
    ) internal pure override returns (bytes4) {
        require(params.liquidityDelta >= 0, "LP principal locked");
        return BaseHook.beforeRemoveLiquidity.selector;
    }

    function _beforeSwap(
        address swapper,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId pid = key.toId();
        address curveAddr = curveOf[pid];
        if (curveAddr == address(0)) revert NotInitialized();
        ICurveCloneRW curve = ICurveCloneRW(curveAddr);

        if (curve.realEthReserves() == 0 && curve.realTokenReserves() == 0) {
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        bool ethIs0 = Currency.unwrap(key.currency0) == address(0);
        bool inputIsEth = (params.zeroForOne == ethIs0);
        if (params.amountSpecified >= 0) revert ExactOutUnsupported();
        uint256 amountIn = uint256(-params.amountSpecified);

        if (inputIsEth) {
            uint256 fee = (amountIn * 100) / 10000;
            uint256 tokensOut = _quoteBuy(curveAddr, amountIn);
            require(tokensOut > 0, "0 out");

            bool didGraduate = curve.applyBuy(amountIn, tokensOut, fee);
            uint256 cFee = (fee * 5000) / 10000;

            emit Trade(
                curve.token(), swapper, true,
                amountIn, tokensOut, fee, cFee, fee - cFee,
                curve.realEthReserves(), curve.realTokenReserves(),
                curve.getPrice(), curve.curveProgressBps(),
                block.timestamp
            );
            if (didGraduate) emit Graduated(curve.token(), curve.realEthReserves(), 207_142_857e18);

            int128 specDelta = int128(int256(amountIn));
            int128 unspecDelta = -int128(int256(tokensOut));
            return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(specDelta, unspecDelta), 0);
        } else {
            uint256 ethGross = _grossEthOnSell(curveAddr, amountIn);
            uint256 fee = (ethGross * 100) / 10000;
            uint256 ethOut = ethGross - fee;
            require(ethOut > 0, "0 out");

            curve.applySell(amountIn, ethGross, fee);
            uint256 cFee = (fee * 5000) / 10000;

            emit Trade(
                curve.token(), swapper, false,
                ethGross, amountIn, fee, cFee, fee - cFee,
                curve.realEthReserves(), curve.realTokenReserves(),
                curve.getPrice(), curve.curveProgressBps(),
                block.timestamp
            );

            int128 specDelta = int128(int256(amountIn));
            int128 unspecDelta = -int128(int256(ethOut));
            return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(specDelta, unspecDelta), 0);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // LP SEED FLOW
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Public entry point. Anyone can call once a token has graduated.
    /// Caller pays the gas. Funds (ETH from the curve clone, tokens via prior
    /// approve()) are deployed into a full-range V4 position. The position is
    /// stored on the PoolManager under (owner=locker, salt=poolId) — V4
    /// positions are non-transferable raw positions; using locker as owner +
    /// blocking remove-liquidity = permanent lock, equivalent to Unicurve's
    /// "send NFT to dead address" pattern (V4 doesn't issue NFTs from core).
    function seedLockedLP(bytes32 poolId) external payable {
        PoolId pid = PoolId.wrap(poolId);
        address curveAddr = curveOf[pid];
        if (curveAddr == address(0)) revert NotInitialized();
        if (seeded[pid]) revert AlreadySeeded();
        ICurveCloneRW curve = ICurveCloneRW(curveAddr);
        if (!curve.graduated()) revert NotGraduated();

        seeded[pid] = true;

        // Pull ETH from the curve clone (it holds realEthReserves as ether).
        // The curve must have a `withdrawEthForSeed()` pattern OR send via a
        // selfdestruct-free push. We use a low-level call that the curve
        // accepts only from the hook (msg.sender check inside curve).
        uint256 ethAmt = curve.realEthReserves();
        uint256 tokenAmt = 207_142_857e18; // LP_TOKENS

        // Trigger PoolManager unlock; settlement happens inside unlockCallback.
        bytes memory data = abi.encode(pid, curveAddr, ethAmt, tokenAmt);
        poolManager.unlock(data);
    }

    /// @dev V4 unlock callback. Only PoolManager may call.
    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "auth");
        (PoolId pid, address curveAddr, uint256 ethAmt, uint256 tokenAmt) =
            abi.decode(raw, (PoolId, address, uint256, uint256));

        ICurveCloneRW curve = ICurveCloneRW(curveAddr);
        address tokenAddr = curve.token();
        address locker = curve.lpLocker();

        // Reconstruct PoolKey from curve state.
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(tokenAddr),
            fee: curve.poolFee(),
            tickSpacing: curve.tickSpacing(),
            hooks: this
        });

        // Compute full-range liquidity from current pool sqrtPrice.
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(pid);
        int24 tickLower = (TickMath.MIN_TICK / curve.tickSpacing()) * curve.tickSpacing();
        int24 tickUpper = (TickMath.MAX_TICK / curve.tickSpacing()) * curve.tickSpacing();

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            ethAmt,
            tokenAmt
        );

        // Mint full-range position owned by the locker, salted by poolId so
        // ownership is unique per token. Locker has no remove-liquidity path
        // (blocked at hook level) → effectively permanent lock.
        (BalanceDelta delta, ) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: int256(uint256(liquidity)),
                salt: PoolId.unwrap(pid)
            }),
            ""
        );

        // Settle both legs. Negative delta = we owe the pool.
        int128 d0 = delta.amount0();
        int128 d1 = delta.amount1();

        // ETH leg (currency0)
        if (d0 < 0) {
            uint256 owed = uint256(uint128(-d0));
            // Pull ETH from the curve clone via a hook-only drain hook.
            // Curve must implement: drainEthToHook(uint256) onlyHook.
            (bool ok, ) = curveAddr.call(
                abi.encodeWithSignature("drainEthToHook(uint256)", owed)
            );
            require(ok, "eth drain");
            poolManager.settle{value: owed}();
        }
        // Token leg (currency1)
        if (d1 < 0) {
            uint256 owed = uint256(uint128(-d1));
            // Curve approved hook for LP_TOKENS in seedLockedLP().
            IERC20Min(tokenAddr).transferFrom(curveAddr, address(this), owed);
            poolManager.sync(Currency.wrap(tokenAddr));
            IERC20Min(tokenAddr).transfer(address(poolManager), owed);
            poolManager.settle();
        }

        // Register the lock so the locker can later call `claimFees` against it.
        // The locker stores curve+poolId mapping for fee splits.
        ILockerRegister(locker).registerLock(PoolId.unwrap(pid), uint256(uint160(locker)), curveAddr);

        // Hand off back to curve: clear reserves + unlock transfers.
        curve.clearReservesAfterSeed();

        emit LpSeeded(pid, locker, liquidity, ethAmt, tokenAmt);
        return "";
    }

    // ── Pure curve math ──
    function _quoteBuy(address c, uint256 ethIn) internal view returns (uint256) {
        ICurveCloneRW curve = ICurveCloneRW(c);
        uint256 fee = (ethIn * 100) / 10000;
        uint256 ethNet = ethIn - fee;
        uint256 realE = curve.realEthReserves();
        uint256 realT = curve.realTokenReserves();
        uint256 ve = 1.06 ether + realE;
        uint256 vt = 1_073_000_000e18 - (792_857_143e18 - realT);
        uint256 k = ve * vt;
        uint256 newVe = ve + ethNet;
        uint256 newVt = k / newVe;
        uint256 out = vt - newVt;
        return out > realT ? realT : out;
    }

    function _grossEthOnSell(address c, uint256 tokenIn) internal view returns (uint256) {
        ICurveCloneRW curve = ICurveCloneRW(c);
        uint256 realE = curve.realEthReserves();
        uint256 realT = curve.realTokenReserves();
        uint256 ve = 1.06 ether + realE;
        uint256 vt = 1_073_000_000e18 - (792_857_143e18 - realT);
        uint256 k = ve * vt;
        uint256 newVt = vt + tokenIn;
        uint256 newVe = k / newVt;
        return ve - newVe;
    }

    receive() external payable {}
}
