// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Blendlink NFT Collection
 * @notice Flattened ERC721 NFT contract for Immutable zkEVM
 * @dev All OpenZeppelin imports inlined for direct compilation
 */

// ============== OpenZeppelin Inlined Code ==============

// Context
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}

// Ownable
abstract contract Ownable is Context {
    address private _owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    constructor() {
        _transferOwnership(_msgSender());
    }
    
    modifier onlyOwner() {
        _checkOwner();
        _;
    }
    
    function owner() public view virtual returns (address) {
        return _owner;
    }
    
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }
    
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }
    
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }
    
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// Strings
library Strings {
    bytes16 private constant _SYMBOLS = "0123456789abcdef";
    
    function toString(uint256 value) internal pure returns (string memory) {
        unchecked {
            uint256 length = log10(value) + 1;
            string memory buffer = new string(length);
            uint256 ptr;
            assembly { ptr := add(buffer, add(32, length)) }
            while (true) {
                ptr--;
                assembly { mstore8(ptr, byte(mod(value, 10), _SYMBOLS)) }
                value /= 10;
                if (value == 0) break;
            }
            return buffer;
        }
    }
    
    function log10(uint256 value) internal pure returns (uint256) {
        uint256 result = 0;
        unchecked {
            if (value >= 10 ** 64) { value /= 10 ** 64; result += 64; }
            if (value >= 10 ** 32) { value /= 10 ** 32; result += 32; }
            if (value >= 10 ** 16) { value /= 10 ** 16; result += 16; }
            if (value >= 10 ** 8) { value /= 10 ** 8; result += 8; }
            if (value >= 10 ** 4) { value /= 10 ** 4; result += 4; }
            if (value >= 10 ** 2) { value /= 10 ** 2; result += 2; }
            if (value >= 10 ** 1) { result += 1; }
        }
        return result;
    }
}

// IERC165
interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// ERC165
abstract contract ERC165 is IERC165 {
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}

// IERC721
interface IERC721 is IERC165 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

// IERC721Receiver
interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}

// IERC721Metadata
interface IERC721Metadata is IERC721 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

// Address
library Address {
    function isContract(address account) internal view returns (bool) {
        return account.code.length > 0;
    }
}

// ERC721
contract ERC721 is Context, ERC165, IERC721, IERC721Metadata {
    using Address for address;
    using Strings for uint256;

    string private _name;
    string private _symbol;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IERC721).interfaceId || interfaceId == type(IERC721Metadata).interfaceId || super.supportsInterface(interfaceId);
    }

    function balanceOf(address owner) public view virtual override returns (uint256) {
        require(owner != address(0), "ERC721: address zero is not a valid owner");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner = _ownerOf(tokenId);
        require(owner != address(0), "ERC721: invalid token ID");
        return owner;
    }

    function name() public view virtual override returns (string memory) { return _name; }
    function symbol() public view virtual override returns (string memory) { return _symbol; }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireMinted(tokenId);
        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
    }

    function _baseURI() internal view virtual returns (string memory) { return ""; }

    function approve(address to, uint256 tokenId) public virtual override {
        address owner = ERC721.ownerOf(tokenId);
        require(to != owner, "ERC721: approval to current owner");
        require(_msgSender() == owner || isApprovedForAll(owner, _msgSender()), "ERC721: approve caller is not token owner or approved for all");
        _approve(to, tokenId);
    }

    function getApproved(uint256 tokenId) public view virtual override returns (address) {
        _requireMinted(tokenId);
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public virtual override {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public virtual override {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: caller is not token owner or approved");
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public virtual override {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public virtual override {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: caller is not token owner or approved");
        _safeTransfer(from, to, tokenId, data);
    }

    function _safeTransfer(address from, address to, uint256 tokenId, bytes memory data) internal virtual {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, data), "ERC721: transfer to non ERC721Receiver implementer");
    }

    function _ownerOf(uint256 tokenId) internal view virtual returns (address) { return _owners[tokenId]; }
    function _exists(uint256 tokenId) internal view virtual returns (bool) { return _ownerOf(tokenId) != address(0); }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual returns (bool) {
        address owner = ERC721.ownerOf(tokenId);
        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }

    function _safeMint(address to, uint256 tokenId) internal virtual { _safeMint(to, tokenId, ""); }

    function _safeMint(address to, uint256 tokenId, bytes memory data) internal virtual {
        _mint(to, tokenId);
        require(_checkOnERC721Received(address(0), to, tokenId, data), "ERC721: transfer to non ERC721Receiver implementer");
    }

    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_exists(tokenId), "ERC721: token already minted");
        _beforeTokenTransfer(address(0), to, tokenId, 1);
        require(!_exists(tokenId), "ERC721: token already minted");
        unchecked { _balances[to] += 1; }
        _owners[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
        _afterTokenTransfer(address(0), to, tokenId, 1);
    }

    function _burn(uint256 tokenId) internal virtual {
        address owner = ERC721.ownerOf(tokenId);
        _beforeTokenTransfer(owner, address(0), tokenId, 1);
        owner = ERC721.ownerOf(tokenId);
        delete _tokenApprovals[tokenId];
        unchecked { _balances[owner] -= 1; }
        delete _owners[tokenId];
        emit Transfer(owner, address(0), tokenId);
        _afterTokenTransfer(owner, address(0), tokenId, 1);
    }

    function _transfer(address from, address to, uint256 tokenId) internal virtual {
        require(ERC721.ownerOf(tokenId) == from, "ERC721: transfer from incorrect owner");
        require(to != address(0), "ERC721: transfer to the zero address");
        _beforeTokenTransfer(from, to, tokenId, 1);
        require(ERC721.ownerOf(tokenId) == from, "ERC721: transfer from incorrect owner");
        delete _tokenApprovals[tokenId];
        unchecked { _balances[from] -= 1; _balances[to] += 1; }
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
        _afterTokenTransfer(from, to, tokenId, 1);
    }

    function _approve(address to, uint256 tokenId) internal virtual {
        _tokenApprovals[tokenId] = to;
        emit Approval(ERC721.ownerOf(tokenId), to, tokenId);
    }

    function _setApprovalForAll(address owner, address operator, bool approved) internal virtual {
        require(owner != operator, "ERC721: approve to caller");
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    function _requireMinted(uint256 tokenId) internal view virtual {
        require(_exists(tokenId), "ERC721: invalid token ID");
    }

    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data) private returns (bool) {
        if (to.isContract()) {
            try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) revert("ERC721: transfer to non ERC721Receiver implementer");
                else assembly { revert(add(32, reason), mload(reason)) }
            }
        } else { return true; }
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal virtual {}
    function _afterTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal virtual {}
}

