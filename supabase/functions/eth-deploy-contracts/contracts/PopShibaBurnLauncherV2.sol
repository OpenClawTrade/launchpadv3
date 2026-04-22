// SPDX-License-Identifier: MIT
// PopShiba.com — V2 BURN Launcher (FULLY STANDALONE, no fees, auto-burn LP)
//
// Self-contained: deploys its own minimal ERC20 token inline (no CloneFactory).
// Completely independent from the V3 suite — has its own ownership, its own state,
// shares nothing with PopShibaCloneFactory / PopShibaFeeVault / PopShibaLauncherV3.
//
// Atomic 1-tx flow:
//   1. new PopShibaBurnToken(name, symbol, metadataURI, totalSupply, recipient=this)
//   2. approve V2 router for full supply
//   3. addLiquidityETH (creates WETH pair if missing, seeds full supply + msg.value-devBuy)
//   4. transfer LP tokens to 0x...dEaD  → all aggregators show ✅ "LP Burned"
//   5. (optional) dev buy via V2 router → tokens to creator
//
// No platform fee, no locker fee, no ownership transfer needed.
// msg.value MUST equal ethForLP + ethForDevBuy.
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2Router02 {
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
}

// Minimal ERC20 — fixed supply, no fees, no owner privileges, no taxes.
// All supply minted to `recipient` (the launcher) at construction.
contract PopShibaBurnToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    string public metadataURI;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory metadataURI_,
        uint256 totalSupply_,
        address recipient
    ) {
        name = name_;
        symbol = symbol_;
        metadataURI = metadataURI_;
        totalSupply = totalSupply_;
        balanceOf[recipient] = totalSupply_;
        emit Transfer(address(0), recipient, totalSupply_);
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
            allowance[from][msg.sender] = a - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ERC20: zero to");
        uint256 b = balanceOf[from];
        require(b >= amount, "ERC20: balance");
        unchecked { balanceOf[from] = b - amount; }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract PopShibaBurnLauncherV2 {
    // --- Mainnet constants ---
    address public constant V2_ROUTER  = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address public constant V2_FACTORY = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
    address public constant WETH       = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant DEAD       = 0x000000000000000000000000000000000000dEaD;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    // --- Storage ---
    address public owner;

    event Launched(address indexed token, address indexed creator, address pair, uint256 lpBurned, bool locked);
    event ConfigChanged();

    modifier onlyOwner() { require(msg.sender == owner, "NOT_OWNER"); _; }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO");
        owner = newOwner;
    }

    // --- ABI compatibility shims with V3 launcher ---
    function teamFinanceFeeWei() external pure returns (uint256) { return 0; }
    function uncxLockFeeWei() external pure returns (uint256) { return 0; }
    function quoteTotalCost(uint256 ethForLP, uint256 ethForDevBuy, bool /*lockLP*/) external pure returns (uint256) {
        return ethForLP + ethForDevBuy;
    }

    /// @notice Atomic V2 launch + LP burn + optional dev buy.
    /// @dev `lockLP` arg is accepted but IGNORED — V2-burn always burns LP.
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

        // 1. Deploy fresh standalone ERC20 (full supply minted to this launcher).
        token = address(new PopShibaBurnToken(name_, symbol_, metadataURI_, TOTAL_SUPPLY, address(this)));

        // 2. Approve V2 router for full supply.
        IERC20(token).approve(V2_ROUTER, TOTAL_SUPPLY);

        // 3. addLiquidityETH — creates WETH pair if missing. LP minted to this contract.
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

        // 4. BURN LP to dead address — every aggregator reads this as "LP Burned ✅"
        IERC20(pair).transfer(DEAD, liquidity);
        lpBurned = liquidity;

        // 5. Optional dev buy via V2 router → tokens to creator.
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

        emit Launched(token, msg.sender, pair, liquidity, true);
        unused = 0;
    }

    receive() external payable {}
}
