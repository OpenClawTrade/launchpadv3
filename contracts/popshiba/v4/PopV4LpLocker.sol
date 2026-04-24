// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title PopV4LpLocker
/// @notice 1:1 fork of Unicurve's LP_LOCKER pattern. Owns the post-graduation
/// V4 PositionManager NFT permanently (locked forever). Mirrors Unicurve's
/// design where the locker:
///   1. Receives the LP NFT minted by the V4 `PositionManager`.
///   2. Whitelists the PositionManager via a `receive()` guard so only the PM
///      can push native ETH into this contract (e.g. fee collection refunds).
///   3. Exposes `claimFees(poolId)` callable by anyone, which forwards LP
///      trading fees from the PM to the curve clone, which then splits them
///      50/50 between creator and protocol treasury.
///
/// All admin functions are removed — once a position is locked, neither the
/// deployer nor the creator can withdraw it.
interface IPositionManagerMin {
    function collect(uint256 tokenId, address recipient) external returns (uint256, uint256);
}

interface IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4);
}

interface ICurveClone {
    function creator() external view returns (address);
    function protocolTreasury() external view returns (address);
    function token() external view returns (address);
}

interface IERC20Min {
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

contract PopV4LpLocker is IERC721Receiver {
    address public immutable POSITION_MANAGER;
    /// @dev Platform admin — can trigger fee claims on behalf of inactive
    /// creators. Cannot withdraw or redirect funds; split logic is hardcoded.
    address public immutable PLATFORM_ADMIN;

    /// @dev poolId (bytes32) → tokenId of the locked V4 position NFT.
    mapping(bytes32 => uint256) public lockedPosition;
    /// @dev poolId → curve clone responsible for fee accounting.
    mapping(bytes32 => address) public curveOf;

    event Locked(bytes32 indexed poolId, uint256 indexed tokenId, address indexed curve);
    event FeesClaimed(bytes32 indexed poolId, address indexed caller, uint256 eth, uint256 tokens);

    error OnlyPositionManager();
    error NotAuthorized();

    constructor(address _pm, address _admin) {
        POSITION_MANAGER = _pm;
        PLATFORM_ADMIN = _admin;
    }

    /// @notice Called by the curve right after the PM mints the LP NFT to us.
    function registerLock(bytes32 poolId, uint256 tokenId, address curve) external {
        require(lockedPosition[poolId] == 0, "locked");
        // Caller must be the curve clone that the factory deployed.
        require(msg.sender == curve, "auth");
        lockedPosition[poolId] = tokenId;
        curveOf[poolId] = curve;
        emit Locked(poolId, tokenId, curve);
    }

    /// @notice Trigger LP fee claim. Restricted to the token CREATOR or the
    /// PLATFORM_ADMIN (per product spec). Funds are always split 50/50
    /// creator/treasury — caller cannot redirect them, only initiate the sweep.
    function claimFees(bytes32 poolId) external {
        uint256 tokenId = lockedPosition[poolId];
        require(tokenId != 0, "!locked");
        address curve = curveOf[poolId];
        address creator = ICurveClone(curve).creator();
        if (msg.sender != creator && msg.sender != PLATFORM_ADMIN) revert NotAuthorized();

        uint256 ethBefore = address(this).balance;
        address tokenAddr = ICurveClone(curve).token();
        uint256 tokBefore = IERC20Min(tokenAddr).balanceOf(address(this));

        IPositionManagerMin(POSITION_MANAGER).collect(tokenId, address(this));

        uint256 ethGained = address(this).balance - ethBefore;
        uint256 tokGained = IERC20Min(tokenAddr).balanceOf(address(this)) - tokBefore;

        // Split + forward: 50/50 creator/treasury for both legs.
        address treasury = ICurveClone(curve).protocolTreasury();

        if (ethGained > 0) {
            uint256 half = ethGained / 2;
            (bool a,) = creator.call{value: half}("");
            (bool b,) = treasury.call{value: ethGained - half}("");
            require(a && b, "send");
        }
        if (tokGained > 0) {
            uint256 half = tokGained / 2;
            IERC20Min(tokenAddr).transfer(creator, half);
            IERC20Min(tokenAddr).transfer(treasury, tokGained - half);
        }

        emit FeesClaimed(poolId, msg.sender, ethGained, tokGained);
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @dev Whitelist guard: only the V4 PositionManager may push native ETH.
    /// Identical pattern to Unicurve's locker (prevents accidental sends from
    /// inflating fee accounting).
    receive() external payable {
        if (msg.sender != POSITION_MANAGER) revert OnlyPositionManager();
    }
}
