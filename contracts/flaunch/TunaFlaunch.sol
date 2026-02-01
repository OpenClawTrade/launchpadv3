// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {IPositionManager} from "./interfaces/IPositionManager.sol";
import {ITunaMemecoin} from "./interfaces/ITunaMemecoin.sol";
import {TunaMemecoin} from "./TunaMemecoin.sol";

/**
 * @title TunaFlaunch
 * @notice ERC721 NFT representing ownership of a token's fee stream (Flaunch.gg replica)
 * @dev When a new position is flaunched by PositionManager, this NFT is minted to the creator.
 *      Transferring this NFT transfers ownership of the fee stream to the new holder.
 */
contract TunaFlaunch is ERC721, Ownable {
    using Strings for uint256;

    error CallerIsNotPositionManager();
    error CreatorFeeAllocationInvalid(uint24 allocation, uint maxAllocation);
    error InvalidFlaunchSchedule();
    error InvalidInitialSupply(uint initialSupply);
    error PremineExceedsInitialAmount(uint buyAmount, uint initialSupply);

    event BaseURIUpdated(string newBaseURI);
    event MemecoinImplementationUpdated(address newImplementation);
    event TreasuryImplementationUpdated(address newImplementation);

    /// @notice Token info for each minted NFT
    struct TokenInfo {
        address memecoin;
        address payable treasury;
    }

    /// @notice Maximum tokens that can be put in fair launch (100% of supply)
    uint public constant MAX_FAIR_LAUNCH_TOKENS = 1_000_000_000 ether;

    /// @notice Maximum creator fee allocation (100.00%)
    uint public constant MAX_CREATOR_ALLOCATION = 100_00;

    /// @notice Maximum schedule duration for delayed launch
    uint public constant MAX_SCHEDULE_DURATION = 30 days;

    /// @notice Base URI for token metadata
    string public baseURI;

    /// @notice Next token ID to be minted
    uint public nextTokenId = 1;

    /// @notice The PositionManager contract
    IPositionManager public positionManager;

    /// @notice Memecoin implementation for cloning
    address public memecoinImplementation;

    /// @notice Treasury implementation for cloning  
    address public treasuryImplementation;

    /// @notice Token info mapping
    mapping(uint tokenId => TokenInfo info) internal _tokenInfo;

    /// @notice Memecoin address to token ID mapping
    mapping(address memecoin => uint tokenId) public tokenIdByMemecoin;

    constructor(string memory baseURI_) 
        ERC721("Tuna Revenue Streams", "TUNA-STREAM") 
        Ownable(msg.sender) 
    {
        baseURI = baseURI_;
    }

    /**
     * @notice Initialize with PositionManager and implementations
     * @param positionManager_ The PositionManager contract
     * @param memecoinImpl_ Memecoin implementation address
     * @param treasuryImpl_ Treasury implementation address
     */
    function initialize(
        IPositionManager positionManager_,
        address memecoinImpl_,
        address treasuryImpl_
    ) external onlyOwner {
        positionManager = positionManager_;
        memecoinImplementation = memecoinImpl_;
        treasuryImplementation = treasuryImpl_;
    }

    /**
     * @notice Flaunch a new token - called by PositionManager
     * @return memecoin_ The deployed memecoin address
     * @return treasury_ The deployed treasury address
     * @return tokenId_ The minted NFT token ID
     */
    function flaunch(
        IPositionManager.FlaunchParams calldata params
    ) external onlyPositionManager returns (
        address memecoin_,
        address payable treasury_,
        uint tokenId_
    ) {
        // Validate schedule
        if (params.flaunchAt > block.timestamp + MAX_SCHEDULE_DURATION) {
            revert InvalidFlaunchSchedule();
        }

        // Validate initial supply
        if (params.initialTokenFairLaunch > MAX_FAIR_LAUNCH_TOKENS) {
            revert InvalidInitialSupply(params.initialTokenFairLaunch);
        }

        // Validate premine
        if (params.premineAmount > params.initialTokenFairLaunch) {
            revert PremineExceedsInitialAmount(params.premineAmount, params.initialTokenFairLaunch);
        }

        // Validate creator fee
        if (params.creatorFeeAllocation > MAX_CREATOR_ALLOCATION) {
            revert CreatorFeeAllocationInvalid(params.creatorFeeAllocation, MAX_CREATOR_ALLOCATION);
        }

        // Store token ID and increment
        tokenId_ = nextTokenId;
        unchecked { nextTokenId++; }

        // Mint ownership NFT to creator
        _mint(params.creator, tokenId_);

        // Deploy memecoin (using create2 for deterministic address)
        bytes32 salt = bytes32(tokenId_);
        memecoin_ = address(new TunaMemecoin{salt: salt}(
            params.name,
            params.symbol,
            params.tokenUri,
            address(positionManager)
        ));

        // Store token ID mapping
        tokenIdByMemecoin[memecoin_] = tokenId_;

        // Deploy treasury
        // Note: In production, this would clone the treasury implementation
        treasury_ = payable(address(0)); // Placeholder for treasury deployment

        // Store token info
        _tokenInfo[tokenId_] = TokenInfo({
            memecoin: memecoin_,
            treasury: treasury_
        });

        // Mint initial supply to PositionManager
        ITunaMemecoin(memecoin_).mint(address(positionManager), MAX_FAIR_LAUNCH_TOKENS);
    }

    /**
     * @notice Get memecoin address for token ID
     */
    function memecoin(uint tokenId_) public view returns (address) {
        return _tokenInfo[tokenId_].memecoin;
    }

    /**
     * @notice Get treasury address for token ID
     */
    function treasury(uint tokenId_) public view returns (address payable) {
        return _tokenInfo[tokenId_].treasury;
    }

    /**
     * @notice Update base URI
     */
    function setBaseURI(string memory baseURI_) external onlyOwner {
        baseURI = baseURI_;
        emit BaseURIUpdated(baseURI_);
    }

    /**
     * @notice Token URI for metadata
     */
    function tokenURI(uint256 tokenId_) public view override returns (string memory) {
        _requireOwned(tokenId_);
        
        if (bytes(baseURI).length == 0) {
            return ITunaMemecoin(_tokenInfo[tokenId_].memecoin).tokenURI();
        }
        
        return string(abi.encodePacked(baseURI, tokenId_.toString()));
    }

    /**
     * @notice Burn token
     */
    function burn(uint tokenId_) external {
        require(ownerOf(tokenId_) == msg.sender, "Not token owner");
        _burn(tokenId_);
    }

    modifier onlyPositionManager() {
        if (msg.sender != address(positionManager)) {
            revert CallerIsNotPositionManager();
        }
        _;
    }
}
