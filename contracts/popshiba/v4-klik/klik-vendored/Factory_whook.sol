pragma solidity ^0.8.20;
/*

 __  _  _      ____  __  _      _____  ____  ____    ____  ____     __    ___
|  |/ ]| |    |    ||  |/ ]    |     ||    ||    \  /    ||    \   /  ]  /  _]
|  ' / | |     |  | |  ' /     |   __| |  | |  _  ||  o  ||  _  | /  /  /  [_
|    \ | |___  |  | |    \     |  |_   |  | |  |  ||     ||  |  |/  /  |    _]
|     \|     | |  | |     \ __ |   _]  |  | |  |  ||  _  ||  |  /   \_ |   [_
|  .  ||     | |  | |  .  ||  ||  |    |  | |  |  ||  |  ||  |  \     ||     |
|__|\_||_____||____||__|\_||__||__|   |____||__|__||__|__||__|__|\____||_____|
V4 Edition

https://klik.finance
https://x.com/klik_evm

*/

pragma solidity >=0.8.9;

import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {LiquidityAmounts} from "v4-core/test/utils/LiquidityAmounts.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";

interface IStateView {
    function getSlot0(PoolId poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee);
}

import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IUniversalRouter} from "@uniswap/universal-router/contracts/interfaces/IUniversalRouter.sol";
import {IV4Router} from "@uniswap/v4-periphery/src/interfaces/IV4Router.sol";
import {IPermit2} from "permit2/src/interfaces/IPermit2.sol";
import {Commands} from "@uniswap/universal-router/contracts/libraries/Commands.sol";

import "v4-core/test/utils/LiquidityAmounts.sol";

interface IToken {
    function creator() external view returns (address);
    function withdrawFees() external returns (uint256);
}

interface IWETH {
    function withdraw(uint256 amount) external;
}

