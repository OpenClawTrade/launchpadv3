// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Verbatim port of Klik Token (Etherscan-verified, factory 0xDE60..ca655).
// Only branding strings changed.

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PopKlikToken is ERC20, ERC20Burnable {
    address public platform;
    address public creator;
    address private _owner;
    uint256 private launchBlock;
    uint256 private maxTxAmount;
    uint256 private constant LAUNCH_PERIOD = 3;
    uint256 private constant MAX_WALLET_PERCENTAGE = 2; // 2% of total supply

    address immutable pool = 0x000000000004444c5dc75cB358380D2e3dE08A90;

    // Track transfers per tx.origin per block to detect multi-swaps
    mapping(address => uint256) private tokensFromPoolPerOrigin;

    event FeesReceived(uint256 amount);

    constructor(
        string memory _name,
        string memory _symbol,
        address _creator,
        address _platform
    ) ERC20(_name, _symbol) {
        platform = _platform;
        creator = _creator;
        _owner = address(0);
        launchBlock = block.number;

        uint256 totalTokens = 1_000_000_000 * 10 ** decimals();
        maxTxAmount = (totalTokens * MAX_WALLET_PERCENTAGE) / 100;

        _mint(_platform, totalTokens);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (block.number > launchBlock && block.number <= launchBlock + LAUNCH_PERIOD) {
            if (from == pool && to != platform && to != creator) {
                tokensFromPoolPerOrigin[tx.origin] += value;
                require(
                    tokensFromPoolPerOrigin[tx.origin] <= maxTxAmount * 110 / 100,
                    "Keeping 2% pool Limits In Kontrol"
                );
            }

            if (to != creator && to != platform && to != pool && from != address(0)) {
                require(
                    balanceOf(to) + value <= maxTxAmount,
                    "Max wallet limit exceeded during launch period"
                );
            }
        }

        // Block all buys at launch block except exempted transfers
        if (block.number == launchBlock &&
            from != address(0) &&
            to != platform &&
            from != platform &&
            !(from == platform && to == creator)) {
            revert("No buys allowed during launch block!");
        }

        super._update(from, to, value);
    }

    function isLaunchPeriodActive() public view returns (bool) {
        return block.number <= launchBlock + LAUNCH_PERIOD;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    receive() external payable {
        emit FeesReceived(msg.value);
    }

    function withdrawFees() external returns (uint256 balance) {
        require(msg.sender == platform, "Only factory can withdraw");
        balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");

        (bool success, ) = payable(platform).call{value: balance}("");
        require(success, "Fee withdrawal failed");
    }

    function changeCreator(address newCreator) external {
        require(msg.sender == platform, "Only platform can change creator");
        creator = newCreator;
    }
}
