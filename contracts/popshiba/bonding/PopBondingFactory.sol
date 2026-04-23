// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IPopBondingTokenInit {
    function initialize(string calldata, string calldata, uint256, address, address) external;
}
interface IPopBondingCurveInit {
    function initialize(address token, address creator, address factory, address eventBus, address lpLocker, address protocolTreasury) external;
    function buy(uint256 minTokensOut, address recipient) external payable returns (uint256);
}
interface IPopEventBusFactory {
    function emitTokenCreated(
        address token, address curve, address creator,
        string calldata name, string calldata symbol, string calldata metadataURI,
        uint256 initialPriceWei, uint256 seedEthSpent
    ) external;
    function setAuthorized(address curve, bool ok) external;
}

/// @title PopBondingFactory
/// @notice Deploys deterministic minimal-proxy clones of the token + curve
/// implementations using CREATE2 with a user-provided salt. msg.value is
/// optionally forwarded into the curve as the launch dev buy (anti-snipe).
contract PopBondingFactory {
    address public immutable TOKEN_IMPL;
    address public immutable CURVE_IMPL;
    address public immutable EVENT_BUS;
    address public immutable LP_LOCKER;
    address public immutable PROTOCOL_TREASURY;

    address public owner;
    mapping(address => bool) public isPopBondingToken;

    event TokenCreated(
        address indexed token, address indexed curve, address indexed creator,
        string name, string symbol, string metadataURI,
        uint256 initialPriceWei, uint256 seedEthSpent
    );

    constructor(
        address _tokenImpl, address _curveImpl, address _eventBus,
        address _lpLocker, address _treasury
    ) {
        TOKEN_IMPL = _tokenImpl;
        CURVE_IMPL = _curveImpl;
        EVENT_BUS = _eventBus;
        LP_LOCKER = _lpLocker;
        PROTOCOL_TREASURY = _treasury;
        owner = msg.sender;
    }

    /// @notice Deploy a new token + curve pair, then optionally do an initial
    /// dev buy with the entire msg.value (minus 1% fee, like Unicurve).
    function createToken(
        bytes32 salt,
        string calldata name,
        string calldata symbol,
        string calldata metadataURI
    ) external payable returns (address tokenAddr, address curveAddr) {
        bytes32 saltT = keccak256(abi.encode(msg.sender, salt, "T"));
        bytes32 saltC = keccak256(abi.encode(msg.sender, salt, "C"));
        tokenAddr = _cloneDeterministic(TOKEN_IMPL, saltT);
        curveAddr = _cloneDeterministic(CURVE_IMPL, saltC);

        IPopBondingTokenInit(tokenAddr).initialize(
            name, symbol, 1_000_000_000e18, curveAddr, address(this)
        );
        IPopBondingCurveInit(curveAddr).initialize(
            tokenAddr, msg.sender, address(this), EVENT_BUS, LP_LOCKER, PROTOCOL_TREASURY
        );
        IPopEventBusFactory(EVENT_BUS).setAuthorized(curveAddr, true);

        isPopBondingToken[tokenAddr] = true;

        // Initial price = VIRTUAL_ETH / VIRTUAL_TOKENS scaled to 1e18 = ~9.88e8 wei/token
        uint256 initPrice = (uint256(1.06 ether) * 1e18) / uint256(1_073_000_000e18);
        IPopEventBusFactory(EVENT_BUS).emitTokenCreated(
            tokenAddr, curveAddr, msg.sender, name, symbol, metadataURI, initPrice, msg.value
        );
        emit TokenCreated(tokenAddr, curveAddr, msg.sender, name, symbol, metadataURI, initPrice, msg.value);

        if (msg.value > 0) {
            IPopBondingCurveInit(curveAddr).buy{value: msg.value}(0, msg.sender);
        }
    }

    function predictAddresses(address creator, bytes32 salt)
        external view returns (address tokenAddr, address curveAddr)
    {
        bytes32 saltT = keccak256(abi.encode(creator, salt, "T"));
        bytes32 saltC = keccak256(abi.encode(creator, salt, "C"));
        tokenAddr = _predict(TOKEN_IMPL, saltT);
        curveAddr = _predict(CURVE_IMPL, saltC);
    }

    // EIP-1167 minimal proxy via CREATE2 (OpenZeppelin Clones inlined for size)
    function _cloneDeterministic(address impl, bytes32 salt) internal returns (address instance) {
        bytes20 targetBytes = bytes20(impl);
        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(clone, 0x14), targetBytes)
            mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create2(0, clone, 0x37, salt)
        }
        require(instance != address(0), "clone");
    }

    function _predict(address impl, bytes32 salt) internal view returns (address) {
        bytes20 targetBytes = bytes20(impl);
        bytes32 hash;
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), targetBytes)
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            let bytecodeHash := keccak256(ptr, 0x37)
            mstore(ptr, hex"ff")
            mstore(add(ptr, 0x01), shl(0x60, address()))
            mstore(add(ptr, 0x15), salt)
            mstore(add(ptr, 0x35), bytecodeHash)
            hash := keccak256(ptr, 0x55)
        }
        return address(uint160(uint256(hash)));
    }

    function setOwner(address n) external { require(msg.sender == owner, "auth"); owner = n; }
}
