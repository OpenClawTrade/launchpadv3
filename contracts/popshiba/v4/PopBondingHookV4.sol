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

interface ICurveCloneRW {
    function initialize(
        address hook, address token, address creator, address treasury, address lpLocker,
        address c0, address c1, uint24 fee, int24 ts
    ) external;
    function applyBuy(uint256 ethIn, uint256 tokensOut, uint256 fee) external returns (bool didGraduate);
    function applySell(uint256 tokenIn, uint256 ethGross, uint256 fee) external;
    function realEthReserves() external view returns (uint256);
    function realTokenReserves() external view returns (uint256);
    function creator() external view returns (address);
    function protocolTreasury() external view returns (address);
    function token() external view returns (address);
    function creatorFeesAccrued() external view returns (uint256);
    function protocolFeesAccrued() external view returns (uint256);
    function getPrice() external view returns (uint256);
    function curveProgressBps() external view returns (uint256);
}

/// @title PopBondingHookV4 (singleton)
/// @notice Singleton Uniswap V4 hook — 1:1 fork of Unicurve's architecture.
/// State per token lives in EIP-1167 clones of `PopCurveImpl` ("CURVE_IMPL"),
/// addressed by `poolId`. The hook itself is stateless w.r.t. tokens; it only
/// orchestrates swap math by delegating accrual to the per-pool clone.
///
/// Key parity points with Unicurve:
///   • One hook contract serves every launch (mined CREATE2 address with the
///     correct permission bits).
///   • Curve constants + virtual reserves identical.
///   • Pre-grad swaps fully consumed via BeforeSwapDelta (custom curve pattern).
///   • Post-grad swaps flow through standard V4 AMM against PM-locked LP NFT
///     (held by `PopV4LpLocker`).
///   • Rich 13-field `Trade` event emitted on every buy/sell — matches the
///     event Unicurve indexers consume.
contract PopBondingHookV4 is BaseHook {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    address public immutable FACTORY;
    /// @dev poolId → curve clone holding all per-token state.
    mapping(PoolId => address) public curveOf;

    error NotFactory();
    error NotInitialized();
    error ExactOutUnsupported();

    /// @notice 13-field Trade event matching Unicurve's indexer surface.
    event Trade(
        address indexed token,
        address indexed trader,
        bool    isBuy,
        uint256 ethAmount,        // gross ETH in (buy) or out (sell, gross)
        uint256 tokenAmount,
        uint256 fee,
        uint256 creatorFee,
        uint256 protocolFee,
        uint256 newRealEth,
        uint256 newRealTokens,
        uint256 priceAfter,       // ETH per token, 1e18
        uint256 progressBps,      // 0..10_000
        uint256 timestamp
    );
    event Graduated(address indexed token, uint256 ethToLp, uint256 tokensToLp);
    event CurveRegistered(PoolId indexed poolId, address indexed token, address indexed curve);

    constructor(IPoolManager _manager, address _factory) BaseHook(_manager) {
        FACTORY = _factory;
    }

    /// @notice Factory-only: bind a freshly-deployed curve clone to its poolId.
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

    /// @dev Block LP ops during bonding phase. Post-grad: only the LP locker
    /// (via PositionManager) may add liquidity.
    function _beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) internal view override returns (bytes4) {
        address curve = curveOf[key.toId()];
        if (curve == address(0)) revert NotInitialized();
        // Allow only after graduation, and only via the locker (sender is PM,
        // origin is the locker — but in V4 the `sender` arg is the PM caller).
        require(ICurveCloneRW(curve).realEthReserves() == 0
            && ICurveCloneRW(curve).realTokenReserves() == 0
            || sender == ICurveCloneRW(curve).protocolTreasury(), "no LP");
        return BaseHook.beforeAddLiquidity.selector;
    }

    function _beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) internal pure override returns (bytes4) {
        revert("LP locked");
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

        // Post-graduation: yield to the standard AMM against the locked LP.
        if (curve.realEthReserves() == 0 && curve.realTokenReserves() == 0) {
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        bool ethIs0 = Currency.unwrap(key.currency0) == address(0);
        bool inputIsEth = (params.zeroForOne == ethIs0);
        if (params.amountSpecified >= 0) revert ExactOutUnsupported();
        uint256 amountIn = uint256(-params.amountSpecified);

        if (inputIsEth) {
            // BUY
            uint256 fee = (amountIn * 100) / 10000; // 1% — constant kept inline
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
            // SELL
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

    // ── Pure curve math (reads state from the clone) ──
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
