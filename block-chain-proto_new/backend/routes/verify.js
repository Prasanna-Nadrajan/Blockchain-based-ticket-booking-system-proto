const express = require('express');
const { ethers } = require('ethers');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { getContract } = require('../utils/blockchain');

const router = express.Router();

/**
 * POST /api/verify
 * Verify a ticket on-chain. Verifier (or organizer) only.
 * Body: { token_id: number, verifier_address: string }
 */
router.post('/', auth, authorize('verifier', 'organizer'), async (req, res) => {
  try {
    const { token_id, verifier_address } = req.body;

    if (token_id === undefined || !verifier_address) {
      return res.status(400).json({ message: 'token_id and verifier_address are required.' });
    }

    const wallet = verifier_address.toLowerCase();

    const c = getContract();
    if (!c) {
      return res.status(500).json({ message: 'Contract not configured.' });
    }

    // Check if caller is a registered verifier on-chain
    try {
      const isVerifier = await c.isVerifier(ethers.getAddress(wallet));
      if (!isVerifier) {
        return res.status(403).json({ message: 'Caller is not a registered verifier on-chain.' });
      }
    } catch (e) {
      return res.status(500).json({ message: 'Failed to check verifier status.' });
    }

    // Check ticket validity
    try {
      const owner = await c.ownerOf(token_id);
      const isUsed = await c.tokenUsed(token_id);

      if (isUsed) {
        return res.json({ status: 'INVALID', reason: 'already_used' });
      }

      return res.json({ status: 'VALID', token_id, owner });
    } catch (e) {
      return res.json({ status: 'INVALID', reason: 'not_found', details: e.message });
    }
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ message: 'Verification failed.' });
  }
});

module.exports = router;
