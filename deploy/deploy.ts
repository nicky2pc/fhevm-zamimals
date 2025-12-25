import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedTrophy = await deploy("ConfidentialTrophyNFT", {
    from: deployer,
    args: [], // конструктор без аргументов
    log: true,
    waitConfirmations: 6, // для Sepolia
  });

  console.log(`ConfidentialTrophyNFT deployed at: ${deployedTrophy.address}`);
};

export default func;

func.id = "deploy_confidential_trophy";
func.tags = ["ConfidentialTrophyNFT"];