const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * Create a new user account.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, walletAddress } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // Auto-generate username from email
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
    let username = baseUsername;
    let counter = 1;
    while (await User.findOne({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    const validRoles = ['user', 'organizer', 'verifier'];
    const userRole = validRoles.includes(role) ? role : 'user';

    const wallets = [];
    if (walletAddress) {
      wallets.push({ chain: 'ethereum', address: walletAddress.toLowerCase(), isPrimary: true });
    }

    const user = await User.create({
      name,
      username,
      email: email.toLowerCase(),
      password,
      role: userRole,
      walletAddress: walletAddress ? walletAddress.toLowerCase() : '',
      wallets,
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

/**
 * POST /api/auth/wallet-login
 * Login via signed message via SIWE pattern
 */
router.post('/wallet-login', async (req, res) => {
  try {
    const { address, signature, message } = req.body;

    if (!address || !signature || !message) {
      return res.status(400).json({ message: 'Address, signature, and message are required.' });
    }

    const { ethers } = require('ethers');
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ message: 'Signature verification failed.' });
    }

    // Attempt to find user with this wallet address
    let user = await User.findOne({ 
      'wallets.address': address.toLowerCase(), 
      isDeleted: false 
    });

    if (!user) {
      // Check legacy field
      user = await User.findOne({ 
        walletAddress: address.toLowerCase(), 
        isDeleted: false 
      });
      
      if (!user) {
        return res.status(404).json({ message: 'No account linked to this wallet. Please log in with email and link it via settings first.' });
      }
    }

    const token = generateToken(user);
    res.json({
      message: 'Wallet login successful',
      token,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('Wallet login error:', err);
    res.status(500).json({ message: 'Server error during wallet login.' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ user: formatUser(user) });
});

/**
 * PUT /api/auth/profile
 * Update profile: bio, social links, avatar, username, preferences
 */
router.put('/profile', auth, async (req, res) => {
  try {
    const allowedFields = ['bio', 'avatarUrl', 'username', 'name', 'preferences'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Handle social links separately (merge)
    if (req.body.socialLinks) {
      const validSocials = ['x', 'instagram', 'linkedin', 'github', 'website'];
      updates.socialLinks = {};
      for (const key of validSocials) {
        if (req.body.socialLinks[key] !== undefined) {
          updates.socialLinks[key] = req.body.socialLinks[key];
        }
      }
      // Merge with existing
      const currentUser = await User.findById(req.user.id);
      updates.socialLinks = { ...currentUser.socialLinks.toObject(), ...updates.socialLinks };
    }

    // Validate username uniqueness
    if (updates.username) {
      const existing = await User.findOne({ username: updates.username, _id: { $ne: req.user.id } });
      if (existing) {
        return res.status(400).json({ message: 'Username already taken.' });
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true, runValidators: true });
    res.json({ message: 'Profile updated', user: formatUser(user) });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Failed to update profile.' });
  }
});

/**
 * PUT /api/auth/wallet
 * Update the wallet address for the current user (legacy endpoint).
 */
router.put('/wallet', auth, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ message: 'Wallet address is required.' });
    }

    const addr = walletAddress.toLowerCase();
    const user = await User.findById(req.user.id);

    // Update legacy field
    user.walletAddress = addr;

    // Also add to wallets array if not already there
    const existing = user.wallets.find((w) => w.address === addr && w.chain === 'ethereum');
    if (!existing) {
      user.wallets.push({ chain: 'ethereum', address: addr, isPrimary: true });
    }

    await user.save();

    res.json({
      message: 'Wallet address updated',
      user: formatUser(user),
    });
  } catch (err) {
    console.error('Wallet update error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

/**
 * POST /api/auth/wallet/link
 * Link a new wallet via signed message verification
 */
router.post('/wallet/link', auth, async (req, res) => {
  try {
    const { chain, address, signature, message } = req.body;

    if (!chain || !address || !signature || !message) {
      return res.status(400).json({ message: 'chain, address, signature, and message are required.' });
    }

    if (!['ethereum', 'solana'].includes(chain)) {
      return res.status(400).json({ message: 'Invalid chain. Use ethereum or solana.' });
    }

    // Verify signature (Ethereum)
    if (chain === 'ethereum') {
      const { ethers } = require('ethers');
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        return res.status(400).json({ message: 'Signature verification failed.' });
      }
    }

    // TODO: Add Solana signature verification

    const user = await User.findById(req.user.id);
    const existing = user.wallets.find((w) => w.address.toLowerCase() === address.toLowerCase() && w.chain === chain);
    if (existing) {
      return res.status(400).json({ message: 'Wallet already linked.' });
    }

    const isPrimary = user.wallets.filter((w) => w.chain === chain).length === 0;
    user.wallets.push({ chain, address: address.toLowerCase(), isPrimary });

    // Also update legacy field if this is the first ethereum wallet
    if (chain === 'ethereum' && !user.walletAddress) {
      user.walletAddress = address.toLowerCase();
    }

    await user.save();

    res.json({ message: 'Wallet linked successfully', user: formatUser(user) });
  } catch (err) {
    console.error('Wallet link error:', err);
    res.status(500).json({ message: 'Failed to link wallet.' });
  }
});

/**
 * DELETE /api/auth/wallet/unlink
 * Unlink a wallet
 */
router.delete('/wallet/unlink', auth, async (req, res) => {
  try {
    const { chain, address } = req.body;
    const user = await User.findById(req.user.id);

    user.wallets = user.wallets.filter(
      (w) => !(w.address.toLowerCase() === address.toLowerCase() && w.chain === chain)
    );

    if (chain === 'ethereum' && user.walletAddress === address.toLowerCase()) {
      const nextEth = user.wallets.find((w) => w.chain === 'ethereum');
      user.walletAddress = nextEth ? nextEth.address : '';
    }

    await user.save();

    res.json({ message: 'Wallet unlinked', user: formatUser(user) });
  } catch (err) {
    console.error('Wallet unlink error:', err);
    res.status(500).json({ message: 'Failed to unlink wallet.' });
  }
});

/**
 * DELETE /api/auth/account
 * Soft delete account
 */
router.delete('/account', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      isDeleted: true,
      deletedAt: new Date(),
      email: `deleted_${req.user.id}@deleted.local`,
    });

    res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ message: 'Failed to delete account.' });
  }
});

/**
 * GET /api/auth/profile/:username
 * Public profile lookup
 */
router.get('/profile/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── Helpers ─────────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function formatUser(user) {
  return {
    id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    socialLinks: user.socialLinks,
    walletAddress: user.walletAddress,
    wallets: user.wallets,
    preferences: user.preferences,
    createdAt: user.createdAt,
  };
}

module.exports = router;