// ERC721URIStorage
abstract contract ERC721URIStorage is ERC721 {
    using Strings for uint256;
    mapping(uint256 => string) private _tokenURIs;

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireMinted(tokenId);
        string memory _tokenURI = _tokenURIs[tokenId];
        string memory base = _baseURI();
        if (bytes(base).length == 0) return _tokenURI;
        if (bytes(_tokenURI).length > 0) return string(abi.encodePacked(base, _tokenURI));
        return super.tokenURI(tokenId);
    }

    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
        require(_exists(tokenId), "ERC721URIStorage: URI set of nonexistent token");
        _tokenURIs[tokenId] = _tokenURI;
    }

    function _burn(uint256 tokenId) internal virtual override {
        super._burn(tokenId);
        if (bytes(_tokenURIs[tokenId]).length != 0) delete _tokenURIs[tokenId];
    }
}

// ============== Immutable Operator Allowlist Interface ==============
interface IOperatorAllowlist {
    function isAllowlisted(address target) external view returns (bool);
}

// ============== BLENDLINK NFT CONTRACT ==============
contract BlendlinkNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    IOperatorAllowlist public operatorAllowlist;
    mapping(address => bool) public minters;
    string private _baseTokenURI;
    
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    
    error CallerNotMinter();
    error ApproveTargetNotAllowlisted();
    error TransferToNotAllowlisted();

    constructor(address _operatorAllowlist, string memory baseURI) ERC721("Blendlink NFT Collection", "BLEND") {
        operatorAllowlist = IOperatorAllowlist(_operatorAllowlist);
        _baseTokenURI = baseURI;
        minters[msg.sender] = true;
        emit MinterAdded(msg.sender);
    }

    // Public mint - anyone can call
    function mint(address to, string memory uri) public returns (uint256) {
        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    // Mint by ID for Minting API
    function mintByID(address to, uint256 tokenId, string memory uri) external {
        if (!minters[msg.sender] && msg.sender != owner()) revert CallerNotMinter();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    // Batch mint by quantity for Minting API
    function mintBatchByQuantity(address to, uint256 quantity) external {
        if (!minters[msg.sender] && msg.sender != owner()) revert CallerNotMinter();
        for (uint256 i = 0; i < quantity; i++) {
            _tokenIdCounter++;
            _safeMint(to, _tokenIdCounter);
        }
    }

    // Minter management
    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    function grantMinterRole(address immutableMinter) external onlyOwner {
        minters[immutableMinter] = true;
        emit MinterAdded(immutableMinter);
    }

    // Operator Allowlist enforcement
    function setOperatorAllowlist(address newAllowlist) external onlyOwner {
        operatorAllowlist = IOperatorAllowlist(newAllowlist);
    }

    function approve(address to, uint256 tokenId) public virtual override {
        if (address(operatorAllowlist) != address(0) && to != address(0)) {
            if (!operatorAllowlist.isAllowlisted(to)) revert ApproveTargetNotAllowlisted();
        }
        super.approve(to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) public virtual override {
        if (address(operatorAllowlist) != address(0) && approved) {
            if (!operatorAllowlist.isAllowlisted(operator)) revert ApproveTargetNotAllowlisted();
        }
        super.setApprovalForAll(operator, approved);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal virtual override {
        if (from != address(0) && to != address(0) && address(operatorAllowlist) != address(0)) {
            if (msg.sender != from && !operatorAllowlist.isAllowlisted(msg.sender)) revert TransferToNotAllowlisted();
        }
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // Metadata
    function setBaseURI(string memory baseURI) external onlyOwner { _baseTokenURI = baseURI; }
    function _baseURI() internal view virtual override returns (string memory) { return _baseTokenURI; }

    // View functions
    function totalSupply() public view returns (uint256) { return _tokenIdCounter; }
    function isMinter(address account) public view returns (bool) { return minters[account]; }
    function contractURI() public pure returns (string memory) { return "ipfs://QmBlendlinkCollection"; }
}
