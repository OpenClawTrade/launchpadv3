// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPositionManager} from "./IPositionManager.sol";

interface ITunaFlaunch {
    /**
     * @notice Token info struct
     */
    struct TokenInfo {
        address memecoin;
        address payable treasury;
    }

    /**
     * @notice Flaunch a new token
     * @param params The flaunch parameters
     * @return memecoin The deployed memecoin address
     * @return treasury The deployed treasury address
     * @return tokenId The minted NFT token ID
     */
    function flaunch(
        IPositionManager.FlaunchParams calldata params
    ) external returns (
        address memecoin,
        address payable treasury,
        uint tokenId
    );

    /**
     * @notice Get memecoin address for token ID
     */
    function memecoin(uint tokenId) external view returns (address);

    /**
     * @notice Get treasury address for token ID
     */
    function treasury(uint tokenId) external view returns (address payable);

    /**
     * @notice Get token ID by memecoin address
     */
    function tokenIdByMemecoin(address memecoin) external view returns (uint);

    /**
     * @notice Next token ID to be minted
     */
    function nextTokenId() external view returns (uint);
}
