// Solidity sources inlined as string constants so the edge-runtime bundler
// includes them (raw .sol files are not bundled with the function).

export const POPSHIBA_TOKEN_SOL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PopShibaToken {
    string public name;
    string public symbol;
    uint8  public constant decimals = 18;
    uint256 public totalSupply;
    string  public metadataURI;
    string  public constant launchedBy = "PopShiba.com";

    bool private _initialized;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function initialize(
        string memory _name,
        string memory _symbol,
        address _recipient,
        uint256 _supply,
        string memory _metadataURI
    ) external {
        require(!_initialized, "ALREADY_INIT");
        _initialized = true;
        name = _name;
        symbol = _symbol;
        totalSupply = _supply;
        metadataURI = _metadataURI;
        balanceOf[_recipient] = _supply;
        emit Transfer(address(0), _recipient, _supply);
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
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "ERC20: allowance");
        if (allowed != type(uint256).max) {
            unchecked { allowance[from][msg.sender] = allowed - value; }
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "ERC20: balance");
        unchecked {
            balanceOf[from] -= value;
            balanceOf[to]   += value;
        }
        emit Transfer(from, to, value);
    }
}
`;

export const POPSHIBA_CLONE_FACTORY_SOL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPopShibaToken {
    function initialize(
        string memory name,
        string memory symbol,
        address recipient,
        uint256 supply,
        string memory metadataURI
    ) external;
}

contract PopShibaCloneFactory {
    address public immutable implementation;
    address public immutable owner;

    event TokenCloned(
        address indexed token,
        address indexed creator,
        string name,
        string symbol
    );

    constructor(address _implementation) {
        require(_implementation != address(0), "ZERO_IMPL");
        implementation = _implementation;
        owner = msg.sender;
    }

    function createToken(
        string calldata name,
        string calldata symbol,
        address recipient,
        uint256 supply,
        string calldata metadataURI,
        address creator
    ) external returns (address token) {
        require(msg.sender == owner, "NOT_OWNER");
        token = _clone(implementation);
        IPopShibaToken(token).initialize(name, symbol, recipient, supply, metadataURI);
        emit TokenCloned(token, creator, name, symbol);
    }

    function _clone(address impl) internal returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, impl))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        require(instance != address(0), "CLONE_FAILED");
    }
}
`;

export const POPSHIBA_FEE_VAULT_SOL = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWETH9 is IERC20 {
    function withdraw(uint256) external;
}

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface INonfungiblePositionManager {
    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }
    function collect(CollectParams calldata params) external returns (uint256 amount0, uint256 amount1);
}

contract PopShibaFeeVault {
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant NPM  = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
    uint128 public constant MAX_UINT128 = type(uint128).max;

    address public owner;
    address public platformTreasury;

    struct TokenInfo {
        uint256 lpTokenId;
        address creator;
        bool    registered;
    }

    mapping(address => TokenInfo) public tokens;
    mapping(address => uint256)  public creatorOwed;
    mapping(address => uint256)  public creatorPaid;
    mapping(address => uint256)  public lifetimeCollected;
    mapping(address => uint256)  public platformPaid;

    event TokenRegistered(address indexed token, uint256 lpTokenId, address indexed creator);
    event FeesCollected(address indexed token, uint256 wethCollected, uint256 creatorShare, uint256 platformShare);
    event CreatorClaimed(address indexed token, address indexed creator, uint256 amountWeth, bool unwrappedToEth);
    event PlatformPaid(address indexed token, uint256 amount);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(address _platformTreasury) {
        require(_platformTreasury != address(0), "ZERO_TREASURY");
        owner = msg.sender;
        platformTreasury = _platformTreasury;
    }

    function registerToken(address token, uint256 lpTokenId, address creator) external onlyOwner {
        require(!tokens[token].registered, "ALREADY_REGISTERED");
        require(creator != address(0), "ZERO_CREATOR");
        require(IERC721(NPM).ownerOf(lpTokenId) == address(this), "NFT_NOT_HELD");
        tokens[token] = TokenInfo({lpTokenId: lpTokenId, creator: creator, registered: true});
        emit TokenRegistered(token, lpTokenId, creator);
    }

    function collect(address token) external returns (uint256 wethCollected) {
        TokenInfo memory info = tokens[token];
        require(info.registered, "NOT_REGISTERED");

        uint256 wethBefore = IERC20(WETH).balanceOf(address(this));

        INonfungiblePositionManager(NPM).collect(INonfungiblePositionManager.CollectParams({
            tokenId: info.lpTokenId,
            recipient: address(this),
            amount0Max: MAX_UINT128,
            amount1Max: MAX_UINT128
        }));

        uint256 wethAfter = IERC20(WETH).balanceOf(address(this));
        wethCollected = wethAfter - wethBefore;
        if (wethCollected == 0) return 0;

        uint256 creatorShare = wethCollected / 2;
        uint256 platformShare = wethCollected - creatorShare;

        creatorOwed[token] += creatorShare;
        lifetimeCollected[token] += wethCollected;

        if (platformShare > 0) {
            require(IERC20(WETH).transfer(platformTreasury, platformShare), "PLATFORM_TRANSFER_FAILED");
            platformPaid[token] += platformShare;
            emit PlatformPaid(token, platformShare);
        }

        emit FeesCollected(token, wethCollected, creatorShare, platformShare);
    }

    function claim(address token, bool unwrap) external returns (uint256 amount) {
        TokenInfo memory info = tokens[token];
        require(info.registered, "NOT_REGISTERED");
        require(msg.sender == info.creator, "NOT_CREATOR");

        amount = creatorOwed[token];
        require(amount > 0, "NOTHING_OWED");

        creatorOwed[token] = 0;
        creatorPaid[token] += amount;

        if (unwrap) {
            IWETH9(WETH).withdraw(amount);
            (bool ok, ) = info.creator.call{value: amount}("");
            require(ok, "ETH_TRANSFER_FAILED");
        } else {
            require(IERC20(WETH).transfer(info.creator, amount), "WETH_TRANSFER_FAILED");
        }

        emit CreatorClaimed(token, info.creator, amount, unwrap);
    }

    function totalOwedFor(address creator, address[] calldata tokenList) external view returns (uint256 total) {
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokens[tokenList[i]].creator == creator) {
                total += creatorOwed[tokenList[i]];
            }
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    function setPlatformTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "ZERO_TREASURY");
        emit TreasuryChanged(platformTreasury, newTreasury);
        platformTreasury = newTreasury;
    }

    receive() external payable {}
}
`;
