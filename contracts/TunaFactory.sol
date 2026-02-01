// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./TunaToken.sol";
import "./TunaFeeVault.sol";
import "./TunaBidWall.sol";

/**
 * @title TunaFactory
 * @notice Factory contract for creating meme tokens on Base
 * @dev Based on Flaunch's Flaunch.sol and PositionManager.sol
 * 
 * Key features (mirroring Flaunch):
 * - Creates ERC20 tokens with fixed 1B supply
 * - Mints NFT representing ownership of fee stream (transferable)
 * - Configurable creator fee split (0-100%)
 * - Fair launch with fixed price period
 * - Auto-buyback system (BidWall equivalent)
 */
contract TunaFactory is ERC721, Ownable, ReentrancyGuard {
    
    // ============ State Variables ============
    
    /// @notice Counter for token IDs (also used as NFT token IDs)
    uint256 public tokenCount;
    
    /// @notice Fee vault contract for handling creator payouts
    TunaFeeVault public feeVault;
    
    /// @notice BidWall contract for auto-buybacks
    TunaBidWall public bidWall;
    
    /// @notice Uniswap V3 Router address on Base
    address public constant UNISWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    
    /// @notice WETH address on Base
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    
    /// @notice Platform fee wallet
    address public platformWallet;
    
    /// @notice Launch fee in ETH (paid by creator)
    uint256 public launchFee = 0.001 ether;
    
    /// @notice Trading fee in basis points (100 = 1%)
    uint256 public constant TRADING_FEE_BPS = 100; // 1% like Flaunch
    
    // ============ Token Data ============
    
    struct TokenInfo {
        address tokenAddress;
        address poolAddress;
        address creator;
        uint256 creatorFeeBps;    // 0-10000 (0-100%)
        uint256 fairLaunchEnd;    // Timestamp when fair launch ends
        uint256 fairLaunchPrice;  // Fixed price during fair launch
        uint256 totalFeesEarned;  // Total fees earned by this token
        bool isActive;
    }
    
    /// @notice Mapping from token ID to token info
    mapping(uint256 => TokenInfo) public tokens;
    
    /// @notice Mapping from token address to token ID
    mapping(address => uint256) public tokenIdByAddress;
    
    // ============ Events ============
    
    event TokenCreated(
        uint256 indexed tokenId,
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 creatorFeeBps,
        uint256 fairLaunchDuration
    );
    
    event PoolCreated(
        uint256 indexed tokenId,
        address indexed poolAddress,
        uint256 initialLiquidity
    );
    
    event FeesDistributed(
        uint256 indexed tokenId,
        uint256 creatorAmount,
        uint256 buybackAmount
    );
    
    event CreatorFeesClaimed(
        uint256 indexed tokenId,
        address indexed creator,
        uint256 amount
    );
    
    // ============ Constructor ============
    
    constructor(
        address platformWallet_,
        address feeVault_,
        address bidWall_
    ) ERC721("Tuna Memestreams", "TUNA") Ownable(msg.sender) {
        platformWallet = platformWallet_;
        feeVault = TunaFeeVault(feeVault_);
        bidWall = TunaBidWall(bidWall_);
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Create a new meme token with liquidity pool
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param description_ Token description
     * @param imageUrl_ Token image URL
     * @param creatorFeeBps_ Creator's share of trading fees (0-10000)
     * @param fairLaunchDuration_ Duration of fair launch in seconds (0 to disable)
     * @return tokenId The ID of the created token (also the NFT ID)
     */
    function createToken(
        string memory name_,
        string memory symbol_,
        string memory description_,
        string memory imageUrl_,
        uint256 creatorFeeBps_,
        uint256 fairLaunchDuration_
    ) external payable nonReentrant returns (uint256 tokenId) {
        require(msg.value >= launchFee, "Insufficient launch fee");
        require(creatorFeeBps_ <= 10000, "Creator fee too high");
        require(bytes(name_).length > 0, "Name required");
        require(bytes(symbol_).length > 0, "Symbol required");
        
        // Increment token ID
        tokenId = ++tokenCount;
        
        // Create the ERC20 token
        TunaToken token = new TunaToken(
            name_,
            symbol_,
            description_,
            imageUrl_,
            address(this) // Factory is initial owner
        );
        
        address tokenAddress = address(token);
        
        // Store token info
        tokens[tokenId] = TokenInfo({
            tokenAddress: tokenAddress,
            poolAddress: address(0), // Set after pool creation
            creator: msg.sender,
            creatorFeeBps: creatorFeeBps_,
            fairLaunchEnd: fairLaunchDuration_ > 0 
                ? block.timestamp + fairLaunchDuration_ 
                : 0,
            fairLaunchPrice: 0, // Set during pool creation
            totalFeesEarned: 0,
            isActive: true
        });
        
        tokenIdByAddress[tokenAddress] = tokenId;
        
        // Mint NFT to creator (represents ownership of fee stream)
        _mint(msg.sender, tokenId);
        
        // Transfer launch fee to platform
        if (launchFee > 0) {
            (bool success, ) = platformWallet.call{value: launchFee}("");
            require(success, "Fee transfer failed");
        }
        
        // Refund excess ETH
        uint256 excess = msg.value - launchFee;
        if (excess > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: excess}("");
            require(refundSuccess, "Refund failed");
        }
        
        emit TokenCreated(
            tokenId,
            tokenAddress,
            msg.sender,
            name_,
            symbol_,
            creatorFeeBps_,
            fairLaunchDuration_
        );
        
        return tokenId;
    }
    
    /**
     * @notice Add initial liquidity for a token
     * @param tokenId_ The token ID
     * @dev Called after createToken to add ETH/token liquidity
     */
    function addLiquidity(uint256 tokenId_) external payable nonReentrant {
        require(msg.value > 0, "ETH required for liquidity");
        TokenInfo storage info = tokens[tokenId_];
        require(info.tokenAddress != address(0), "Token not found");
        require(info.poolAddress == address(0), "Pool already exists");
        require(ownerOf(tokenId_) == msg.sender, "Not token owner");
        
        // TODO: Create Uniswap V3 pool and add liquidity
        // This requires integration with Uniswap V3 contracts
        // For now, store the pool address placeholder
        
        info.poolAddress = address(0x1); // Placeholder
        
        emit PoolCreated(tokenId_, info.poolAddress, msg.value);
    }
    
    /**
     * @notice Distribute trading fees for a token
     * @param tokenId_ The token ID
     * @param feeAmount_ The fee amount in ETH
     * @dev Called by the fee hook on each swap
     */
    function distributeFees(uint256 tokenId_, uint256 feeAmount_) external payable {
        TokenInfo storage info = tokens[tokenId_];
        require(info.isActive, "Token not active");
        require(msg.value == feeAmount_, "Fee mismatch");
        
        info.totalFeesEarned += feeAmount_;
        
        // Calculate split
        uint256 creatorAmount = (feeAmount_ * info.creatorFeeBps) / 10000;
        uint256 buybackAmount = feeAmount_ - creatorAmount;
        
        // Send creator share to vault
        if (creatorAmount > 0) {
            feeVault.deposit{value: creatorAmount}(tokenId_, ownerOf(tokenId_));
        }
        
        // Send buyback share to bid wall
        if (buybackAmount > 0) {
            bidWall.deposit{value: buybackAmount}(tokenId_, info.tokenAddress);
        }
        
        emit FeesDistributed(tokenId_, creatorAmount, buybackAmount);
    }
    
    /**
     * @notice Claim accumulated creator fees
     * @param tokenId_ The token ID
     */
    function claimFees(uint256 tokenId_) external nonReentrant {
        require(ownerOf(tokenId_) == msg.sender, "Not token owner");
        
        uint256 claimed = feeVault.claim(tokenId_, msg.sender);
        
        emit CreatorFeesClaimed(tokenId_, msg.sender, claimed);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get token info
     */
    function getTokenInfo(uint256 tokenId_) external view returns (TokenInfo memory) {
        return tokens[tokenId_];
    }
    
    /**
     * @notice Check if token is in fair launch period
     */
    function isInFairLaunch(uint256 tokenId_) external view returns (bool) {
        TokenInfo storage info = tokens[tokenId_];
        return info.fairLaunchEnd > 0 && block.timestamp < info.fairLaunchEnd;
    }
    
    /**
     * @notice Get unclaimed fees for a token
     */
    function getUnclaimedFees(uint256 tokenId_) external view returns (uint256) {
        return feeVault.getBalance(tokenId_);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set the launch fee
     */
    function setLaunchFee(uint256 fee_) external onlyOwner {
        launchFee = fee_;
    }
    
    /**
     * @notice Set the platform wallet
     */
    function setPlatformWallet(address wallet_) external onlyOwner {
        require(wallet_ != address(0), "Invalid wallet");
        platformWallet = wallet_;
    }
    
    /**
     * @notice Set the fee vault
     */
    function setFeeVault(address vault_) external onlyOwner {
        feeVault = TunaFeeVault(vault_);
    }
    
    /**
     * @notice Set the bid wall
     */
    function setBidWall(address bidWall_) external onlyOwner {
        bidWall = TunaBidWall(bidWall_);
    }
    
    // ============ NFT Metadata ============
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        TokenInfo storage info = tokens[tokenId];
        
        // Return metadata about the token
        return string(abi.encodePacked(
            "data:application/json,{",
            '"name":"Tuna Stream #', _toString(tokenId), '",',
            '"description":"Fee stream for ', TunaToken(info.tokenAddress).name(), '",',
            '"image":"', TunaToken(info.tokenAddress).imageUrl(), '"',
            "}"
        ));
    }
    
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
