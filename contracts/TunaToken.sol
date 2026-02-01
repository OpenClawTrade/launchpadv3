// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TunaToken
 * @notice ERC20 token created by TunaFactory for Base chain launches
 * @dev Based on Flaunch's Memecoin contract - simple ERC20 with burn capability
 */
contract TunaToken is ERC20, ERC20Burnable, Ownable {
    string private _tokenURI;
    
    /// @notice Total supply is fixed at 1 billion tokens (with 18 decimals)
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;
    
    /// @notice Token metadata
    string public description;
    string public imageUrl;
    string public websiteUrl;
    string public twitterUrl;
    string public telegramUrl;
    
    constructor(
        string memory name_,
        string memory symbol_,
        string memory description_,
        string memory imageUrl_,
        address creator_
    ) ERC20(name_, symbol_) Ownable(creator_) {
        description = description_;
        imageUrl = imageUrl_;
        
        // Mint total supply to the factory (which will add to LP)
        _mint(msg.sender, TOTAL_SUPPLY);
    }
    
    /// @notice Set social links (can only be called by owner)
    function setSocialLinks(
        string memory website_,
        string memory twitter_,
        string memory telegram_
    ) external onlyOwner {
        websiteUrl = website_;
        twitterUrl = twitter_;
        telegramUrl = telegram_;
    }
    
    /// @notice Set token URI for metadata
    function setTokenURI(string memory tokenURI_) external onlyOwner {
        _tokenURI = tokenURI_;
    }
    
    /// @notice Get token URI
    function tokenURI() external view returns (string memory) {
        return _tokenURI;
    }
}
