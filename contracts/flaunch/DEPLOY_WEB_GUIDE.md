# 🐟 Tuna Flaunch - Web Deployment Guide (Remix IDE)

This guide walks you through deploying the Flaunch contracts using **Remix IDE** (browser-based, no CLI required).

---

## Prerequisites

1. **MetaMask** wallet with Base Sepolia ETH
2. Get testnet ETH: https://www.alchemy.com/faucets/base-sepolia

---

## Step 1: Open Remix IDE

👉 **Go to:** https://remix.ethereum.org

---

## Step 2: Create Contract Files

In Remix, create a new folder called `flaunch` and add these files:

### 2.1 Create `TunaFlETH.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TunaFlETH
 * @notice Yield-bearing ETH wrapper (Flaunch.gg replica)
 */
contract TunaFlETH is ERC20, ERC20Permit, Ownable, ReentrancyGuard {
    address public yieldStrategy;
    uint256 public totalDeposited;
    uint256 public totalYieldEarned;
    bool public depositsPaused;

    event Deposit(address indexed from, uint256 ethAmount, uint256 flethMinted);
    event Withdraw(address indexed to, uint256 flethBurned, uint256 ethReturned);

    constructor() 
        ERC20("Tuna Flaunch ETH", "flETH") 
        ERC20Permit("Tuna Flaunch ETH")
        Ownable(msg.sender) 
    {}

    function deposit() external payable nonReentrant returns (uint256 shares) {
        require(!depositsPaused, "Deposits paused");
        require(msg.value > 0, "Must deposit ETH");
        
        shares = msg.value; // 1:1 ratio for simplicity
        totalDeposited += msg.value;
        _mint(msg.sender, shares);
        
        emit Deposit(msg.sender, msg.value, shares);
    }

    function withdraw(uint256 shares) external nonReentrant returns (uint256 ethAmount) {
        require(shares > 0, "Must withdraw > 0");
        require(balanceOf(msg.sender) >= shares, "Insufficient balance");
        
        ethAmount = shares; // 1:1 ratio
        totalDeposited -= ethAmount;
        _burn(msg.sender, shares);
        
        payable(msg.sender).transfer(ethAmount);
        emit Withdraw(msg.sender, shares, ethAmount);
    }

    function setYieldStrategy(address strategy) external onlyOwner {
        yieldStrategy = strategy;
    }

    function pauseDeposits(bool paused) external onlyOwner {
        depositsPaused = paused;
    }

    receive() external payable {
        this.deposit();
    }
}
```

### 2.2 Create `TunaMemecoin.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TunaMemecoin
 * @notice Standard ERC20 memecoin with 1B supply
 */
contract TunaMemecoin is ERC20, Ownable {
    string private _tokenURI;
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether;
    bool public mintingFinished;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory tokenUri_,
        address initialOwner_
    ) ERC20(name_, symbol_) Ownable(initialOwner_) {
        _tokenURI = tokenUri_;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(!mintingFinished, "Minting finished");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    function finishMinting() external onlyOwner {
        mintingFinished = true;
    }

    function tokenURI() external view returns (string memory) {
        return _tokenURI;
    }

    function setTokenURI(string memory newUri) external onlyOwner {
        _tokenURI = newUri;
    }
}
```

### 2.3 Create `TunaFlaunch.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title TunaFlaunch
 * @notice ERC721 NFT representing ownership of a token's fee stream
 */
contract TunaFlaunch is ERC721, Ownable {
    using Strings for uint256;

    struct TokenInfo {
        address memecoin;
        address payable treasury;
        string name;
        string symbol;
        uint24 creatorFee;
    }

    string public baseURI;
    uint256 public nextTokenId = 1;
    address public positionManager;

    mapping(uint256 => TokenInfo) public tokenInfo;
    mapping(address => uint256) public tokenIdByMemecoin;

    event TokenLaunched(uint256 indexed tokenId, address memecoin, string name, string symbol);

    constructor(string memory baseURI_) 
        ERC721("Tuna Revenue Streams", "TUNA-STREAM") 
        Ownable(msg.sender) 
    {
        baseURI = baseURI_;
    }

    function setPositionManager(address pm) external onlyOwner {
        positionManager = pm;
    }

    function flaunch(
        string calldata name,
        string calldata symbol,
        string calldata tokenUri,
        address creator,
        uint24 creatorFeeAllocation
    ) external returns (address memecoin, uint256 tokenId) {
        require(msg.sender == positionManager || msg.sender == owner(), "Not authorized");
        require(creatorFeeAllocation <= 10000, "Fee > 100%");

        tokenId = nextTokenId++;
        
        // Deploy memecoin
        TunaMemecoin newToken = new TunaMemecoin(name, symbol, tokenUri, address(this));
        memecoin = address(newToken);
        
        // Store info
        tokenInfo[tokenId] = TokenInfo({
            memecoin: memecoin,
            treasury: payable(creator),
            name: name,
            symbol: symbol,
            creatorFee: creatorFeeAllocation
        });
        
        tokenIdByMemecoin[memecoin] = tokenId;
        
        // Mint NFT to creator
        _mint(creator, tokenId);
        
        // Mint initial supply to position manager or caller
        address mintTo = positionManager != address(0) ? positionManager : msg.sender;
        newToken.mint(mintTo, 1_000_000_000 ether);
        newToken.finishMinting();
        
        emit TokenLaunched(tokenId, memecoin, name, symbol);
    }

    function getTokenInfo(uint256 tokenId) external view returns (TokenInfo memory) {
        return tokenInfo[tokenId];
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked(baseURI, tokenId.toString()));
    }
}

