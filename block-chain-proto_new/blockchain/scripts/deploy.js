const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying TicketNFT with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy — the deployer IS the organizer
  const TicketNFT = await hre.ethers.getContractFactory("TicketNFT");
  const contract = await TicketNFT.deploy(deployer.address);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("\n✅ TicketNFT deployed to:", contractAddress);
  console.log("   Organizer (owner) address:", deployer.address);

  // Write deployment info
  const deploymentInfo = {
    contractAddress,
    organizerAddress: deployer.address,
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

  // Copy ABI + deployment info to backend (root of backend/)
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

  // Copy deployment info to frontend/public/ (served as static asset by Vite)
  const frontendPublicDir = path.join(__dirname, "..", "..", "frontend", "public");
  if (!fs.existsSync(frontendPublicDir)) fs.mkdirSync(frontendPublicDir, { recursive: true });
  fs.writeFileSync(
    path.join(frontendPublicDir, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n📄 Files written:");
  console.log("   blockchain/deployment.json");
  console.log("   backend/TicketNFT_abi.json");
  console.log("   backend/deployment.json");
  console.log("   frontend/public/deployment.json");
  console.log("\n🚀 Next steps:");
  console.log("   1. Start backend:  cd ../backend && npm run dev");
  console.log("   2. Start frontend: cd ../frontend && npm run dev");
  console.log("   3. Connect MetaMask to http://127.0.0.1:8545 (Chain ID 31337)");
  console.log("   4. Import deployer account private key into MetaMask");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
