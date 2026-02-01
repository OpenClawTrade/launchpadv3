// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TunaBidWall
 * @notice Progressive Bid Wall for automatic buybacks
 * @dev Based on Flaunch's BidWall contract
 * 
 * Accumulates community fee share and executes automatic buybacks
 * when threshold is reached. Bought tokens are burned.
 * 
 * How it works (like Flaunch):
 * 1. Community fee share accumulates in this contract
 * 2. When accumulated amount >= threshold, place limit order below spot
 * 3. When price hits the order, tokens are bought
 * 4. Bought tokens are burned (deflationary)
 */
contract TunaBidWall is Ownable, ReentrancyGuard {
    
    // ============ Constants ============
    
    /// @notice Threshold to trigger buyback (0.05 ETH like Flaunch)
    uint256 public constant BUYBACK_THRESHOLD = 0.05 ether;
    
    /// @notice Uniswap V3 Router on Base
    address public constant UNISWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    
    /// @notice WETH on Base
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    
    // ============ State Variables ============
    
    /// @notice Factory contract address
    address public factory;
    
    /// @notice Accumulated ETH per token
    mapping(uint256 => uint256) public accumulatedEth;
    
    /// @notice Token address per token ID
    mapping(uint256 => address) public tokenAddresses;
    
    /// @notice Total tokens bought back per token ID
    mapping(uint256 => uint256) public totalBoughtBack;
    
    /// @notice Total tokens burned per token ID  
    mapping(uint256 => uint256) public totalBurned;
    
    /// @notice Buyback count per token ID
    mapping(uint256 => uint256) public buybackCount;
    
    // ============ Events ============
    
    event Deposited(uint256 indexed tokenId, address indexed token, uint256 amount);
    event BuybackExecuted(uint256 indexed tokenId, uint256 ethSpent, uint256 tokensBought);
    event TokensBurned(uint256 indexed tokenId, uint256 amount);
    
    // ============ Constructor ============
    
    constructor() Ownable(msg.sender) {}
    
    // ============ Modifiers ============
    
    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Deposit ETH for buybacks
     * @param tokenId_ The token ID
     * @param tokenAddress_ The token contract address
     */
    function deposit(uint256 tokenId_, address tokenAddress_) external payable onlyFactory {
        require(msg.value > 0, "No value");
        
        accumulatedEth[tokenId_] += msg.value;
        tokenAddresses[tokenId_] = tokenAddress_;
        
        emit Deposited(tokenId_, tokenAddress_, msg.value);
        
        // Auto-execute buyback if threshold reached
        if (accumulatedEth[tokenId_] >= BUYBACK_THRESHOLD) {
            _executeBuyback(tokenId_);
        }
    }
    
    /**
     * @notice Manually trigger buyback (if automated didn't work)
     * @param tokenId_ The token ID
     */
    function triggerBuyback(uint256 tokenId_) external nonReentrant {
        require(accumulatedEth[tokenId_] >= BUYBACK_THRESHOLD, "Below threshold");
        _executeBuyback(tokenId_);
    }
    
    /**
     * @notice Internal buyback execution
     * @param tokenId_ The token ID
     */
    function _executeBuyback(uint256 tokenId_) internal {
        uint256 ethAmount = accumulatedEth[tokenId_];
        address tokenAddress = tokenAddresses[tokenId_];
        
        require(ethAmount > 0, "No ETH to spend");
        require(tokenAddress != address(0), "Token not set");
        
        // Reset accumulator
        accumulatedEth[tokenId_] = 0;
        buybackCount[tokenId_]++;
        
        // TODO: Execute swap on Uniswap V3
        // For now, we'll emit the event with placeholder values
        // In production, this would:
        // 1. Get current spot price
        // 2. Place limit order at 99% of spot (1% below)
        // 3. Execute immediately if possible
        // 4. Burn received tokens
        
        uint256 tokensBought = 0; // Placeholder
        
        totalBoughtBack[tokenId_] += tokensBought;
        
        emit BuybackExecuted(tokenId_, ethAmount, tokensBought);
        
        // Burn tokens
        if (tokensBought > 0) {
            _burnTokens(tokenId_, tokensBought);
        }
    }
    
    /**
     * @notice Burn bought tokens
     * @param tokenId_ The token ID
     * @param amount_ Amount to burn
     */
    function _burnTokens(uint256 tokenId_, uint256 amount_) internal {
        address tokenAddress = tokenAddresses[tokenId_];
        
        // Transfer to dead address (burn)
        IERC20(tokenAddress).transfer(address(0xdead), amount_);
        
        totalBurned[tokenId_] += amount_;
        
        emit TokensBurned(tokenId_, amount_);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get accumulated ETH for a token
     */
    function getAccumulatedEth(uint256 tokenId_) external view returns (uint256) {
        return accumulatedEth[tokenId_];
    }
    
    /**
     * @notice Get buyback stats for a token
     */
    function getBuybackStats(uint256 tokenId_) external view returns (
        uint256 accumulated,
        uint256 bought,
        uint256 burned,
        uint256 count
    ) {
        return (
            accumulatedEth[tokenId_],
            totalBoughtBack[tokenId_],
            totalBurned[tokenId_],
            buybackCount[tokenId_]
        );
    }
    
    /**
     * @notice Check if buyback can be triggered
     */
    function canTriggerBuyback(uint256 tokenId_) external view returns (bool) {
        return accumulatedEth[tokenId_] >= BUYBACK_THRESHOLD;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set the factory address
     */
    function setFactory(address factory_) external onlyOwner {
        require(factory_ != address(0), "Invalid factory");
        factory = factory_;
    }
    
    /**
     * @notice Emergency withdraw (only owner, for stuck funds)
     */
    function emergencyWithdraw(address recipient_) external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        
        (bool success, ) = recipient_.call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    // ============ Receive ============
    
    receive() external payable {}
}
