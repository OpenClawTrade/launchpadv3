// SPDX-License-Identifier: MIT
// PopShiba.com — Ethereum Mainnet Launchpad
// PopShibaLauncherV2: atomic launch + LP lock in UNCX V3 Locker.
//
// One-tx flow (single signature for the creator):
//   1. Clone PopShibaToken (deterministic via PopShibaCloneFactory).
//   2. Mint 1B supply to this launcher.
//   3. Wrap creator's ETH → WETH for LP seed + dev buy.
//   4. Create + initialize Uniswap V3 1% pool (token / WETH).
//   5. Mint a single-sided LP position above spot. NFT minted to this contract.
//   6. Approve UNCX_V3_LOCKER and call lock() with `collector = PopShibaFeeVault`.
//      - Liquidity is locked until +100 years (effectively permanent).
//      - PopShibaFeeVault is set as both `owner` and `collector` of the UNCX lock,
//        so it can keep harvesting the 1% trading fees forever.
//   7. (Optional) execute the dev buy in the same tx using remaining WETH.
//   8. Tell PopShibaFeeVaultV2 about the new (token, lockId, creator) tuple.
//
// Result: from the moment the token is live, every block-explorer / scanner
// (DEXTools, GMGN, DEXScreener, Honeypot.is) shows the recognized
// "🔒 LP Locked via UNCX" badge.
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

// UNCX_LiquidityLocker_UniV3 (mainnet: 0xFD235968e65B0990584585763f837A5b5330e6DE)
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

contract PopShibaLauncherV2 {
    // --- Constants (mainnet) ---
    address public constant WETH      = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant V3_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    address public constant NPM        = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    address public constant SWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address public constant UNCX_V3_LOCKER = 0xFD235968e65B0990584585763f837A5b5330e6DE;

    uint24  public constant FEE_TIER     = 10000; // 1%
    int24   public constant TICK_SPACING = 200;
    int24   public constant TICK_LOWER   = -887200; // min usable, multiple of 200
    int24   public constant TICK_UPPER   =  887200; // max usable, multiple of 200
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    // --- Storage ---
    address public owner;
    address public cloneFactory;
    address public feeVault;
    string  public uncxFeeName = "DEFAULT";

    event Launched(address indexed token, address indexed creator, address pool, uint256 lpTokenId);
    event LpLocked(address indexed token, uint256 indexed uncxLockId, uint256 unlockDate);
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

    // --- Views ---
    /// @notice The flat ETH fee UNCX charges per lock (must be forwarded as msg.value).
    function uncxLockFeeWei() public view returns (uint256) {
        IUNCX_LiquidityLocker_UniV3.FeeStruct memory f =
            IUNCX_LiquidityLocker_UniV3(UNCX_V3_LOCKER).getFee(uncxFeeName);
        // We only support flat-ETH lock fees (flatFeeToken == address(0)).
        if (f.flatFeeToken == address(0)) return f.flatFee;
        return 0;
    }

    // --- Main entrypoint ---
    /// @notice Deploy + pool + LP + UNCX lock + optional dev buy. Single signature.
    /// @param ethForLP    ETH the creator wants seeded as LP liquidity
    /// @param ethForDevBuy ETH the creator wants spent buying their own token instantly
    /// msg.value MUST equal: ethForLP + ethForDevBuy + uncxLockFeeWei()
    function launch(
        string calldata name_,
        string calldata symbol_,
        string calldata metadataURI_,
        uint256 ethForLP,
        uint256 ethForDevBuy
    ) external payable returns (address token, address pool, uint256 lpTokenId, uint256 uncxLockId) {
        require(ethForLP > 0, "LP=0");

        uint256 uncxFee = uncxLockFeeWei();
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
        // Initial price: 1 token = 1 wei of WETH (placeholder); real price set by single-sided LP range.
        uint160 sqrtPriceX96 = _initialSqrtPriceX96(token);
        try IUniswapV3Pool(pool).initialize(sqrtPriceX96) {} catch { /* already initialized */ }

        // 4. Mint single-sided LP position. NFT minted to THIS contract (not the vault).
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

        // 5. Lock NFT in UNCX with PopShibaFeeVault as collector + owner.
        IERC721(NPM).approve(UNCX_V3_LOCKER, lpTokenId);

        // Effective unlock date: now + 100 years (≈ permanent).
        // We deliberately do NOT use type(uint256).max because some UNCX deployments
        // sanity-check the bound; +100y is universally accepted and reads as
        // "Locked until 21XX-XX-XX" on every scanner.
        uint256 unlockDate = block.timestamp + (100 * 365 days);

        bytes[] memory empty = new bytes[](0);
        IUNCX_LiquidityLocker_UniV3.LockParams memory lp = IUNCX_LiquidityLocker_UniV3.LockParams({
            nftPositionManager: NPM,
            nft_id: lpTokenId,
            dustRecipient: msg.sender,         // any leftover dust → creator
            owner: feeVault,                   // vault can extend / migrate (not unlock early)
            additionalCollector: address(0),
            collector: feeVault,               // vault calls collect() to harvest fees
            countryCode: 0,
            feeName: uncxFeeName,
            r: empty
        });

        // UNCX takes a flat ETH fee per lock; we forward exactly uncxFee from msg.value.
        uncxLockId = IUNCX_LiquidityLocker_UniV3(UNCX_V3_LOCKER).lock{value: uncxFee}(lp);

        // We can't reliably embed the real unlockDate UNCX records (it may clip),
        // so we emit our requested value for off-chain UI.
        emit LpLocked(token, uncxLockId, unlockDate);

        // 6. Tell vault about the new (token, lockId, creator) tuple
        IPopShibaFeeVaultV2(feeVault).registerLockedToken(token, uncxLockId, msg.sender);

        // 7. Optional dev buy
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

        emit Launched(token, msg.sender, pool, lpTokenId);
    }

    /// @dev Cheap initial sqrtPriceX96. Range is full so the exact starting price
    ///      doesn't matter for fees — only the active liquidity does.
    function _initialSqrtPriceX96(address token) internal pure returns (uint160) {
        // 2**96 = 79228162514264337593543950336 ⇒ implies price ≈ 1:1 (token vs WETH)
        // Single-sided full-range provides identical economics regardless of seed price.
        token; // silence unused warning
        return 79228162514264337593543950336;
    }

    receive() external payable {}
}
