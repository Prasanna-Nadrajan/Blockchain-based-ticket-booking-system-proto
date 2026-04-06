const express = require('express');
const QRCode = require('qrcode');
const Event = require('../models/Event');
const auth = require('../middleware/auth');
const { getContract } = require('../utils/blockchain');

const router = express.Router();

/**
 * GET /api/tickets?owner=<walletAddress>
 * List tickets owned by a specific wallet. Authenticated.
 */
router.get('/', auth, async (req, res) => {
  try {
    const ownerParam = (req.query.owner || '').toLowerCase();
    const wallet = req.user.walletAddress || '';

    if (!ownerParam) {
      return res.status(400).json({ message: 'owner query parameter is required.' });
    }

    // Users can only view their own tickets
    if (req.user.role === 'user' && ownerParam !== wallet) {
      return res.status(403).json({ message: 'You can only view your own tickets.' });
    }

    const c = getContract();
    if (!c) return res.json([]);

    const totalMinted = Number(await c.totalMinted());
    const tickets = [];

    for (let i = 0; i < totalMinted; i++) {
      try {
        const tokenOwner = (await c.ownerOf(i)).toLowerCase();
        if (tokenOwner === ownerParam) {
          const tokenEvent = await c.tokenEvent(i);
          const isUsed = await c.tokenUsed(i);

          // Get event name from DB
          const ev = await Event.findOne({ eventId: tokenEvent });
          const eventName = ev ? ev.name : 'Unknown Event';

          tickets.push({
            token_id: i,
            event_id: tokenEvent || 'UNKNOWN',
            event_name: eventName,
            owner: tokenOwner,
            is_used: isUsed,
          });
        }
      } catch (e) {
        continue;
      }
    }

    res.json(tickets);
  } catch (err) {
    console.error('List tickets error:', err);
    res.status(500).json({ message: 'Failed to list tickets.' });
  }
});

/**
 * GET /api/tickets/:ticketId
 * Get a single ticket. Owner or organizer only.
 */
router.get('/:ticketId', auth, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const c = getContract();
    if (!c) {
      return res.status(500).json({ message: 'Contract not configured.' });
    }

    const owner = (await c.ownerOf(ticketId)).toLowerCase();
    const wallet = (req.user.walletAddress || '').toLowerCase();

    if (wallet !== owner && req.user.role !== 'organizer') {
      return res.status(403).json({ message: 'Not authorized to view this ticket.' });
    }

    const eventId = await c.tokenEvent(ticketId);
    const isUsed = await c.tokenUsed(ticketId);

    res.json({
      token_id: ticketId,
      event_id: eventId,
      owner,
      is_used: isUsed,
    });
  } catch (err) {
    console.error('Get ticket error:', err);
    res.status(404).json({ message: 'Ticket not found.' });
  }
});

/**
 * GET /api/tickets/:ticketId/qr
 * Generate a QR code for a ticket. Owner or organizer only.
 */
router.get('/:ticketId/qr', auth, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const c = getContract();
    if (!c) {
      return res.status(500).json({ message: 'Contract not configured.' });
    }

    const owner = (await c.ownerOf(ticketId)).toLowerCase();
    const wallet = (req.user.walletAddress || '').toLowerCase();

    if (wallet !== owner && req.user.role !== 'organizer') {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    const eventId = await c.tokenEvent(ticketId);

    const payload = JSON.stringify({ token_id: ticketId, event_id: eventId });
    const qrDataUrl = await QRCode.toDataURL(payload, { width: 300, margin: 2 });

    res.json({ qr_base64: qrDataUrl });
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).json({ message: 'Failed to generate QR code.' });
  }
});

module.exports = router;
