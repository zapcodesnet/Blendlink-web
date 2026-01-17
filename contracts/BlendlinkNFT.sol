// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title Blendlink NFT Collection
 * @notice ERC721 NFT contract for Blendlink platform on Immutable zkEVM
 * @dev Compatible with Immutable Minting API for gasless mints
 * 
 * Features:
 * - ERC721URIStorage for IPFS metadata (photos/videos/music)
 * - Public mint function for users
 * - Minter role for Immutable Minting API integration
 * - Operator Allowlist compliant for Immutable zkEVM
 */

// Immutable Operator Allowlist Interface
interface IOperatorAllowlist {
    function isAllowlisted(address target) external view returns (bool);
}

contract BlendlinkNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Operator Allowlist for Immutable zkEVM compliance
    IOperatorAllowlist public operatorAllowlist;
    
    // Minter role for Immutable Minting API
    mapping(address => bool) public minters;
    
    // Base URI for metadata
    string private _baseTokenURI;
    
    // Events
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event OperatorAllowlistUpdated(address indexed newAllowlist);
    
    // Errors
    error CallerNotMinter();
    error ApproveTargetNotAllowlisted();
    error TransferToNotAllowlisted();
    
    /**
     * @notice Constructor
     * @param _operatorAllowlist Immutable Operator Allowlist address
     * @param baseURI Base URI for token metadata
     */
    constructor(
        address _operatorAllowlist,
        string memory baseURI
    ) ERC721("Blendlink NFT Collection", "BLEND") {
        operatorAllowlist = IOperatorAllowlist(_operatorAllowlist);
        _baseTokenURI = baseURI;
        
        // Owner is initial minter
        minters[msg.sender] = true;
        emit MinterAdded(msg.sender);
    }
    
    // ============== MINTING ==============
    
    /**
     * @notice Public mint function - anyone can mint
     * @param to Address to mint to
     * @param tokenURI IPFS URI for token metadata
     * @return tokenId The minted token ID
     */
    function mint(address to, string memory tokenURI) public returns (uint256) {
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        
        return tokenId;
    }
    
    /**
     * @notice Mint with specific token ID (for Minting API compatibility)
     * @dev Only callable by authorized minters
     * @param to Address to mint to
     * @param tokenId Specific token ID to mint
     * @param tokenURI IPFS URI for token metadata
     */
    function mintByID(address to, uint256 tokenId, string memory tokenURI) external {
        if (!minters[msg.sender] && msg.sender != owner()) {
            revert CallerNotMinter();
        }
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
    }
    
    /**
     * @notice Batch mint function for efficiency
     * @param to Address to mint to
     * @param tokenURIs Array of IPFS URIs
     * @return tokenIds Array of minted token IDs
     */
    function mintBatch(address to, string[] memory tokenURIs) external returns (uint256[] memory) {
        uint256[] memory tokenIds = new uint256[](tokenURIs.length);
        
        for (uint256 i = 0; i < tokenURIs.length; i++) {
            _tokenIdCounter.increment();
            uint256 tokenId = _tokenIdCounter.current();
            
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, tokenURI);
            tokenIds[i] = tokenId;
        }
        
        return tokenIds;
    }
    
    /**
     * @notice Safe mint for Minting API (gasless mints)
     * @dev Only callable by authorized minters
     * @param to Address to mint to  
     * @param quantity Number of tokens to mint
     */
    function mintBatchByQuantity(address to, uint256 quantity) external {
        if (!minters[msg.sender] && msg.sender != owner()) {
            revert CallerNotMinter();
        }
        
        for (uint256 i = 0; i < quantity; i++) {
            _tokenIdCounter.increment();
            uint256 tokenId = _tokenIdCounter.current();
            _safeMint(to, tokenId);
        }
    }
    
    // ============== MINTER MANAGEMENT ==============
    
    /**
     * @notice Add a minter (for Immutable Minting API)
     * @param minter Address to add as minter
     */
    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
        emit MinterAdded(minter);
    }
    
    /**
     * @notice Remove a minter
     * @param minter Address to remove
     */
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }
    
    /**
     * @notice Grant minter role to Immutable's minter contract
     * @dev Call this after deployment with Immutable's minter address
     */
    function grantMinterRole(address immutableMinter) external onlyOwner {
        minters[immutableMinter] = true;
        emit MinterAdded(immutableMinter);
    }
    
    // ============== OPERATOR ALLOWLIST (Immutable zkEVM Compliance) ==============
    
    /**
     * @notice Update operator allowlist address
     * @param newAllowlist New allowlist contract address
     */
    function setOperatorAllowlist(address newAllowlist) external onlyOwner {
        operatorAllowlist = IOperatorAllowlist(newAllowlist);
        emit OperatorAllowlistUpdated(newAllowlist);
    }
    
    /**
     * @dev Override approve to enforce operator allowlist
     */
    function approve(address to, uint256 tokenId) public virtual override(ERC721, IERC721) {
        if (address(operatorAllowlist) != address(0)) {
            if (!operatorAllowlist.isAllowlisted(to) && to != address(0)) {
                revert ApproveTargetNotAllowlisted();
            }
        }
        super.approve(to, tokenId);
    }
    
    /**
     * @dev Override setApprovalForAll to enforce operator allowlist
     */
    function setApprovalForAll(address operator, bool approved) public virtual override(ERC721, IERC721) {
        if (address(operatorAllowlist) != address(0) && approved) {
            if (!operatorAllowlist.isAllowlisted(operator)) {
                revert ApproveTargetNotAllowlisted();
            }
        }
        super.setApprovalForAll(operator, approved);
    }
    
    /**
     * @dev Override _beforeTokenTransfer to enforce operator allowlist on transfers
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override {
        // Skip check for minting (from == address(0)) and burning (to == address(0))
        if (from != address(0) && to != address(0) && address(operatorAllowlist) != address(0)) {
            // Check if the transfer is initiated by an allowlisted operator
            if (msg.sender != from && !operatorAllowlist.isAllowlisted(msg.sender)) {
                revert TransferToNotAllowlisted();
            }
        }
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    // ============== METADATA ==============
    
    /**
     * @notice Set base URI for all tokens
     * @param baseURI New base URI
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    /**
     * @dev Override base URI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }
    
    // ============== VIEW FUNCTIONS ==============
    
    /**
     * @notice Get total supply of minted tokens
     * @return Total number of tokens minted
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    /**
     * @notice Check if address is a minter
     * @param account Address to check
     * @return True if address is a minter
     */
    function isMinter(address account) public view returns (bool) {
        return minters[account];
    }
    
    /**
     * @notice Contract metadata for marketplaces
     * @return Contract-level metadata URI
     */
    function contractURI() public pure returns (string memory) {
        return "ipfs://QmBlendlinkCollectionMetadata";
    }
    
    // ============== REQUIRED OVERRIDES ==============
    
    function _burn(uint256 tokenId) internal override(ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
