// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title PopBondingToken
/// @notice Minimal ERC20 cloned by PopBondingFactory for every launch.
/// Total supply is minted once at initialize() to the curve, which then sells
/// it down via the bonding curve. After graduation the curve sends the
/// remaining tokens + ETH to the LP locker which seeds a Uniswap V3 1% pool
/// and burns the position NFT.
contract PopBondingToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public curve;          // the bonding curve clone
    address public factory;        // PopBondingFactory
    bool    private _initialized;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /// @notice Called once by the factory right after CREATE2 clone deploy.
    /// Mints the entire supply to the curve.
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
        uint256 b = balanceOf[from];
        require(b >= value, "bal");
        unchecked { balanceOf[from] = b - value; }
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
