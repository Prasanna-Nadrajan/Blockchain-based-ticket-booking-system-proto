// Shared Web3 and API logic for the frontend

/* global ethers */

const BACKEND_URL = "http://localhost:8000";
window.userAddress = null;
window.provider = null;
window.signer = null;
window.contract = null;

// The ABI for TicketNFT (copying essential methods here, better to load dynamically but this avoids complexity)
const abi = [
    "function buyTicket(string eventId) external payable",
    "function setEventParams(string eventId, uint256 price, uint256 maxSupply) external",
    "function mintBatch(string eventId, uint256 count, address recipient) external",
    "function addVerifier(address verifier) external",
    "function markUsed(uint256 tokenId) external",
    "function tokensOfOwnerForEvent(address wallet, string eventId) external view returns (uint256[])",
    "function tokenUsed(uint256) external view returns (bool)",
    "function tokenEvent(uint256) external view returns (string)",
    "function ownerOf(uint256) external view returns (address)",
    "function transferFrom(address from, address to, uint256 tokenId) external"
];

let deploymentData = null;

async function initApp() {
    try {
        // Fetch deployment info to get contract address
        const res = await fetch('deployment.json');
        if (res.ok) {
            deploymentData = await res.json();
        } else {
            console.error("Could not load deployment.json. Have you deployed the contract?");
        }
    } catch (e) {
        console.warn("Running from file:// ? Hardcoding might be necessary if fetch fails.", e);
    }
}

async function checkConnection() {
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await setupEthers(accounts[0]);
            return true;
        }
    }
    return false;
}

async function connectWallet() {
    if (!window.ethereum) {
        alert("Please install MetaMask!");
        return false;
    }
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        await setupEthers(accounts[0]);
        return true;
    } catch (err) {
        console.error("User rejected request", err);
        return false;
    }
}

async function setupEthers(address) {
    window.userAddress = address.toLowerCase();
    
    // Setup ethers v6
    window.provider = new ethers.BrowserProvider(window.ethereum);
    window.signer = await window.provider.getSigner();
    
    // Switch to Hardhat network if needed
    try {
        const network = await window.provider.getNetwork();
        if (network.chainId !== 31337n) {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x7a69' }], // 31337 in hex
            });
        }
    } catch (e) {
        console.error("Failed to switch network", e);
    }

    // Setup contract instance if deployment data is loaded
    if (deploymentData) {
        window.contract = new ethers.Contract(deploymentData.contractAddress, abi, window.signer);
    } else {
        // Fallback or retry
        await initApp();
        if (deploymentData) {
            window.contract = new ethers.Contract(deploymentData.contractAddress, abi, window.signer);
        }
    }

    // Handle account change
    window.ethereum.on('accountsChanged', function (accounts) {
        if (accounts.length > 0) {
            window.location.reload();
        }
    });
}

// Helper to make API calls with the wallet header
async function apiCall(path, options = {}) {
    if (!window.userAddress) throw new Error("Wallet not connected");
    
    const headers = options.headers || {};
    headers['X-Wallet-Address'] = window.userAddress;
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    
    const response = await fetch(`${BACKEND_URL}${path}`, {
        ...options,
        headers
    });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP Error ${response.status}`);
    }
    
    return response.json();
}

function showToast(title, message, isError = false) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = isError ? 'var(--danger)' : 'var(--success)';
    toast.style.color = '#fff';
    toast.style.padding = '1rem';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
    toast.style.zIndex = '9999';
    toast.style.animation = 'fadeIn 0.3s ease';
    toast.innerHTML = `<strong>${title}</strong><br><span style="font-size: 0.875rem">${message}</span>`;
    
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Guard components
function renderGuard() {
    return `
        <div class="auth-guard">
            <div class="icon">🦊</div>
            <h2>MetaMask Required</h2>
            <p style="color: var(--text-muted); margin: 1rem 0 2rem;">Please connect your wallet to access this page.</p>
            <button class="btn btn-primary" onclick="connectAndReload()">Connect Wallet</button>
        </div>
    `;
}

async function connectAndReload() {
    await connectWallet();
    window.location.reload();
}
