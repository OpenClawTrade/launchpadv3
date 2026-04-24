// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Verbatim port of Klik Factory (Etherscan-verified 0xDE60..ca655).
// Only deltas vs Klik:
//   - Token type renamed to PopKlikToken.
//   - klikHook param renamed to popHook (semantics identical).
//   - Minimal local interfaces for IPositionManager / IUniversalRouter / IAllowanceTransfer
//     so we don't have to vendor v4-periphery, universal-router, and permit2.
//   - Inlined Actions/Commands constants used by Klik.
//
// Liquidity geometry, sqrtPriceX96, ticks, anti-sniper penalty curve, single-sided
// LP via PositionManager, dev-buy via Universal Router V4_SWAP, fee collection
// via Token.withdrawFees() — all identical to Klik.

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";

import {PopKlikToken} from "./PopKlikToken.sol";

interface IStateView {
    function getSlot0(PoolId poolId)
        external view
        returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee);
}

interface IPositionManager {
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
}

interface IAllowanceTransfer {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

interface IUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable;
}

interface IToken {
    function creator() external view returns (address);
    function withdrawFees() external returns (uint256);
}

interface IWETH {
    function withdraw(uint256 amount) external;
}

/// @dev Mirrors v4-periphery Actions enum values used by Klik.
library Actions {
    uint8 internal constant SWAP_EXACT_IN_SINGLE = 0x06;
    uint8 internal constant SETTLE_PAIR          = 0x0d;
    uint8 internal constant SETTLE_ALL           = 0x0c;
    uint8 internal constant TAKE_ALL             = 0x0f;
    uint8 internal constant MINT_POSITION        = 0x02;
}

/// @dev Mirrors universal-router Commands enum value used by Klik.
library Commands {
    uint8 internal constant V4_SWAP = 0x10;
}

