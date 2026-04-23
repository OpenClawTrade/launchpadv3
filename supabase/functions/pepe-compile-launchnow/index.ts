// Compiles a per-token Solidity source for the LaunchNow PEPE-style ERC20.
// Returns: { bytecode, abi, sourceCode, contractName, fileName }
//
// Key idea:
//   - Each launch gets its OWN unique source (custom header, contract name,
//     filename) so the compiled bytecode is unique → Etherscan returns
//     "Exact Match" with the user-supplied header preserved.
//   - We sanitize the ticker into a valid Solidity identifier
//     (auto-fix: prefix digit-leading, strip non-alnum, fall back to "Token").
//
// solc-js is dynamically imported from esm.sh (WASM under the hood). Cold
// start ~5-10s; warm ~1-2s.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Solidity reserved words we must NOT use as a contract name.
const SOLIDITY_RESERVED = new Set<string>([
  "abstract","address","after","alias","anonymous","apply","as","assembly","auto",
  "bool","break","byte","bytes","calldata","case","catch","constant","constructor",
  "continue","contract","copyof","default","define","delete","do","else","emit",
  "enum","event","external","fallback","false","final","fixed","for","from",
  "function","hex","if","immutable","implements","import","in","indexed","inline",
  "int","interface","internal","is","let","library","mapping","match","memory",
  "modifier","new","null","of","override","partial","payable","pragma","private",
  "promise","public","pure","receive","record","reference","relocatable","require",
  "return","returns","revert","sealed","sizeof","solidity","static","storage",
  "string","struct","super","supports","switch","this","throw","true","try","type",
  "typedef","typeof","ufixed","uint","unchecked","unicode","using","var","view",
  "virtual","void","while","with","yield","Context","Ownable","ERC20","IERC20",
  "PepeToken",
]);

function sanitizeIdentifier(input: string): string {
  let s = String(input ?? "").trim();
  if (!s) return "Token";
  // Strip everything that isn't [A-Za-z0-9_]
  s = s.replace(/[^A-Za-z0-9_]/g, "");
  if (!s) return "Token";
  // Prefix if it starts with a digit
  if (/^[0-9]/.test(s)) s = "T" + s;
  // Avoid reserved words
  if (SOLIDITY_RESERVED.has(s)) s = s + "Token";
  // Cap length
  if (s.length > 32) s = s.slice(0, 32);
  return s;
}

