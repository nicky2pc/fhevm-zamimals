// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract ConfidentialTrophyNFT is ERC721URIStorage, Ownable, ZamaEthereumConfig {
    uint256 private _nextTokenId;
    mapping(uint256 => euint32) private encryptedScores;

    function contractURI() public pure returns (string memory) {
        return "ipfs://bafkreifxdgxalrmctuytadma3avj43mjlojsunrtho2cxxahwm5sljhxvu"; // см. ниже
    }

    constructor() ERC721("Confidential Trophy", "CTROPHY") Ownable(msg.sender) {}

    function mintWithConfidentialScore(
        address to,
        string memory uri,  // ✅ Это должен быть IPFS CID метаданных JSON!
        externalEuint32 encryptedScore,
        bytes calldata inputProof
    ) external {
        euint32 score = FHE.fromExternal(encryptedScore, inputProof);
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri); // ✅ Устанавливаем правильный URI
        encryptedScores[tokenId] = score;

        FHE.allowThis(encryptedScores[tokenId]);
        FHE.allow(encryptedScores[tokenId], to);
    }

    function getEncryptedScore(uint256 tokenId) external view returns (bytes32) {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        return FHE.toBytes32(encryptedScores[tokenId]);
    }
}