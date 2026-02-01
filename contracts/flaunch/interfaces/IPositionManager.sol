// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IPositionManager {
    /**
     * @notice Parameters for flaunching a new token
     */
    struct FlaunchParams {
        string name;                    // Token name
        string symbol;                  // Token symbol
        string tokenUri;                // Metadata URI
        uint initialTokenFairLaunch;    // Tokens for fair launch (0 = no fair launch)
        uint fairLaunchDuration;        // Duration in seconds
        uint premineAmount;             // Creator's premine amount
        address creator;                // Creator address (receives NFT)
        uint24 creatorFeeAllocation;    // Creator's fee share (0-10000 = 0-100%)
        uint flaunchAt;                 // Scheduled launch timestamp (0 = immediate)
        bytes initialPriceParams;       // Initial price configuration
        bytes feeCalculatorParams;      // Fee calculator configuration
    }

    /**
     * @notice Flaunch a new memecoin with automatic pool creation
     * @param params The flaunch parameters
     * @return memecoin The deployed memecoin address
     */
    function flaunch(FlaunchParams calldata params) external payable returns (address memecoin);

    /**
     * @notice Get the flaunch fee for given params
     */
    function getFlaunchingFee(bytes calldata initialPriceParams) external view returns (uint);
}
