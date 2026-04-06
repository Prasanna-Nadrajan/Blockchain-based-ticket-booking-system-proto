import { ethers } from 'ethers';

const abi = [
  'function buyTicket(string eventId) external payable',
  'function setEventParams(string eventId, uint256 price, uint256 maxSupply) external',
  'function mintBatch(string eventId, uint256 count, address recipient) external',
  'function addVerifier(address verifier) external',
  'function markUsed(uint256 tokenId) external',
  'function tokensOfOwnerForEvent(address wallet, string eventId) external view returns (uint256[])',
  'function tokenUsed(uint256) external view returns (bool)',
  'function tokenEvent(uint256) external view returns (string)',
  'function ownerOf(uint256) external view returns (address)',
  'function transferFrom(address from, address to, uint256 tokenId) external',
];

let provider = null;
let signer = null;
let contract = null;
let deploymentData = null;

export async function loadDeployment() {
  try {
    const res = await fetch('/deployment.json');
    if (res.ok) {
      deploymentData = await res.json();
    } else {
      console.warn('deployment.json not found. Deploy the contract first.');
    }
  } catch (e) {
    console.warn('Could not load deployment.json:', e);
  }
}

export async function connectWallet() {
  if (!window.ethereum) {
    alert('Please install MetaMask!');
    return null;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    await setupEthers(accounts[0]);
    return accounts[0].toLowerCase();
  } catch (err) {
    console.error('User rejected wallet request', err);
    return null;
  }
}

export async function checkConnection() {
  if (window.ethereum) {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      await setupEthers(accounts[0]);
      return accounts[0].toLowerCase();
    }
  }
  return null;
}

async function setupEthers(address) {
  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();

  try {
    const network = await provider.getNetwork();
    if (network.chainId !== 31337n) {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7a69' }],
      });
    }
  } catch (e) {
    console.warn('Failed to switch network', e);
  }

  if (!deploymentData) await loadDeployment();
  if (deploymentData) {
    contract = new ethers.Contract(deploymentData.contractAddress, abi, signer);
  }

  window.ethereum.on('accountsChanged', () => window.location.reload());
}

export function getContract() {
  return contract;
}

export function getSigner() {
  return signer;
}
