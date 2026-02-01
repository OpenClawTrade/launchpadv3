// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TunaFlETH
 * @notice Yield-bearing ETH wrapper for platform revenue (Flaunch.gg replica)
 * @dev All liquidity pools trade against flETH instead of raw ETH/WETH.
 *      flETH wraps ETH and deposits into yield strategies (Aave, Lido, etc.)
 *      Platform earns yield (~3-5% APY) on all locked liquidity.
 *      
 *      This is how Flaunch generates platform revenue WITHOUT taking trading fees.
 * 
 * Key Features:
 * - 1:1 peg with ETH (user deposits ETH, gets flETH)
 * - Underlying ETH deposited into Aave V3 for yield
 * - Yield accrues to protocol treasury
 * - Users can redeem flETH for ETH anytime
 */
contract TunaFlETH is ERC20, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    error DepositTooSmall();
    error WithdrawTooLarge();
    error StrategyNotSet();
    error InsufficientBalance();

    /// @notice Emitted when ETH is deposited for flETH
    event Deposit(address indexed user, uint ethAmount, uint flethMinted);

    /// @notice Emitted when flETH is redeemed for ETH
    event Withdraw(address indexed user, uint flethBurned, uint ethReturned);

    /// @notice Emitted when yield is harvested
    event YieldHarvested(uint yieldAmount, address recipient);

    /// @notice Emitted when strategy is updated
    event StrategyUpdated(address oldStrategy, address newStrategy);

    /// @notice The yield strategy contract (Aave, Lido, etc.)
    address public yieldStrategy;

    /// @notice The treasury that receives yield
    address public treasury;

    /// @notice Total ETH deposited (before yield)
    uint public totalDeposited;

    /// @notice Minimum deposit amount
    uint public constant MIN_DEPOSIT = 0.0001 ether;

    /// @notice WETH address on Base
    address public constant WETH = 0x4200000000000000000000000000000000000006;

    /// @notice Aave V3 Pool on Base (for yield strategy)
    address public constant AAVE_V3_POOL = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;

    constructor(address treasury_) 
        ERC20("Tuna Yield ETH", "flETH") 
        Ownable(msg.sender) 
    {
        treasury = treasury_;
    }

    /**
     * @notice Deposit ETH and receive flETH
     */
    function deposit() external payable nonReentrant returns (uint flethAmount) {
        if (msg.value < MIN_DEPOSIT) revert DepositTooSmall();

        flethAmount = msg.value;
        totalDeposited += msg.value;

        // Mint flETH 1:1 with ETH
        _mint(msg.sender, flethAmount);

        // Deposit into yield strategy if set
        if (yieldStrategy != address(0)) {
            _depositToStrategy(msg.value);
        }

        emit Deposit(msg.sender, msg.value, flethAmount);
    }

    /**
     * @notice Deposit ETH on behalf of another address
     */
    function depositFor(address recipient) external payable nonReentrant returns (uint flethAmount) {
        if (msg.value < MIN_DEPOSIT) revert DepositTooSmall();

        flethAmount = msg.value;
        totalDeposited += msg.value;

        _mint(recipient, flethAmount);

        if (yieldStrategy != address(0)) {
            _depositToStrategy(msg.value);
        }

        emit Deposit(recipient, msg.value, flethAmount);
    }

    /**
     * @notice Redeem flETH for ETH
     */
    function withdraw(uint flethAmount) external nonReentrant returns (uint ethAmount) {
        if (flethAmount > balanceOf(msg.sender)) revert WithdrawTooLarge();

        // flETH is always 1:1 with ETH for users
        ethAmount = flethAmount;

        // Burn flETH
        _burn(msg.sender, flethAmount);
        totalDeposited -= ethAmount;

        // Withdraw from strategy if needed
        if (yieldStrategy != address(0)) {
            _withdrawFromStrategy(ethAmount);
        }

        // Transfer ETH
        (bool success, ) = msg.sender.call{value: ethAmount}("");
        require(success, "ETH transfer failed");

        emit Withdraw(msg.sender, flethAmount, ethAmount);
    }

    /**
     * @notice Harvest yield and send to treasury
     * @dev Called periodically to collect accrued yield
     */
    function harvestYield() external nonReentrant returns (uint yieldAmount) {
        if (yieldStrategy == address(0)) return 0;

        // Get total value including yield
        uint totalValue = _getStrategyBalance();
        
        // Calculate yield (value above deposits)
        if (totalValue > totalDeposited) {
            yieldAmount = totalValue - totalDeposited;
            
            // Withdraw yield
            _withdrawFromStrategy(yieldAmount);
            
            // Send to treasury
            (bool success, ) = treasury.call{value: yieldAmount}("");
            require(success, "Treasury transfer failed");

            emit YieldHarvested(yieldAmount, treasury);
        }
    }

    /**
     * @notice Get current APY from strategy
     */
    function getCurrentAPY() external view returns (uint) {
        // In production: query Aave for current supply APY
        // Placeholder: ~3% APY
        return 300; // 3.00%
    }

    /**
     * @notice Get total value locked including yield
     */
    function getTotalValueLocked() external view returns (uint) {
        if (yieldStrategy != address(0)) {
            return _getStrategyBalance();
        }
        return address(this).balance;
    }

    /**
     * @notice Get pending yield to harvest
     */
    function getPendingYield() external view returns (uint) {
        if (yieldStrategy == address(0)) return 0;
        
        uint totalValue = _getStrategyBalance();
        if (totalValue > totalDeposited) {
            return totalValue - totalDeposited;
        }
        return 0;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set yield strategy contract
     */
    function setYieldStrategy(address strategy_) external onlyOwner {
        address oldStrategy = yieldStrategy;
        
        // Withdraw from old strategy if exists
        if (oldStrategy != address(0)) {
            uint balance = _getStrategyBalance();
            if (balance > 0) {
                _withdrawFromStrategy(balance);
            }
        }

        yieldStrategy = strategy_;

        // Deposit to new strategy
        if (strategy_ != address(0) && address(this).balance > 0) {
            _depositToStrategy(address(this).balance);
        }

        emit StrategyUpdated(oldStrategy, strategy_);
    }

    /**
     * @notice Update treasury address
     */
    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "Invalid treasury");
        treasury = treasury_;
    }

    // ============ Internal Functions ============

    function _depositToStrategy(uint amount) internal {
        // In production: deposit to Aave V3
        // Simplified placeholder
        // IAavePool(AAVE_V3_POOL).supply(WETH, amount, address(this), 0);
    }

    function _withdrawFromStrategy(uint amount) internal {
        // In production: withdraw from Aave V3
        // Simplified placeholder
        // IAavePool(AAVE_V3_POOL).withdraw(WETH, amount, address(this));
    }

    function _getStrategyBalance() internal view returns (uint) {
        // In production: get aToken balance
        // Simplified: return deposited amount
        return totalDeposited;
    }

    // ============ Receive ETH ============

    receive() external payable {
        // Auto-deposit when receiving ETH
        if (msg.value >= MIN_DEPOSIT) {
            totalDeposited += msg.value;
            _mint(msg.sender, msg.value);
            
            if (yieldStrategy != address(0)) {
                _depositToStrategy(msg.value);
            }
        }
    }
}