function escapeForSolidityComment(s: unknown): string {
  return String(s ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\*\//g, "* /")
    .trim();
}

function buildHeaderBlock(opts: {
  customHeader?: string;
}): string {
  // Only include SPDX (required by solc) + EXACTLY what the user typed.
  // No auto-added name/ticker banner, no "Launched from" footer, no separators.
  const lines: string[] = ["// SPDX-License-Identifier: MIT"];
  if (opts.customHeader && opts.customHeader.trim()) {
    for (const raw of opts.customHeader.split(/\r?\n/)) {
      const sanitized = raw.replace(/\*\//g, "* /").trimEnd();
      if (!sanitized.trim()) {
        lines.push("//");
        continue;
      }
      lines.push(sanitized.startsWith("//") ? sanitized : `// ${sanitized}`);
    }
  }
  return lines.join("\n");
}

function buildSource(contractName: string, headerBlock: string): string {
  // Same logical contract as contracts/launchnow/PepeToken.sol, with the
  // contract renamed to {contractName} so each launch produces unique bytecode
  // and verifies as Exact Match with its own filename + header.
  return `${headerBlock}
pragma solidity ^0.8.20;

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
}

abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        _transferOwnership(_msgSender());
    }

    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner_, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

abstract contract ERC20 is Context, IERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;
    string private _name;
    string private _symbol;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() public view virtual returns (string memory) { return _name; }
    function symbol() public view virtual returns (string memory) { return _symbol; }
    function decimals() public view virtual returns (uint8) { return 18; }
    function totalSupply() public view virtual override returns (uint256) { return _totalSupply; }
    function balanceOf(address account) public view virtual override returns (uint256) { return _balances[account]; }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        _transfer(_msgSender(), to, amount);
        return true;
    }

    function allowance(address owner_, address spender) public view virtual override returns (uint256) {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        uint256 currentAllowance = _allowances[from][_msgSender()];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            _approve(from, _msgSender(), currentAllowance - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal virtual {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(from, to, amount);

        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");
        _balances[from] = fromBalance - amount;
        _balances[to] += amount;

        emit Transfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        _balances[account] = accountBalance - amount;
        _totalSupply -= amount;

        emit Transfer(account, address(0), amount);
    }

    function _approve(address owner_, address spender, uint256 amount) internal virtual {
        require(owner_ != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner_][spender] = amount;
        emit Approval(owner_, spender, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual {}
}

contract ${contractName} is Ownable, ERC20 {
    bool public limited;
    uint256 public maxHoldingAmount;
    uint256 public minHoldingAmount;
    address public uniswapV2Pair;
    mapping(address => bool) public blacklists;

    constructor(string memory name_, string memory symbol_, uint256 totalSupply_) ERC20(name_, symbol_) {
        _mint(msg.sender, totalSupply_);
    }

    function blacklist(address _address, bool _isBlacklisting) external onlyOwner {
        blacklists[_address] = _isBlacklisting;
    }

    function setRule(bool _limited, address _uniswapV2Pair, uint256 _maxHoldingAmount, uint256 _minHoldingAmount) external onlyOwner {
        limited = _limited;
        uniswapV2Pair = _uniswapV2Pair;
        maxHoldingAmount = _maxHoldingAmount;
        minHoldingAmount = _minHoldingAmount;
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        require(!blacklists[to] && !blacklists[from], "Blacklisted");

        if (uniswapV2Pair == address(0)) {
            require(from == owner() || to == owner(), "trading is not started");
            return;
        }

        if (limited && from == uniswapV2Pair) {
            require(super.balanceOf(to) + amount <= maxHoldingAmount && super.balanceOf(to) + amount >= minHoldingAmount, "Forbid");
        }
    }

    function burn(uint256 value) external {
        _burn(msg.sender, value);
    }
}
`;
}

// Cache the loaded solc compiler across warm invocations.
let cachedSolc: any = null;

async function loadSolc(): Promise<any> {
  if (cachedSolc) return cachedSolc;
  // Pin solc 0.8.28 (matches existing PEPE_LIKE_BYTECODE compiler version + commit).
  const mod: any = await import("https://esm.sh/solc@0.8.28?bundle");
  cachedSolc = mod.default ?? mod;
  return cachedSolc;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const name: string | undefined = body?.name;
    const ticker: string | undefined = body?.ticker;
    const description: string | undefined = body?.description;
    const customHeader: string | undefined = body?.customHeader;

    if (!name || !ticker) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing name/ticker" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contractName = sanitizeIdentifier(ticker);
    const fileName = `${contractName}.sol`;

    // Use ONLY the user-supplied header text. Fall back to description if no
    // explicit customHeader was provided. Nothing else gets injected.
    const headerBlock = buildHeaderBlock({
      customHeader: customHeader ?? description,
    });
    const sourceCode = buildSource(contractName, headerBlock);

    console.log(`[pepe-compile-launchnow] compiling ${fileName} (contract ${contractName})`);

    const solc = await loadSolc();

    const input = {
      language: "Solidity",
      sources: {
        [fileName]: { content: sourceCode },
      },
      settings: {
        evmVersion: "paris",
        optimizer: { enabled: true, runs: 200 },
        outputSelection: {
          "*": { "*": ["abi", "evm.bytecode.object"] },
        },
      },
    };

    const outputRaw = solc.compile(JSON.stringify(input));
    const output = JSON.parse(outputRaw);

    // Surface compiler errors (warnings are fine)
    const fatalErrors = (output?.errors ?? []).filter(
      (e: any) => e?.severity === "error",
    );
    if (fatalErrors.length > 0) {
      console.error("[pepe-compile-launchnow] compile errors", fatalErrors);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Compile failed: ${fatalErrors[0]?.formattedMessage ?? fatalErrors[0]?.message ?? "unknown"}`,
          details: fatalErrors,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contract = output?.contracts?.[fileName]?.[contractName];
    const bytecode = contract?.evm?.bytecode?.object;
    const abi = contract?.abi;

    if (!bytecode || !abi) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Compile produced no bytecode/abi",
          rawKeys: Object.keys(output?.contracts?.[fileName] ?? {}),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        bytecode: `0x${bytecode}`,
        abi,
        sourceCode,
        contractName,
        fileName,
        compilerVersion: "v0.8.28+commit.7893614a",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[pepe-compile-launchnow]", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
