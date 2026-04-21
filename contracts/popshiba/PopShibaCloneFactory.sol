// SPDX-License-Identifier: MIT
// PopShiba.com — Ethereum Mainnet Launchpad
// EIP-1167 minimal-proxy factory. Clones the PopShibaToken implementation
// for ~90% gas saving on every launch (~25k gas vs ~250k for full deploy).
pragma solidity ^0.8.20;

interface IPopShibaToken {
    function initialize(
        string memory name,
        string memory symbol,
        address recipient,
        uint256 supply,
        string memory metadataURI
    ) external;
}

contract PopShibaCloneFactory {
    address public immutable implementation;
    address public immutable owner;

    event TokenCloned(
        address indexed token,
        address indexed creator,
        string name,
        string symbol
    );

    constructor(address _implementation) {
        require(_implementation != address(0), "ZERO_IMPL");
        implementation = _implementation;
        owner = msg.sender;
    }

    /// @notice Deploy a new PopShiba token via EIP-1167 minimal proxy.
    /// @dev Only the platform deployer may call (gas-paid by the platform).
    function createToken(
        string calldata name,
        string calldata symbol,
        address recipient,
        uint256 supply,
        string calldata metadataURI,
        address creator
    ) external returns (address token) {
        require(msg.sender == owner, "NOT_OWNER");
        token = _clone(implementation);
        IPopShibaToken(token).initialize(name, symbol, recipient, supply, metadataURI);
        emit TokenCloned(token, creator, name, symbol);
    }

    /// @dev EIP-1167 minimal-proxy clone. ~45 bytes of bytecode.
    function _clone(address impl) internal returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, impl))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        require(instance != address(0), "CLONE_FAILED");
    }
}
