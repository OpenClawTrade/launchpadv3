// In-flight Solidity compilation for the V2-Fees launcher.
// Mirrors the bnb-deploy-portal pattern: fetch soljson from binaries.soliditylang.org,
// instantiate it in a Function() sandbox, run solidity_compile, return the bytecode + abi.
//
// We compile on-demand (only when the v2fees deploy button is clicked) so we don't
// have to ship large precompiled bytecode for this variant — the Solidity source is
// the source of truth and we can iterate without an offline compile step.

const SOLC_URL = "https://binaries.soliditylang.org/bin/soljson-v0.8.20+commit.a1b79de6.js";

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

let cachedSolc: any = null;

/**
 * Load solc inside Deno. soljson.js (the raw emscripten build) references
 * Node-only globals like `__dirname` / `process`, which blow up in the Deno
 * sandbox with "__dirname is not defined". The `solc` npm wrapper handles
 * those shims for us, so we use `npm:solc@0.8.20` directly.
 */
async function loadSolc(): Promise<any> {
  if (cachedSolc) return cachedSolc;
  console.log("[v2fees-compile] loading npm:solc@0.8.20...");
  const t0 = Date.now();
  const mod: any = await import("npm:solc@0.8.20");
  cachedSolc = mod.default ?? mod;
  if (typeof cachedSolc.compile !== "function") {
    throw new Error("solc loaded but .compile is not a function");
  }
  console.log(`[v2fees-compile] solc ready in ${Date.now() - t0}ms`);
  return cachedSolc;
}


export async function compilePopShibaFeesLauncherV2(): Promise<{ abi: any[]; bytecode: `0x${string}` }> {
  const solc = await loadSolc();

  const input = JSON.stringify({
    language: "Solidity",
    sources: { "PopShibaFeesLauncherV2.sol": { content: POPSHIBA_FEES_LAUNCHER_V2_SOURCE } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  });

  const t1 = Date.now();
  const output = JSON.parse(solc.compile(input));
  console.log(`[v2fees-compile] solidity_compile done in ${Date.now() - t1}ms`);


  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === "error");
    if (errors.length > 0) {
      throw new Error(`Compilation errors:\n${errors.map((e: any) => e.formattedMessage || e.message).join("\n")}`);
    }
  }

  const c = output.contracts?.["PopShibaFeesLauncherV2.sol"]?.["PopShibaFeesLauncherV2"];
  if (!c) throw new Error("PopShibaFeesLauncherV2 not found in compiler output");
  const bytecodeHex = c.evm?.bytecode?.object;
  if (!bytecodeHex || bytecodeHex.length < 100) throw new Error("Invalid bytecode from compiler");
  return { abi: c.abi, bytecode: `0x${bytecodeHex}` as `0x${string}` };
}
