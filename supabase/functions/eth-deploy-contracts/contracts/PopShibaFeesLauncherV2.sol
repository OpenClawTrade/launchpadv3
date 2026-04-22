// SPDX-License-Identifier: MIT
// PopShiba.com — V2 FEES Launcher (FULLY STANDALONE, fixed 1% swap fee → platform wallet)
//
// Self-contained: deploys its own fee-on-transfer ERC20 token inline (no CloneFactory).
// Completely independent from V3 / V2-burn — has its own ownership, its own state, shares
// nothing with the rest of the suite.
//
// Atomic 1-tx flow:
//   1. new PopShibaFeesToken(name, symbol, metadataURI, totalSupply, recipient=this,
//                            uniV2Pair=address(0) initially, feeRecipient)
//   2. approve V2 router for full supply
//   3. addLiquidityETH (creates WETH pair, seeds full supply + ethForLP)
//   4. token.setPair(pair) so the fee logic knows which transfers are swaps
//   5. transfer LP tokens to 0x...dEaD  → all aggregators show ✅ "LP Burned"
//   6. (optional) dev buy via V2 router → tokens to creator
//
// The token charges a fixed 1% (100 bps) tax on swap-related transfers (transfers
// where `from == pair` (a buy) or `to == pair` (a sell)). The taxed tokens are
// auto-swapped back to ETH inside the same transaction (when selling) and forwarded
// to the platform wallet 0x9FD5f2E480F43320E8F65072A739c941cb5b10B0. There is no
// creator share — 1% always goes to the platform wallet, in ETH.
//
// `msg.value` MUST equal `ethForLP + ethForDevBuy`.
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2Router02 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

// =====================================================================
// Fee-on-transfer ERC20.
//   - Fixed 1% tax on swap transfers (from==pair OR to==pair).
//   - Tax accumulates inside the contract until a sell triggers the
//     internal swap-back-to-ETH and forwards to feeRecipient.
//   - Buyers pay nothing extra: the 1% is taken from the token amount they
//     receive (typical fee-on-transfer behaviour).
//   - Sellers pay nothing extra: 1% of their sell input becomes the
//     contract's own balance, which is then sold for ETH inside the same
//     swap and forwarded.
// Safety:
//   - No owner can change fee, recipient, or pair after launch (immutable
//     once setPair is called by the launcher).
//   - No mint, no burn-from-anyone, no blacklist, no max-tx, no max-wallet.
//   - Pair setter is one-shot and can only be called by the launcher that
//     created the token.
// =====================================================================
contract PopShibaFeesToken {
    string  public name;
    string  public symbol;
    uint8   public constant decimals = 18;
    uint256 public totalSupply;
    string  public metadataURI;

    address public immutable launcher;
    address public immutable feeRecipient;
    uint16  public constant  FEE_BPS = 100; // 1%

    // The Uniswap V2 pair against WETH. Set ONCE by the launcher right after
    // addLiquidityETH so we know which transfers are "swaps".
    address public pair;
    bool    private _pairSet;

    // Reentrancy guard for the auto-swap-back path.
    bool private _inSwap;
    modifier lockSwap() { _inSwap = true; _; _inSwap = false; }

    address public immutable router;
    address public immutable weth;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event FeeForwarded(uint256 tokenAmount, uint256 ethAmount);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory metadataURI_,
        uint256 totalSupply_,
        address recipient_,
        address feeRecipient_,
        address router_,
        address weth_
    ) {
        require(feeRecipient_ != address(0), "ZERO_FEE_RECIPIENT");
        require(router_ != address(0), "ZERO_ROUTER");
        require(weth_ != address(0), "ZERO_WETH");

        name = name_;
        symbol = symbol_;
        metadataURI = metadataURI_;
        totalSupply = totalSupply_;
        balanceOf[recipient_] = totalSupply_;

        launcher = msg.sender;
        feeRecipient = feeRecipient_;
        router = router_;
        weth = weth_;

        emit Transfer(address(0), recipient_, totalSupply_);
    }

    /// @notice One-shot: launcher tells us the pair address right after creation.
    /// @dev    After this is called, `pair` is immutable forever.
    function setPair(address pair_) external {
        require(msg.sender == launcher, "ONLY_LAUNCHER");
        require(!_pairSet, "PAIR_SET");
        require(pair_ != address(0), "ZERO_PAIR");
        pair = pair_;
        _pairSet = true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            require(a >= amount, "ERC20: allowance");
            unchecked { allowance[from][msg.sender] = a - amount; }
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ERC20: zero to");
        uint256 b = balanceOf[from];
        require(b >= amount, "ERC20: balance");
        unchecked { balanceOf[from] = b - amount; }

        // No fee until pair is wired. No fee on internal swap-back path.
        // No fee on transfers that don't involve the pair.
        bool isSwap = _pairSet && !_inSwap && (from == pair || to == pair);
        // Never tax the launcher seeding LP, the router, or the contract itself.
        bool excluded = (from == launcher) || (to == launcher)
                      || (from == address(this)) || (to == address(this))
                      || (from == router) || (to == router);

        if (isSwap && !excluded) {
            uint256 fee = (amount * FEE_BPS) / 10000;
            uint256 net = amount - fee;
            balanceOf[address(this)] += fee;
            emit Transfer(from, address(this), fee);
            balanceOf[to] += net;
            emit Transfer(from, to, net);

            // Trigger swap-back ONLY on sells (to == pair). Buys can't swap-back
            // safely (would call into the pair we are mid-trading with).
            if (to == pair) {
                _swapAndForward();
            }
        } else {
            balanceOf[to] += amount;
            emit Transfer(from, to, amount);
        }
    }

    function _swapAndForward() internal lockSwap {
        uint256 balance = balanceOf[address(this)];
        if (balance == 0) return;

        // Approve router for the accumulated fee tokens.
        allowance[address(this)][router] = balance;
        emit Approval(address(this), router, balance);

        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = weth;

        // amountOutMin = 0 — we don't want to revert the user's swap if our tiny
        // fee swap can't fill. Worst case fees stay in the contract for next time.
        try IUniswapV2Router02(router).swapExactTokensForETHSupportingFeeOnTransferTokens(
            balance,
            0,
            path,
            feeRecipient,
            block.timestamp
        ) {
            emit FeeForwarded(balance, 0);
        } catch {
            // swallow — leftover tokens remain for next sell to retry
        }
    }

    receive() external payable {}
}

