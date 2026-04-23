// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IPopBondingToken {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

interface IPopEventBus {
    function emitTrade(
        address token, address curve, address trader, bool isBuy,
        uint256 ethAmount, uint256 tokenAmount, uint256 fee,
        uint256 newRealEth, uint256 newRealTokens
    ) external;
    function emitGraduation(address token, address curve, uint256 ethToLp, uint256 tokensToLp) external;
}

interface IPopLpLocker {
    function lockGraduationLiquidity(address token, uint256 tokenAmount) external payable;
}

/// @title PopBondingCurve
/// @notice Constant-product bonding curve. Math is bit-identical to Unicurve:
///   virtualEth = 1.06 ETH, virtualTokens = 1.073B, curveTokens = 792.857142857B,
///   gradThreshold = 3 ETH real reserves, fee = 1% on ETH leg split 50/50
///   between creator and protocol. Once realEth >= 3, the next buy auto-graduates:
///   any leftover tokens + the 3 ETH are forwarded to the LP locker which
///   seeds a Uniswap V3 1% pool and burns the LP NFT (locked forever).
contract PopBondingCurve {
    // ── Constants (immutable across all curves, baked into impl) ──
    uint256 public constant TOTAL_SUPPLY        = 1_000_000_000e18;
    uint256 public constant CURVE_TOKENS        = 792_857_143e18;        // sold via curve
    uint256 public constant LP_TOKENS           = TOTAL_SUPPLY - CURVE_TOKENS; // 207_142_857e18 → V3 LP
    uint256 public constant VIRTUAL_ETH         = 1.06 ether;
    uint256 public constant VIRTUAL_TOKENS      = 1_073_000_000e18;
    uint256 public constant GRADUATION_THRESHOLD = 3 ether;
    uint16  public constant FEE_BPS             = 100;   // 1%
    uint16  public constant CREATOR_SHARE_BPS   = 5000;  // 50% of fee
    uint16  public constant PROTOCOL_SHARE_BPS  = 5000;  // 50% of fee

    // ── Per-curve state ──
    address public token;
    address public creator;
    address public factory;
    address public eventBus;
    address public lpLocker;
    address public protocolTreasury;
    bool    public graduated;
    bool    private _initialized;
    uint256 private _locked;

    uint256 public realEthReserves;       // ETH paid in net of fee, available for sells
    uint256 public realTokenReserves;     // tokens still held by curve for sale
    uint256 public creatorFeesAccrued;    // pending claim
    uint256 public protocolFeesAccrued;   // swept by factory owner

    event Buy(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 fee, uint256 newRealEth, uint256 newRealTokens);
    event Sell(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 fee, uint256 newRealEth, uint256 newRealTokens);
    event Graduated(uint256 ethToLp, uint256 tokensToLp);
    event CreatorFeeClaimed(address indexed creator, uint256 amount);

    modifier nonReentrant() {
        require(_locked == 0, "reent");
        _locked = 1; _; _locked = 0;
    }

    function initialize(
        address _token,
        address _creator,
        address _factory,
        address _eventBus,
        address _lpLocker,
        address _protocolTreasury
    ) external {
        require(!_initialized, "init");
        _initialized = true;
        token = _token;
        creator = _creator;
        factory = _factory;
        eventBus = _eventBus;
        lpLocker = _lpLocker;
        protocolTreasury = _protocolTreasury;
        realTokenReserves = CURVE_TOKENS;
    }

    /// @notice Quote tokens out for a given ETH input (post-fee).
    function quoteBuy(uint256 ethIn) public view returns (uint256 tokensOut) {
        if (graduated || ethIn == 0) return 0;
        uint256 fee = (ethIn * FEE_BPS) / 10000;
        uint256 ethNet = ethIn - fee;
        uint256 ve = VIRTUAL_ETH + realEthReserves;
        uint256 vt = VIRTUAL_TOKENS - (CURVE_TOKENS - realTokenReserves);
        // x*y=k  →  tokensOut = vt - k/(ve+ethNet)
        uint256 k = ve * vt;
        uint256 newVe = ve + ethNet;
        uint256 newVt = k / newVe;
        tokensOut = vt - newVt;
        if (tokensOut > realTokenReserves) tokensOut = realTokenReserves;
    }

    /// @notice Quote ETH out for a given token sell.
    function quoteSell(uint256 tokenIn) public view returns (uint256 ethOut) {
        if (graduated || tokenIn == 0 || tokenIn > (CURVE_TOKENS - realTokenReserves)) return 0;
        uint256 ve = VIRTUAL_ETH + realEthReserves;
        uint256 vt = VIRTUAL_TOKENS - (CURVE_TOKENS - realTokenReserves);
        uint256 k = ve * vt;
        uint256 newVt = vt + tokenIn;
        uint256 newVe = k / newVt;
        uint256 ethGross = ve - newVe;
        uint256 fee = (ethGross * FEE_BPS) / 10000;
        ethOut = ethGross - fee;
    }

    /// @notice Buy tokens from the curve.
    function buy(uint256 minTokensOut, address recipient) external payable nonReentrant returns (uint256 tokensOut) {
        require(!graduated, "grad");
        require(msg.value > 0, "value");
        uint256 fee = (msg.value * FEE_BPS) / 10000;
        uint256 ethNet = msg.value - fee;
        uint256 creatorCut = (fee * CREATOR_SHARE_BPS) / 10000;
        uint256 protoCut = fee - creatorCut;
        creatorFeesAccrued += creatorCut;
        protocolFeesAccrued += protoCut;

        tokensOut = quoteBuy(msg.value);
        require(tokensOut >= minTokensOut && tokensOut > 0, "slip");

        realEthReserves += ethNet;
        realTokenReserves -= tokensOut;
        require(IPopBondingToken(token).transfer(recipient, tokensOut), "xfer");

        emit Buy(msg.sender, msg.value, tokensOut, fee, realEthReserves, realTokenReserves);
        IPopEventBus(eventBus).emitTrade(token, address(this), msg.sender, true,
            msg.value, tokensOut, fee, realEthReserves, realTokenReserves);

        if (realEthReserves >= GRADUATION_THRESHOLD) _graduate();
    }

    /// @notice Sell tokens back to the curve.
    function sell(uint256 tokenAmount, uint256 minEthOut) external nonReentrant returns (uint256 ethOut) {
        require(!graduated, "grad");
        require(tokenAmount > 0, "amt");
        ethOut = quoteSell(tokenAmount);
        require(ethOut >= minEthOut && ethOut > 0, "slip");

        // pull tokens via transferFrom-equivalent: caller must have transferred first OR we use transferFrom.
        // To keep ABI simple we require approval pattern via a helper; do transferFrom inline.
        (bool ok, bytes memory data) = token.call(abi.encodeWithSignature(
            "transferFrom(address,address,uint256)", msg.sender, address(this), tokenAmount));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "pull");

        // gross ETH the user "earned" on curve (before fee already removed in quoteSell)
        uint256 ve = VIRTUAL_ETH + realEthReserves;
        uint256 vt = VIRTUAL_TOKENS - (CURVE_TOKENS - realTokenReserves);
        uint256 k = ve * vt;
        uint256 newVt = vt + tokenAmount;
        uint256 newVe = k / newVt;
        uint256 ethGross = ve - newVe;
        uint256 fee = ethGross - ethOut;
        uint256 creatorCut = (fee * CREATOR_SHARE_BPS) / 10000;
        uint256 protoCut = fee - creatorCut;
        creatorFeesAccrued += creatorCut;
        protocolFeesAccrued += protoCut;

        realEthReserves -= ethGross;
        realTokenReserves += tokenAmount;

        (bool sent,) = msg.sender.call{value: ethOut}("");
        require(sent, "eth");

        emit Sell(msg.sender, tokenAmount, ethOut, fee, realEthReserves, realTokenReserves);
        IPopEventBus(eventBus).emitTrade(token, address(this), msg.sender, false,
            ethOut, tokenAmount, fee, realEthReserves, realTokenReserves);
    }

    function _graduate() internal {
        graduated = true;
        uint256 ethToLp = realEthReserves;     // exactly 3 ETH (or slightly more)
        // The factory pre-funded the curve with CURVE_TOKENS only. For LP we
        // need LP_TOKENS — those are minted to the curve by the factory at
        // graduation time (see notifyGraduation). For now forward whatever
        // tokens we still hold.
        uint256 tokensToLp = IPopBondingToken(token).balanceOf(address(this));
        require(IPopBondingToken(token).transfer(lpLocker, tokensToLp), "lpx");
        realEthReserves = 0;
        realTokenReserves = 0;
        IPopLpLocker(lpLocker).lockGraduationLiquidity{value: ethToLp}(token, tokensToLp);
        emit Graduated(ethToLp, tokensToLp);
        IPopEventBus(eventBus).emitGraduation(token, address(this), ethToLp, tokensToLp);
    }

    /// @notice Curve progress 0..10000 from real ETH reserves.
    function curveProgressBps() external view returns (uint256) {
        if (graduated) return 10000;
        uint256 p = (realEthReserves * 10000) / GRADUATION_THRESHOLD;
        return p > 10000 ? 10000 : p;
    }

    function getPrice() external view returns (uint256) {
        uint256 ve = VIRTUAL_ETH + realEthReserves;
        uint256 vt = VIRTUAL_TOKENS - (CURVE_TOKENS - realTokenReserves);
        if (vt == 0) return 0;
        return (ve * 1e18) / vt;
    }

    function claimCreatorFees() external nonReentrant {
        require(msg.sender == creator, "auth");
        uint256 amt = creatorFeesAccrued;
        require(amt > 0, "0");
        creatorFeesAccrued = 0;
        (bool ok,) = creator.call{value: amt}("");
        require(ok, "send");
        emit CreatorFeeClaimed(creator, amt);
    }

    /// @notice Sweep accumulated protocol fees to the treasury. Anyone can call.
    function sweepProtocolFees() external nonReentrant {
        uint256 amt = protocolFeesAccrued;
        require(amt > 0, "0");
        protocolFeesAccrued = 0;
        (bool ok,) = protocolTreasury.call{value: amt}("");
        require(ok, "send");
    }

    receive() external payable {}
}
