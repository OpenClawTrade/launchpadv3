// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BaseHook} from "uniswap-hooks/src/base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";

/// @title PopInstantHook (singleton)
/// @notice Flat 1.25% fee hook for instant-LP V4 launches.
///
/// Architecture
/// ────────────
///   • Singleton: ONE deployed instance services every Pop V4 instant launch.
///   • Pool LP fee = 0 (no protocol-level LP fees). All economics live in
///     this hook so we can split between creator and treasury freely.
///   • Per-swap fee: 1.25% of the *input* amount, taken in the input currency
///     via `poolManager.take()` to this hook in `afterSwap`. Split 50/50:
///       - 0.625% → creator (claimable)
///       - 0.625% → treasury (claimable)
///   • Fee % is hardcoded constant — never changes per token, per mcap, or
///     per swap. Simple, predictable, ~5k less gas than a tiered curve.
///   • Storage is per-pool: registered once by the factory at launch.
///
/// Permission bits required (Hooks.sol):
///   beforeInitialize=false, afterInitialize=true,
///   beforeSwap=true (returns delta=0; we just record the fee math),
///   afterSwap=true (returns delta=fee taken from input),
///   beforeSwapReturnDelta=false, afterSwapReturnDelta=true
contract PopInstantHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    address public immutable FACTORY;
    address public immutable TREASURY;

    /// @dev poolId → creator address (receives 50% of fees)
    mapping(PoolId => address) public creatorOf;
    /// @dev poolId → token address (the non-ETH currency in the pool)
    mapping(PoolId => address) public tokenOf;

    /// @dev token → unclaimed ETH for the creator
    mapping(address => uint256) public creatorEthOwed;
    /// @dev token → unclaimed ETH for the treasury
    mapping(address => uint256) public treasuryEthOwed;
    /// @dev token → unclaimed token amount (when fee is taken in token side)
    mapping(address => uint256) public creatorTokenOwed;
    mapping(address => uint256) public treasuryTokenOwed;

    /// @dev token → lifetime totals (for analytics)
    mapping(address => uint256) public lifetimeCreatorEth;
    mapping(address => uint256) public lifetimeTreasuryEth;

    error NotFactory();
    error NotInitialized();

    event PoolRegistered(PoolId indexed poolId, address indexed token, address indexed creator);
    event FeeAccrued(
        address indexed token,
        bool feeInEth,
        uint256 totalFee,
        uint256 creatorShare,
        uint256 treasuryShare
    );
    event CreatorClaimed(address indexed token, address indexed creator, uint256 ethAmount, uint256 tokenAmount);
    event TreasuryClaimed(address indexed token, address indexed treasury, uint256 ethAmount, uint256 tokenAmount);

    constructor(IPoolManager _pm, address _factory, address _treasury) BaseHook(_pm) {
        FACTORY = _factory;
        TREASURY = _treasury;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @notice Called by the factory immediately after `poolManager.initialize`.
    /// Records who the creator is so afterSwap knows where to credit fees.
    function registerPool(PoolId poolId, address token, address creator) external {
        if (msg.sender != FACTORY) revert NotFactory();
        creatorOf[poolId] = creator;
        tokenOf[poolId] = token;
        emit PoolRegistered(poolId, token, creator);
    }

    function _afterInitialize(
        address,
        PoolKey calldata,
        uint160,
        int24
    ) internal pure override returns (bytes4) {
        return BaseHook.afterInitialize.selector;
    }

    /// @dev We don't modify the swap in beforeSwap; we just need the hook to
    /// be callable. Real fee logic happens in afterSwap where we know the
    /// actual amounts moved.
    function _beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        bytes calldata
    ) internal view override returns (bytes4, BeforeSwapDelta, uint24) {
        if (creatorOf[key.toId()] == address(0)) revert NotInitialized();
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    /// @dev Take 1.5% of the input side post-swap. We use afterSwapReturnDelta
    /// to ask the PoolManager to credit the hook with the fee amount.
    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        PoolId pid = key.toId();
        address token = tokenOf[pid];
        if (token == address(0)) return (BaseHook.afterSwap.selector, int128(0));

        // The "input" is whichever side is negative on the user delta.
        // We collect 1.5% of the absolute input as our hook fee.
        bool zeroForOne = params.zeroForOne;
        bool ethIsZero = (Currency.unwrap(key.currency0) == address(0));
        bool feeInEth = (zeroForOne && ethIsZero) || (!zeroForOne && !ethIsZero);

        int128 inputDelta = zeroForOne ? delta.amount0() : delta.amount1();
        // amountSpecified < 0 = exact-input; for our single-direction model,
        // input delta will be negative on the user side, meaning the pool
        // *received* that much. Take fee on the absolute value.
        if (inputDelta >= 0) return (BaseHook.afterSwap.selector, int128(0));
        uint256 absIn = uint256(uint128(-inputDelta));
        uint256 fee = (absIn * 125) / 10_000; // 1.25% flat — see contract header
        if (fee == 0) return (BaseHook.afterSwap.selector, int128(0));

        uint256 creatorShare = fee / 2;
        uint256 treasuryShare = fee - creatorShare;

        if (feeInEth) {
            poolManager.take(Currency.wrap(address(0)), address(this), fee);
            creatorEthOwed[token]  += creatorShare;
            treasuryEthOwed[token] += treasuryShare;
            lifetimeCreatorEth[token]  += creatorShare;
            lifetimeTreasuryEth[token] += treasuryShare;
        } else {
            poolManager.take(Currency.wrap(token), address(this), fee);
            creatorTokenOwed[token]  += creatorShare;
            treasuryTokenOwed[token] += treasuryShare;
        }

        emit FeeAccrued(token, feeInEth, fee, creatorShare, treasuryShare);

        // Returning a positive int128 on the *input* currency tells the PM
        // to expect that much LESS to be settled by the swap router (because
        // we already took it). Side selection: amountSpecified is the input
        // for exact-input swaps; afterSwap expects delta on the unspecified
        // currency when amountSpecified < 0, which equals the *input* side
        // in our setup. We simply return the fee; PM nets it.
        return (BaseHook.afterSwap.selector, int128(uint128(fee)));
    }

    /// @notice Creator pulls their accrued ETH + token fees for a given token.
    function claimCreator(address token) external {
        require(msg.sender == _expectedCreatorFor(token), "not creator");
        uint256 e = creatorEthOwed[token];
        uint256 t = creatorTokenOwed[token];
        creatorEthOwed[token] = 0;
        creatorTokenOwed[token] = 0;
        if (e > 0) {
            (bool ok, ) = msg.sender.call{value: e}("");
            require(ok, "eth send");
        }
        if (t > 0) {
            (bool ok, ) = token.call(abi.encodeWithSignature("transfer(address,uint256)", msg.sender, t));
            require(ok, "tok send");
        }
        emit CreatorClaimed(token, msg.sender, e, t);
    }

    /// @notice Treasury pulls its accrued share. Permissionless trigger,
    /// always pays the immutable TREASURY address.
    function claimTreasury(address token) external {
        uint256 e = treasuryEthOwed[token];
        uint256 t = treasuryTokenOwed[token];
        treasuryEthOwed[token] = 0;
        treasuryTokenOwed[token] = 0;
        if (e > 0) {
            (bool ok, ) = TREASURY.call{value: e}("");
            require(ok, "eth send");
        }
        if (t > 0) {
            (bool ok, ) = token.call(abi.encodeWithSignature("transfer(address,uint256)", TREASURY, t));
            require(ok, "tok send");
        }
        emit TreasuryClaimed(token, TREASURY, e, t);
    }

    /// @dev Reverse-lookup: walk creatorOf via tokenOf? We instead store
    /// creator per token directly. Cheaper to add a second mapping.
    mapping(address => address) public creatorByToken;
    function _expectedCreatorFor(address token) internal view returns (address) {
        return creatorByToken[token];
    }

    /// @notice Factory calls this alongside registerPool to enable
    /// `claimCreator` lookups by token address.
    function setCreatorByToken(address token, address creator) external {
        if (msg.sender != FACTORY) revert NotFactory();
        creatorByToken[token] = creator;
    }

    receive() external payable {}
}