// Import for deployment
import "./TunaMemecoin.sol";
```

### 2.4 Create `TunaBidWall.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TunaBidWall
 * @notice Progressive Bid Wall - single-sided liquidity for buybacks
 */
contract TunaBidWall is Ownable, ReentrancyGuard {
    address public positionManager;
    address public flETH;

    struct WallPosition {
        uint256 ethBalance;
        uint256 tokensBought;
        int24 currentTick;
        uint256 lastUpdate;
    }

    mapping(address => WallPosition) public walls; // memecoin => wall

    event WallDeposit(address indexed memecoin, uint256 amount, int24 tick);
    event WallBuyback(address indexed memecoin, uint256 ethSpent, uint256 tokensBought);

    constructor(address flETH_) Ownable(msg.sender) {
        flETH = flETH_;
    }

    function setPositionManager(address pm) external onlyOwner {
        positionManager = pm;
    }

    function deposit(address memecoin, uint256 amount, int24 tick) external payable {
        require(msg.sender == positionManager || msg.sender == owner(), "Not authorized");
        
        WallPosition storage wall = walls[memecoin];
        wall.ethBalance += amount;
        wall.currentTick = tick;
        wall.lastUpdate = block.timestamp;
        
        emit WallDeposit(memecoin, amount, tick);
    }

    function getWallBalance(address memecoin) external view returns (uint256) {
        return walls[memecoin].ethBalance;
    }

    function executeBuyback(address memecoin, uint256 amount) external onlyOwner nonReentrant {
        WallPosition storage wall = walls[memecoin];
        require(wall.ethBalance >= amount, "Insufficient balance");
        
        wall.ethBalance -= amount;
        // In production: execute swap via Uniswap
        
        emit WallBuyback(memecoin, amount, 0);
    }

    receive() external payable {}
}
```

### 2.5 Create `TunaFairLaunch.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TunaFairLaunch
 * @notice Fixed-price fair launch period (5-30 minutes)
 */
contract TunaFairLaunch is Ownable, ReentrancyGuard {
    address public positionManager;

    struct LaunchConfig {
        uint256 startTime;
        uint256 endTime;
        uint256 fixedPrice; // tokens per ETH
        uint256 totalTokens;
        uint256 tokensSold;
        uint256 ethRaised;
        bool finalized;
    }

    mapping(address => LaunchConfig) public launches; // memecoin => config
    mapping(address => mapping(address => uint256)) public purchases; // memecoin => buyer => amount

    event LaunchCreated(address indexed memecoin, uint256 startTime, uint256 duration, uint256 fixedPrice);
    event TokensPurchased(address indexed memecoin, address indexed buyer, uint256 ethAmount, uint256 tokens);
    event LaunchFinalized(address indexed memecoin, uint256 tokensSold, uint256 ethRaised);

    constructor() Ownable(msg.sender) {}

    function setPositionManager(address pm) external onlyOwner {
        positionManager = pm;
    }

    function createLaunch(
        address memecoin,
        uint256 startTime,
        uint256 durationMinutes,
        uint256 fixedPrice,
        uint256 totalTokens
    ) external {
        require(msg.sender == positionManager || msg.sender == owner(), "Not authorized");
        require(durationMinutes >= 5 && durationMinutes <= 30, "Duration 5-30 min");
        require(launches[memecoin].startTime == 0, "Already created");

        launches[memecoin] = LaunchConfig({
            startTime: startTime,
            endTime: startTime + (durationMinutes * 1 minutes),
            fixedPrice: fixedPrice,
            totalTokens: totalTokens,
            tokensSold: 0,
            ethRaised: 0,
            finalized: false
        });

        emit LaunchCreated(memecoin, startTime, durationMinutes, fixedPrice);
    }

    function buy(address memecoin) external payable nonReentrant {
        LaunchConfig storage launch = launches[memecoin];
        require(block.timestamp >= launch.startTime, "Not started");
        require(block.timestamp < launch.endTime, "Ended");
        require(!launch.finalized, "Finalized");
        require(msg.value > 0, "Must send ETH");

        uint256 tokens = msg.value * launch.fixedPrice;
        require(launch.tokensSold + tokens <= launch.totalTokens, "Exceeds available");

        launch.tokensSold += tokens;
        launch.ethRaised += msg.value;
        purchases[memecoin][msg.sender] += tokens;

        emit TokensPurchased(memecoin, msg.sender, msg.value, tokens);
    }

    function finalize(address memecoin) external {
        require(msg.sender == positionManager || msg.sender == owner(), "Not authorized");
        LaunchConfig storage launch = launches[memecoin];
        require(block.timestamp >= launch.endTime, "Not ended");
        require(!launch.finalized, "Already finalized");

        launch.finalized = true;
        emit LaunchFinalized(memecoin, launch.tokensSold, launch.ethRaised);
    }

    function isInFairLaunch(address memecoin) external view returns (bool) {
        LaunchConfig storage launch = launches[memecoin];
        return block.timestamp >= launch.startTime && 
               block.timestamp < launch.endTime && 
               !launch.finalized;
    }

    function getLaunchInfo(address memecoin) external view returns (LaunchConfig memory) {
        return launches[memecoin];
    }
}
```

---

## Step 3: Compile Contracts

1. Click **Solidity Compiler** (left sidebar, looks like "S")
2. Set compiler version: **0.8.26**
3. Enable **Optimization** (200 runs)
4. Click **Compile** for each contract

---

## Step 4: Connect MetaMask to Base Sepolia

1. Open MetaMask
2. Click network dropdown → **Add Network**
3. Add Base Sepolia:

| Field | Value |
|-------|-------|
| Network Name | Base Sepolia |
| RPC URL | `https://sepolia.base.org` |
| Chain ID | `84532` |
| Currency | ETH |
| Explorer | `https://sepolia.basescan.org` |