contract PopKlikFactory is ReentrancyGuard {
    event ERC20TokenCreated(address tokenAddress);

    struct TokenInfo {
        address tokenAddress;
        string name;
        string symbol;
        address deployer;
        uint256 time;
        string metadata;
        uint256 marketCapInETH;
        uint256 totalFeesGenerated;
    }

    mapping(uint256 => TokenInfo) public deployedTokens;
    mapping(address => TokenInfo) public tokenInfoByAddress;
    uint256 public tokenCount = 0;
    address public platformController;
    address public popHook; // Universal hook for all tokens (can be updated)
    uint256 private itemsPerPage = 250; // Configurable items per page for pagination
    
    // Mapping to store token addresses by creator/deployer
    mapping(address => address[]) public creatorTokens;
    
    // Mapping to track total fees generated per token
    mapping(address => uint256) public tokenFeesGenerated;

    // Mapping to store the hook address used at deploy time per token
    mapping(address => address) public tokenHook;

    IAllowanceTransfer constant PERMIT2 = IAllowanceTransfer(address(0x000000000022D473030F116dDEE9F6B43aC78BA3));
    address public constant POSITION_MANAGER = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
    IPositionManager positionManager = IPositionManager(POSITION_MANAGER);
    address public constant POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;
    IPoolManager poolManager = IPoolManager(POOL_MANAGER);
    address public constant STATE_VIEW = 0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227;
    IStateView stateView = IStateView(STATE_VIEW);
    uint256 constant Q96 = 2 ** 96;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant UNIVERSAL_ROUTER = 0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af;
    IUniversalRouter router = IUniversalRouter(UNIVERSAL_ROUTER);

    uint24 private constant FEE_TIER = 0;

    bool public deployCoinEnabled = true;
    
    // Liquidity configuration struct
    struct LiquidityConfig {
        uint160 sqrtPriceX96;       // sqrtPriceX96 for the pool (address(0) is always currency0)
        int24 tickLower;            // Lower tick for the position
        int24 tickUpper;            // Upper tick for the position
        uint256 amount0Desired;     // Desired amount of currency0 (ETH)
        uint256 amount1Desired;     // Desired amount of currency1 (Token)
        uint256 virtualAmount;      // Virtual ETH amount for market cap calculation
        uint256 penaltyMultiplier;  // Penalty multiplier (50 = 50%, 100 = 100%, 200 = 200%)
    }
    
    // Multiple liquidity configurations
    mapping(uint256 => LiquidityConfig) public liquidityConfigs;
    uint256 public liquidityConfigCount = 0;

    event TokenPurchased(address buyer, address tokenOut, uint256 ethSpent, uint256 tokensReceived);
    event PopHookUpdated(address oldHook, address newHook);

    constructor(address _klikHook) {
        platformController = msg.sender;
        popHook = _klikHook;
        
        // Initialize default liquidity configuration (ID: 0)
        // Values for 1 ETH virtual liquidity with full token supply
        liquidityConfigs[0] = LiquidityConfig({
            sqrtPriceX96: 2505411999795360582221170761428213,
            tickLower: -887200,
            tickUpper: 207200,
            amount0Desired: 0,                          // 0 ETH (single-sided liquidity)
            amount1Desired: 1000000000000000000000000000, // 1 billion tokens
            virtualAmount: 1 ether,
            penaltyMultiplier: 50  // 100% = standard penalty
        });
        liquidityConfigCount = 1;
    }

    function setPopHook(address _newHook) external {
        require(msg.sender == platformController, "Caller is not controller");
        address oldHook = popHook;
        popHook = _newHook;
        emit PopHookUpdated(oldHook, _newHook);
    }

    receive() external payable {}

    function deployCoin(string memory _name, string memory _symbol, string memory _metadata, bytes32 salt, uint256 configId) public payable returns (uint256 tokensReceived) {
        require(deployCoinEnabled, "Token deployment is currently disabled");
        require(configId < liquidityConfigCount, "Invalid liquidity config ID");
        
        Token t = new Token{salt: salt}(
            _name,
            _symbol,
            msg.sender,
            address(this)
        );

        address coin_address = address(t);

        emit ERC20TokenCreated(coin_address);

        provideLiquidityV4(coin_address, configId);

        tokensReceived = 0; // Initialize return value

        if (msg.value > 0) {
            LiquidityConfig memory config = liquidityConfigs[configId];
            uint256 basePenalty = getPenalty(msg.value); // in basis points (e.g., 2500 = 25%)
            uint256 taxBps = (basePenalty * config.penaltyMultiplier) / 100; // Apply config multiplier
            uint256 tax;
            uint256 amountAfterTax;

            // Assembly optimized math operations
            unchecked {
                assembly {
                    tax := div(mul(callvalue(), taxBps), 10000)
                    amountAfterTax := sub(callvalue(), tax)
                }
            }

            uint256 tokensBefore = IERC20(coin_address).balanceOf(address(this));
            _buyToken(coin_address, amountAfterTax);
            uint256 tokensAfter = IERC20(coin_address).balanceOf(address(this));
            tokensReceived = tokensAfter - tokensBefore;
            
            // Transfer tokens to buyer
            IERC20(coin_address).transfer(msg.sender, tokensReceived);
            
            emit TokenPurchased(msg.sender, coin_address, amountAfterTax, tokensReceived);
        }

        // Cache tokenCount to avoid multiple SLOAD operations
        uint256 currentTokenCount = tokenCount;

        TokenInfo memory newTokenInfo = TokenInfo({
            tokenAddress: coin_address,
            name: _name,
            symbol: _symbol,
            deployer: msg.sender,
            time: block.timestamp,
            metadata: _metadata,
            marketCapInETH: 0,
            totalFeesGenerated: 0
        });

        deployedTokens[currentTokenCount] = newTokenInfo;
        tokenInfoByAddress[coin_address] = newTokenInfo;
        tokenHook[coin_address] = popHook;

        // Add token to creator's array
        creatorTokens[msg.sender].push(coin_address);

        // Assembly optimized increment (unchecked)
        assembly {
            sstore(tokenCount.slot, add(currentTokenCount, 1))
        }

        return tokensReceived;
    }

    function getTokenBytecode(
        string memory _name,
        string memory _symbol,
        address creator
    ) public view returns (bytes memory bytecode) {
        bytecode = abi.encodePacked(
            type(Token).creationCode,
            abi.encode(_name, _symbol, creator, address(this))
        );
    }

    function getPenalty(uint256 ethAmount) public pure returns (uint256) {
        if (ethAmount < 0.05 ether) return 0;
        if (ethAmount >= 0.30 ether) return 5000; // max 50%

        uint256 slope = 18000;
        uint256 delta = ethAmount - 0.05 ether;
        uint256 penalty = 500 + (delta * slope) / 1 ether;

        return penalty;
    }

    function toggleDeployCoin() external {
        require(msg.sender == platformController, "Caller is not controller");
        deployCoinEnabled = !deployCoinEnabled;
    }

    // Create new liquidity configuration
    function createLiquidityConfig(
        uint160 _sqrtPriceX96,
        int24 _tickLower,
        int24 _tickUpper,
        uint256 _amount0Desired,
        uint256 _amount1Desired,
        uint256 _virtualAmount,
        uint256 _penaltyMultiplier
    ) external returns (uint256 configId) {
        require(msg.sender == platformController, "Only platform controller can create liquidity config");
        require(_penaltyMultiplier >= 10 && _penaltyMultiplier <= 500, "Penalty multiplier must be between 10% and 500%");

        configId = liquidityConfigCount;
        liquidityConfigs[configId] = LiquidityConfig({
            sqrtPriceX96: _sqrtPriceX96,
            tickLower: _tickLower,
            tickUpper: _tickUpper,
            amount0Desired: _amount0Desired,
            amount1Desired: _amount1Desired,
            virtualAmount: _virtualAmount,
            penaltyMultiplier: _penaltyMultiplier
        });
        liquidityConfigCount++;

        return configId;
    }
    
    // Update existing liquidity configuration
    function updateLiquidityConfig(
        uint256 _configId,
        uint160 _sqrtPriceX96,
        int24 _tickLower,
        int24 _tickUpper,
        uint256 _amount0Desired,
        uint256 _amount1Desired,
        uint256 _virtualAmount,
        uint256 _penaltyMultiplier
    ) external {
        require(msg.sender == platformController, "Only platform controller can update liquidity config");
        require(_configId < liquidityConfigCount, "Invalid config ID");
        require(_penaltyMultiplier >= 10 && _penaltyMultiplier <= 500, "Penalty multiplier must be between 10% and 500%");

        liquidityConfigs[_configId] = LiquidityConfig({
            sqrtPriceX96: _sqrtPriceX96,
            tickLower: _tickLower,
            tickUpper: _tickUpper,
            amount0Desired: _amount0Desired,
            amount1Desired: _amount1Desired,
            virtualAmount: _virtualAmount,
            penaltyMultiplier: _penaltyMultiplier
        });
    }
    
    // Delete liquidity configuration (sets to zero values)
    function deleteLiquidityConfig(uint256 _configId) external {
        require(msg.sender == platformController, "Only platform controller can delete liquidity config");
        require(_configId < liquidityConfigCount, "Invalid config ID");
        require(_configId != 0, "Cannot delete default config");
        
        delete liquidityConfigs[_configId];
    }
    
    // Get liquidity configuration
    function getLiquidityConfig(uint256 _configId) external view returns (LiquidityConfig memory) {
        require(_configId < liquidityConfigCount, "Invalid config ID");
        return liquidityConfigs[_configId];
    }

    // Change the number of items per page for pagination
    function setItemsPerPage(uint256 _itemsPerPage) external {
        require(msg.sender == platformController, "Only platform controller can change items per page");
        require(_itemsPerPage > 0 && _itemsPerPage <= 1000, "Items per page must be between 1 and 1000");
        itemsPerPage = _itemsPerPage;
    }
    
    // Get all tokens for a creator in one call  
    function getAllTokensByCreator(address _creator) public view returns (address[] memory) {
        return creatorTokens[_creator];
    }

    function getDeploysByPage(uint256 page, uint256 order) public view returns (TokenInfo[] memory) {
        require(tokenCount > 0, "No tokens deployed");

        uint256 totalPages = (tokenCount + itemsPerPage - 1) / itemsPerPage;
        require(page < totalPages, "Page out of range");

        uint256 start;
        uint256 end;
        uint256 j = 0;

        if (order == 0) {
            // Newest first
            start = tokenCount > (page + 1) * itemsPerPage ? tokenCount - (page + 1) * itemsPerPage : 0;
            end = tokenCount - page * itemsPerPage;
            if (end > tokenCount) end = tokenCount;
        } else {
            // Oldest first
            start = page * itemsPerPage;
            end = start + itemsPerPage;
            if (end > tokenCount) end = tokenCount;
        }

        TokenInfo[] memory tokens = new TokenInfo[](end - start);

        for (uint256 i = start; i < end; i++) {
            uint256 index = order == 0 ? end - 1 - (i - start) : i;
            TokenInfo memory info = deployedTokens[index];

            // Calculate market cap using the correct formula
            uint256 marketCap = getMarketCap(info.tokenAddress);

            tokens[j++] = TokenInfo({
                tokenAddress: info.tokenAddress,
                name: info.name,
                symbol: info.symbol,
                deployer: info.deployer,
                time: info.time,
                metadata: info.metadata,
                marketCapInETH: marketCap,
                totalFeesGenerated: tokenFeesGenerated[info.tokenAddress]
            });
        }

        return tokens;
    }

    function withdrawFeesWETH() external {
        require(msg.sender == platformController, "Caller is not controller");
        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        require(wethBalance > 0, "No WETH to withdraw");

        IWETH(WETH).withdraw(wethBalance);

        (bool success, ) = msg.sender.call{value: wethBalance}("");
        require(success, "ETH transfer failed");
    }

    function withdrawFeesETH() external {
        require(msg.sender == platformController, "Caller is not controller");

        uint256 ethBalance = address(this).balance;
        require(ethBalance > 0, "No ETH to withdraw");

        (bool success, ) = msg.sender.call{value: ethBalance}("");
        require(success, "ETH transfer failed");
    }

    function provideLiquidityV4(address tokenA, uint256 configId) internal {
        LiquidityConfig memory config = liquidityConfigs[configId];
        
        // Since address(0) is always < any token address, it's always currency0
        // No need for complex comparison logic
        IERC20 token = IERC20(tokenA);

        token.approve(address(PERMIT2), type(uint256).max);
        PERMIT2.approve(tokenA, address(POSITION_MANAGER), type(uint160).max, type(uint48).max);
        PERMIT2.approve(tokenA, address(POOL_MANAGER), type(uint160).max, type(uint48).max);

        PoolKey memory pool = PoolKey({
            currency0: Currency.wrap(address(0)),  // ETH is always currency0
            currency1: Currency.wrap(address(tokenA)), // Token is always currency1
            fee: 0,
            tickSpacing: 200,
            hooks: IHooks(popHook) // Use universal hook
        });

        poolManager.initialize(pool, config.sqrtPriceX96);

        uint128 liquidity = _calculateLiquidity(
            config.sqrtPriceX96,
            config.tickLower,
            config.tickUpper,
            config.amount0Desired,
            config.amount1Desired
        );

        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR));

        bytes memory hookData = new bytes(0);

        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(
            pool,
            config.tickLower,
            config.tickUpper,
            liquidity,
            config.amount0Desired,
            config.amount1Desired,
            address(this),
            hookData
        );

        params[1] = abi.encode(pool.currency0, pool.currency1);

        try positionManager.modifyLiquidities(
            abi.encode(actions, params),
            block.timestamp + 120
        ) {
            // Successfully added liquidity
        } catch (bytes memory reason) {
            assembly {
                revert(add(reason, 0x20), mload(reason))
            }
        }
    }

    function _calculateLiquidity(
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0Desired,
        uint256 amount1Desired
    ) private pure returns (uint128) {
        return LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            amount0Desired,
            amount1Desired
        );
    }

    function _buyToken(address tokenAddress, uint256 ethAmount) internal {
        // Create PoolKey for ETH -> Token swap
        PoolKey memory pool = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(tokenAddress), // New token
            fee: 0,
            tickSpacing: 200,
            hooks: IHooks(popHook) // Use universal hook
        });

        // Encode the Universal Router command
        bytes memory commands = abi.encodePacked(uint8(Commands.V4_SWAP));
        bytes[] memory inputs = new bytes[](1);

        // Encode V4Router actions
        bytes memory actions = abi.encodePacked(
            uint8(Actions.SWAP_EXACT_IN_SINGLE),
            uint8(Actions.SETTLE_ALL),
            uint8(Actions.TAKE_ALL)
        );

        // Prepare parameters for each action
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            pool, // PoolKey
            true, // zeroForOne: ETH (currency0) -> Token (currency1)
            uint128(ethAmount), // amountIn
            uint128(0), // amountOutMinimum: 0 = no minimum requirement
            bytes("") // hookData
        );
        params[1] = abi.encode(pool.currency0, ethAmount); // SETTLE_ALL params
        params[2] = abi.encode(pool.currency1, uint128(0)); // TAKE_ALL params

        // Combine actions and params into inputs
        inputs[0] = abi.encode(actions, params);

        // Execute the swap
        uint256 deadline = block.timestamp + 120;
        router.execute{value: ethAmount}(commands, inputs, deadline);

        // Tokens remain in contract - caller handles transfer and event emission
    }

    function collectFees(address tokenAddress) external nonReentrant returns (uint256 ethCollected) {
        address creator = IToken(tokenAddress).creator();
        require(msg.sender == creator || msg.sender == platformController, "Not authorized");

        uint256 balanceBefore = address(this).balance;
        IToken(tokenAddress).withdrawFees();
        uint256 balanceAfter = address(this).balance;
        
        ethCollected = balanceAfter - balanceBefore;

        if (ethCollected > 0) {
            tokenFeesGenerated[tokenAddress] += ethCollected;

            // Platform share is taken atomically by the hook at swap time.
            // Everything in the token contract is the creator's portion.
            (bool success, ) = payable(creator).call{value: ethCollected}("");
            require(success, "ETH transfer to creator failed");
        }

        return ethCollected;
    }

    function changeTokenFeeReceiver(address tokenAddress, address newCreator) external {
        require(msg.sender == platformController, "Only platform controller can change creator"); // Updating Fee Receiver
        require(newCreator != address(0), "New creator cannot be zero address");
        
        PopKlikToken(payable(tokenAddress)).changeCreator(newCreator);
    }

    function getTokenPrice(address tokenAddress) public view returns (bytes32 poolIdBytes, uint160 sqrtPrice, uint256 calculatedPrice, uint256 marketCapETH) {
        // Create PoolKey for ETH/Token pool
        address hook = tokenHook[tokenAddress] != address(0) ? tokenHook[tokenAddress] : popHook;
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(tokenAddress), // Token
            fee: 0,
            tickSpacing: 200,
            hooks: IHooks(hook)
        });

        // V4 approach: Get actual pool state using StateView
        PoolId poolId = PoolId.wrap(keccak256(abi.encode(poolKey)));
        poolIdBytes = PoolId.unwrap(poolId);

        try stateView.getSlot0(poolId) returns (uint160 sqrtPriceX96, int24, uint24, uint24) {
            sqrtPrice = sqrtPriceX96;

            if (sqrtPriceX96 > 0) {
                uint256 sqrtPriceX96_uint = uint256(sqrtPriceX96);
                uint256 q96 = 2**96;

                uint256 scaledDivisor = (q96 * 1e18) / sqrtPriceX96_uint;
                calculatedPrice = (scaledDivisor * q96) / sqrtPriceX96_uint; // finalPrice

                // Market Cap = price * totalSupply
                uint256 totalSupply = IERC20(tokenAddress).totalSupply();
                marketCapETH = calculatedPrice * totalSupply/1e18;

                return (poolIdBytes, sqrtPrice, calculatedPrice, marketCapETH);
            }
        } catch {
            // Pool doesn't exist - return 0
            return (poolIdBytes, 0, 0, 0);
        }

        return (poolIdBytes, 0, 0, 0);
    }

    function getMarketCap(address tokenAddress) public view returns (uint256 marketCapETH) {
        (, , , marketCapETH) = getTokenPrice(tokenAddress);
        return marketCapETH;
    }
    
    // Get total fees generated by a specific token
    function getTokenFeesGenerated(address tokenAddress) public view returns (uint256) {
        return tokenFeesGenerated[tokenAddress];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PopKlikToken is ERC20, ERC20Burnable {
    address public platform;
    address public creator;
    address private _owner;
    uint256 private launchBlock;
    uint256 private maxTxAmount;
    uint256 private constant LAUNCH_PERIOD = 3;
    uint256 private constant MAX_WALLET_PERCENTAGE = 2; // 2% of total supply

    address immutable pool = 0x000000000004444c5dc75cB358380D2e3dE08A90;

    // Track transfers per tx.origin per block to detect multi-swaps
    mapping(address => uint256) private tokensFromPoolPerOrigin;

    event FeesReceived(uint256 amount);

    constructor(
        string memory _name,
        string memory _symbol,
        address _creator,
        address _platform
    ) ERC20(_name, _symbol) {
        platform = _platform;
        creator = _creator;
        _owner = address(0);
        launchBlock = block.number;

        uint256 totalTokens = 1000000000 * 10 ** decimals();
        maxTxAmount = (totalTokens * MAX_WALLET_PERCENTAGE) / 100;

        _mint(_platform, totalTokens);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (block.number > launchBlock && block.number <= launchBlock + LAUNCH_PERIOD) {
            // Get pool address for exemption

            if (from == pool && to != platform && to != creator) {
                tokensFromPoolPerOrigin[tx.origin] += value;
                require(
                    tokensFromPoolPerOrigin[tx.origin] <= maxTxAmount*110/100,
                    "Keeping 2% pool Limits In Kontrol"
                );
            }

            if (to != creator && to != platform && to != pool && from != address(0)) {
                require(
                    balanceOf(to) + value <= maxTxAmount,
                    "Max wallet limit exceeded during launch period"
                );
            }
        }

        // Block all buys at launch block except exempted transfers
        if (block.number == launchBlock &&
            from != address(0) &&
            to != platform &&
            from != platform &&
            !(from == platform && to == creator)) { // Only platform can send to creator
            revert("No buys allowed during launch block!");
        }

        super._update(from, to, value);
    }

    function isLaunchPeriodActive() public view returns (bool) {
        return block.number <= launchBlock + LAUNCH_PERIOD;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    // Receive ETH from hook fees
    receive() external payable {
        emit FeesReceived(msg.value);
    }

    // Allow only Factory to withdraw accumulated fees
    function withdrawFees() external returns (uint256 balance) {
        require(msg.sender == platform, "Only factory can withdraw");
        balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");

        (bool success, ) = payable(platform).call{value: balance}("");
        require(success, "Fee withdrawal failed");
    }

    function changeCreator(address newCreator) external {
        require(msg.sender == platform, "Only platform can change creator"); // Updating Fee Receiver
        creator = newCreator;
    }
}
