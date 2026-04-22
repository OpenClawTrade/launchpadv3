// Source-only copy of the V2-Fees launcher Solidity for Etherscan verification.
// Kept in this function's directory because Supabase edge functions cannot
// import from sibling function folders during bundling.

export const POPSHIBA_FEES_LAUNCHER_V2_SOURCE = `// SPDX-License-Identifier: MIT
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

contract PopShibaFeesToken {
    string  public name;
    string  public symbol;
    uint8   public constant decimals = 18;
    uint256 public totalSupply;
    string  public metadataURI;

    address public immutable launcher;
    address public immutable feeRecipient;
    uint16  public constant  FEE_BPS = 100;

    address public pair;
    bool    private _pairSet;

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

        bool isSwap = _pairSet && !_inSwap && (from == pair || to == pair);
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
            if (to == pair) { _swapAndForward(); }
        } else {
            balanceOf[to] += amount;
            emit Transfer(from, to, amount);
        }
    }

    function _swapAndForward() internal lockSwap {
        uint256 balance = balanceOf[address(this)];
        if (balance == 0) return;
        allowance[address(this)][router] = balance;
        emit Approval(address(this), router, balance);
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = weth;
        try IUniswapV2Router02(router).swapExactTokensForETHSupportingFeeOnTransferTokens(
            balance, 0, path, feeRecipient, block.timestamp
        ) { emit FeeForwarded(balance, 0); } catch {}
    }

    receive() external payable {}
}

contract PopShibaFeesLauncherV2 {
    address public constant V2_ROUTER  = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address public constant V2_FACTORY = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
    address public constant WETH       = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant DEAD       = 0x000000000000000000000000000000000000dEaD;
    address public constant FEE_RECIPIENT = 0x9FD5f2E480F43320E8F65072A739c941cb5b10B0;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;

    address public owner;

    event Launched(address indexed token, address indexed creator, address pair, uint256 lpBurned, address feeRecipient);

    modifier onlyOwner() { require(msg.sender == owner, "NOT_OWNER"); _; }

    constructor() { owner = msg.sender; }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO");
        owner = newOwner;
    }

    function teamFinanceFeeWei() external pure returns (uint256) { return 0; }
    function uncxLockFeeWei() external pure returns (uint256) { return 0; }
    function quoteTotalCost(uint256 ethForLP, uint256 ethForDevBuy, bool) external pure returns (uint256) {
        return ethForLP + ethForDevBuy;
    }

    function launch(
        string calldata name_,
        string calldata symbol_,
        string calldata metadataURI_,
        uint256 ethForLP,
        uint256 ethForDevBuy,
        bool
    ) external payable returns (address token, address pair, uint256 lpBurned, uint256 unused) {
        require(ethForLP > 0, "LP=0");
        require(msg.value == ethForLP + ethForDevBuy, "BAD_VALUE");

        token = address(new PopShibaFeesToken(
            name_, symbol_, metadataURI_,
            TOTAL_SUPPLY, address(this),
            FEE_RECIPIENT, V2_ROUTER, WETH
        ));

        IERC20(token).approve(V2_ROUTER, TOTAL_SUPPLY);

        ( , , uint256 liquidity) = IUniswapV2Router02(V2_ROUTER).addLiquidityETH{value: ethForLP}(
            token, TOTAL_SUPPLY, 0, 0, address(this), block.timestamp + 600
        );

        pair = IUniswapV2Factory(V2_FACTORY).getPair(token, WETH);
        require(pair != address(0), "NO_PAIR");

        PopShibaFeesToken(payable(token)).setPair(pair);

        IERC20(pair).transfer(DEAD, liquidity);
        lpBurned = liquidity;

        if (ethForDevBuy > 0) {
            address[] memory path = new address[](2);
            path[0] = WETH;
            path[1] = token;
            IUniswapV2Router02(V2_ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{value: ethForDevBuy}(
                0, path, msg.sender, block.timestamp + 600
            );
        }

        emit Launched(token, msg.sender, pair, liquidity, FEE_RECIPIENT);
        unused = 0;
    }

    receive() external payable {}
}
`;
