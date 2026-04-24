// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title PopKlikToken
/// @notice Minimal ERC20 deployed once per launch. Full 1B supply minted at
/// construction to the factory, which then routes ~96% to the V4 LP and
/// retains the remainder for the creator's atomic initial buy.
/// No transfer restrictions (Klik-style: instant-LP launch has no anti-snipe
/// because the dev buy + LP seed happen atomically in one tx).
contract PopKlikToken {
    string public name;
    string public symbol;
    uint8  public constant decimals = 18;
    uint256 public constant totalSupply = 1_000_000_000e18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, address mintTo) {
        name = _name;
        symbol = _symbol;
        balanceOf[mintTo] = totalSupply;
        emit Transfer(address(0), mintTo, totalSupply);
    }

    function transfer(address to, uint256 v) external returns (bool) {
        _move(msg.sender, to, v);
        return true;
    }

    function transferFrom(address from, address to, uint256 v) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            require(a >= v, "allowance");
            allowance[from][msg.sender] = a - v;
        }
        _move(from, to, v);
        return true;
    }

    function approve(address sp, uint256 v) external returns (bool) {
        allowance[msg.sender][sp] = v;
        emit Approval(msg.sender, sp, v);
        return true;
    }

    function _move(address f, address t, uint256 v) internal {
        require(balanceOf[f] >= v, "bal");
        unchecked {
            balanceOf[f] -= v;
            balanceOf[t] += v;
        }
        emit Transfer(f, t, v);
    }
}
