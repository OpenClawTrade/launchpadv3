// Solidity sources inlined as string constants so the edge-runtime bundler
// includes them (raw .sol files are not bundled with the function).

export const POPSHIBA_TOKEN_SOL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PopShibaToken {
    string public name;
    string public symbol;
    uint8  public constant decimals = 18;
    uint256 public totalSupply;
    string  public metadataURI;
    string  public constant launchedBy = "PopShiba.com";

    bool private _initialized;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function initialize(
        string memory _name,
        string memory _symbol,
        address _recipient,
        uint256 _supply,
        string memory _metadataURI
    ) external {
        require(!_initialized, "ALREADY_INIT");
        _initialized = true;
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        metadataURI = _metadataURI;
        balanceOf[_recipient] = _supply;
        emit Transfer(address(0), _recipient, _supply);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "ERC20: allowance");
        if (allowed != type(uint256).max) {
            unchecked { allowance[from][msg.sender] = allowed - value; }
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "ERC20: balance");
        unchecked {
            balanceOf[from] -= value;
            balanceOf[to]   += value;
        }
        emit Transfer(from, to, value);
    }
}
`;

// PERMISSIONLESS clone factory — anyone can call createToken (no onlyOwner).
// Safety: minimal proxy + initialize() pattern; supply is bounded by caller's
// arg and minted to caller's chosen recipient. No funds custody.
export const POPSHIBA_CLONE_FACTORY_SOL = `// SPDX-License-Identifier: MIT
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

    event TokenCloned(
        address indexed token,
        address indexed creator,
        string name,
        string symbol
    );

    constructor(address _implementation) {
        require(_implementation != address(0), "ZERO_IMPL");
        implementation = _implementation;
    }

    /// @notice Permissionlessly clone the PopShiba ERC-20 implementation.
    function createToken(
        string calldata name,
        string calldata symbol,
        address recipient,
        uint256 supply,
        string calldata metadataURI,
        address creator
    ) external returns (address token) {
        token = _clone(implementation);
        IPopShibaToken(token).initialize(name, symbol, recipient, supply, metadataURI);
        emit TokenCloned(token, creator, name, symbol);
    }

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
`;

// PERMISSIONLESS fee vault — registerToken() is callable by anyone, but only
// works if the LP NFT is already owned by this vault (require check). Fees
// stay split 50/50 between the registered creator and platformTreasury.
export const POPSHIBA_FEE_VAULT_SOL = `// SPDX-License-Identifier: MIT
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
        uint256 lpTokenId;
        address creator;
        bool    registered;
    }

    mapping(address => TokenInfo) public tokens;
    mapping(address => uint256)  public creatorOwed;
    mapping(address => uint256)  public creatorPaid;
    mapping(address => uint256)  public lifetimeCollected;
    mapping(address => uint256)  public platformPaid;

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

    /// @notice Permissionless registration. Caller must have already transferred
    /// the LP NFT to this contract. Creator address is recorded for fee splits.
    function registerToken(address token, uint256 lpTokenId, address creator) external {
        require(!tokens[token].registered, "ALREADY_REGISTERED");
        require(creator != address(0), "ZERO_CREATOR");
        require(IERC721(NPM).ownerOf(lpTokenId) == address(this), "NFT_NOT_HELD");
        tokens[token] = TokenInfo({lpTokenId: lpTokenId, creator: creator, registered: true});
        emit TokenRegistered(token, lpTokenId, creator);
    }

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

    receive() external payable {}
}
`;

// =====================================================================
// PopShibaLauncher — Atomic 1-tx token launcher (Clanker / Flaunch style)
//
// Single entry point launch() does everything in one user signature:
//   1. Wraps msg.value (minus dev buy) to WETH for LP seeding
//   2. Clones a PopShibaToken with full supply minted to this launcher
//   3. Creates + initializes a Uniswap V3 1% pool at the requested price
//   4. Mints a single-sided full-range LP position; LP NFT recipient = vault
//   5. Registers (token, lpTokenId, creator) in the FeeVault for fee splits
//   6. Optionally executes a dev buy via SwapRouter, tokens go to creator
//   7. Sweeps any leftover ETH/tokens back to the creator
//
// Stateless, no admin, immutable. ReentrancyGuard inlined.
// =====================================================================
export const POPSHIBA_LAUNCHER_SOL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWETH9 is IERC20 {
    function deposit() external payable;
    function withdraw(uint256) external;
}

interface ICloneFactory {
    function createToken(
        string calldata name,
        string calldata symbol,
        address recipient,
        uint256 supply,
        string calldata metadataURI,
        address creator
    ) external returns (address token);
}

interface IFeeVault {
    function registerToken(address token, uint256 lpTokenId, address creator) external;
}

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address);
}

interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24  fee;
        int24   tickLower;
        int24   tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }
    function createAndInitializePoolIfNecessary(
        address token0, address token1, uint24 fee, uint160 sqrtPriceX96
    ) external payable returns (address pool);
    function mint(MintParams calldata params)
        external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    function factory() external view returns (address);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);
}

contract PopShibaLauncher {
    // ---- Mainnet constants ----
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant NPM  = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    address public constant SWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address public constant V3_FACTORY  = 0x1F98431c8aD98523631AE4a59f267346ea31F984;

    uint24  public constant FEE_TIER     = 10000; // 1%
    int24   public constant TICK_SPACING = 200;
    int24   public constant MIN_TICK     = -887200; // multiple of 200
    int24   public constant MAX_TICK     =  887200;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether; // 1B with 18 decimals

    ICloneFactory public immutable cloneFactory;
    IFeeVault     public immutable feeVault;

    // ---- Reentrancy guard ----
    uint256 private _locked;
    modifier nonReentrant() {
        require(_locked == 0, "REENTRANT");
        _locked = 1;
        _;
        _locked = 0;
    }

    event TokenLaunched(
        address indexed token,
        address indexed creator,
        address pool,
        uint256 lpTokenId,
        uint256 ethForLP,
        uint256 ethForDevBuy
    );

    constructor(address _cloneFactory, address _feeVault) {
        require(_cloneFactory != address(0) && _feeVault != address(0), "ZERO_ADDR");
        cloneFactory = ICloneFactory(_cloneFactory);
        feeVault     = IFeeVault(_feeVault);
    }

    /// @notice Atomic launch. User signs once and pays gas + msg.value.
    /// @param name        ERC-20 name
    /// @param symbol      ERC-20 symbol
    /// @param metadataURI JSON metadata blob (description, image, socials)
    /// @param sqrtPriceX96 Initial sqrtPriceX96 for the V3 pool
    /// @param ethForDevBuy Wei to spend swapping ETH → token for the creator (0 to skip)
    /// @return token       New ERC-20 address
    /// @return pool        Uniswap V3 pool address
    /// @return lpTokenId   Minted LP NFT id (held by FeeVault)
    function launch(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        uint160 sqrtPriceX96,
        uint256 ethForDevBuy
    ) external payable nonReentrant returns (address token, address pool, uint256 lpTokenId) {
        require(msg.value > ethForDevBuy, "INSUFFICIENT_ETH"); // need >0 for LP
        uint256 ethForLP = msg.value - ethForDevBuy;
        address creator = msg.sender;

        // 1. Clone token, full supply minted to this launcher
        token = cloneFactory.createToken(
            name, symbol, address(this), TOTAL_SUPPLY, metadataURI, creator
        );

        // 2. Wrap ETH for LP
        IWETH9(WETH).deposit{value: ethForLP}();

        // 3. Create + initialize pool
        (address token0, address token1) = token < WETH ? (token, WETH) : (WETH, token);
        pool = INonfungiblePositionManager(NPM).createAndInitializePoolIfNecessary(
            token0, token1, FEE_TIER, sqrtPriceX96
        );

        // 4. Approve NPM and mint full-range single-sided LP to the vault
        IERC20(token).approve(NPM, TOTAL_SUPPLY);
        IERC20(WETH).approve(NPM, ethForLP);

        bool tokenIsToken0 = token < WETH;
        (uint256 amount0Desired, uint256 amount1Desired) = tokenIsToken0
            ? (TOTAL_SUPPLY, ethForLP)
            : (ethForLP, TOTAL_SUPPLY);

        INonfungiblePositionManager.MintParams memory mp = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: FEE_TIER,
            tickLower: MIN_TICK,
            tickUpper: MAX_TICK,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: 0,
            amount1Min: 0,
            recipient: address(feeVault),
            deadline: block.timestamp + 600
        });
        (lpTokenId, , , ) = INonfungiblePositionManager(NPM).mint(mp);

        // Reset approvals
        IERC20(token).approve(NPM, 0);
        IERC20(WETH).approve(NPM, 0);

        // 5. Register in fee vault
        feeVault.registerToken(token, lpTokenId, creator);

        // 6. Optional dev buy — swap ETH→token, recipient = creator
        if (ethForDevBuy > 0) {
            ISwapRouter.ExactInputSingleParams memory sp = ISwapRouter.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: token,
                fee: FEE_TIER,
                recipient: creator,
                deadline: block.timestamp + 600,
                amountIn: ethForDevBuy,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });
            ISwapRouter(SWAP_ROUTER).exactInputSingle{value: ethForDevBuy}(sp);
        }

        // 7. Sweep dust back to creator
        uint256 leftoverToken = IERC20(token).balanceOf(address(this));
        if (leftoverToken > 0) IERC20(token).transfer(creator, leftoverToken);
        uint256 leftoverWeth = IERC20(WETH).balanceOf(address(this));
        if (leftoverWeth > 0) {
            IWETH9(WETH).withdraw(leftoverWeth);
        }
        if (address(this).balance > 0) {
            (bool ok, ) = creator.call{value: address(this).balance}("");
            require(ok, "REFUND_FAILED");
        }

        emit TokenLaunched(token, creator, pool, lpTokenId, ethForLP, ethForDevBuy);
    }

    receive() external payable {}
}
`;
