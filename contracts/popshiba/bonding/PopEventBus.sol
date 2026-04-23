// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title PopEventBus
/// @notice Centralised event sink so indexers only have to watch one address
/// for new tokens, trades, and graduations across the whole PopShiba protocol.
contract PopEventBus {
    address public owner;
    address public factory;
    mapping(address => bool) public authorizedCurve;

    event TokenCreated(
        address indexed token, address indexed curve, address indexed creator,
        string name, string symbol, string metadataURI,
        uint256 initialPriceWei, uint256 seedEthSpent
    );
    event TradeExecuted(
        address indexed token, address indexed curve, address indexed trader,
        bool isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 fee,
        uint256 newRealEth, uint256 newRealTokens
    );
    event Graduation(address indexed token, address indexed curve, uint256 ethToLp, uint256 tokensToLp);

    constructor() { owner = msg.sender; }

    function setFactory(address f) external { require(msg.sender == owner, "auth"); factory = f; }

    function setAuthorized(address curve, bool ok) external {
        require(msg.sender == factory, "auth");
        authorizedCurve[curve] = ok;
    }

    function emitTokenCreated(
        address token, address curve, address creator,
        string calldata name, string calldata symbol, string calldata metadataURI,
        uint256 initialPriceWei, uint256 seedEthSpent
    ) external {
        require(msg.sender == factory, "auth");
        emit TokenCreated(token, curve, creator, name, symbol, metadataURI, initialPriceWei, seedEthSpent);
    }

    function emitTrade(
        address token, address curve, address trader, bool isBuy,
        uint256 ethAmount, uint256 tokenAmount, uint256 fee,
        uint256 newRealEth, uint256 newRealTokens
    ) external {
        require(authorizedCurve[msg.sender], "auth");
        emit TradeExecuted(token, curve, trader, isBuy, ethAmount, tokenAmount, fee, newRealEth, newRealTokens);
    }

    function emitGraduation(address token, address curve, uint256 ethToLp, uint256 tokensToLp) external {
        require(authorizedCurve[msg.sender], "auth");
        emit Graduation(token, curve, ethToLp, tokensToLp);
    }
}
