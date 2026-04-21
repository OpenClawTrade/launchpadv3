// SPDX-License-Identifier: MIT
// PopShiba.com — Ethereum Mainnet Launchpad
// PopShibaFeeVaultV3: Team Finance-aware fee vault.
//
// SAME 50/50 fee split + per-token accounting + creator claim flow as V2,
// but harvests fees by calling Team Finance's `collectUniswapV3LPFees(_id)`
// instead of UNCX's `collect(...)`.
//
// Critical Team Finance fact: collectUniswapV3LPFees sweeps fees to the
// withdrawal address recorded on the lock — which MUST be this vault — so
// fees land here in WETH. We then split 50/50 just like V2.
pragma solidity ^0.8.19;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWETH9 is IERC20 {
    function withdraw(uint256) external;
}

/// @notice Subset of Team Finance's LockToken (proxy 0xe2fe530c047f2d85298b07d9333c05737f1435fb)
interface ITeamFinanceLocker {
    /// @notice Sweeps Uniswap V3 LP trading fees for lock `_id` to the lock's withdrawal address.
    function collectUniswapV3LPFees(uint256 _id) external;

    /// @notice Returns full lock details: tokenAddress, withdrawalAddress, tokenAmount,
    /// unlockTime, withdrawn, tokenId.
    function lockedNFTs(uint256 _id) external view returns (
        address tokenAddress,
        address withdrawalAddress,
        uint256 tokenAmount,
        uint256 unlockTime,
        bool withdrawn,
        uint256 tokenId
    );

    /// @notice After unlockTime, withdrawal address can pull the LP NFT.
    function withdrawTokens(uint256 _id, uint256 _amount) external;
}

contract PopShibaFeeVaultV3 {
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant TEAM_FINANCE_LOCKER = 0xE2fE530C047f2d85298b07D9333C05737f1435fB;

    address public owner;
    address public platformTreasury;
    address public launcher; // PopShibaLauncherV3 — only address allowed to register

    struct TokenInfo {
        uint256 tfLockId;     // Team Finance lock id (NOT NFT id)
        address creator;      // 50% recipient
        bool    registered;
    }

    mapping(address => TokenInfo) public tokens;
    mapping(address => uint256)  public creatorOwed;
    mapping(address => uint256)  public creatorPaid;
    mapping(address => uint256)  public lifetimeCollected;
    mapping(address => uint256)  public platformPaid;

    event LauncherChanged(address indexed oldLauncher, address indexed newLauncher);
    event TokenRegistered(address indexed token, uint256 indexed tfLockId, address indexed creator);
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
    // Registration — called once per LOCKED launch by PopShibaLauncherV3.
    // Unlocked launches do NOT register here (no fees to claim).
    // ============================================================
    function registerLockedToken(address token, uint256 tfLockId, address creator) external onlyLauncher {
        require(!tokens[token].registered, "ALREADY_REGISTERED");
        require(creator != address(0), "ZERO_CREATOR");
        tokens[token] = TokenInfo({tfLockId: tfLockId, creator: creator, registered: true});
        emit TokenRegistered(token, tfLockId, creator);
    }

    // ============================================================
    // Fee collection — anyone can call. Routes via Team Finance.
    // ============================================================
    function collect(address token) external returns (uint256 wethCollected) {
        TokenInfo memory info = tokens[token];
        require(info.registered, "NOT_REGISTERED");

        uint256 wethBefore = IERC20(WETH).balanceOf(address(this));

        // Sweeps trading fees to this vault (the withdrawal address on the lock).
        ITeamFinanceLocker(TEAM_FINANCE_LOCKER).collectUniswapV3LPFees(info.tfLockId);

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
    // Creator claim — identical UX to V2.
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

    /// @notice After Team Finance unlock period (10y), owner can pull the LP NFT.
    /// Routes via Team Finance: vault is the withdrawal address, so it owns withdrawal rights.
    function withdrawUnlockedLp(uint256 tfLockId, uint256 amount) external onlyOwner {
        ITeamFinanceLocker(TEAM_FINANCE_LOCKER).withdrawTokens(tfLockId, amount);
    }

    /// @dev Required to receive ETH from WETH.withdraw()
    receive() external payable {}
}
