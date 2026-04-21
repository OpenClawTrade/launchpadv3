// SPDX-License-Identifier: MIT
// PopShiba.com — Ethereum Mainnet Launchpad
// Trustless fee vault. Holds Uniswap V3 LP NFTs, auto-collects WETH fees,
// per-token creator accounting, on-chain claim().
//
// Fee split: 50% creator, 50% platform.
// Platform share auto-forwards to PLATFORM_TREASURY on every collect.
// Creator share accrues in `creatorOwed[token]` and is claimable any time.
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWETH9 is IERC20 {
    function withdraw(uint256) external;
}

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface INonfungiblePositionManager {
    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }
    function collect(CollectParams calldata params) external returns (uint256 amount0, uint256 amount1);
}

contract PopShibaFeeVault {
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant NPM  = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    uint128 public constant MAX_UINT128 = type(uint128).max;

    address public owner;
    address public platformTreasury;

    struct TokenInfo {
        uint256 lpTokenId;     // Uniswap V3 NFT id
        address creator;       // Creator wallet (50% recipient)
        bool    registered;
    }

    mapping(address => TokenInfo) public tokens;          // token → info
    mapping(address => uint256)  public creatorOwed;      // token → unclaimed WETH
    mapping(address => uint256)  public creatorPaid;      // token → claimed lifetime
    mapping(address => uint256)  public lifetimeCollected;// token → total WETH collected
    mapping(address => uint256)  public platformPaid;    // token → platform lifetime

    event TokenRegistered(address indexed token, uint256 lpTokenId, address indexed creator);
    event FeesCollected(address indexed token, uint256 wethCollected, uint256 creatorShare, uint256 platformShare);
    event CreatorClaimed(address indexed token, address indexed creator, uint256 amountWeth, bool unwrappedToEth);
    event PlatformPaid(address indexed token, uint256 amount);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address _platformTreasury) {
        require(_platformTreasury != address(0), "ZERO_TREASURY");
        owner = msg.sender;
        platformTreasury = _platformTreasury;
    }

    /// @notice Register a freshly-launched token + its V3 LP NFT.
    /// @dev Caller must have already transferred the NFT to this vault.
    function registerToken(address token, uint256 lpTokenId, address creator) external onlyOwner {
        require(!tokens[token].registered, "ALREADY_REGISTERED");
        require(creator != address(0), "ZERO_CREATOR");
        require(IERC721(NPM).ownerOf(lpTokenId) == address(this), "NFT_NOT_HELD");
        tokens[token] = TokenInfo({lpTokenId: lpTokenId, creator: creator, registered: true});
        emit TokenRegistered(token, lpTokenId, creator);
    }

    /// @notice Collect Uniswap V3 fees for a token, split 50/50, forward platform share.
    /// @dev Anyone can call — fees still go to the right places. Returns WETH collected.
    function collect(address token) external returns (uint256 wethCollected) {
        TokenInfo memory info = tokens[token];
        require(info.registered, "NOT_REGISTERED");

        uint256 wethBefore = IERC20(WETH).balanceOf(address(this));

        INonfungiblePositionManager(NPM).collect(INonfungiblePositionManager.CollectParams({
            tokenId: info.lpTokenId,
            recipient: address(this),
            amount0Max: MAX_UINT128,
            amount1Max: MAX_UINT128
        }));

        uint256 wethAfter = IERC20(WETH).balanceOf(address(this));
        wethCollected = wethAfter - wethBefore;
        if (wethCollected == 0) return 0;

        uint256 creatorShare = wethCollected / 2;
        uint256 platformShare = wethCollected - creatorShare;

        creatorOwed[token] += creatorShare;
        lifetimeCollected[token] += wethCollected;

        if (platformShare > 0) {
            require(IERC20(WETH).transfer(platformTreasury, platformShare), "PLATFORM_TRANSFER_FAILED");
            platformPaid[token] += platformShare;
            emit PlatformPaid(token, platformShare);
        }

        emit FeesCollected(token, wethCollected, creatorShare, platformShare);
    }

    /// @notice Creator claims their accrued WETH share for a single token.
    /// @param token Token contract address
    /// @param unwrap If true, unwrap WETH → ETH and send native ETH to creator
    function claim(address token, bool unwrap) external returns (uint256 amount) {
        TokenInfo memory info = tokens[token];
        require(info.registered, "NOT_REGISTERED");
        require(msg.sender == info.creator, "NOT_CREATOR");

        amount = creatorOwed[token];
        require(amount > 0, "NOTHING_OWED");

        creatorOwed[token] = 0;
        creatorPaid[token] += amount;

        if (unwrap) {
            IWETH9(WETH).withdraw(amount);
            (bool ok, ) = info.creator.call{value: amount}("");
            require(ok, "ETH_TRANSFER_FAILED");
        } else {
            require(IERC20(WETH).transfer(info.creator, amount), "WETH_TRANSFER_FAILED");
        }

        emit CreatorClaimed(token, info.creator, amount, unwrap);
    }

    /// @notice View: how much WETH a creator can claim across many tokens.
    function totalOwedFor(address creator, address[] calldata tokenList) external view returns (uint256 total) {
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokens[tokenList[i]].creator == creator) {
                total += creatorOwed[tokenList[i]];
            }
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    function setPlatformTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "ZERO_TREASURY");
        emit TreasuryChanged(platformTreasury, newTreasury);
        platformTreasury = newTreasury;
    }

    /// @dev Required to receive ETH from WETH.withdraw()
    receive() external payable {}
}
