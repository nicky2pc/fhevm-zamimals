import { ConfidentialTrophyNFT, ConfidentialTrophyNFT__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ConfidentialTrophyNFT")) as ConfidentialTrophyNFT__factory;
  const trophyContract = (await factory.deploy()) as ConfidentialTrophyNFT;
  const trophyContractAddress = await trophyContract.getAddress();
  return { trophyContract, trophyContractAddress };
}

describe("ConfidentialTrophyNFT", function () {
  let signers: Signers;
  let trophyContract: ConfidentialTrophyNFT;
  let trophyContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async () => {
    ({ trophyContract, trophyContractAddress } = await deployFixture());
  });

  it("should mint NFT with confidential score", async function () {
    const scoreToMint = 42;
    const uri = "ipfs://QmTestMetadata/trophy.json";

    const encryptedScore = await fhevm
      .createEncryptedInput(trophyContractAddress, signers.alice.address)
      .add32(scoreToMint)
      .encrypt();

    const tx = await trophyContract
      .connect(signers.alice)
      .mintWithConfidentialScore(
        signers.alice.address,
        uri,
        encryptedScore.handles[0],
        encryptedScore.inputProof
      );
    await tx.wait();

    const tokenId = 0;

    expect(await trophyContract.ownerOf(tokenId)).to.equal(signers.alice.address);
    expect(await trophyContract.tokenURI(tokenId)).to.equal(uri);

    const encryptedHandle = await trophyContract
      .connect(signers.alice)
      .getEncryptedScore(tokenId);

    // Проверка: decrypt и сравнение с исходным scoreToMint
    const decryptedScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedHandle,
      trophyContractAddress,
      signers.alice
    );

    expect(decryptedScore).to.equal(scoreToMint);
  });

  it("only owner can get encrypted score handle", async function () {
    const scoreToMint = 100;
    const uri = "ipfs://QmTestMetadata/trophy.json";

    const encryptedScore = await fhevm
      .createEncryptedInput(trophyContractAddress, signers.alice.address)
      .add32(scoreToMint)
      .encrypt();

    await trophyContract
      .connect(signers.alice)
      .mintWithConfidentialScore(
        signers.alice.address,
        uri,
        encryptedScore.handles[0],
        encryptedScore.inputProof
      );

    const tokenId = 0;

    // Owner может
    const handleFromOwner = await trophyContract.connect(signers.alice).getEncryptedScore(tokenId);
    expect(handleFromOwner).to.not.equal(ethers.ZeroHash);

    // Non-owner revert'ит
    await expect(
      trophyContract.connect(signers.deployer).getEncryptedScore(tokenId)
    ).to.be.revertedWith("Not owner");
  });
});