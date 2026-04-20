// ============================================================================
// eth-create-token
//
// USER-PAYS-GAS deployment flow for Ethereum mainnet (klik.finance-style).
// 
// Flow:
//   1. Frontend calls this with token metadata + LP/tax config.
//   2. Function compiles the taxable ERC-20 (adapted from base-create-token),
//      embeds metadata into the contract bytecode (constructor args),
//      and persists a `pending` row in eth_launch_requests.
//   3. Returns:
//        - launchId (UUID)
//        - bytecode + ABI + constructorArgs (so client can simulate / verify)
//        - encoded deploy transaction { to: null, data, value: 0, chainId: 1 }
//      Client signs + broadcasts via wagmi/viem from the user's own wallet.
//   4. After broadcast, client posts the tx hash + computed token address back
//      to `eth-launch-finalize` (separate function) to mark deployed and seed LP.
// 
// No platform private key required.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  encodeDeployData,
  parseEther,
  getAddress,
  toHex,
} from "https://esm.sh/viem@2.45.1";

// Accept both checksummed and lowercase 0x addresses
const isEvmAddress = (a: unknown): a is string =>
  typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// Taxable ERC-20 with embedded launchpad metadata + tax routing
// Constructor: (name, symbol, recipient, supply, userTaxBps, platformTaxBps,
//               platformTaxWallet, creatorTaxWallet, metadataURI)
// Tax is applied on every transfer except mints/burns and tax-wallet receives.
// ============================================================================
const ERC20_SOLIDITY_SOURCE = `// SPDX-License-Identifier: MIT
// Launched via Saturn Ethereum Launchpad — https://saturn.trade
pragma solidity ^0.8.20;

contract SaturnEthToken {
    string public name;
    string public symbol;
    uint8  public constant decimals = 18;
    uint256 public totalSupply;

    // Embedded launchpad metadata (visible on-chain)
    string  public metadataURI;
    string  public constant launchedBy = "Saturn Launchpad (Ethereum)";
    address public immutable platformTaxWallet;
    address public immutable creatorTaxWallet;
    uint16  public immutable userTaxBps;     // 0..300  (0%..3%)
    uint16  public immutable platformTaxBps; // always 100 (1%)
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public isTaxExempt;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        address _recipient,
        uint256 _supply,
        uint16  _userTaxBps,
        uint16  _platformTaxBps,
        address _platformTaxWallet,
        address _creatorTaxWallet,
        string memory _metadataURI
    ) {
        require(_userTaxBps <= 300, "user tax > 3%");
        require(_platformTaxBps == 100, "platform tax must be 1%");
        require(_platformTaxWallet != address(0), "platform wallet zero");
        require(_creatorTaxWallet != address(0), "creator wallet zero");

        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        balanceOf[_recipient] = _supply;
        emit Transfer(address(0), _recipient, _supply);

        userTaxBps = _userTaxBps;
        platformTaxBps = _platformTaxBps;
        platformTaxWallet = _platformTaxWallet;
        creatorTaxWallet = _creatorTaxWallet;
        metadataURI = _metadataURI;

        owner = _recipient;
        emit OwnershipTransferred(address(0), _recipient);

        isTaxExempt[_recipient] = true;
        isTaxExempt[_platformTaxWallet] = true;
        isTaxExempt[_creatorTaxWallet] = true;
    }

    function setTaxExempt(address account, bool exempt) external onlyOwner {
        isTaxExempt[account] = exempt;
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "ERC20: insufficient balance");

        uint256 sendAmount = value;

        if (!isTaxExempt[from] && !isTaxExempt[to]) {
            uint256 totalTaxBps = uint256(userTaxBps) + uint256(platformTaxBps);
            if (totalTaxBps > 0) {
                uint256 platformCut = (value * platformTaxBps) / 10000;
                uint256 creatorCut  = (value * userTaxBps) / 10000;
                uint256 totalTax    = platformCut + creatorCut;
                sendAmount = value - totalTax;

                unchecked {
                    balanceOf[from] -= totalTax;
                    if (platformCut > 0) {
                        balanceOf[platformTaxWallet] += platformCut;
                        emit Transfer(from, platformTaxWallet, platformCut);
                    }
                    if (creatorCut > 0) {
                        balanceOf[creatorTaxWallet] += creatorCut;
                        emit Transfer(from, creatorTaxWallet, creatorCut);
                    }
                }
            }
        }

        unchecked {
            balanceOf[from] -= sendAmount;
            balanceOf[to]   += sendAmount;
        }
        emit Transfer(from, to, sendAmount);
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
        require(allowed >= value, "ERC20: insufficient allowance");
        if (allowed != type(uint256).max) {
            unchecked { allowance[from][msg.sender] = allowed - value; }
        }
        _transfer(from, to, value);
        return true;
    }
}`;

