// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PopBondingHookV4} from "./PopBondingHookV4.sol";
import {PopBondingToken} from "../popshiba/bonding/PopBondingToken.sol";

/// @title PopBondingFactoryV4
/// @notice Off-chain process mines a CREATE2 salt so the hook deploys at an
/// address whose lower 14 bits == 0x2A88 (beforeAddLiquidity | beforeRemoveLiquidity
/// | beforeSwap | beforeSwapReturnsDelta). Caller passes that salt here.
contract PopBondingFactoryV4 {
    IPoolManager public immutable poolManager;
    address public immutable tokenImpl; // EIP-1167 minimal proxy target
    address public immutable treasury;
    int24 public constant TICK_SPACING = 60;
    uint24 public constant LP_FEE = 10_000; // 1% post-graduation pool fee

    event Launched(address indexed token, address indexed hook, address indexed creator, bytes32 salt);

    constructor(IPoolManager _pm, address _tokenImpl, address _treasury) {
        poolManager = _pm;
        tokenImpl = _tokenImpl;
        treasury = _treasury;
    }

    /// @notice Deploy hook at a pre-mined CREATE2 address, deploy the token,
    /// initialize the V4 pool, and prime the curve with all CURVE_TOKENS.
    function launch(
        string calldata name,
        string calldata symbol,
        bytes32 salt,
        uint160 sqrtPriceX96
    ) external returns (address tokenAddr, address hookAddr) {
        // 1. Deploy hook via CREATE2 with mined salt
        bytes memory creationCode = abi.encodePacked(
            type(PopBondingHookV4).creationCode,
            abi.encode(poolManager)
        );
        assembly {
            hookAddr := create2(0, add(creationCode, 0x20), mload(creationCode), salt)
            if iszero(hookAddr) { revert(0, 0) }
        }
        require(uint160(hookAddr) & 0x3FFF == 0x2A88, "BAD_SALT");

        // 2. Clone token (EIP-1167) and initialize: mint full supply to hook
        tokenAddr = _clone(tokenImpl);
        PopBondingToken(tokenAddr).initialize(
            name,
            symbol,
            PopBondingHookV4(payable(hookAddr)).TOTAL_SUPPLY(),
            hookAddr,
            address(this)
        );

        // 3. Build PoolKey: currency0 = ETH (0x0), currency1 = token
        // Native currency must be currency0 in V4 (lower address rule, 0x0 < anything).
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(tokenAddr),
            fee: LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(hookAddr)
        });

        // 4. Initialize hook state + the V4 pool itself
        PopBondingHookV4(payable(hookAddr)).initialize(tokenAddr, msg.sender, treasury, key);
        poolManager.initialize(key, sqrtPriceX96);

        emit Launched(tokenAddr, hookAddr, msg.sender, salt);
    }

    /// @dev EIP-1167 minimal proxy clone.
    function _clone(address impl) internal returns (address result) {
        bytes20 targetBytes = bytes20(impl);
        assembly {
            let c := mload(0x40)
            mstore(c, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(c, 0x14), targetBytes)
            mstore(add(c, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            result := create(0, c, 0x37)
        }
        require(result != address(0), "CLONE_FAIL");
    }
}
