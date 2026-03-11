// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TicketNFT
 * @notice ERC-721 contract for event-based NFT ticketing.
 *
 * Roles:
 *   - Owner (Organizer): deploys contract, mints tickets, registers verifiers
 *   - Verifier (Gate):   registered by owner, can mark tickets as used
 *   - Holder:           any wallet that owns a token
 */
contract TicketNFT is ERC721, Ownable {

    // ─── State ────────────────────────────────────────────────────────────────

    uint256 private _nextTokenId;

    /// token_id → event_id
    mapping(uint256 => string) public tokenEvent;

    /// token_id → used flag
    mapping(uint256 => bool) public tokenUsed;

    /// registered gate verifiers
    mapping(address => bool) public isVerifier;

    // ─── Events ───────────────────────────────────────────────────────────────

    event TicketMinted(uint256 indexed tokenId, string eventId, address indexed recipient);
    event TicketUsed(uint256 indexed tokenId, address indexed verifier);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address initialOwner) ERC721("NFTTicket", "NTKT") Ownable(initialOwner) {}

    // ─── Organizer functions (owner only) ─────────────────────────────────────

    /**
     * @notice Mint `count` tickets for `eventId`, all sent to `recipient`.
     * @return firstTokenId  The ID of the first token minted in this batch.
     */
    function mintBatch(
        string calldata eventId,
        uint256 count,
        address recipient
    ) external onlyOwner returns (uint256 firstTokenId) {
        require(count > 0 && count <= 200, "TicketNFT: count out of range");
        firstTokenId = _nextTokenId;

        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(recipient, tokenId);
            tokenEvent[tokenId] = eventId;
            emit TicketMinted(tokenId, eventId, recipient);
        }
    }

    /**
     * @notice Register an address as a gate verifier.
     */
    function addVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "TicketNFT: zero address");
        isVerifier[verifier] = true;
        emit VerifierAdded(verifier);
    }

    /**
     * @notice Remove a gate verifier.
     */
    function removeVerifier(address verifier) external onlyOwner {
        isVerifier[verifier] = false;
        emit VerifierRemoved(verifier);
    }

    // ─── Verifier functions ───────────────────────────────────────────────────

    /**
     * @notice Mark a ticket as used. Only callable by registered verifiers.
     */
    function markUsed(uint256 tokenId) external {
        require(isVerifier[msg.sender], "TicketNFT: caller is not a verifier");
        require(_ownerOf(tokenId) != address(0), "TicketNFT: token does not exist");
        require(!tokenUsed[tokenId], "TicketNFT: ticket already used");
        tokenUsed[tokenId] = true;
        emit TicketUsed(tokenId, msg.sender);
    }

    // ─── Public views ─────────────────────────────────────────────────────────

    /**
     * @notice Returns all token IDs owned by `wallet` for a specific `eventId`.
     *         NOTE: Only reliable for small supplies; use backend indexing for large scale.
     */
    function tokensOfOwnerForEvent(address wallet, string calldata eventId)
        external
        view
        returns (uint256[] memory)
    {
        uint256 total = _nextTokenId;
        uint256[] memory temp = new uint256[](total);
        uint256 found = 0;
        for (uint256 i = 0; i < total; i++) {
            if (
                _ownerOf(i) == wallet &&
                keccak256(bytes(tokenEvent[i])) == keccak256(bytes(eventId))
            ) {
                temp[found++] = i;
            }
        }
        uint256[] memory result = new uint256[](found);
        for (uint256 j = 0; j < found; j++) {
            result[j] = temp[j];
        }
        return result;
    }

    /**
     * @notice Total tokens minted so far.
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @notice Check if a token exists.
     */
    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
