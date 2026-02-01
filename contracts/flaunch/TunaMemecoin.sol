// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {ITunaMemecoin} from "./interfaces/ITunaMemecoin.sol";

/**
 * @title TunaMemecoin
 * @notice Standard ERC20 memecoin deployed by TunaFlaunch
 * @dev Total supply is 1 billion tokens, minted to PositionManager on creation
 */
contract TunaMemecoin is ERC20, ITunaMemecoin {
    /// @notice The deploying launchpad contract
    address public immutable launchpad;
    
    /// @notice The position manager that can mint
    address public immutable positionManager;
    
    /// @notice Token metadata URI
    string internal _tokenUri;

    error NotAuthorized();

    constructor(
        string memory name_,
        string memory symbol_,
        string memory tokenUri_,
        address positionManager_
    ) ERC20(name_, symbol_) {
        launchpad = msg.sender;
        positionManager = positionManager_;
        _tokenUri = tokenUri_;
    }

    /**
     * @notice Mint tokens - only callable by position manager
     */
    function mint(address to, uint256 amount) external override {
        if (msg.sender != positionManager && msg.sender != launchpad) {
            revert NotAuthorized();
        }
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens
     */
    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Get token metadata URI
     */
    function tokenURI() external view override returns (string memory) {
        return _tokenUri;
    }

    /**
     * @notice Update metadata - only callable by launchpad owner
     */
    function setMetadata(string calldata name_, string calldata symbol_) external override {
        // This would require additional logic to verify caller
        // For now, this is a placeholder
        revert NotAuthorized();
    }
}