contract PopKlikFactory is ReentrancyGuard {
    event ERC20TokenCreated(address tokenAddress);

    struct TokenInfo {
        address tokenAddress;
        string  name;
        string  symbol;
        address deployer;
        uint256 time;
        string  metadata;
        uint256 marketCapInETH;
        uint256 totalFeesGenerated;
    }

    mapping(uint256 => TokenInfo) public deployedTokens;
    mapping(address => TokenInfo) public tokenInfoByAddress;
    uint256 public tokenCount = 0;
    address public platformController;
    address public popHook; // singleton hook
    uint256 private itemsPerPage = 250;

    mapping(address => address[]) public creatorTokens;
    mapping(address => uint256)   public tokenFeesGenerated;
    mapping(address => address)   public tokenHook;

    IAllowanceTransfer constant PERMIT2 =
        IAllowanceTransfer(address(0x000000000022D473030F116dDEE9F6B43aC78BA3));
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

    bool public deployCoinEnabled = true;

    struct LiquidityConfig {
        uint160 sqrtPriceX96;
        int24   tickLower;
        int24   tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 virtualAmount;
        uint256 penaltyMultiplier;
    }

    mapping(uint256 => LiquidityConfig) public liquidityConfigs;
    uint256 public liquidityConfigCount = 0;

    event TokenPurchased(address buyer, address tokenOut, uint256 ethSpent, uint256 tokensReceived);
    event PopHookUpdated(address oldHook, address newHook);

    constructor(address _popHook) {
        platformController = msg.sender;
        popHook = _popHook;

        // Default liquidity configuration (ID: 0) — Klik values, byte-for-byte.
        liquidityConfigs[0] = LiquidityConfig({
            sqrtPriceX96:      2505411999795360582221170761428213,
            tickLower:         -887200,
            tickUpper:         207200,
            amount0Desired:    0,
            amount1Desired:    1_000_000_000 * 1e18,
            virtualAmount:     1 ether,
            penaltyMultiplier: 50
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

    function deployCoin(
        string memory _name,
        string memory _symbol,
        string memory _metadata,
        bytes32 salt,
        uint256 configId
    ) public payable returns (uint256 tokensReceived) {
        require(deployCoinEnabled, "Token deployment is currently disabled");
        require(configId < liquidityConfigCount, "Invalid liquidity config ID");

        PopKlikToken t = new PopKlikToken{salt: salt}(
            _name, _symbol, msg.sender, address(this)
        );
        address coin_address = address(t);

        emit ERC20TokenCreated(coin_address);

        provideLiquidityV4(coin_address, configId);

        tokensReceived = 0;

        if (msg.value > 0) {
            LiquidityConfig memory config = liquidityConfigs[configId];
            uint256 basePenalty = getPenalty(msg.value);
            uint256 taxBps = (basePenalty * config.penaltyMultiplier) / 100;
            uint256 tax;
            uint256 amountAfterTax;

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

            IERC20(coin_address).transfer(msg.sender, tokensReceived);

            emit TokenPurchased(msg.sender, coin_address, amountAfterTax, tokensReceived);
        }

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
        tokenInfoByAddress[coin_address]  = newTokenInfo;
        tokenHook[coin_address]           = popHook;

        creatorTokens[msg.sender].push(coin_address);

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
            type(PopKlikToken).creationCode,
            abi.encode(_name, _symbol, creator, address(this))
        );
    }

    /// @notice Anti-sniper tax curve, identical to Klik:
    ///   <0.05 ETH  → 0%
    ///   0.05→0.30  → linear ramp 5%→50%
    ///   ≥0.30 ETH  → 50% (hard cap)
    function getPenalty(uint256 ethAmount) public pure returns (uint256) {
        if (ethAmount < 0.05 ether) return 0;
        if (ethAmount >= 0.30 ether) return 5000;

        uint256 slope = 18000;
        uint256 delta = ethAmount - 0.05 ether;
        uint256 penalty = 500 + (delta * slope) / 1 ether;

        return penalty;
    }

    function toggleDeployCoin() external {
        require(msg.sender == platformController, "Caller is not controller");
        deployCoinEnabled = !deployCoinEnabled;
    }

    function createLiquidityConfig(
        uint160 _sqrtPriceX96,
        int24   _tickLower,
        int24   _tickUpper,
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

    function updateLiquidityConfig(
        uint256 _configId,
        uint160 _sqrtPriceX96,
        int24   _tickLower,
        int24   _tickUpper,
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

    function deleteLiquidityConfig(uint256 _configId) external {
        require(msg.sender == platformController, "Only platform controller can delete liquidity config");
        require(_configId < liquidityConfigCount, "Invalid config ID");
        require(_configId != 0, "Cannot delete default config");
        delete liquidityConfigs[_configId];
    }

    function getLiquidityConfig(uint256 _configId) external view returns (LiquidityConfig memory) {
        require(_configId < liquidityConfigCount, "Invalid config ID");
        return liquidityConfigs[_configId];
    }

    function setItemsPerPage(uint256 _itemsPerPage) external {
        require(msg.sender == platformController, "Only platform controller can change items per page");
        require(_itemsPerPage > 0 && _itemsPerPage <= 1000, "Items per page must be between 1 and 1000");
        itemsPerPage = _itemsPerPage;
    }

    function getAllTokensByCreator(address _creator) public view returns (address[] memory) {
        return creatorTokens[_creator];
    }

    function withdrawFeesETH() external {
        require(msg.sender == platformController, "Caller is not controller");
        uint256 ethBalance = address(this).balance;
        require(ethBalance > 0, "No ETH to withdraw");
        (bool success, ) = msg.sender.call{value: ethBalance}("");
        require(success, "ETH transfer failed");
    }

    function withdrawFeesWETH() external {
        require(msg.sender == platformController, "Caller is not controller");
        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        require(wethBalance > 0, "No WETH to withdraw");
        IWETH(WETH).withdraw(wethBalance);
        (bool success, ) = msg.sender.call{value: wethBalance}("");
        require(success, "ETH transfer failed");
    }

    function provideLiquidityV4(address tokenA, uint256 configId) internal {
        LiquidityConfig memory config = liquidityConfigs[configId];

        IERC20 token = IERC20(tokenA);
        token.approve(address(PERMIT2), type(uint256).max);
        PERMIT2.approve(tokenA, address(POSITION_MANAGER), type(uint160).max, type(uint48).max);
        PERMIT2.approve(tokenA, address(POOL_MANAGER),     type(uint160).max, type(uint48).max);

        PoolKey memory pool = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(tokenA),
            fee: 0,
            tickSpacing: 200,
            hooks: IHooks(popHook)
        });

        poolManager.initialize(pool, config.sqrtPriceX96);

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            config.sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(config.tickLower),
            TickMath.getSqrtPriceAtTick(config.tickUpper),
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

        try positionManager.modifyLiquidities(abi.encode(actions, params), block.timestamp + 120) {
            // ok
        } catch (bytes memory reason) {
            assembly { revert(add(reason, 0x20), mload(reason)) }
        }
    }

    function _buyToken(address tokenAddress, uint256 ethAmount) internal {
        PoolKey memory pool = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(tokenAddress),
            fee: 0,
            tickSpacing: 200,
            hooks: IHooks(popHook)
        });

        bytes memory commands = abi.encodePacked(uint8(Commands.V4_SWAP));
        bytes[] memory inputs = new bytes[](1);

        bytes memory actions = abi.encodePacked(
            uint8(Actions.SWAP_EXACT_IN_SINGLE),
            uint8(Actions.SETTLE_ALL),
            uint8(Actions.TAKE_ALL)
        );

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            pool,
            true,                    // zeroForOne: ETH -> token
            uint128(ethAmount),
            uint128(0),              // amountOutMinimum = 0
            bytes("")
        );
        params[1] = abi.encode(pool.currency0, ethAmount);    // SETTLE_ALL
        params[2] = abi.encode(pool.currency1, uint128(0));   // TAKE_ALL

        inputs[0] = abi.encode(actions, params);

        uint256 deadline = block.timestamp + 120;
        router.execute{value: ethAmount}(commands, inputs, deadline);
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
            (bool success, ) = payable(creator).call{value: ethCollected}("");
            require(success, "ETH transfer to creator failed");
        }
        return ethCollected;
    }

    function changeTokenFeeReceiver(address tokenAddress, address newCreator) external {
        require(msg.sender == platformController, "Only platform controller can change creator");
        require(newCreator != address(0), "New creator cannot be zero address");
        PopKlikToken(payable(tokenAddress)).changeCreator(newCreator);
    }

    function getTokenPrice(address tokenAddress)
        public view
        returns (bytes32 poolIdBytes, uint160 sqrtPrice, uint256 calculatedPrice, uint256 marketCapETH)
    {
        address hook = tokenHook[tokenAddress] != address(0) ? tokenHook[tokenAddress] : popHook;
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(tokenAddress),
            fee: 0,
            tickSpacing: 200,
            hooks: IHooks(hook)
        });

        PoolId poolId = PoolId.wrap(keccak256(abi.encode(poolKey)));
        poolIdBytes = PoolId.unwrap(poolId);

        try stateView.getSlot0(poolId) returns (uint160 sqrtPriceX96, int24, uint24, uint24) {
            sqrtPrice = sqrtPriceX96;

            if (sqrtPriceX96 > 0) {
                uint256 sqrtPriceX96_uint = uint256(sqrtPriceX96);
                uint256 q96 = 2 ** 96;

                uint256 scaledDivisor = (q96 * 1e18) / sqrtPriceX96_uint;
                calculatedPrice = (scaledDivisor * q96) / sqrtPriceX96_uint;

                uint256 totalSupply = IERC20(tokenAddress).totalSupply();
                marketCapETH = calculatedPrice * totalSupply / 1e18;
                return (poolIdBytes, sqrtPrice, calculatedPrice, marketCapETH);
            }
        } catch {
            return (poolIdBytes, 0, 0, 0);
        }
        return (poolIdBytes, 0, 0, 0);
    }

    function getMarketCap(address tokenAddress) public view returns (uint256 marketCapETH) {
        (, , , marketCapETH) = getTokenPrice(tokenAddress);
        return marketCapETH;
    }

    function getTokenFeesGenerated(address tokenAddress) public view returns (uint256) {
        return tokenFeesGenerated[tokenAddress];
    }
}
