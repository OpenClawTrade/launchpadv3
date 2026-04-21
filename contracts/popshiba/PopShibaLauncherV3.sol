// SPDX-License-Identifier: MIT
// PopShiba.com — Ethereum Mainnet Launchpad
// PopShibaLauncherV3: atomic launch with OPTIONAL UNCX lock (per-launch flag).
//
// Same one-tx flow as V2, but the creator chooses at call-time whether to lock
// LP in UNCX or not. This means we deploy ONCE and the UI controls policy:
//   - lockLP = false → cheapest possible launch (no UNCX fee). LP NFT stays
//                      held by THIS launcher contract (rescuable by owner only).
//                      No UNCX scanner badge.
//   - lockLP = true  → identical to V2: NFT locked in UNCX, fees harvested by
//                      PopShibaFeeVaultV2, scanner shows "🔒 LP Locked via UNCX".
//
// msg.value MUST equal:
//   ethForLP + ethForDevBuy + (lockLP ? uncxLockFeeWei() : 0)
//
// Future migration path: when locking becomes mandatory, just enforce lockLP=true
// in the UI / a thin wrapper — no contract redeploy needed.
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWETH9 is IERC20 {
    function deposit() external payable;
}

interface IERC721 {
    function approve(address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

interface IPopShibaToken {
    function initialize(string memory name_, string memory symbol_, string memory metadataURI_, uint256 totalSupply_, address recipient_) external;
}

interface IPopShibaCloneFactory {
    function deploy(address creator) external returns (address token);
}

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address);
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address);
}

interface IUniswapV3Pool {
    function initialize(uint160 sqrtPriceX96) external;
    function token0() external view returns (address);
}

interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }
    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IUNCX_LiquidityLocker_UniV3 {
    struct LockParams {
        address nftPositionManager;
        uint256 nft_id;
        address dustRecipient;
        address owner;
        address additionalCollector;
        address collector;
        uint16 countryCode;
        string feeName;
        bytes[] r;
    }
    struct FeeStruct {
        string name;
        uint256 lpFee;
        uint256 collectFee;
        uint256 flatFee;
        address flatFeeToken;
    }
    function lock(LockParams calldata params) external payable returns (uint256 lockId);
    function getFee(string memory _name) external view returns (FeeStruct memory);
}

interface IPopShibaFeeVaultV2 {
    function registerLockedToken(address token, uint256 uncxLockId, address creator) external;
}

