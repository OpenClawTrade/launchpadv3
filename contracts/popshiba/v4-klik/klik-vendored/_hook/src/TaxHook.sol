// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, toBeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";

interface IFactory {
    function getMarketCap(address tokenAddress) external view returns (uint256 marketCapETH);
}

contract UniversalKlikHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    uint256 public constant BASIS_POINTS_DIVISOR = 10000;
    uint256 private constant FIXED_FEE_FALLBACK = 100;

    // Track deployment block per pool — no fees on launch block
    mapping(bytes32 => uint256) public poolDeploymentBlock;

    address public owner;
    address public platformTreasury;
    address public factory;

    // ─── Configurable fee tiers ───────────────────────────────────────────────
    // Tiers are sorted ascending by mcapThresholdEth.
    // The last tier has no threshold — it is the floor that catches everything above.
    // creatorBps is always derived as totalBps - platformBps.
    struct FeeTier {
        uint128 mcapThresholdEth; // upper bound in ETH (wei). last tier: ignored
        uint128 totalBps;
        uint128 platformBps;
    }

    FeeTier[] public feeTiers;

    event FeeTiersUpdated(uint256 count);

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {
        owner = tx.origin;
        _initDefaultFeeTiers();
    }

    function _initDefaultFeeTiers() internal {
        feeTiers.push(FeeTier(15 ether,   125, 80));
        feeTiers.push(FeeTier(55 ether,   120, 70));
        feeTiers.push(FeeTier(90 ether,   115, 60));
        feeTiers.push(FeeTier(125 ether,  110, 55));
        feeTiers.push(FeeTier(165 ether,  105, 52));
        feeTiers.push(FeeTier(365 ether,  100, 50));
        feeTiers.push(FeeTier(545 ether,   95, 47));
        feeTiers.push(FeeTier(725 ether,   90, 44));
        feeTiers.push(FeeTier(910 ether,   85, 41));
        feeTiers.push(FeeTier(1090 ether,  80, 38));
        feeTiers.push(FeeTier(1275 ether,  75, 35));
        feeTiers.push(FeeTier(1450 ether,  70, 33));
        feeTiers.push(FeeTier(1635 ether,  65, 30));
        feeTiers.push(FeeTier(1815 ether,  60, 28));
        feeTiers.push(FeeTier(2000 ether,  55, 27));
        feeTiers.push(FeeTier(2175 ether,  53, 25));
        feeTiers.push(FeeTier(0,           35, 15)); // floor — threshold ignored
    }

    // ─── Owner functions ──────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function setPlatformTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        platformTreasury = _treasury;
    }

    function setFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Zero address");
        factory = _factory;
    }

    function rescueETH(address to) external onlyOwner {
        require(to != address(0), "Zero address");
        uint256 balance = address(this).balance;
        require(balance > 0, "Nothing to rescue");
        (bool success, ) = payable(to).call{value: balance}("");
        require(success, "Transfer failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    uint128 public constant MAX_FEE_BPS = 125;

    function setFeeTiers(FeeTier[] calldata tiers) external onlyOwner {
        require(tiers.length > 0, "Need at least one tier");
        for (uint256 i = 0; i < tiers.length - 1; i++) {
            require(tiers[i].totalBps <= MAX_FEE_BPS, "Fee exceeds 1.25% max");
            require(tiers[i].mcapThresholdEth > 0, "Threshold must be non-zero");
            require(tiers[i].platformBps <= tiers[i].totalBps, "platformBps exceeds totalBps");
            if (i > 0) {
                require(
                    tiers[i].mcapThresholdEth > tiers[i - 1].mcapThresholdEth,
                    "Tiers must be sorted ascending"
                );
            }
        }
        require(tiers[tiers.length - 1].totalBps <= MAX_FEE_BPS, "Fee exceeds 1.25% max");
        require(
            tiers[tiers.length - 1].platformBps <= tiers[tiers.length - 1].totalBps,
            "platformBps exceeds totalBps"
        );

        delete feeTiers;
        for (uint256 i = 0; i < tiers.length; i++) {
            feeTiers.push(tiers[i]);
        }

        emit FeeTiersUpdated(tiers.length);
    }

    /// @notice Returns all fee tiers as an array.
    function getFeeTiers() external view returns (FeeTier[] memory) {
        return feeTiers;
    }

    // ─── Fee logic ────────────────────────────────────────────────────────────

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _beforeInitialize(address, PoolKey calldata key, uint160) internal override returns (bytes4) {
        poolDeploymentBlock[PoolId.unwrap(key.toId())] = block.number;
        return BaseHook.beforeInitialize.selector;
    }

    /// @notice Returns the fee tier for a given market cap. Falls back to
    ///         FIXED_FEE_FALLBACK if no tiers are configured.
    function getFeeTier(uint256 mcapETH)
        public
        view
        returns (uint256 totalBps, uint256 platformBps, uint256 creatorBps)
    {
        uint256 len = feeTiers.length;
        if (len == 0) return (FIXED_FEE_FALLBACK, 0, FIXED_FEE_FALLBACK);

        for (uint256 i = 0; i < len; i++) {
            if (i == len - 1 || mcapETH < feeTiers[i].mcapThresholdEth) {
                uint256 t = feeTiers[i].totalBps;
                uint256 p = feeTiers[i].platformBps;
                return (t, p, t - p);
            }
        }

        // unreachable
        return (FIXED_FEE_FALLBACK, 0, FIXED_FEE_FALLBACK);
    }

    function _getFeeSplit(bytes32 poolId, address tokenAddress)
        internal
        view
        returns (uint256 totalFeeBps, uint256 platformBps, uint256 creatorBps)
    {
        if (block.number == poolDeploymentBlock[poolId]) return (0, 0, 0);

        if (factory == address(0)) {
            return (FIXED_FEE_FALLBACK, 0, FIXED_FEE_FALLBACK);
        }

        uint256 mcapETH = 0;
        try IFactory(factory).getMarketCap(tokenAddress) returns (uint256 mcap) {
            mcapETH = mcap;
        } catch {}

        return getFeeTier(mcapETH);
    }

    function _distributeFee(
        address tokenAddress,
        uint256 feeAmount,
        uint256 platformBps,
        uint256 totalBps
    ) internal {
        if (feeAmount == 0) return;

        if (platformTreasury != address(0) && totalBps > 0 && platformBps > 0) {
            uint256 platformShare = feeAmount * platformBps / totalBps;
            uint256 creatorShare = feeAmount - platformShare;

            if (platformShare > 0) {
                // unchecked: failed send stays in hook, owner withdraws via rescueETH
                (bool sent, ) = payable(platformTreasury).call{value: platformShare}("");
                sent;
            }
            if (creatorShare > 0) {
                (bool cs, ) = payable(tokenAddress).call{value: creatorShare}("");
                require(cs, "Creator fee failed");
            }
        } else {
            (bool success, ) = payable(tokenAddress).call{value: feeAmount}("");
            require(success, "Fee transfer failed");
        }
    }

    function _getTokenFromPool(PoolKey calldata key) internal pure returns (address) {
        address currency0 = Currency.unwrap(key.currency0);
        address currency1 = Currency.unwrap(key.currency1);
        if (currency0 == address(0)) return currency1;
        if (currency1 == address(0)) return currency0;
        return address(0);
    }

    function _isBuyTransaction(PoolKey calldata key, SwapParams calldata params) internal pure returns (bool) {
        bool ethIsCurrency0 = Currency.unwrap(key.currency0) == address(0);
        return ethIsCurrency0 ? params.zeroForOne : !params.zeroForOne;
    }

    /**
     * @dev Only exactInput buys are taxed here (specified currency = ETH in).
     * Other cases fall through to _afterSwap where ETH is the unspecified side:
     *   - exactOutput buys (specified = tokens out, unspecified = ETH in)
     *   - exactInput sells  (specified = tokens in,  unspecified = ETH out)
     * exactOutput sells are reverted — would require pre-swap price lookup.
     */
    function _beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        address tokenAddress = _getTokenFromPool(key);
        if (tokenAddress == address(0)) {
            return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        bool isBuy = _isBuyTransaction(key, params);
        bool isExactInput = params.amountSpecified < 0;

        // Block exactOutput sells — ETH is the specified currency here, so the
        // fee would need a pre-swap price lookup. Revert loudly instead of
        // silently allowing a fee-free sell path.
        require(isBuy || isExactInput, "exactOutput sells not supported");

        if (!isBuy || !isExactInput) {
            // exactOutput buys & exactInput sells: taxed in _afterSwap
            return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        bytes32 poolId = PoolId.unwrap(key.toId());
        (uint256 totalFeeBps, uint256 platformBps, ) = _getFeeSplit(poolId, tokenAddress);
        if (totalFeeBps == 0) {
            return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        uint256 ethIn = uint256(-params.amountSpecified);
        uint256 feeAmount = (ethIn * totalFeeBps) / BASIS_POINTS_DIVISOR;
        if (feeAmount == 0) {
            return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        bool ethIsCurrency0 = Currency.unwrap(key.currency0) == address(0);
        Currency ethCurrency = ethIsCurrency0 ? key.currency0 : key.currency1;
        poolManager.take(ethCurrency, address(this), feeAmount);
        _distributeFee(tokenAddress, feeAmount, platformBps, totalFeeBps);

        return (BaseHook.beforeSwap.selector, toBeforeSwapDelta(int128(int256(feeAmount)), 0), 0);
    }

    /**
     * @dev Tax cases where ETH is the *unspecified* currency:
     *   - exactOutput buy: user owes additional feeAmount ETH on top of swap cost
     *   - exactInput sell: user receives feeAmount less ETH
     */
    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        address tokenAddress = _getTokenFromPool(key);
        if (tokenAddress == address(0)) {
            return (BaseHook.afterSwap.selector, 0);
        }

        bool isBuy = _isBuyTransaction(key, params);
        bool isExactInput = params.amountSpecified < 0;
        bool ethIsUnspecified = (isBuy && !isExactInput) || (!isBuy && isExactInput);
        if (!ethIsUnspecified) {
            return (BaseHook.afterSwap.selector, 0);
        }

        bytes32 poolId = PoolId.unwrap(key.toId());
        (uint256 totalFeeBps, uint256 platformBps, ) = _getFeeSplit(poolId, tokenAddress);
        if (totalFeeBps == 0) {
            return (BaseHook.afterSwap.selector, 0);
        }

        bool ethIsCurrency0 = Currency.unwrap(key.currency0) == address(0);
        int128 ethDelta = ethIsCurrency0 ? delta.amount0() : delta.amount1();
        uint256 ethMoved = ethDelta < 0 ? uint256(-int256(ethDelta)) : uint256(int256(ethDelta));
        if (ethMoved == 0) {
            return (BaseHook.afterSwap.selector, 0);
        }

        uint256 feeAmount = (ethMoved * totalFeeBps) / BASIS_POINTS_DIVISOR;
        if (feeAmount == 0) {
            return (BaseHook.afterSwap.selector, 0);
        }

        Currency ethCurrency = ethIsCurrency0 ? key.currency0 : key.currency1;
        poolManager.take(ethCurrency, address(this), feeAmount);
        _distributeFee(tokenAddress, feeAmount, platformBps, totalFeeBps);

        return (BaseHook.afterSwap.selector, int128(int256(feeAmount)));
    }

    receive() external payable {}
}
