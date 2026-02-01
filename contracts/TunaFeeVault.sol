// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TunaFeeVault
 * @notice Vault for storing and distributing creator fees
 * @dev Based on Flaunch's MemecoinTreasury contract
 * 
 * Stores ETH fees for each token that creators can claim.
 * Only the factory can deposit, only the current NFT owner can claim.
 */
contract TunaFeeVault is Ownable, ReentrancyGuard {
    
    // ============ State Variables ============
    
    /// @notice Factory contract address
    address public factory;
    
    /// @notice Mapping from token ID to accumulated fees
    mapping(uint256 => uint256) public balances;
    
    /// @notice Mapping from token ID to total claimed
    mapping(uint256 => uint256) public totalClaimed;
    
    // ============ Events ============
    
    event Deposited(uint256 indexed tokenId, address indexed creator, uint256 amount);
    event Claimed(uint256 indexed tokenId, address indexed creator, uint256 amount);
    
    // ============ Constructor ============
    
    constructor() Ownable(msg.sender) {}
    
    // ============ Modifiers ============
    
    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Deposit fees for a token
     * @param tokenId_ The token ID
     * @param creator_ The current creator (NFT owner)
     */
    function deposit(uint256 tokenId_, address creator_) external payable onlyFactory {
        require(msg.value > 0, "No value");
        
        balances[tokenId_] += msg.value;
        
        emit Deposited(tokenId_, creator_, msg.value);
    }
    
    /**
     * @notice Claim accumulated fees
     * @param tokenId_ The token ID
     * @param recipient_ The recipient address (must be NFT owner)
     * @return amount The amount claimed
     */
    function claim(uint256 tokenId_, address recipient_) external onlyFactory nonReentrant returns (uint256 amount) {
        amount = balances[tokenId_];
        require(amount > 0, "Nothing to claim");
        
        balances[tokenId_] = 0;
        totalClaimed[tokenId_] += amount;
        
        (bool success, ) = recipient_.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Claimed(tokenId_, recipient_, amount);
        
        return amount;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get claimable balance for a token
     */
    function getBalance(uint256 tokenId_) external view returns (uint256) {
        return balances[tokenId_];
    }
    
    /**
     * @notice Get total claimed for a token
     */
    function getTotalClaimed(uint256 tokenId_) external view returns (uint256) {
        return totalClaimed[tokenId_];
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
