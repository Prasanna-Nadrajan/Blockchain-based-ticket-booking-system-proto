const Event = require('../models/Event');
const User = require('../models/User');
const { ethers } = require('ethers');

// Minimal ERC721/ERC20 ABI for balance check
const minimalABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

/**
 * Token Gate Middleware
 * Checks if a user's linked wallet holds specific tokens/NFTs
 * before allowing registration for exclusive events.
 *
 * Usage: router.post('/register', auth, tokenGate, handler)
 */
const tokenGate = async (req, res, next) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return next();

    // Use findById for events.js endpoints if eventId is ObjectId, but keep string find fallback
    const event = await Event.findById(eventId).catch(() => null) || await Event.findOne({ eventId });
    if (!event) return next();

    // If event has no token gate requirement, pass through
    if (!event.tokenGate || !event.tokenGate.enabled || !event.tokenGate.contractAddress) {
      return next();
    }

    // Get user from req.user (populated by auth middleware)
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required for token gated event.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    const targetChain = event.tokenGate.chain || 'ethereum';
    const ethWallet = user.wallets?.find(w => w.chain === targetChain && w.isPrimary) 
      || user.wallets?.find(w => w.chain === targetChain);

    if (!ethWallet && !user.walletAddress) {
      return res.status(403).json({ message: 'A linked wallet is required to access this token gated event.' });
    }

    const addressToCheck = ethWallet ? ethWallet.address : user.walletAddress;

    // Use default RPC or environment RPC (Hardhat local by default for testing)
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    try {
      const contract = new ethers.Contract(event.tokenGate.contractAddress, minimalABI, provider);
      const balance = await contract.balanceOf(addressToCheck);
      
      const requiredAmount = ethers.toBigInt(event.tokenGate.minBalance || 1);
      
      if (balance < requiredAmount) {
        return res.status(403).json({ 
          message: `Access denied. You need at least ${event.tokenGate.minBalance} token(s) of ${event.tokenGate.contractAddress} to register.` 
        });
      }
    } catch (contractErr) {
      console.error('Contract interaction failed during token gating:', contractErr.message);
      // For local development without contract deployed, we might want to bypass or mock
      if (process.env.NODE_ENV === 'development') {
         console.warn('Bypassing token gate error in development mode.');
         return next();
      }
      return res.status(403).json({ message: 'Failed to verify token ownership on-chain.' });
    }

    // Pass through if verified
    next();
  } catch (err) {
    console.error('Token gate error:', err);
    next(); // Fail open if infrastructure error
  }
};

module.exports = tokenGate;