// Compile cache (per isolate)
let cachedCompilation: { abi: any[]; bytecode: `0x${string}` } | null = null;

async function compileERC20(): Promise<{ abi: any[]; bytecode: `0x${string}` }> {
  if (cachedCompilation) return cachedCompilation;

  const t0 = Date.now();
  console.log("[compile] fetching solc 0.8.20…");
  const solcUrl = "https://binaries.soliditylang.org/bin/soljson-v0.8.20+commit.a1b79de6.js";
  const res = await fetch(solcUrl);
  if (!res.ok) throw new Error(`Failed to fetch solc: HTTP ${res.status}`);
  const solcCode = await res.text();
  console.log(`[compile] solc fetched (${(solcCode.length / 1024 / 1024).toFixed(1)}MB) in ${Date.now() - t0}ms`);

  // Stub Node-only globals that solc's Emscripten build references in Deno
  const moduleObj = { exports: {} as any };
  const stubProcess = { argv: [], env: {}, stdout: { write: () => {} }, stderr: { write: () => {} }, on: () => {}, exit: () => {}, platform: "linux", version: "v18.0.0" };
  const fn = new Function(
    "module", "exports", "require", "process", "__dirname", "__filename", "global",
    solcCode + "\n//# sourceURL=soljson.js"
  );
  fn(moduleObj, moduleObj.exports, () => ({}), stubProcess, "/", "/soljson.js", globalThis);

  const soljson = moduleObj.exports;
  if (!soljson?.cwrap) throw new Error("solc loaded but cwrap missing");
  const compile = soljson.cwrap("solidity_compile", "string", ["string", "number", "number"]);

  const input = JSON.stringify({
    language: "Solidity",
    sources: { "SaturnEthToken.sol": { content: ERC20_SOLIDITY_SOURCE } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  });

  const output = JSON.parse(compile(input, 0, 0));
  if (output.errors) {
    const errs = output.errors.filter((e: any) => e.severity === "error");
    if (errs.length > 0) {
      throw new Error("Solidity compile errors:\n" + errs.map((e: any) => e.formattedMessage || e.message).join("\n"));
    }
  }

  const contract = output.contracts?.["SaturnEthToken.sol"]?.["SaturnEthToken"];
  if (!contract?.evm?.bytecode?.object) throw new Error("Compilation produced no bytecode");
  const bytecode = ("0x" + contract.evm.bytecode.object) as `0x${string}`;
  cachedCompilation = { abi: contract.abi, bytecode };
  console.log(`[compile] ok in ${Date.now() - t0}ms — bytecode ${bytecode.length} chars`);
  return cachedCompilation;
}

// ============================================================================
// Request handler
// ============================================================================
interface LaunchBody {
  name: string;
  ticker: string;
  creatorWallet: string;
  lpEth: number;
  userTaxBps: number;
  platformTaxBps: number;
  burnLp: boolean;
  renounce: boolean;
  description?: string | null;
  imageUrl?: string | null;
  websiteUrl?: string | null;
  twitterUrl?: string | null;
  telegramUrl?: string | null;
}

const ETHEREUM_CHAIN_ID = 1;
// Platform tax receiver — first ETH-equivalent here funds the LP refund stream.
// Defaults to a project-controlled address; override via env if rotated.
const PLATFORM_TAX_WALLET_DEFAULT = "0x000000000000000000000000000000000000dEaD";
// Total supply: 1B tokens (18 decimals)
const TOTAL_SUPPLY_WEI = parseEther("1000000000");

function validate(body: any): { ok: true; data: LaunchBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const { name, ticker, creatorWallet, lpEth, userTaxBps, platformTaxBps } = body;
  if (typeof name !== "string" || name.trim().length < 1 || name.length > 32) return { ok: false, error: "Invalid name" };
  if (typeof ticker !== "string" || ticker.trim().length < 1 || ticker.length > 10) return { ok: false, error: "Invalid ticker" };
  if (!isEvmAddress(creatorWallet)) return { ok: false, error: "Invalid creator wallet" };
  if (typeof lpEth !== "number" || !isFinite(lpEth) || lpEth <= 0 || lpEth > 1000) return { ok: false, error: "Invalid lpEth (0 < x ≤ 1000)" };
  if (typeof userTaxBps !== "number" || !Number.isInteger(userTaxBps) || userTaxBps < 0 || userTaxBps > 300) {
    return { ok: false, error: "userTaxBps must be integer 0–300 (0%–3%)" };
  }
  if (typeof platformTaxBps !== "number" || platformTaxBps !== 100) return { ok: false, error: "Platform tax must be 100 bps (1%)" };
  return { ok: true, data: body as LaunchBody };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const json = await req.json().catch(() => null);
    const result = validate(json);
    if (!result.ok) {
      return new Response(JSON.stringify({ success: false, error: result.error }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = result.data;
    const platformTaxWallet = (Deno.env.get("ETH_PLATFORM_TAX_WALLET") || PLATFORM_TAX_WALLET_DEFAULT) as `0x${string}`;
    const creatorTaxWallet = getAddress(body.creatorWallet) as `0x${string}`;

    // Persist launch intent (before compile so we always have a record)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let launchId: string | null = null;
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data, error } = await supabase
        .from("eth_launch_requests")
        .insert({
          creator_wallet: creatorTaxWallet,
          token_name: body.name.trim(),
          token_ticker: body.ticker.trim().toUpperCase(),
          description: body.description ?? null,
          image_url: body.imageUrl ?? null,
          website_url: body.websiteUrl ?? null,
          twitter_url: body.twitterUrl ?? null,
          telegram_url: body.telegramUrl ?? null,
          lp_eth: body.lpEth,
          user_tax_bps: body.userTaxBps,
          platform_tax_bps: body.platformTaxBps,
          burn_lp: body.burnLp,
          renounce: body.renounce,
          status: "pending_signature",
          lp_refund_owed_eth: body.lpEth,
        })
        .select("id")
        .single();
      if (error) {
        console.error("[eth-create-token] db insert failed:", error);
      } else {
        launchId = data?.id ?? null;
      }
    }

    // Compile ERC-20
    const { abi, bytecode } = await compileERC20();

    // Build metadata URI (compact JSON embedded as constructor arg)
    const metadataURI = JSON.stringify({
      name: body.name.trim(),
      symbol: body.ticker.trim().toUpperCase(),
      description: body.description?.slice(0, 500) ?? "",
      image: body.imageUrl ?? "",
      website: body.websiteUrl ?? "",
      twitter: body.twitterUrl ?? "",
      telegram: body.telegramUrl ?? "",
      launchpad: "saturn-eth-v1",
      launchId: launchId ?? "",
    });

    const constructorArgs = [
      body.name.trim(),
      body.ticker.trim().toUpperCase(),
      creatorTaxWallet,
      TOTAL_SUPPLY_WEI,
      body.userTaxBps,
      body.platformTaxBps,
      platformTaxWallet,
      creatorTaxWallet,
      metadataURI,
    ];

    const deployData = encodeDeployData({
      abi,
      bytecode,
      args: constructorArgs as any,
    });

    return new Response(
      JSON.stringify({
        success: true,
        launchId,
        chainId: ETHEREUM_CHAIN_ID,
        platformTaxWallet,
        creatorTaxWallet,
        totalSupply: TOTAL_SUPPLY_WEI.toString(),
        // Unsigned tx the client should send via wagmi/viem
        deployTx: {
          to: null,
          data: deployData,
          value: "0x0",
          chainId: ETHEREUM_CHAIN_ID,
        },
        // Returned for client-side post-deploy steps (LP add, burn, renounce)
        abi,
        bytecode,
        metadataURI,
        config: {
          lpEth: body.lpEth,
          userTaxBps: body.userTaxBps,
          platformTaxBps: body.platformTaxBps,
          totalTaxBps: body.userTaxBps + body.platformTaxBps,
          burnLp: body.burnLp,
          renounce: body.renounce,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[eth-create-token] error", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
