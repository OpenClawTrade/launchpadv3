// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PopBondingHookV4} from "./PopBondingHookV4.sol";

interface IBHookView {
    function realEthReserves() external view returns (uint256);
    function realTokenReserves() external view returns (uint256);
    function token() external view returns (address);
    function poolKey() external view returns (Currency, Currency, uint24, int24, address);
    function graduated() external view returns (bool);
    function withdrawForSeed(address to) external;
}

interface IERC20Min {
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

/// @title PopBondingLpSeederV4
/// @notice Anyone can call `seed(hook)` after a hook reaches graduation. The
/// seeder pulls the ETH + remaining tokens out of the hook, then opens a
/// full-range V4 liquidity position owned by this seeder forever (locked).
/// Trading fees from the post-grad pool can later be claimed via the V4
/// PositionManager (separate flow — fees are split 50/50 creator/treasury).
contract PopBondingLpSeederV4 is IUnlockCallback {
    IPoolManager public immutable POOL_MANAGER;

    error NotGraduated();
    error AlreadySeeded();
    error OnlyManager();

    mapping(address hook => bool seeded) public seeded;

    event Seeded(address indexed hook, uint256 ethUsed, uint256 tokensUsed);

    constructor(IPoolManager _pm) {
        POOL_MANAGER = _pm;
    }

    function seed(address hook) external {
        if (!IBHookView(hook).graduated()) revert NotGraduated();
        if (seeded[hook]) revert AlreadySeeded();
        seeded[hook] = true;

        // Pull funds OUT of the hook into this contract via privileged getters.
        IBHookView(hook).withdrawForSeed(address(this));

        // Trigger the unlock — the unlockCallback then pulls the
        // hook's accumulated ETH + tokens into the pool.
        POOL_MANAGER.unlock(abi.encode(hook));
    }

    /// @notice PoolManager invokes this with our payload.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(POOL_MANAGER)) revert OnlyManager();
        address hook = abi.decode(data, (address));

        // Reconstruct PoolKey from hook
        (Currency c0, Currency c1, uint24 fee, int24 tickSpacing, address hookAddr) = IBHookView(hook).poolKey();
        PoolKey memory key = PoolKey({
            currency0: c0,
            currency1: c1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: PopBondingHookV4(payable(hookAddr))
        });

        uint256 ethAmount = address(this).balance;
        uint256 tokenAmount = IERC20Min(IBHookView(hook).token()).balanceOf(address(this));

        // Approve tokens for the PoolManager
        IERC20Min(IBHookView(hook).token()).approve(address(POOL_MANAGER), tokenAmount);

        // Compute liquidity for full-range position.
        int24 minTick = (TickMath.MIN_TICK / tickSpacing) * tickSpacing;
        int24 maxTick = (TickMath.MAX_TICK / tickSpacing) * tickSpacing;

        // Mint LP — passed amounts via salt-style calldata. PoolManager will
        // settle by pulling currency from us.
        (BalanceDelta delta, ) = POOL_MANAGER.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: minTick,
                tickUpper: maxTick,
                liquidityDelta: int256(uint256(_estimateLiquidity(ethAmount, tokenAmount))),
                salt: bytes32(0)
            }),
            ""
        );

        emit Seeded(hook, ethAmount, tokenAmount);
        return abi.encode(delta);
    }

    function _estimateLiquidity(uint256 a, uint256 b) internal pure returns (uint128) {
        // Geometric mean approximation — sufficient for full-range seeding.
        unchecked {
            uint256 p = a * b;
            if (p == 0) return 0;
            uint256 z = p;
            uint256 y = (z + 1) >> 1;
            while (y < z) { z = y; y = (p / y + y) >> 1; }
            return uint128(z);
        }
    }

    receive() external payable {}
}
