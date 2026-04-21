// SPDX-License-Identifier: MIT
// PopShiba.com — Ethereum Mainnet Launchpad
// PopShibaFeeVaultV2: same trustless 50/50 fee model as v1, but harvests fees
// from the UNCX V3 Locker (where the LP NFT now lives) instead of calling
// the Uniswap NonfungiblePositionManager directly.
//
// Per-token accounting & creator claim flow are byte-for-byte identical to v1.
pragma solidity ^0.8.19;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWETH9 is IERC20 {
    function withdraw(uint256) external;
}

// UNCX_LiquidityLocker_UniV3 (mainnet: 0xFD235968e65B0990584585763f837A5b5330e6DE)
interface IUNCX_LiquidityLocker_UniV3 {
    struct LockedPosition {
        uint256 lock_id;
        address nftPositionManager;
        address pendingOwner;
        address owner;
        address additionalCollector;
        address collector;
        address pool;
        uint256 nft_id;
        uint256 unlockDate;
        uint16 countryCode;
        uint256 ucf;
    }
    /// @notice Collect fees from a locked position. Caller must be the `collector`.
    function collect(uint256 lockId, address recipient, uint128 amount0Max, uint128 amount1Max)
        external returns (uint256 amount0, uint256 amount1, uint256 fee0, uint256 fee1);
    function getLock(uint256 lockId) external view returns (LockedPosition memory);
}

contract PopShibaFeeVaultV2 {
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant UNCX_V3_LOCKER = 0xFD235968e65B0990584585763f837A5b5330e6DE;
    uint128 public constant MAX_UINT128 = type(uint128).max;

    address public owner;
    address public platformTreasury;
    address public launcher; // PopShibaLauncherV2 — the only address allowed to register

    struct TokenInfo {
        uint256 uncxLockId;   // UNCX lock id (NOT the NFT id)
        address creator;      // 50% recipient
        bool    registered;
    }

    mapping(address => TokenInfo) public tokens;
    mapping(address => uint256)  public creatorOwed;
    mapping(address => uint256)  public creatorPaid;
    mapping(address => uint256)  public lifetimeCollected;
    mapping(address => uint256)  public platformPaid;

    event LauncherChanged(address indexed oldLauncher, address indexed newLauncher);
    event TokenRegistered(address indexed token, uint256 indexed uncxLockId, address indexed creator);
    event FeesCollected(address indexed token, uint256 wethCollected, uint256 creatorShare, uint256 platformShare);
    event CreatorClaimed(address indexed token, address indexed creator, uint256 amountWeth, bool unwrappedToEth);
    event PlatformPaid(address indexed token, uint256 amount);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);

    modifier onlyOwner() { require(msg.sender == owner, "NOT_OWNER"); _; }
    modifier onlyLauncher() { require(msg.sender == launcher, "NOT_LAUNCHER"); _; }

    constructor(address _platformTreasury) {
        require(_platformTreasury != address(0), "ZERO_TREASURY");
        owner = msg.sender;
        platformTreasury = _platformTreasury;
    }

    // ============================================================
    // Registration — called once per launch by PopShibaLauncherV2.
    // ============================================================
    function registerLockedToken(address token, uint256 uncxLockId, address creator) external onlyLauncher {
        require(!tokens[token].registered, "ALREADY_REGISTERED");
        require(creator != address(0), "ZERO_CREATOR");
        tokens[token] = TokenInfo({uncxLockId: uncxLockId, creator: creator, registered: true});
        emit TokenRegistered(token, uncxLockId, creator);
    }

    // ============================================================
    // Fee collection — anyone can call. Routes via UNCX.
    // ============================================================
    function collect(address token) external returns (uint256 wethCollected) {
        TokenInfo memory info = tokens[token];
        require(info.registered, "NOT_REGISTERED");

        uint256 wethBefore = IERC20(WETH).balanceOf(address(this));

        IUNCX_LiquidityLocker_UniV3(UNCX_V3_LOCKER).collect(
            info.uncxLockId,
            address(this),
            MAX_UINT128,
            MAX_UINT128
        );

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

    // ============================================================
    // Creator claim — identical UX to v1.
    // ============================================================
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

    function totalOwedFor(address creator, address[] calldata tokenList) external view returns (uint256 total) {
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokens[tokenList[i]].creator == creator) {
                total += creatorOwed[tokenList[i]];
            }
        }
    }

    // ============================================================
    // Admin
    // ============================================================
    function setLauncher(address newLauncher) external onlyOwner {
        require(newLauncher != address(0), "ZERO_LAUNCHER");
        emit LauncherChanged(launcher, newLauncher);
        launcher = newLauncher;
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
