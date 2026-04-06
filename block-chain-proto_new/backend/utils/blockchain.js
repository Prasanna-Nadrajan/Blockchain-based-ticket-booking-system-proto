const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const DEPLOYMENT_FILE = path.join(BASE_DIR, 'deployment.json');
const ABI_FILE = path.join(BASE_DIR, 'TicketNFT_abi.json');

let provider = null;
let contract = null;
let organizerAddress = null;

/**
 * Get ethers.js JSON-RPC provider connected to the local Hardhat node.
 */
function getProvider() {
  if (!provider) {
    const rpcUrl = process.env.BLOCKCHAIN_RPC || 'http://127.0.0.1:8545';
    provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return provider;
}

/**
 * Get the TicketNFT contract instance (read-only via provider).
 * Returns null if deployment files don't exist yet.
 */
function getContract() {
  if (contract) return contract;

  if (!fs.existsSync(DEPLOYMENT_FILE) || !fs.existsSync(ABI_FILE)) {
    console.warn('⚠️  deployment.json or ABI file not found. Deploy the contract first.');
    return null;
  }

  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf-8'));
  const abi = JSON.parse(fs.readFileSync(ABI_FILE, 'utf-8'));

  organizerAddress = deployment.organizerAddress.toLowerCase();
  contract = new ethers.Contract(deployment.contractAddress, abi, getProvider());

  return contract;
}

/**
 * Get the organizer (contract owner) address.
 */
function getOrganizerAddress() {
  if (!organizerAddress) getContract(); // triggers load
  return organizerAddress;
}

/**
 * Reset cached contract instance (useful if contract is redeployed).
 */
function resetContract() {
  contract = null;
  organizerAddress = null;
}

module.exports = { getProvider, getContract, getOrganizerAddress, resetContract };
