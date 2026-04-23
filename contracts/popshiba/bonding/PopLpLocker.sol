// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IWETH9 {
    function deposit() external payable;
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}
interface IERC20 {
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}
interface IUniV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address);
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address);
}
interface IUniV3Pool {
    function initialize(uint160 sqrtPriceX96) external;
    function token0() external view returns (address);
    function token1() external view returns (address);
}
interface INonfungiblePositionManager {
    struct MintParams {
        address token0; address token1; uint24 fee;
        int24 tickLower; int24 tickUpper;
        uint256 amount0Desired; uint256 amount1Desired;
        uint256 amount0Min; uint256 amount1Min;
        address recipient; uint256 deadline;
    }
    function mint(MintParams calldata) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

/// @title PopLpLocker
/// @notice Receives the graduation token+ETH bundle from a curve, creates a
/// Uniswap V3 1% pool (token / WETH) at the curve's final price, mints a
/// full-range LP position, and immediately sends the position NFT to 0xdEaD
/// — locked forever. Trading fees from the V3 pool stay claimable by 0xdEaD,
/// which is functionally identical to a permanent burn (matches Unicurve UX:
/// liquidity is non-pullable forever).
contract PopLpLocker {
    address public immutable WETH;
    address public immutable UNI_V3_FACTORY;
    address public immutable UNI_V3_POSITION_MANAGER;
    address public immutable BONDING_FACTORY;

    int24 public constant TICK_LOWER = -887200;
    int24 public constant TICK_UPPER =  887200;
    uint24 public constant FEE_TIER  = 10000; // 1%
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    event LiquidityLocked(address indexed token, address pool, uint256 tokenId, uint128 liquidity, uint256 ethIn, uint256 tokensIn);

    constructor(address _weth, address _v3Factory, address _v3PosMgr, address _bondingFactory) {
        WETH = _weth;
        UNI_V3_FACTORY = _v3Factory;
        UNI_V3_POSITION_MANAGER = _v3PosMgr;
        BONDING_FACTORY = _bondingFactory;
    }

    /// @notice Called by a graduating curve. The curve has already transferred
    /// `tokenAmount` of `token` to this contract and is sending msg.value ETH.
    function lockGraduationLiquidity(address token, uint256 tokenAmount) external payable {
        require(msg.value > 0 && tokenAmount > 0, "0");
        // Wrap ETH
        IWETH9(WETH).deposit{value: msg.value}();

        // Sort tokens (V3 requires token0 < token1)
        (address t0, address t1, uint256 a0, uint256 a1) = token < WETH
            ? (token, WETH, tokenAmount, msg.value)
            : (WETH, token, msg.value, tokenAmount);

        // Create + init pool if needed at curve's final price
        address pool = IUniV3Factory(UNI_V3_FACTORY).getPool(t0, t1, FEE_TIER);
        if (pool == address(0)) {
            pool = IUniV3Factory(UNI_V3_FACTORY).createPool(t0, t1, FEE_TIER);
            uint160 sqrtPriceX96 = _calcSqrtPriceX96(a0, a1);
            IUniV3Pool(pool).initialize(sqrtPriceX96);
        }

        // Approve & mint full-range position to this contract, then forward NFT to dEaD
        IERC20(token).approve(UNI_V3_POSITION_MANAGER, tokenAmount);
        IWETH9(WETH).approve(UNI_V3_POSITION_MANAGER, msg.value);

        INonfungiblePositionManager.MintParams memory p = INonfungiblePositionManager.MintParams({
            token0: t0, token1: t1, fee: FEE_TIER,
            tickLower: TICK_LOWER, tickUpper: TICK_UPPER,
            amount0Desired: a0, amount1Desired: a1,
            amount0Min: 0, amount1Min: 0,
            recipient: address(this), deadline: block.timestamp + 600
        });
        (uint256 tokenId, uint128 liq,,) = INonfungiblePositionManager(UNI_V3_POSITION_MANAGER).mint(p);
        INonfungiblePositionManager(UNI_V3_POSITION_MANAGER).safeTransferFrom(address(this), DEAD, tokenId);

        emit LiquidityLocked(token, pool, tokenId, liq, msg.value, tokenAmount);
    }

    /// @dev sqrt(a1/a0) * 2^96 — rough but fine for full-range LP seed.
    function _calcSqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        uint256 ratio = (amount1 * 1e18) / amount0;        // 1e18 fixed
        uint256 sqrtRatio = _sqrt(ratio * 1e18);           // sqrt of (ratio * 1e18) → still 1e18 scale
        return uint160((sqrtRatio * (1 << 96)) / 1e18);
    }
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = (x + 1) / 2; y = x;
        while (z < y) { y = z; z = (x / z + z) / 2; }
    }

    // Required to receive ERC721
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }
}
