// SPDX-License-Identifier: MIT
// PopShiba.com — V2 BURN Launcher (no fees, auto-burn LP)
//
// One-tx atomic launch flow:
//   1. Clone PopShibaToken via PopShibaCloneFactory.
//   2. Mint 1B supply to this launcher.
//   3. Approve Uniswap V2 Router for token + ETH.
//   4. addLiquidityETH — creates the WETH pair if missing, seeds it with the
//      full 1B supply + all of msg.value (minus optional dev buy).
//   5. BURN the LP tokens by transferring them to 0x000...dEaD.
//      → Every aggregator (DEXTools, GMGN, DEXScreener, GoPlus, Honeypot.is)
//        sees the LP at the dead address and shows ✅ "LP Burned".
//   6. Optional dev buy: routes through V2 router, tokens go to creator.
//
// No platform fee, no locker fee. msg.value = ethForLP + ethForDevBuy exactly.
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IPopShibaToken {
    function initialize(string memory name_, string memory symbol_, string memory metadataURI_, uint256 totalSupply_, address recipient_) external;
}

interface IPopShibaCloneFactory {
    function deploy(address creator) external returns (address token);
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
    address public cloneFactory;

    event Launched(address indexed token, address indexed creator, address pair, uint256 lpBurned, bool locked);
    event ConfigChanged();

    modifier onlyOwner() { require(msg.sender == owner, "NOT_OWNER"); _; }

    constructor(address _cloneFactory) {
        require(_cloneFactory != address(0), "ZERO_ADDR");
        owner = msg.sender;
        cloneFactory = _cloneFactory;
    }

    // --- Admin ---
    function setCloneFactory(address f) external onlyOwner { cloneFactory = f; emit ConfigChanged(); }
    function transferOwnership(address newOwner) external onlyOwner { require(newOwner != address(0), "ZERO"); owner = newOwner; }

    // --- Views ---
    /// @notice V2 burn launcher charges no extra protocol fee. Returns 0 for ABI compatibility with V3.
    function teamFinanceFeeWei() external pure returns (uint256) { return 0; }
    function uncxLockFeeWei() external pure returns (uint256) { return 0; }

    /// @notice Total ETH the caller must send.
    function quoteTotalCost(uint256 ethForLP, uint256 ethForDevBuy, bool /*lockLP*/) external pure returns (uint256) {
        return ethForLP + ethForDevBuy;
    }

    // --- Main entrypoint ---
    /// @notice Deploy + V2 pool + LP add + LP burn + optional dev buy. Single tx.
    /// @dev Signature mirrors V3 launcher (lockLP arg ignored — V2 always burns).
    /// msg.value MUST equal ethForLP + ethForDevBuy.
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

        // 1. Clone & initialize token (full supply minted to this launcher).
        token = IPopShibaCloneFactory(cloneFactory).deploy(msg.sender);
        IPopShibaToken(token).initialize(name_, symbol_, metadataURI_, TOTAL_SUPPLY, address(this));

        // 2. Approve router for full supply.
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

        // 4. BURN LP tokens to dead address. All scanners read this as "LP Burned ✅".
        IERC20(pair).transfer(DEAD, liquidity);
        lpBurned = liquidity;

        // 5. Optional dev buy via V2 router (tokens → creator).
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
