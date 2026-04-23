// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title PopBondingToken
/// @notice Minimal ERC20 cloned by the factory for every launch. Mirrors
/// Unicurve's token: full supply minted to the curve (hook) at init, transfers
/// blocked until the curve calls `enableTransfers()` post-graduation.
///
/// Pre-graduation: only transfers FROM the curve are allowed (so bonding-curve
/// buyers can receive tokens). All peer-to-peer transfers revert. This forces
/// every pre-grad swap through the curve and prevents off-curve OTC markets.
contract PopBondingToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public curve;          // curve clone (mints + gates transfers)
    address public factory;
    bool    public transfersEnabled;
    bool    private _initialized;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TransfersEnabled();

    function initialize(
        string calldata _name,
        string calldata _symbol,
        uint256 _supply,
        address _curve,
        address _factory
    ) external {
        require(!_initialized, "init");
        _initialized = true;
        name = _name;
        symbol = _symbol;
        curve = _curve;
        factory = _factory;
        totalSupply = _supply;
        balanceOf[_curve] = _supply;
        emit Transfer(address(0), _curve, _supply);
    }

    /// @notice Called by the curve clone once at graduation to unlock generic
    /// transfers for AMM trading.
    function enableTransfers() external {
        require(msg.sender == curve, "auth");
        transfersEnabled = true;
        emit TransfersEnabled();
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
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            require(a >= value, "allow");
            unchecked { allowance[from][msg.sender] = a - value; }
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "to=0");
        // Pre-graduation: only the curve can be a sender. This lets the curve
        // mint→user on buys and pull user→curve on sells via transferFrom.
        if (!transfersEnabled) {
            require(from == curve || msg.sender == curve, "locked");
        }
        uint256 b = balanceOf[from];
        require(b >= value, "bal");
        unchecked { balanceOf[from] = b - value; }
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