contract PopShibaLauncherV3 {
    // --- Constants (mainnet) ---
    address public constant WETH       = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant V3_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    address public constant NPM        = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    address public constant SWAP_ROUTER     = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address public constant UNCX_V3_LOCKER  = 0xFD235968e65B0990584585763f837A5b5330e6DE;

    uint24  public constant FEE_TIER     = 10000; // 1%
    int24   public constant TICK_LOWER   = -887200;
    int24   public constant TICK_UPPER   =  887200;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    // --- Storage ---
    address public owner;
    address public cloneFactory;
    address public feeVault;
    string  public uncxFeeName = "DEFAULT";

    // Track unlocked LP NFTs we still custody (lockLP=false launches).
    // tokenAddr => lpTokenId
    mapping(address => uint256) public unlockedLpTokenId;

    event Launched(address indexed token, address indexed creator, address pool, uint256 lpTokenId, bool locked);
    event LpLocked(address indexed token, uint256 indexed uncxLockId, uint256 unlockDate);
    event UnlockedLpRescued(address indexed token, uint256 indexed lpTokenId, address indexed to);
    event ConfigChanged();

    modifier onlyOwner() { require(msg.sender == owner, "NOT_OWNER"); _; }

    constructor(address _cloneFactory, address _feeVault) {
        require(_cloneFactory != address(0) && _feeVault != address(0), "ZERO_ADDR");
        owner = msg.sender;
        cloneFactory = _cloneFactory;
        feeVault = _feeVault;
    }

    // --- Admin ---
    function setCloneFactory(address f) external onlyOwner { cloneFactory = f; emit ConfigChanged(); }
    function setFeeVault(address v) external onlyOwner { feeVault = v; emit ConfigChanged(); }
    function setUncxFeeName(string calldata name_) external onlyOwner { uncxFeeName = name_; emit ConfigChanged(); }
    function transferOwnership(address newOwner) external onlyOwner { require(newOwner != address(0), "ZERO"); owner = newOwner; }

    /// @notice Owner can rescue an unlocked LP NFT (only those held from lockLP=false launches).
    /// Use this to later migrate an unlocked position into Team Finance / UNCX once we choose.
    function rescueUnlockedLp(address token, address to) external onlyOwner {
        uint256 id = unlockedLpTokenId[token];
        require(id != 0, "NO_UNLOCKED_LP");
        delete unlockedLpTokenId[token];
        IERC721(NPM).transferFrom(address(this), to, id);
        emit UnlockedLpRescued(token, id, to);
    }

    // --- Views ---
    function uncxLockFeeWei() public view returns (uint256) {
        IUNCX_LiquidityLocker_UniV3.FeeStruct memory f =
            IUNCX_LiquidityLocker_UniV3(UNCX_V3_LOCKER).getFee(uncxFeeName);
        if (f.flatFeeToken == address(0)) return f.flatFee;
        return 0;
    }

    /// @notice Total ETH msg.value the user must send for a given launch config.
    function quoteTotalCost(uint256 ethForLP, uint256 ethForDevBuy, bool lockLP) external view returns (uint256) {
        return ethForLP + ethForDevBuy + (lockLP ? uncxLockFeeWei() : 0);
    }

    // --- Main entrypoint ---
    /// @param lockLP true → lock LP in UNCX (adds uncxLockFeeWei to required msg.value)
    ///               false → keep LP NFT in this contract (cheapest path; no scanner badge)
    function launch(
        string calldata name_,
        string calldata symbol_,
        string calldata metadataURI_,
        uint256 ethForLP,
        uint256 ethForDevBuy,
        bool lockLP
    ) external payable returns (address token, address pool, uint256 lpTokenId, uint256 uncxLockId) {
        require(ethForLP > 0, "LP=0");

        uint256 uncxFee = lockLP ? uncxLockFeeWei() : 0;
        require(msg.value == ethForLP + ethForDevBuy + uncxFee, "BAD_VALUE");

        // 1. Clone & initialize token
        token = IPopShibaCloneFactory(cloneFactory).deploy(msg.sender);
        IPopShibaToken(token).initialize(name_, symbol_, metadataURI_, TOTAL_SUPPLY, address(this));

        // 2. Wrap LP + dev-buy ETH into WETH
        IWETH9(WETH).deposit{value: ethForLP + ethForDevBuy}();

        // 3. Create + init pool
        pool = IUniswapV3Factory(V3_FACTORY).getPool(token, WETH, FEE_TIER);
        if (pool == address(0)) {
            pool = IUniswapV3Factory(V3_FACTORY).createPool(token, WETH, FEE_TIER);
        }
        try IUniswapV3Pool(pool).initialize(_initialSqrtPriceX96()) {} catch {}

        // 4. Mint single-sided LP position. NFT minted to THIS contract.
        IERC20(token).approve(NPM, TOTAL_SUPPLY);
        IERC20(WETH).approve(NPM, ethForLP);

        (address t0, address t1) = token < WETH ? (token, WETH) : (WETH, token);
        (uint256 amt0, uint256 amt1) = token < WETH
            ? (TOTAL_SUPPLY, ethForLP)
            : (ethForLP, TOTAL_SUPPLY);

        (lpTokenId, , , ) = INonfungiblePositionManager(NPM).mint(
            INonfungiblePositionManager.MintParams({
                token0: t0,
                token1: t1,
                fee: FEE_TIER,
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                amount0Desired: amt0,
                amount1Desired: amt1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp + 600
            })
        );

        // 5. Optional UNCX lock
        if (lockLP) {
            IERC721(NPM).approve(UNCX_V3_LOCKER, lpTokenId);
            uint256 unlockDate = block.timestamp + (100 * 365 days);

            bytes[] memory empty = new bytes[](0);
            IUNCX_LiquidityLocker_UniV3.LockParams memory lp = IUNCX_LiquidityLocker_UniV3.LockParams({
                nftPositionManager: NPM,
                nft_id: lpTokenId,
                dustRecipient: msg.sender,
                owner: feeVault,
                additionalCollector: address(0),
                collector: feeVault,
                countryCode: 0,
                feeName: uncxFeeName,
                r: empty
            });

            uncxLockId = IUNCX_LiquidityLocker_UniV3(UNCX_V3_LOCKER).lock{value: uncxFee}(lp);
            emit LpLocked(token, uncxLockId, unlockDate);

            // Register with vault so creator can claim 50% fees forever.
            IPopShibaFeeVaultV2(feeVault).registerLockedToken(token, uncxLockId, msg.sender);
        } else {
            // NFT stays here. Owner can later migrate via rescueUnlockedLp().
            unlockedLpTokenId[token] = lpTokenId;
        }

        // 6. Optional dev buy
        if (ethForDevBuy > 0) {
            IERC20(WETH).approve(SWAP_ROUTER, ethForDevBuy);
            ISwapRouter(SWAP_ROUTER).exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: WETH,
                    tokenOut: token,
                    fee: FEE_TIER,
                    recipient: msg.sender,
                    deadline: block.timestamp + 600,
                    amountIn: ethForDevBuy,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        emit Launched(token, msg.sender, pool, lpTokenId, lockLP);
    }

    function _initialSqrtPriceX96() internal pure returns (uint160) {
        return 79228162514264337593543950336; // 2**96 ≈ 1:1
    }

    receive() external payable {}
}
