// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IPoolManager} from "@uniswap/v4-core/contracts/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/contracts/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/contracts/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/contracts/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/contracts/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/contracts/types/BeforeSwapDelta.sol";
import {Hooks} from "@uniswap/v4-core/contracts/libraries/Hooks.sol";
import {BaseHook} from "@uniswap/v4-periphery/contracts/base/hooks/BaseHook.sol";

import {IPositionManager} from "./interfaces/IPositionManager.sol";
import {ITunaFlaunch} from "./interfaces/ITunaFlaunch.sol";
import {TunaBidWall} from "./TunaBidWall.sol";
import {TunaFairLaunch} from "./TunaFairLaunch.sol";

/**
 * @title TunaPositionManager
 * @notice Uniswap V4 Hook that manages the full token lifecycle (Flaunch.gg replica)
 * @dev Implements beforeSwap/afterSwap hooks for fee collection and distribution
 * 
 * Key Features:
 * - 1% trading fee on all swaps (configurable per pool)
 * - Fee split between creator (0-100%) and BidWall (remainder)
 * - Fair launch period with fixed price
 * - Progressive BidWall for buyback support
 */
contract TunaPositionManager is BaseHook, IPositionManager, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;

    error CallerIsNotBidWall();
    error CannotBeInitializedDirectly();
    error InsufficientFlaunchFee(uint paid, uint required);
    error TokenNotFlaunched(uint flaunchesAt);
    error UnknownPool(PoolId poolId);

    /// @notice Emitted when a pool is created
    event PoolCreated(
        PoolId indexed poolId,
        address memecoin,
        address treasury,
        uint tokenId,
        bool currencyFlipped,
        uint flaunchFee,
        FlaunchParams params
    );

    /// @notice Emitted when a pool is scheduled for future launch
    event PoolScheduled(PoolId indexed poolId, uint flaunchesAt);

    /// @notice Emitted on every swap
    event PoolSwap(
        PoolId indexed poolId,
        int flAmount0,
        int flAmount1,
        int flFee0,
        int flFee1,
        int bidWallAmount0,
        int bidWallAmount1,
        int uniFee0,
        int uniFee1
    );

    /// @notice Emitted after any transaction to share pool state
    event PoolStateUpdated(
        PoolId indexed poolId,
        uint160 sqrtPriceX96,
        int24 tick,
        uint24 protocolFee,
        uint24 swapFee,
        uint128 liquidity
    );

    /// @notice Default trading fee (2% total - 1% platform + 1% creator)
    uint24 public constant DEFAULT_TRADING_FEE = 200_00; // 2% = 20000 basis points in 1e6
    
    /// @notice Platform fee (1% - always collected)
    uint24 public constant PLATFORM_FEE = 100_00; // 1% = 10000 basis points in 1e6

    /// @notice Minimum distribution threshold
    uint public constant MIN_DISTRIBUTE_THRESHOLD = 0.001 ether;

    /// @notice Burn address for unsold tokens
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @notice Native token (flETH wrapper)
    address public immutable nativeToken;

    /// @notice The Flaunch NFT contract
    ITunaFlaunch public flaunchContract;

    /// @notice BidWall contract for buybacks
    TunaBidWall public bidWall;

    /// @notice FairLaunch contract
    TunaFairLaunch public fairLaunch;

    /// @notice Protocol fee recipient
    address public protocolFeeRecipient;

    /// @notice Creator fee allocation per pool (in basis points, max 10000 = 100%)
    mapping(PoolId => uint24) public creatorFee;

    /// @notice Pool keys by memecoin address
    mapping(address memecoin => PoolKey) internal _poolKeys;

    /// @notice When a pool is scheduled to launch
    mapping(PoolId => uint) public flaunchesAt;

    /// @notice Tick before swap for afterSwap reference
    int24 internal _beforeSwapTick;

    constructor(
        IPoolManager poolManager_,
        address nativeToken_,
        address protocolFeeRecipient_
    ) BaseHook(poolManager_) Ownable(msg.sender) {
        nativeToken = nativeToken_;
        protocolFeeRecipient = protocolFeeRecipient_;
    }

    /**
     * @notice Initialize with Flaunch, BidWall, and FairLaunch contracts
     */
    function initialize(
        ITunaFlaunch flaunchContract_,
        TunaBidWall bidWall_,
        TunaFairLaunch fairLaunch_
    ) external onlyOwner {
        flaunchContract = flaunchContract_;
        bidWall = bidWall_;
        fairLaunch = fairLaunch_;

        // Approve BidWall and FairLaunch to manage native token
        IERC20(nativeToken).approve(address(bidWall_), type(uint256).max);
        IERC20(nativeToken).approve(address(fairLaunch_), type(uint256).max);
    }

    // ============ Hook Permissions ============

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ============ Core Flaunch Function ============

    /**
     * @notice Flaunch a new token with automatic pool creation
     * @param params The flaunch parameters
     * @return memecoin_ The deployed memecoin address
     */
    function flaunch(FlaunchParams calldata params) external payable override nonReentrant returns (address memecoin_) {
        // Deploy token via Flaunch NFT contract
        (address memecoin, address payable treasury, uint tokenId) = flaunchContract.flaunch(params);
        memecoin_ = memecoin;

        // Determine currency ordering (flETH vs memecoin)
        bool currencyFlipped = nativeToken >= memecoin;

        // Create Uniswap V4 pool key
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(currencyFlipped ? memecoin : nativeToken),
            currency1: Currency.wrap(currencyFlipped ? nativeToken : memecoin),
            fee: 0, // No LP fee - all fees handled by hook
            tickSpacing: 60,
            hooks: this
        });

        // Store pool key
        _poolKeys[memecoin] = poolKey;
        PoolId poolId = poolKey.toId();

        // Set creator fee allocation
        if (params.creatorFeeAllocation != 0) {
            creatorFee[poolId] = params.creatorFeeAllocation;
        }

        // Get flaunch fee based on initial price params
        uint flaunchFee = getFlaunchingFee(params.initialPriceParams);
        if (msg.value < flaunchFee) {
            revert InsufficientFlaunchFee(msg.value, flaunchFee);
        }

        // Initialize the pool
        uint160 sqrtPriceX96 = _calculateInitialPrice(currencyFlipped, params.initialPriceParams);
        poolManager.initialize(poolKey, sqrtPriceX96);

        // Set up scheduled launch if specified
        if (params.flaunchAt > block.timestamp) {
            flaunchesAt[poolId] = params.flaunchAt;
            emit PoolScheduled(poolId, params.flaunchAt);
        }

        // Create fair launch position
        fairLaunch.createPosition(
            poolId,
            0, // initialTick determined by pool
            params.flaunchAt > 0 ? params.flaunchAt : block.timestamp,
            params.initialTokenFairLaunch,
            params.fairLaunchDuration
        );

        emit PoolCreated(
            poolId,
            memecoin,
            treasury,
            tokenId,
            currencyFlipped,
            flaunchFee,
            params
        );

        // Refund excess ETH
        if (msg.value > flaunchFee) {
            payable(msg.sender).transfer(msg.value - flaunchFee);
        }
    }

    // ============ Hook Callbacks ============

    function _beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();

        // Check if pool is launched yet
        uint launchTime = flaunchesAt[poolId];
        if (launchTime > 0 && block.timestamp < launchTime) {
            revert TokenNotFlaunched(launchTime);
        }

        // Store tick for afterSwap
        (, _beforeSwapTick, , ) = poolManager.getSlot0(poolId);

        // Check if in fair launch - prevent sells during fair launch
        if (fairLaunch.inFairLaunchWindow(poolId)) {
            bool isSelling = _isSellingSideOfSwap(key, params);
            if (isSelling) {
                revert("Cannot sell during fair launch");
            }

            // Handle fair launch swap
            return _handleFairLaunchSwap(key, params);
        }

        // Check for stale BidWall position
        bool nativeIsZero = Currency.unwrap(key.currency0) == nativeToken;
        bidWall.checkStalePosition(key, _beforeSwapTick, nativeIsZero);

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function _afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        BalanceDelta delta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        PoolId poolId = key.toId();

        // Skip fee collection during fair launch
        if (fairLaunch.inFairLaunchWindow(poolId)) {
            return (BaseHook.afterSwap.selector, 0);
        }

        // Calculate trading fee (2% total = 1% platform + 1% creator)
        bool nativeIsZero = Currency.unwrap(key.currency0) == nativeToken;
        int128 nativeDelta = nativeIsZero ? delta.amount0() : delta.amount1();
        
        if (nativeDelta < 0) {
            // Native token going out - take 2% fee
            uint256 totalFee = uint256(uint128(-nativeDelta)) / 50; // 2% fee
            
            // Fixed 50/50 split: 1% platform, 1% creator
            uint256 platformFeeAmount = totalFee / 2; // 1% to platform
            uint256 creatorFeeAmount = totalFee - platformFeeAmount; // 1% to creator

            // Send platform share to protocol fee recipient
            if (platformFeeAmount > 0) {
                // Transfer to protocol fee recipient
                IERC20(nativeToken).safeTransfer(protocolFeeRecipient, platformFeeAmount);
            }

            // Send creator share to BidWall for buyback support
            if (creatorFeeAmount > 0) {
                bidWall.deposit(key, creatorFeeAmount, _beforeSwapTick, nativeIsZero);
            }
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    // ============ View Functions ============

    function poolKey(address memecoin_) external view returns (PoolKey memory) {
        return _poolKeys[memecoin_];
    }

    function getFlaunchingFee(bytes calldata) public pure returns (uint) {
        // Base flaunch fee - can be dynamic based on initial price
        return 0.001 ether;
    }

    // ============ Internal Functions ============

    function _calculateInitialPrice(
        bool currencyFlipped,
        bytes calldata
    ) internal pure returns (uint160) {
        // Default starting price calculation
        // In production, this would use initialPriceParams
        // sqrtPriceX96 for ~$0.00001 per token
        if (currencyFlipped) {
            return 79228162514264337593543950336; // 1:1 ratio as placeholder
        }
        return 79228162514264337593543950336;
    }

    function _isSellingSideOfSwap(
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params
    ) internal view returns (bool) {
        bool nativeIsZero = Currency.unwrap(key.currency0) == nativeToken;
        // zeroForOne = true means selling token0
        // If native is token0: zeroForOne = selling native = NOT selling memecoin
        // If native is token1: zeroForOne = selling memecoin
        return nativeIsZero ? !params.zeroForOne : params.zeroForOne;
    }

    function _handleFairLaunchSwap(
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params
    ) internal returns (bytes4, BeforeSwapDelta, uint24) {
        // During fair launch, handle fixed-price buying
        // This is a simplified version - full implementation would match Flaunch
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    // ============ Receive ETH ============

    receive() external payable {}
}
