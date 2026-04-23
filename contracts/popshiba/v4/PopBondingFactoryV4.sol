// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolIdLibrary, PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PopBondingToken} from "./PopBondingToken.sol";

interface ISingletonHook {
    function registerCurve(PoolId poolId, address curve, address token) external;
}

interface ICurveImpl {
    function initialize(
        address hook, address token, address creator, address treasury, address lpLocker,
        address c0, address c1, uint24 fee, int24 ts
    ) external;
    function TOTAL_SUPPLY() external view returns (uint256);
}

/// @title PopBondingFactoryV4
/// @notice 1:1 with Unicurve: deploys a token clone + a curve clone per launch,
/// registers the curve in the singleton hook, and initializes the V4 pool.
/// The hook itself is deployed ONCE off-chain at a mined CREATE2 address with
/// the required permission bits (0x2A88 lower-14-bits) — this factory just
/// wires per-launch state.
contract PopBondingFactoryV4 {
    using PoolIdLibrary for PoolKey;

    IPoolManager public immutable poolManager;
    address public immutable hook;          // singleton hook
    address public immutable curveImpl;     // EIP-1167 implementation
    address public immutable tokenImpl;     // EIP-1167 implementation
    address public immutable lpLocker;
    address public immutable treasury;

    int24  public constant TICK_SPACING = 60;
    uint24 public constant LP_FEE       = 10_000; // 1%

    event Launched(
        address indexed token,
        address indexed curve,
        address indexed creator,
        PoolId  poolId
    );

    constructor(
        IPoolManager _pm,
        address _hook,
        address _curveImpl,
        address _tokenImpl,
        address _lpLocker,
        address _treasury
    ) {
        poolManager = _pm;
        hook = _hook;
        curveImpl = _curveImpl;
        tokenImpl = _tokenImpl;
        lpLocker = _lpLocker;
        treasury = _treasury;
    }

    function launch(
        string calldata name,
        string calldata symbol,
        uint160 sqrtPriceX96
    ) external returns (address tokenAddr, address curveAddr, PoolId poolId) {
        // 1. Clone token + curve (EIP-1167, cheap)
        tokenAddr = _clone(tokenImpl);
        curveAddr = _clone(curveImpl);

        // 2. PoolKey: native ETH (0x0) is currency0 by V4's lower-address rule
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(tokenAddr),
            fee: LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(hook)
        });
        poolId = key.toId();

        // 3. Initialize curve clone (it now owns reserve accounting)
        ICurveImpl(curveAddr).initialize(
            hook, tokenAddr, msg.sender, treasury, lpLocker,
            address(0), tokenAddr, LP_FEE, TICK_SPACING
        );

        // 4. Mint full supply to the curve clone
        PopBondingToken(tokenAddr).initialize(
            name, symbol,
            ICurveImpl(curveAddr).TOTAL_SUPPLY(),
            curveAddr,
            address(this)
        );

        // 5. Register in the singleton hook + initialize the V4 pool
        ISingletonHook(hook).registerCurve(poolId, curveAddr, tokenAddr);
        poolManager.initialize(key, sqrtPriceX96);

        emit Launched(tokenAddr, curveAddr, msg.sender, poolId);
    }

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
