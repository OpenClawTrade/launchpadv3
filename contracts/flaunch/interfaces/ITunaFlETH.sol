// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ITunaFlETH {
    /**
     * @notice Deposit ETH and receive flETH
     */
    function deposit() external payable returns (uint flethAmount);

    /**
     * @notice Deposit ETH for another address
     */
    function depositFor(address recipient) external payable returns (uint flethAmount);

    /**
     * @notice Redeem flETH for ETH
     */
    function withdraw(uint flethAmount) external returns (uint ethAmount);

    /**
     * @notice Harvest yield to treasury
     */
    function harvestYield() external returns (uint yieldAmount);

    /**
     * @notice Get current APY
     */
    function getCurrentAPY() external view returns (uint);

    /**
     * @notice Get total value locked
     */
    function getTotalValueLocked() external view returns (uint);

    /**
     * @notice Get pending yield
     */
    function getPendingYield() external view returns (uint);
}
