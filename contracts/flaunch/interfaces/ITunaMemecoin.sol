// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ITunaMemecoin {
    /**
     * @notice Mint tokens
     */
    function mint(address to, uint256 amount) external;

    /**
     * @notice Burn tokens
     */
    function burn(uint256 amount) external;

    /**
     * @notice Get token metadata URI
     */
    function tokenURI() external view returns (string memory);

    /**
     * @notice Update metadata
     */
    function setMetadata(string calldata name, string calldata symbol) external;
}
