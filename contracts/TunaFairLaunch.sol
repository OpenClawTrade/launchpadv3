// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TunaFairLaunch
 * @notice Fair launch mechanism with fixed price period
 * @dev Based on Flaunch's FairLaunch contract
 * 
 * During fair launch period:
 * - Fixed price (no price impact from buys)
 * - Limited supply available (e.g., 10% of total)
 * - No sells allowed
 * - CAPTCHA verification (handled off-chain)
 * - Anti-sniper protection
 */
contract TunaFairLaunch is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Structs ============
    
    struct FairLaunchInfo {
        address tokenAddress;
        uint256 startTime;
        uint256 endTime;
        uint256 fixedPrice;           // Price in ETH per token (18 decimals)
        uint256 supplyForSale;        // Tokens available for sale
        uint256 soldAmount;           // Tokens sold so far
        uint256 maxPerWallet;         // Max tokens per wallet
        bool isActive;
    }
    
    // ============ State Variables ============
    
    /// @notice Factory contract address
    address public factory;
    
    /// @notice Fair launch info per token ID
    mapping(uint256 => FairLaunchInfo) public fairLaunches;
    
    /// @notice Amount bought per wallet per token
    mapping(uint256 => mapping(address => uint256)) public purchased;
    
    /// @notice Verified wallets (CAPTCHA passed)
    mapping(address => bool) public verifiedWallets;
    
    /// @notice Verifier address (can mark wallets as verified)
    address public verifier;
    
    // ============ Events ============
    
    event FairLaunchCreated(
        uint256 indexed tokenId,
        address indexed token,
        uint256 startTime,
        uint256 endTime,
        uint256 fixedPrice,
        uint256 supply
    );
    
    event TokensPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amount,
        uint256 ethPaid
    );
    
    event FairLaunchEnded(uint256 indexed tokenId, uint256 totalSold);
    
    event WalletVerified(address indexed wallet);
    
    // ============ Constructor ============
    
    constructor() Ownable(msg.sender) {
        verifier = msg.sender;
    }
    
    // ============ Modifiers ============
    
    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }
    
    modifier onlyVerifier() {
        require(msg.sender == verifier, "Only verifier");
        _;
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Create a fair launch for a token
     * @param tokenId_ The token ID
     * @param tokenAddress_ The token contract address
     * @param duration_ Duration in seconds
     * @param fixedPrice_ Fixed price per token (in wei per token)
     * @param supplyPercent_ Percentage of supply for sale (e.g., 10 = 10%)
     * @param maxPerWalletPercent_ Max per wallet as percentage of sale supply
     */
    function createFairLaunch(
        uint256 tokenId_,
        address tokenAddress_,
        uint256 duration_,
        uint256 fixedPrice_,
        uint256 supplyPercent_,
        uint256 maxPerWalletPercent_
    ) external onlyFactory {
        require(duration_ >= 5 minutes, "Min 5 minutes");
        require(duration_ <= 30 minutes, "Max 30 minutes");
        require(supplyPercent_ >= 5 && supplyPercent_ <= 20, "Supply 5-20%");
        
        uint256 totalSupply = IERC20(tokenAddress_).totalSupply();
        uint256 supplyForSale = (totalSupply * supplyPercent_) / 100;
        uint256 maxPerWallet = (supplyForSale * maxPerWalletPercent_) / 100;
        
        fairLaunches[tokenId_] = FairLaunchInfo({
            tokenAddress: tokenAddress_,
            startTime: block.timestamp,
            endTime: block.timestamp + duration_,
            fixedPrice: fixedPrice_,
            supplyForSale: supplyForSale,
            soldAmount: 0,
            maxPerWallet: maxPerWallet,
            isActive: true
        });
        
        emit FairLaunchCreated(
            tokenId_,
            tokenAddress_,
            block.timestamp,
            block.timestamp + duration_,
            fixedPrice_,
            supplyForSale
        );
    }
    
    /**
     * @notice Buy tokens during fair launch
     * @param tokenId_ The token ID
     * @param amount_ Amount of tokens to buy
     */
    function buy(uint256 tokenId_, uint256 amount_) external payable nonReentrant {
        FairLaunchInfo storage info = fairLaunches[tokenId_];
        
        require(info.isActive, "Not active");
        require(block.timestamp >= info.startTime, "Not started");
        require(block.timestamp < info.endTime, "Ended");
        require(verifiedWallets[msg.sender], "Not verified");
        
        require(info.soldAmount + amount_ <= info.supplyForSale, "Exceeds supply");
        require(purchased[tokenId_][msg.sender] + amount_ <= info.maxPerWallet, "Exceeds limit");
        
        uint256 cost = (amount_ * info.fixedPrice) / 1e18;
        require(msg.value >= cost, "Insufficient ETH");
        
        // Update state
        info.soldAmount += amount_;
        purchased[tokenId_][msg.sender] += amount_;
        
        // Transfer tokens
        IERC20(info.tokenAddress).safeTransfer(msg.sender, amount_);
        
        // Refund excess
        if (msg.value > cost) {
            (bool success, ) = msg.sender.call{value: msg.value - cost}("");
            require(success, "Refund failed");
        }
        
        emit TokensPurchased(tokenId_, msg.sender, amount_, cost);
    }
    
    /**
     * @notice End fair launch early (if sold out)
     * @param tokenId_ The token ID
     */
    function endFairLaunch(uint256 tokenId_) external {
        FairLaunchInfo storage info = fairLaunches[tokenId_];
        
        require(info.isActive, "Not active");
        require(
            block.timestamp >= info.endTime || info.soldAmount >= info.supplyForSale,
            "Cannot end yet"
        );
        
        info.isActive = false;
        
        emit FairLaunchEnded(tokenId_, info.soldAmount);
    }
    
    /**
     * @notice Verify a wallet (CAPTCHA passed)
     * @param wallet_ The wallet to verify
     */
    function verifyWallet(address wallet_) external onlyVerifier {
        verifiedWallets[wallet_] = true;
        emit WalletVerified(wallet_);
    }
    
    /**
     * @notice Batch verify wallets
     * @param wallets_ Array of wallets to verify
     */
    function batchVerifyWallets(address[] calldata wallets_) external onlyVerifier {
        for (uint256 i = 0; i < wallets_.length; i++) {
            verifiedWallets[wallets_[i]] = true;
            emit WalletVerified(wallets_[i]);
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get fair launch info
     */
    function getFairLaunchInfo(uint256 tokenId_) external view returns (FairLaunchInfo memory) {
        return fairLaunches[tokenId_];
    }
    
    /**
     * @notice Check if fair launch is active
     */
    function isActive(uint256 tokenId_) external view returns (bool) {
        FairLaunchInfo storage info = fairLaunches[tokenId_];
        return info.isActive && 
               block.timestamp >= info.startTime && 
               block.timestamp < info.endTime;
    }
    
    /**
     * @notice Get remaining supply
     */
    function getRemainingSupply(uint256 tokenId_) external view returns (uint256) {
        FairLaunchInfo storage info = fairLaunches[tokenId_];
        return info.supplyForSale - info.soldAmount;
    }
    
    /**
     * @notice Get remaining allowance for a wallet
     */
    function getRemainingAllowance(uint256 tokenId_, address wallet_) external view returns (uint256) {
        FairLaunchInfo storage info = fairLaunches[tokenId_];
        return info.maxPerWallet - purchased[tokenId_][wallet_];
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
     * @notice Set the verifier address
     */
    function setVerifier(address verifier_) external onlyOwner {
        require(verifier_ != address(0), "Invalid verifier");
        verifier = verifier_;
    }
    
    /**
     * @notice Withdraw accumulated ETH to factory
     */
    function withdrawToFactory() external onlyFactory {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        
        (bool success, ) = factory.call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    // ============ Receive ============
    
    receive() external payable {}
}
