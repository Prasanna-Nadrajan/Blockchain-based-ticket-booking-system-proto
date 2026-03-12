const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying TicketNFT with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const userAddress = "0x33497c9f49a5cffd78d6235c5cda5ba3083dd781";

  // Fund the user's wallet with test ETH from the Hardhat node 
  console.log("Funding user wallet with 100 ETH...");
  const tx = await deployer.sendTransaction({
    to: userAddress,
    value: hre.ethers.parseEther("100.0")
  });
  await tx.wait();

  // Deploy
  const TicketNFT = await hre.ethers.getContractFactory("TicketNFT");
  const contract = await TicketNFT.deploy(userAddress);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("\n✅ TicketNFT deployed to:", contractAddress);
  console.log("   Organizer (owner) address set to:", userAddress);

  // Write deployment info to a shared config file read by both frontend and backend
  const deploymentInfo = {
    contractAddress,
    organizerAddress: userAddress,
    network: "localhost",
    chainId: 31337,
    deployedAt: new Date().toISOString()
  };

  // Write to blockchain/deployment.json
  const blockchainDir = path.join(__dirname, "..");
  fs.writeFileSync(
    path.join(blockchainDir, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Copy ABI + deployment info to backend
  const backendDir = path.join(__dirname, "..", "..", "backend");
  if (!fs.existsSync(backendDir)) fs.mkdirSync(backendDir, { recursive: true });
  const artifact = hre.artifacts.readArtifactSync("TicketNFT");
  fs.writeFileSync(
    path.join(backendDir, "TicketNFT_abi.json"),
    JSON.stringify(artifact.abi, null, 2)
  );
  fs.writeFileSync(
    path.join(backendDir, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Copy ABI + deployment info to frontend
  const frontendDir = path.join(__dirname, "..", "..", "frontend");
  if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir, { recursive: true });
  fs.writeFileSync(
    path.join(frontendDir, "TicketNFT_abi.json"),
    JSON.stringify(artifact.abi, null, 2)
  );
  fs.writeFileSync(
    path.join(frontendDir, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n📄 Files written:");
  console.log("   blockchain/deployment.json");
  console.log("   backend/TicketNFT_abi.json");
  console.log("   backend/deployment.json");
  console.log("   frontend/TicketNFT_abi.json");
  console.log("   frontend/deployment.json");
  console.log("\n🚀 Next steps:");
  console.log("   1. Start backend:  cd ../backend && uvicorn main:app --reload --port 8000");
  console.log("   2. Open frontend:  frontend/index.html in browser");
  console.log("   3. Connect MetaMask to http://127.0.0.1:8545 (Chain ID 31337)");
  console.log("   4. Import organizer account private key into MetaMask");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
