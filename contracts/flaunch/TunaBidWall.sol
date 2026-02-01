// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IPoolManager} from "@uniswap/v4-core/contracts/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/contracts/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/contracts/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/contracts/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/contracts/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/contracts/libraries/StateLibrary.sol";

/**
 * @title TunaBidWall
 * @notice Progressive Bid Wall - single-sided liquidity position 1 tick below spot (Flaunch.gg replica)
 * @dev Places ETH fees as liquidity 1 tick below current price for buyback support.
 *      After each deposit, the position rebalances to stay 1 tick below spot.
 *      This creates natural price support and buyback pressure.
 */
contract TunaBidWall is AccessControl, Ownable {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    error NotPositionManager();
    error BidWallDisabled();

    /// @notice Emitted when BidWall is first initialized
    event BidWallInitialized(PoolId indexed poolId, uint eth, int24 tickLower, int24 tickUpper);

    /// @notice Emitted when BidWall receives a deposit
    event BidWallDeposit(PoolId indexed poolId, uint added, uint pending);

    /// @notice Emitted when BidWall is repositioned
    event BidWallRepositioned(PoolId indexed poolId, uint eth, int24 tickLower, int24 tickUpper);

    /// @notice Emitted when tokens are transferred to treasury
    event BidWallRewardsTransferred(PoolId indexed poolId, address recipient, uint tokens);

    /// @notice Emitted when BidWall is closed
    event BidWallClosed(PoolId indexed poolId, address recipient, uint eth);

    /// @notice Emitted when BidWall is disabled/enabled
    event BidWallDisabledStateUpdated(PoolId indexed poolId, bool disabled);

    /// @notice Emitted when swap fee threshold is updated
    event SwapFeeThresholdUpdated(uint newThreshold);

    /// @notice Emitted when stale time window is updated
    event StaleTimeWindowUpdated(uint newWindow);

    /**
     * @notice BidWall info for each pool
     */
    struct PoolInfo {
        bool disabled;           // If BidWall is disabled for this pool
        bool initialized;        // If BidWall has been initialized
        int24 tickLower;        // Current lower tick of BidWall position
        int24 tickUpper;        // Current upper tick of BidWall position
        uint pendingETHFees;    // ETH waiting to be added to BidWall
        uint cumulativeSwapFees; // Total swap fees ever accumulated
    }

    /// @notice The Uniswap V4 PoolManager
    IPoolManager public immutable poolManager;

    /// @notice The native token (flETH)
    address public immutable nativeToken;

    /// @notice The PositionManager contract
    address public positionManager;

    /// @notice Time window after which BidWall becomes stale
    uint public staleTimeWindow = 7 days;

    /// @notice Swap fee threshold before repositioning
    uint internal _swapFeeThreshold = 0.1 ether;

    /// @notice Pool info mapping
    mapping(PoolId => PoolInfo) public poolInfo;

    /// @notice Last transaction timestamp per pool
    mapping(PoolId => uint) public lastPoolTransaction;

    /// @notice Role for position manager
    bytes32 public constant POSITION_MANAGER_ROLE = keccak256("POSITION_MANAGER_ROLE");

    constructor(
        address nativeToken_,
        IPoolManager poolManager_,
        address owner_
    ) Ownable(owner_) {
        nativeToken = nativeToken_;
        poolManager = poolManager_;

        // Grant admin role
        _grantRole(DEFAULT_ADMIN_ROLE, owner_);

        emit SwapFeeThresholdUpdated(0.1 ether);
        emit StaleTimeWindowUpdated(7 days);
    }

    /**
     * @notice Set the position manager
     */
    function setPositionManager(address positionManager_) external onlyOwner {
        positionManager = positionManager_;
        _grantRole(POSITION_MANAGER_ROLE, positionManager_);
    }

    /**
     * @notice Check if BidWall is enabled for a pool
     */
    function isBidWallEnabled(PoolId poolId_) public view returns (bool) {
        return !poolInfo[poolId_].disabled;
    }

    /**
     * @notice Deposit ETH fees into BidWall
     * @param poolKey_ The pool key
     * @param ethSwapAmount_ Amount of ETH fees to add
     * @param currentTick_ Current pool tick
     * @param nativeIsZero_ If native token is currency0
     */
    function deposit(
        PoolKey memory poolKey_,
        uint ethSwapAmount_,
        int24 currentTick_,
        bool nativeIsZero_
    ) external onlyPositionManager {
        if (ethSwapAmount_ == 0) return;

        PoolId poolId = poolKey_.toId();
        PoolInfo storage info = poolInfo[poolId];

        // Check if BidWall is enabled
        if (info.disabled) return;

        // Update cumulative and pending fees
        info.cumulativeSwapFees += ethSwapAmount_;
        info.pendingETHFees += ethSwapAmount_;

        // Update last transaction timestamp
        lastPoolTransaction[poolId] = block.timestamp;

        emit BidWallDeposit(poolId, ethSwapAmount_, info.pendingETHFees);

        // Check if we've crossed the threshold for repositioning
        uint threshold = _getSwapFeeThreshold(info.cumulativeSwapFees);
        if (info.pendingETHFees < threshold) {
            return;
        }

        // Reposition the BidWall
        _reposition(poolKey_, info, currentTick_, nativeIsZero_);
    }

    /**
     * @notice Check and reposition stale BidWall
     */
    function checkStalePosition(
        PoolKey memory poolKey_,
        int24 currentTick_,
        bool nativeIsZero_
    ) external onlyPositionManager {
        PoolId poolId = poolKey_.toId();

        // Check if stale
        if (lastPoolTransaction[poolId] + staleTimeWindow > block.timestamp) {
            return;
        }

        PoolInfo storage info = poolInfo[poolId];

        // Only reposition if there are pending fees
        if (info.pendingETHFees == 0) {
            return;
        }

        _reposition(poolKey_, info, currentTick_, nativeIsZero_);
    }

    /**
     * @notice Disable BidWall for a pool (creator decision)
     */
    function disableBidWall(PoolId poolId_) external {
        // This would require verification that caller is pool creator
        // For now, only owner can disable
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");

        poolInfo[poolId_].disabled = true;
        emit BidWallDisabledStateUpdated(poolId_, true);
    }

    /**
     * @notice Enable BidWall for a pool
     */
    function enableBidWall(PoolId poolId_) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");

        poolInfo[poolId_].disabled = false;
        emit BidWallDisabledStateUpdated(poolId_, false);
    }

    /**
     * @notice Update swap fee threshold
     */
    function setSwapFeeThreshold(uint threshold_) external onlyOwner {
        _swapFeeThreshold = threshold_;
        emit SwapFeeThresholdUpdated(threshold_);
    }

    /**
     * @notice Update stale time window
     */
    function setStaleTimeWindow(uint window_) external onlyOwner {
        staleTimeWindow = window_;
        emit StaleTimeWindowUpdated(window_);
    }

    /**
     * @notice Get swap fee threshold
     */
    function getSwapFeeThreshold() external view returns (uint) {
        return _swapFeeThreshold;
    }

    // ============ Internal Functions ============

    /**
     * @notice Reposition the BidWall liquidity
     * @dev Removes existing liquidity and places it 1 tick below current spot
     */
    function _reposition(
        PoolKey memory poolKey_,
        PoolInfo storage info_,
        int24 currentTick_,
        bool nativeIsZero_
    ) internal {
        // Get total fees to deploy
        uint totalFees = info_.pendingETHFees;
        info_.pendingETHFees = 0;

        uint ethWithdrawn;
        uint memecoinWithdrawn;

        // If already initialized, remove existing position
        if (info_.initialized) {
            (ethWithdrawn, memecoinWithdrawn) = _removeLiquidity(
                poolKey_,
                info_.tickLower,
                info_.tickUpper,
                nativeIsZero_
            );
        } else {
            info_.initialized = true;
        }

        // Get current tick from pool
        PoolId poolId = poolKey_.toId();
        (, int24 slot0Tick, , ) = poolManager.getSlot0(poolId);

        // Use the lower of beforeSwap tick or current tick
        if (nativeIsZero_ == slot0Tick > currentTick_) {
            currentTick_ = slot0Tick;
        }

        // Calculate new tick range (1 tick below spot)
        int24 tickSpacing = poolKey_.tickSpacing;
        int24 newTickLower;
        int24 newTickUpper;

        if (nativeIsZero_) {
            // Native is token0: BidWall should be below current price
            newTickUpper = _roundTickDown(currentTick_, tickSpacing);
            newTickLower = newTickUpper - tickSpacing;
        } else {
            // Native is token1: BidWall should be above current price
            newTickLower = _roundTickUp(currentTick_, tickSpacing);
            newTickUpper = newTickLower + tickSpacing;
        }

        // Store new tick range
        info_.tickLower = newTickLower;
        info_.tickUpper = newTickUpper;

        // Add liquidity at new position
        uint totalEth = ethWithdrawn + totalFees;
        _addETHLiquidity(poolKey_, newTickLower, newTickUpper, totalEth, nativeIsZero_);

        emit BidWallRepositioned(poolId, totalEth, newTickLower, newTickUpper);

        // Handle memecoins from old position (send to treasury)
        if (memecoinWithdrawn > 0) {
            // In production: transfer to memecoin treasury
        }
    }

    function _removeLiquidity(
        PoolKey memory,
        int24,
        int24,
        bool
    ) internal pure returns (uint ethWithdrawn, uint memecoinWithdrawn) {
        // In production: call PoolManager to remove liquidity
        // This is a placeholder
        return (0, 0);
    }

    function _addETHLiquidity(
        PoolKey memory,
        int24,
        int24,
        uint,
        bool
    ) internal pure {
        // In production: call PoolManager to add liquidity
        // This is a placeholder
    }

    function _getSwapFeeThreshold(uint cumulativeFees_) internal view returns (uint) {
        // Dynamic threshold based on cumulative fees
        // Larger pools can have higher thresholds
        if (cumulativeFees_ > 100 ether) {
            return 1 ether;
        } else if (cumulativeFees_ > 10 ether) {
            return 0.5 ether;
        }
        return _swapFeeThreshold;
    }

    function _roundTickDown(int24 tick_, int24 tickSpacing_) internal pure returns (int24) {
        int24 mod = tick_ % tickSpacing_;
        if (mod < 0) {
            return tick_ - mod - tickSpacing_;
        }
        return tick_ - mod;
    }

    function _roundTickUp(int24 tick_, int24 tickSpacing_) internal pure returns (int24) {
        int24 mod = tick_ % tickSpacing_;
        if (mod == 0) return tick_;
        if (mod > 0) {
            return tick_ + tickSpacing_ - mod;
        }
        return tick_ - mod;
    }

    // ============ Modifiers ============

    modifier onlyPositionManager() {
        if (msg.sender != positionManager) {
            revert NotPositionManager();
        }
        _;
    }

    // ============ Receive ETH ============

    receive() external payable {}
}
