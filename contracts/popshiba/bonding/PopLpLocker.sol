// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IWETH9 {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
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
    struct CollectParams { uint256 tokenId; address recipient; uint128 amount0Max; uint128 amount1Max; }
    function collect(CollectParams calldata) external payable returns (uint256 amount0, uint256 amount1);
}
interface IPopBondingCurveCreator {
    function creator() external view returns (address);
}

/// @title PopLpLocker
/// @notice Mirrors Unicurve's locker behaviour: at graduation it seeds a
/// Uniswap V3 1% pool (token / WETH) at the curve's final price, mints a
/// full-range LP position that this contract owns permanently (LP can never
/// be pulled), and exposes `claimLpFees(token)` which collects accumulated
/// V3 trading fees and splits them 50/50 between the token's creator and
/// the protocol treasury — the same economics as Unicurve post-graduation.
contract PopLpLocker {
    address public immutable WETH;
    address public immutable UNI_V3_FACTORY;
    address public immutable UNI_V3_POSITION_MANAGER;
    address public protocolTreasury;
    address public owner;

    int24  public constant TICK_LOWER = -887200;
    int24  public constant TICK_UPPER =  887200;
    uint24 public constant FEE_TIER   = 10000; // 1%
    uint16 public constant CREATOR_SHARE_BPS  = 5000;
    uint16 public constant PROTOCOL_SHARE_BPS = 5000;

    struct Position { uint256 tokenId; address curve; address pool; bool active; }
    mapping(address => Position) public positions; // token => position

    event LiquidityLocked(address indexed token, address pool, uint256 tokenId, uint128 liquidity, uint256 ethIn, uint256 tokensIn);
    event LpFeesClaimed(address indexed token, address indexed creator, uint256 ethToCreator, uint256 tokenToCreator, uint256 ethToProtocol, uint256 tokenToProtocol);

    constructor(address _weth, address _v3Factory, address _v3PosMgr, address _treasury) {
        WETH = _weth;
        UNI_V3_FACTORY = _v3Factory;
        UNI_V3_POSITION_MANAGER = _v3PosMgr;
        protocolTreasury = _treasury;
        owner = msg.sender;
    }

    function setTreasury(address t) external { require(msg.sender == owner, "auth"); protocolTreasury = t; }

    /// @notice Called by a graduating curve. The curve has already transferred
    /// `tokenAmount` of `token` to this contract and is sending msg.value ETH.
    function lockGraduationLiquidity(address token, uint256 tokenAmount) external payable {
        require(msg.value > 0 && tokenAmount > 0, "0");
        require(!positions[token].active, "exists");

        IWETH9(WETH).deposit{value: msg.value}();

        (address t0, address t1, uint256 a0, uint256 a1) = token < WETH
            ? (token, WETH, tokenAmount, msg.value)
            : (WETH, token, msg.value, tokenAmount);

        address pool = IUniV3Factory(UNI_V3_FACTORY).getPool(t0, t1, FEE_TIER);
        if (pool == address(0)) {
            pool = IUniV3Factory(UNI_V3_FACTORY).createPool(t0, t1, FEE_TIER);
            uint160 sqrtPriceX96 = _calcSqrtPriceX96(a0, a1);
            IUniV3Pool(pool).initialize(sqrtPriceX96);
        }

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
        positions[token] = Position({ tokenId: tokenId, curve: msg.sender, pool: pool, active: true });

        emit LiquidityLocked(token, pool, tokenId, liq, msg.value, tokenAmount);
    }

    /// @notice Sweep accrued LP trading fees and split 50/50 between
    /// the token's creator and the protocol treasury. Anyone may call;
    /// proceeds always go to the canonical recipients.
    function claimLpFees(address token) external {
        Position memory pos = positions[token];
        require(pos.active, "no pos");

        (uint256 amt0, uint256 amt1) = INonfungiblePositionManager(UNI_V3_POSITION_MANAGER).collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: pos.tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        // Map (amt0, amt1) → (ethAmt, tokenAmt)
        (uint256 ethAmt, uint256 tokAmt) = token < WETH ? (amt1, amt0) : (amt0, amt1);

        // Unwrap WETH to ETH for distribution
        if (ethAmt > 0) IWETH9(WETH).withdraw(ethAmt);

        address creator = IPopBondingCurveCreator(pos.curve).creator();

        uint256 ethCreator = (ethAmt * CREATOR_SHARE_BPS) / 10000;
        uint256 ethProto   = ethAmt - ethCreator;
        uint256 tokCreator = (tokAmt * CREATOR_SHARE_BPS) / 10000;
        uint256 tokProto   = tokAmt - tokCreator;

        if (ethCreator > 0) { (bool s,) = creator.call{value: ethCreator}(""); require(s, "ethC"); }
        if (ethProto > 0)   { (bool s,) = protocolTreasury.call{value: ethProto}(""); require(s, "ethP"); }
        if (tokCreator > 0) IERC20(token).transfer(creator, tokCreator);
        if (tokProto > 0)   IERC20(token).transfer(protocolTreasury, tokProto);

        emit LpFeesClaimed(token, creator, ethCreator, tokCreator, ethProto, tokProto);
    }

    function _calcSqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        uint256 ratio = (amount1 * 1e18) / amount0;
        uint256 sqrtRatio = _sqrt(ratio * 1e18);
        return uint160((sqrtRatio * (1 << 96)) / 1e18);
    }
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = (x + 1) / 2; y = x;
        while (z < y) { y = z; z = (x / z + z) / 2; }
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }
    receive() external payable {}
}
