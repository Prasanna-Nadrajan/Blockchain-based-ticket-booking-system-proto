const express = require('express');
const Event = require('../models/Event');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { getContract } = require('../utils/blockchain');

const router = express.Router();

// Auto-incrementing event counter
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
    const {
      name, date, venue, capacity, price_eth,
      description, coverImageUrl, startTime, endTime, timezone,
      locationType, location, visibility, requireApproval, isFree,
      tags, ticketTiers, status,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Event name is required.' });
    }

    const eventId = await getNextEventId();

    // Build event data
    const eventData = {
      eventId,
      name,
      description: description || '',
      coverImageUrl: coverImageUrl || '',
      startTime: startTime ? new Date(startTime) : new Date(date || Date.now()),
      endTime: endTime ? new Date(endTime) : undefined,
      timezone: timezone || 'Asia/Kolkata',
      date: date || '',
      locationType: locationType || 'offline',
      location: location || {},
      venue: venue || location?.address || '',
      visibility: visibility || 'public',
      requireApproval: requireApproval || false,
      isFree: isFree || false,
      totalCapacity: capacity || 100,
      priceEth: price_eth || 0.01,
      ticketTiers: ticketTiers || [],
      tags: tags || [],
      createdBy: req.user.id,
      hosts: [req.user.id],
      status: status || 'published',
    };

    const event = await Event.create(eventData);

    res.status(201).json(formatEvent(event));
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
    const events = await Event.find({ status: { $ne: 'cancelled' } })
      .populate('createdBy', 'name username avatarUrl')
      .sort({ startTime: -1 });
    res.json(events.map(formatEvent));
  } catch (err) {
    console.error('List events error:', err);
    res.status(500).json({ message: 'Failed to list events.' });
  }
});

/**
 * GET /api/events/discover
 * Public discovery endpoint with category/city/search filtering.
 */
router.get('/discover', async (req, res) => {
  try {
    const { category, city, search, upcoming } = req.query;
    const filter = { status: 'published', visibility: 'public' };

    if (category) {
      filter.tags = { $in: [category.toLowerCase()] };
    }
    if (city) {
      filter['location.city'] = new RegExp(city, 'i');
    }
    if (search) {
      filter.$text = { $search: search };
    }
    if (upcoming === 'true') {
      filter.startTime = { $gte: new Date() };
    }

    const events = await Event.find(filter)
      .populate('createdBy', 'name username avatarUrl')
      .populate('hosts', 'name username avatarUrl')
      .sort({ startTime: 1 })
      .limit(50);

    res.json(events.map(formatEvent));
  } catch (err) {
    console.error('Discover error:', err);
    res.status(500).json({ message: 'Failed to discover events.' });
  }
});

/**
 * GET /api/events/marketplace
 * Public marketplace with real-time blockchain supply data.
 */
router.get('/marketplace', async (req, res) => {
  try {
    const events = await Event.find({ status: 'published' })
      .populate('createdBy', 'name username avatarUrl')
      .sort({ createdAt: -1 });
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
        ...formatEvent(ev),
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
 * GET /api/events/:eventId
 * Get single event detail
 */
router.get('/:eventId', async (req, res) => {
  try {
    const event = await Event.findOne({ eventId: req.params.eventId })
      .populate('createdBy', 'name username avatarUrl bio')
      .populate('hosts', 'name username avatarUrl');

    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Get blockchain data if available
    const c = getContract();
    let available = event.totalCapacity;
    let total = event.totalCapacity;

    if (c) {
      try {
        const maxSupply = Number(await c.eventMaxSupply(event.eventId));
        const mintedCount = Number(await c.eventMintedCount(event.eventId));
        total = maxSupply > 0 ? maxSupply : event.totalCapacity;
        available = total - mintedCount;
      } catch (e) {
        // fallback
      }
    }

    res.json({ ...formatEvent(event), available, total });
  } catch (err) {
    console.error('Get event error:', err);
    res.status(500).json({ message: 'Failed to get event.' });
  }
});

/**
 * PUT /api/events/:eventId
 * Update event. Creator/host only.
 */
router.put('/:eventId', auth, async (req, res) => {
  try {
    const event = await Event.findOne({ eventId: req.params.eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.createdBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this event.' });
    }

    const allowedUpdates = [
      'name', 'description', 'coverImageUrl', 'startTime', 'endTime',
      'timezone', 'locationType', 'location', 'venue', 'visibility',
      'requireApproval', 'isFree', 'totalCapacity', 'priceEth',
      'ticketTiers', 'tags', 'status',
    ];

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        event[field] = req.body[field];
      }
    }

    await event.save();
    res.json(formatEvent(event));
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ message: 'Failed to update event.' });
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

// ── Helper ──────────────────────────────────────────────────
function formatEvent(ev) {
  return {
    id: ev.eventId,
    name: ev.name,
    description: ev.description,
    coverImageUrl: ev.coverImageUrl,
    startTime: ev.startTime,
    endTime: ev.endTime,
    timezone: ev.timezone,
    date: ev.date,
    locationType: ev.locationType,
    location: ev.location,
    venue: ev.venue,
    visibility: ev.visibility,
    requireApproval: ev.requireApproval,
    isFree: ev.isFree,
    totalCapacity: ev.totalCapacity,
    price_eth: ev.priceEth,
    ticketTiers: ev.ticketTiers,
    tags: ev.tags,
    hosts: ev.hosts,
    createdBy: ev.createdBy,
    status: ev.status,
    registrationCount: ev.registrationCount,
    createdAt: ev.createdAt,
  };
}

module.exports = router;
