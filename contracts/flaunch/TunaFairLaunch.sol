// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {IPoolManager} from "@uniswap/v4-core/contracts/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/contracts/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/contracts/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/contracts/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/contracts/libraries/TickMath.sol";
import {BeforeSwapDelta, toBeforeSwapDelta} from "@uniswap/v4-core/contracts/types/BeforeSwapDelta.sol";
import {BalanceDelta} from "@uniswap/v4-core/contracts/types/BalanceDelta.sol";

/**
 * @title TunaFairLaunch
 * @notice Fair Launch mechanism - fixed price period at launch (Flaunch.gg replica)
 * @dev Creates a time window after token launch where:
 *      - Token price is fixed (single tick position)
 *      - Only buying is allowed (no selling)
 *      - ETH raised goes to BidWall for price support
 *      - After period ends, remaining tokens + ETH form Uniswap position
 */
contract TunaFairLaunch is AccessControl {
    using PoolIdLibrary for PoolKey;

    error CannotModifyLiquidityDuringFairLaunch();
    error CannotSellTokenDuringFairLaunch();
    error NotPositionManager();

    /// @notice Emitted when fair launch position is created
    event FairLaunchCreated(
        PoolId indexed poolId,
        uint tokens,
        uint startsAt,
        uint endsAt
    );

    /// @notice Emitted when fair launch ends and rebalances
    event FairLaunchEnded(
        PoolId indexed poolId,
        uint revenue,
        uint unsoldSupply,
        uint endedAt
    );

    /**
     * @notice Fair launch info for a pool
     */
    struct FairLaunchInfo {
        uint startsAt;      // Unix timestamp when fair launch starts
        uint endsAt;        // Unix timestamp when fair launch ends
        int24 initialTick;  // The tick where fair launch is priced
        uint revenue;       // ETH revenue earned during fair launch
        uint supply;        // Token supply in fair launch
        bool closed;        // Whether fair launch has been closed
    }

    /// @notice Fair launch info per pool
    mapping(PoolId => FairLaunchInfo) internal _fairLaunchInfo;

    /// @notice The Uniswap V4 PoolManager
    IPoolManager public immutable poolManager;

    /// @notice The PositionManager contract
    address public positionManager;

    /// @notice Burn address for unsold tokens
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @notice Role for position manager
    bytes32 public constant POSITION_MANAGER_ROLE = keccak256("POSITION_MANAGER_ROLE");

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Set the position manager
     */
    function setPositionManager(address positionManager_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        positionManager = positionManager_;
        _grantRole(POSITION_MANAGER_ROLE, positionManager_);
    }

    /**
     * @notice Check if pool is in fair launch window
     */
    function inFairLaunchWindow(PoolId poolId_) public view returns (bool) {
        FairLaunchInfo memory info = _fairLaunchInfo[poolId_];
        return block.timestamp >= info.startsAt && 
               block.timestamp < info.endsAt && 
               !info.closed;
    }

    /**
     * @notice Get fair launch info for a pool
     */
    function fairLaunchInfo(PoolId poolId_) public view returns (FairLaunchInfo memory) {
        return _fairLaunchInfo[poolId_];
    }

    /**
     * @notice Create a fair launch position
     * @param poolId_ The pool ID
     * @param initialTick_ The initial tick for the fair launch price
     * @param flaunchesAt_ When the fair launch starts
     * @param initialTokenFairLaunch_ Amount of tokens in fair launch
     * @param fairLaunchDuration_ Duration of fair launch in seconds
     */
    function createPosition(
        PoolId poolId_,
        int24 initialTick_,
        uint flaunchesAt_,
        uint initialTokenFairLaunch_,
        uint fairLaunchDuration_
    ) external onlyPositionManager returns (FairLaunchInfo memory) {
        // If no tokens, no fair launch duration
        if (initialTokenFairLaunch_ == 0) {
            fairLaunchDuration_ = 0;
        }

        // Calculate end time
        uint endsAt = flaunchesAt_ + fairLaunchDuration_;

        // Store fair launch info
        _fairLaunchInfo[poolId_] = FairLaunchInfo({
            startsAt: flaunchesAt_,
            endsAt: endsAt,
            initialTick: initialTick_,
            revenue: 0,
            supply: initialTokenFairLaunch_,
            closed: false
        });

        emit FairLaunchCreated(poolId_, initialTokenFairLaunch_, flaunchesAt_, endsAt);

        return _fairLaunchInfo[poolId_];
    }

    /**
     * @notice Handle a swap during fair launch
     * @dev Only allows buying (ETH -> Token), not selling
     * @param poolId_ The pool ID
     * @param amountIn_ Amount of ETH being swapped in
     * @return tokensOut Amount of tokens to give
     */
    function handleFairLaunchSwap(
        PoolId poolId_,
        uint amountIn_
    ) external onlyPositionManager returns (uint tokensOut) {
        FairLaunchInfo storage info = _fairLaunchInfo[poolId_];

        // Calculate tokens out based on fixed price (initialTick)
        // In production: use tick math to calculate exact price
        // Simplified: assume 1 ETH = X tokens based on initial price
        uint pricePerToken = _getPriceFromTick(info.initialTick);
        tokensOut = (amountIn_ * 1e18) / pricePerToken;

        // Cap at remaining supply
        if (tokensOut > info.supply) {
            tokensOut = info.supply;
            // Refund excess ETH in production
        }

        // Update state
        info.supply -= tokensOut;
        info.revenue += amountIn_;

        return tokensOut;
    }

    /**
     * @notice Close the fair launch position
     * @dev Burns unsold tokens, deploys remaining + ETH to Uniswap
     */
    function closePosition(
        PoolKey memory poolKey_,
        bool nativeIsZero_
    ) external onlyPositionManager returns (FairLaunchInfo memory) {
        PoolId poolId = poolKey_.toId();
        FairLaunchInfo storage info = _fairLaunchInfo[poolId];

        require(!info.closed, "Already closed");
        require(block.timestamp >= info.endsAt, "Fair launch not ended");

        // Mark as closed
        info.closed = true;
        info.endsAt = block.timestamp;

        // Calculate unsold supply (will be burned)
        uint unsoldSupply = info.supply;

        emit FairLaunchEnded(poolId, info.revenue, unsoldSupply, block.timestamp);

        // In production:
        // 1. Burn unsold tokens
        // 2. Create wide-range Uniswap position with revenue + remaining tokens
        // 3. Send part of revenue to BidWall

        return info;
    }

    /**
     * @notice Force close expired fair launch
     */
    function forceClose(PoolKey memory poolKey_, bool nativeIsZero_) external {
        PoolId poolId = poolKey_.toId();
        FairLaunchInfo memory info = _fairLaunchInfo[poolId];

        require(block.timestamp >= info.endsAt, "Not expired");
        require(!info.closed, "Already closed");

        // Anyone can trigger close after expiry
        // In production: this would call closePosition logic
    }

    // ============ Internal Functions ============

    function _getPriceFromTick(int24 tick_) internal pure returns (uint) {
        // Simplified price calculation
        // In production: use TickMath.getSqrtRatioAtTick
        // Returns price in wei per token (1e18 = 1 ETH per token)
        
        // Placeholder: very low starting price
        // tick = 0 means 1:1, negative tick means token is cheaper
        if (tick_ < -100) {
            return 0.00001 ether; // Very cheap
        } else if (tick_ < 0) {
            return 0.0001 ether;
        } else {
            return 0.001 ether;
        }
    }

    // ============ Modifiers ============

    modifier onlyPositionManager() {
        if (msg.sender != positionManager) {
            revert NotPositionManager();
        }
        _;
    }
}
