// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

interface IPopToken {
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function enableTransfers() external;
}

interface IHookSeed {
    function seedLockedLP(bytes32 poolId) external;
}

/// @title PopCurveImpl
/// @notice Per-token curve state contract. One EIP-1167 clone is deployed for
/// every launch by the singleton hook. This mirrors Unicurve's `CURVE_IMPL`:
/// the hook is shared/singleton and holds NO per-token storage; all reserves,
/// fee accruals, creator info and the PoolKey live in this clone, addressed
/// by `poolId`.
///
/// Only the singleton hook may mutate this clone. Public read views are open
/// for indexers / quoters / UIs (quoteBuy, quoteSell, getPrice, curveProgressBps).
contract PopCurveImpl {
    // ── Curve constants (identical to V3) ──
    uint256 public constant TOTAL_SUPPLY         = 1_000_000_000e18;
    uint256 public constant CURVE_TOKENS         = 792_857_143e18;
    uint256 public constant LP_TOKENS            = TOTAL_SUPPLY - CURVE_TOKENS;
    uint256 public constant VIRTUAL_ETH          = 1.06 ether;
    uint256 public constant VIRTUAL_TOKENS       = 1_073_000_000e18;
    uint256 public constant GRADUATION_THRESHOLD = 0.1 ether; // TESTNET-SAFE CAP — raise to 3 ether for prod
    uint16  public constant FEE_BPS              = 100;
    uint16  public constant CREATOR_SHARE_BPS    = 5000;
    uint16  public constant PROTOCOL_SHARE_BPS   = 5000;

    // ── Per-token state ──
    address public hook;              // singleton hook (only mutator)
    address public token;
    address public creator;
    address public protocolTreasury;
    address public lpLocker;
    bool    public graduated;
    bool    private _initialized;

    uint256 public realEthReserves;
    uint256 public realTokenReserves;
    uint256 public creatorFeesAccrued;
    uint256 public protocolFeesAccrued;

    // Stored PoolKey fields (PoolKey itself is calldata-only)
    address public currency0;
    address public currency1;
    uint24  public poolFee;
    int24   public tickSpacing;

    modifier onlyHook() { require(msg.sender == hook, "auth"); _; }

    function initialize(
        address _hook,
        address _token,
        address _creator,
        address _treasury,
        address _lpLocker,
        address _c0,
        address _c1,
        uint24  _fee,
        int24   _ts
    ) external {
        require(!_initialized, "init");
        _initialized = true;
        hook = _hook;
        token = _token;
        creator = _creator;
        protocolTreasury = _treasury;
        lpLocker = _lpLocker;
        currency0 = _c0;
        currency1 = _c1;
        poolFee = _fee;
        tickSpacing = _ts;
        realTokenReserves = CURVE_TOKENS;
    }

    // ── Hook-only mutators ──
    function applyBuy(uint256 ethIn, uint256 tokensOut, uint256 fee) external onlyHook returns (bool didGraduate) {
        uint256 cCut = (fee * CREATOR_SHARE_BPS) / 10000;
        creatorFeesAccrued += cCut;
        protocolFeesAccrued += (fee - cCut);
        realEthReserves += (ethIn - fee);
        realTokenReserves -= tokensOut;
        if (!graduated && realEthReserves >= GRADUATION_THRESHOLD) {
            graduated = true;
            didGraduate = true;
        }
    }

    function applySell(uint256 tokenIn, uint256 ethGross, uint256 fee) external onlyHook {
        uint256 cCut = (fee * CREATOR_SHARE_BPS) / 10000;
        creatorFeesAccrued += cCut;
        protocolFeesAccrued += (fee - cCut);
        realEthReserves -= ethGross;
        realTokenReserves += tokenIn;
    }

    /// @notice Public, callable once after graduation. Delegates the V4
    /// PoolManager `unlock` dance to the hook (which is the canonical
    /// IUnlockCallback for this pool family). The hook will:
    ///   1. modifyLiquidity full-range using this clone's realEthReserves +
    ///      LP_TOKENS supply
    ///   2. mint a PositionManager NFT directly to PopV4LpLocker
    ///   3. call locker.registerLock(poolId, tokenId, address(this))
    ///   4. call token.enableTransfers()
    /// All in a single atomic `unlock` callback. After this returns,
    /// realEthReserves is zero and the AMM phase begins.
    function seedLockedLP(bytes32 poolId) external {
        require(graduated, "!grad");
        require(realEthReserves > 0, "seeded");
        // Hand off to hook — it has IPoolManager + unlock callback wiring.
        // The hook will pull ETH via _take and tokens via approve+transferFrom
        // through the standard V4 settle/take pattern inside the callback.
        IPopToken(token).approve(hook, LP_TOKENS);
        IHookSeed(hook).seedLockedLP(poolId);
        // Hook clears reserves via clearReservesAfterSeed() on success.
    }

    /// @notice Hook-only: called from inside the unlock callback after the
    /// position NFT has been minted + locked. Zeroes reserves and unlocks
    /// generic transfers.
    function clearReservesAfterSeed() external onlyHook {
        require(graduated, "!grad");
        realEthReserves = 0;
        IPopToken(token).enableTransfers();
    }

    /// @notice Hook-only ETH drain used inside unlockCallback to settle the
    /// ETH leg of the LP mint. Sends `amount` wei to the hook.
    function drainEthToHook(uint256 amount) external onlyHook {
        (bool ok, ) = hook.call{value: amount}("");
        require(ok, "drain");
    }

    /// @dev Curve clone must hold ETH (forwarded by hook on every buy via
    /// post-swap settlement). Hook pushes ETH here on-receipt.
    receive() external payable {}



    // ── Public views ──
    function quoteBuy(uint256 ethIn) external view returns (uint256 tokensOut) {
        uint256 fee = (ethIn * FEE_BPS) / 10000;
        uint256 ethNet = ethIn - fee;
        uint256 ve = VIRTUAL_ETH + realEthReserves;
        uint256 vt = VIRTUAL_TOKENS - (CURVE_TOKENS - realTokenReserves);
        uint256 k = ve * vt;
        uint256 newVe = ve + ethNet;
        uint256 newVt = k / newVe;
        uint256 out = vt - newVt;
        return out > realTokenReserves ? realTokenReserves : out;
    }

    function quoteSell(uint256 tokenIn) external view returns (uint256 ethOut) {
        uint256 ve = VIRTUAL_ETH + realEthReserves;
        uint256 vt = VIRTUAL_TOKENS - (CURVE_TOKENS - realTokenReserves);
        uint256 k = ve * vt;
        uint256 newVt = vt + tokenIn;
        uint256 newVe = k / newVt;
        uint256 gross = ve - newVe;
        uint256 fee = (gross * FEE_BPS) / 10000;
        return gross - fee;
    }

    /// @notice Spot price in ETH per token (1e18 scaled).
    function getPrice() external view returns (uint256) {
        uint256 ve = VIRTUAL_ETH + realEthReserves;
        uint256 vt = VIRTUAL_TOKENS - (CURVE_TOKENS - realTokenReserves);
        if (vt == 0) return 0;
        return (ve * 1e18) / vt;
    }

    /// @notice 0..10_000 progress to graduation (3 ETH).
    function curveProgressBps() external view returns (uint256) {
        if (realEthReserves >= GRADUATION_THRESHOLD) return 10_000;
        return (realEthReserves * 10_000) / GRADUATION_THRESHOLD;
    }

    function poolKeyTuple()
        external
        view
        returns (address, address, uint24, int24, address)
    {
        return (currency0, currency1, poolFee, tickSpacing, hook);
    }
}