// =====================================================================
// Launcher: deploys a single PopShibaFeesToken, seeds full LP, burns LP,
// wires the pair address, optionally dev-buys.
// Stateless, no admin, immutable settings (FEE_RECIPIENT is a constant).
// =====================================================================
contract PopShibaFeesLauncherV2 {
    // --- Mainnet constants ---
    address public constant V2_ROUTER  = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address public constant V2_FACTORY = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
    address public constant WETH       = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant DEAD       = 0x000000000000000000000000000000000000dEaD;

    // Fixed platform wallet — 1% of every swap is forwarded here as ETH.
    address public constant FEE_RECIPIENT = 0x9FD5f2E480F43320E8F65072A739c941cb5b10B0;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    // --- Storage ---
    address public owner;

    event Launched(address indexed token, address indexed creator, address pair, uint256 lpBurned, address feeRecipient);

    modifier onlyOwner() { require(msg.sender == owner, "NOT_OWNER"); _; }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO");
        owner = newOwner;
    }

    // --- ABI compatibility shims (matches V2-burn signature exactly) ---
    function teamFinanceFeeWei() external pure returns (uint256) { return 0; }
    function uncxLockFeeWei() external pure returns (uint256) { return 0; }
    function quoteTotalCost(uint256 ethForLP, uint256 ethForDevBuy, bool /*lockLP*/) external pure returns (uint256) {
        return ethForLP + ethForDevBuy;
    }

    /// @notice Atomic V2-fees launch + LP burn + optional dev buy.
    /// @dev    `lockLP` arg is accepted but IGNORED — we always burn LP and the
    ///         1% swap fee handles ongoing economics (no LP fees to collect).
    function launch(
        string calldata name_,
        string calldata symbol_,
        string calldata metadataURI_,
        uint256 ethForLP,
        uint256 ethForDevBuy,
        bool /*lockLP*/
    ) external payable returns (address token, address pair, uint256 lpBurned, uint256 unused) {
        require(ethForLP > 0, "LP=0");
        require(msg.value == ethForLP + ethForDevBuy, "BAD_VALUE");

        // 1. Deploy fresh standalone fee-on-transfer ERC20.
        token = address(new PopShibaFeesToken(
            name_,
            symbol_,
            metadataURI_,
            TOTAL_SUPPLY,
            address(this),
            FEE_RECIPIENT,
            V2_ROUTER,
            WETH
        ));

        // 2. Approve V2 router for full supply.
        IERC20(token).approve(V2_ROUTER, TOTAL_SUPPLY);

        // 3. addLiquidityETH — creates WETH pair if missing. LP minted to this contract.
        // The token's setPair() isn't wired yet, so this seed transfer is fee-free
        // (the pair address is unknown so the swap branch can't fire).
        ( , , uint256 liquidity) = IUniswapV2Router02(V2_ROUTER).addLiquidityETH{value: ethForLP}(
            token,
            TOTAL_SUPPLY,
            0,
            0,
            address(this),
            block.timestamp + 600
        );

        pair = IUniswapV2Factory(V2_FACTORY).getPair(token, WETH);
        require(pair != address(0), "NO_PAIR");

        // 4. Wire the pair into the token so future swaps get taxed.
        PopShibaFeesToken(payable(token)).setPair(pair);

        // 5. BURN LP — every aggregator reads dead-address LP balance as ✅ "LP Burned"
        IERC20(pair).transfer(DEAD, liquidity);
        lpBurned = liquidity;

        // 6. Optional dev buy. Buys pay the 1% fee (received tokens reduced by 1%).
        if (ethForDevBuy > 0) {
            address[] memory path = new address[](2);
            path[0] = WETH;
            path[1] = token;
            IUniswapV2Router02(V2_ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{value: ethForDevBuy}(
                0,
                path,
                msg.sender,
                block.timestamp + 600
            );
        }

        emit Launched(token, msg.sender, pair, liquidity, FEE_RECIPIENT);
        unused = 0;
    }

    receive() external payable {}
}