---

## Step 5: Deploy Contracts (IN ORDER!)

Click **Deploy & Run Transactions** (left sidebar, rocket icon)

### 5.1 Deploy TunaFlETH
1. Select `TunaFlETH` from dropdown
2. Environment: **Injected Provider - MetaMask**
3. Click **Deploy**
4. Confirm in MetaMask
5. **COPY THE ADDRESS** → Save as `FLETH_ADDRESS`

### 5.2 Deploy TunaFlaunch
1. Select `TunaFlaunch`
2. Constructor param: `"https://api.tuna.fun/metadata/testnet/"`
3. Click **Deploy**
4. **COPY THE ADDRESS** → Save as `FLAUNCH_ADDRESS`

### 5.3 Deploy TunaBidWall
1. Select `TunaBidWall`
2. Constructor param: paste your `FLETH_ADDRESS`
3. Click **Deploy**
4. **COPY THE ADDRESS** → Save as `BIDWALL_ADDRESS`

### 5.4 Deploy TunaFairLaunch
1. Select `TunaFairLaunch`
2. No constructor params
3. Click **Deploy**
4. **COPY THE ADDRESS** → Save as `FAIRLAUNCH_ADDRESS`

---

## Step 6: Initialize Contracts

After all contracts are deployed, you need to connect them:

### 6.1 On TunaFlaunch:
1. Expand `TunaFlaunch` in "Deployed Contracts"
2. Find `setPositionManager` function
3. Enter your wallet address (you'll act as position manager for testing)
4. Click **transact**

### 6.2 On TunaBidWall:
1. Find `setPositionManager` function
2. Enter your wallet address
3. Click **transact**

### 6.3 On TunaFairLaunch:
1. Find `setPositionManager` function
2. Enter your wallet address
3. Click **transact**

---

## Step 7: Test Token Launch

1. On `TunaFlaunch`, find `flaunch` function
2. Enter:
   - name: `"Test Token"`
   - symbol: `"TEST"`
   - tokenUri: `"https://example.com/token.json"`
   - creator: `YOUR_WALLET_ADDRESS`
   - creatorFeeAllocation: `5000` (50%)
3. Click **transact**
4. Check the transaction on Base Sepolia explorer!

---

## Step 8: Save Your Addresses

Copy this template and fill in your deployed addresses:

```
DEPLOYED ADDRESSES (Base Sepolia)
=================================
TunaFlETH:      0x...
TunaFlaunch:    0x...
TunaBidWall:    0x...
TunaFairLaunch: 0x...

Deployed by:    YOUR_WALLET
Date:           YYYY-MM-DD
```

---

## Step 9: Verify on Basescan (Optional)

1. Go to https://sepolia.basescan.org
2. Find your contract address
3. Click **Contract** → **Verify and Publish**
4. Select:
   - Compiler: 0.8.26
   - Optimization: Yes (200)
   - License: MIT
5. Paste the source code
6. Click **Verify**

---

## Next Steps

After successful testnet deployment:
1. Share your addresses with me to update `src/lib/baseContracts.ts`
2. Test the flaunch function on the frontend
3. When ready, repeat on Base Mainnet

---

## Troubleshooting

**"Gas estimation failed"**
- Make sure you have Base Sepolia ETH
- Check constructor parameters are correct

**"Transaction reverted"**
- Contracts must be deployed in order
- Check you're calling functions as owner

**MetaMask not connecting**
- Refresh Remix
- Ensure MetaMask is on Base Sepolia network
