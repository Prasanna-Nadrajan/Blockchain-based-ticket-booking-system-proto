const express = require('express');
const Event = require('../models/Event');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { getContract } = require('../utils/blockchain');

const router = express.Router();

// Auto-incrementing event counter — loaded from DB on first use
let eventCounter = null;

async function getNextEventId() {
  if (eventCounter === null) {
    const lastEvent = await Event.findOne().sort({ createdAt: -1 });
    if (lastEvent && lastEvent.eventId) {
      const num = parseInt(lastEvent.eventId.replace('EVT-', ''), 10);
      eventCounter = isNaN(num) ? 1 : num + 1;
    } else {
      eventCounter = 1;
    }
  }
  const id = `EVT-${String(eventCounter).padStart(3, '0')}`;
  eventCounter++;
  return id;
}

/**
 * POST /api/events
 * Create a new event. Organizer only.
 */
router.post('/', auth, authorize('organizer'), async (req, res) => {
  try {
    const { name, date, venue, capacity, price_eth } = req.body;

    if (!name || !date || !venue || !capacity) {
      return res.status(400).json({ message: 'name, date, venue, and capacity are required.' });
    }

    const eventId = await getNextEventId();

    const event = await Event.create({
      eventId,
      name,
      date,
      venue,
      totalCapacity: capacity,
      priceEth: price_eth || 0.01,
      createdBy: req.user.id,
    });

    res.status(201).json({
      id: event.eventId,
      name: event.name,
      date: event.date,
      venue: event.venue,
      total_capacity: event.totalCapacity,
      price_eth: event.priceEth,
    });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ message: 'Failed to create event.' });
  }
});

/**
 * GET /api/events
 * List all events. Authenticated users only.
 */
router.get('/', auth, async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    const result = events.map((ev) => ({
      id: ev.eventId,
      name: ev.name,
      date: ev.date,
      venue: ev.venue,
      total_capacity: ev.totalCapacity,
      price_eth: ev.priceEth,
    }));
    res.json(result);
  } catch (err) {
    console.error('List events error:', err);
    res.status(500).json({ message: 'Failed to list events.' });
  }
});

/**
 * GET /api/events/marketplace
 * Public marketplace with real-time blockchain supply data.
 */
router.get('/marketplace', async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    const c = getContract();

    const marketplace = [];
    for (const ev of events) {
      let available = ev.totalCapacity;
      let total = ev.totalCapacity;

      if (c) {
        try {
          const maxSupply = Number(await c.eventMaxSupply(ev.eventId));
          const mintedCount = Number(await c.eventMintedCount(ev.eventId));
          total = maxSupply > 0 ? maxSupply : ev.totalCapacity;
          available = total - mintedCount;
        } catch (e) {
          // fallback to off-chain data
        }
      }

      marketplace.push({
        id: ev.eventId,
        name: ev.name,
        date: ev.date,
        venue: ev.venue,
        price_eth: ev.priceEth,
        available,
        total,
      });
    }

    res.json(marketplace);
  } catch (err) {
    console.error('Marketplace error:', err);
    res.status(500).json({ message: 'Failed to load marketplace.' });
  }
});

/**
 * GET /api/events/:eventId/tickets
 * List all tickets for an event from blockchain. Organizer only.
 */
router.get('/:eventId/tickets', auth, authorize('organizer'), async (req, res) => {
  try {
    const c = getContract();
    if (!c) return res.json([]);

    const totalMinted = Number(await c.totalMinted());
    const tickets = [];

    for (let i = 0; i < totalMinted; i++) {
      try {
        const tokenEvent = await c.tokenEvent(i);
        if (tokenEvent === req.params.eventId) {
          const owner = (await c.ownerOf(i)).toLowerCase();
          const isUsed = await c.tokenUsed(i);
          tickets.push({
            token_id: i,
            event_id: tokenEvent,
            owner,
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

module.exports = router;
