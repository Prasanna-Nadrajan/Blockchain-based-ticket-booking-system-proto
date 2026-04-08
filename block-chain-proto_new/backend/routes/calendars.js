const express = require('express');
const Calendar = require('../models/Calendar');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/calendars
 * Create a new calendar/community
 */
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, avatarUrl, coverImageUrl, isPublic } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Calendar name is required.' });
    }

    // Generate slug from name
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let counter = 1;
    while (await Calendar.findOne({ slug })) {
      slug = `${slug}-${counter}`;
      counter++;
    }

    const calendar = await Calendar.create({
      name,
      slug,
      description: description || '',
      avatarUrl: avatarUrl || '',
      coverImageUrl: coverImageUrl || '',
      owner: req.user.id,
      admins: [req.user.id],
      isPublic: isPublic !== false,
    });

    res.status(201).json(calendar);
  } catch (err) {
    console.error('Create calendar error:', err);
    res.status(500).json({ message: 'Failed to create calendar.' });
  }
});

/**
 * GET /api/calendars
 * List public calendars
 */
router.get('/', async (req, res) => {
  try {
    const calendars = await Calendar.find({ isPublic: true })
      .populate('owner', 'name username avatarUrl')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(calendars);
  } catch (err) {
    console.error('List calendars error:', err);
    res.status(500).json({ message: 'Failed to list calendars.' });
  }
});

/**
 * GET /api/calendars/:slug
 * Get calendar with events
 */
router.get('/:slug', async (req, res) => {
  try {
    const calendar = await Calendar.findOne({ slug: req.params.slug })
      .populate('owner', 'name username avatarUrl')
      .populate('admins', 'name username avatarUrl')
      .populate({
        path: 'events',
        options: { sort: { startTime: 1 } },
        populate: { path: 'createdBy', select: 'name username avatarUrl' },
      });

    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found.' });
    }

    res.json(calendar);
  } catch (err) {
    console.error('Get calendar error:', err);
    res.status(500).json({ message: 'Failed to get calendar.' });
  }
});

/**
 * POST /api/calendars/:slug/subscribe
 * Subscribe to a calendar
 */
router.post('/:slug/subscribe', auth, async (req, res) => {
  try {
    const calendar = await Calendar.findOne({ slug: req.params.slug });
    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found.' });
    }

    const alreadySubscribed = calendar.subscribers.some(
      (s) => s.user.toString() === req.user.id.toString()
    );

    if (alreadySubscribed) {
      return res.status(400).json({ message: 'Already subscribed.' });
    }

    calendar.subscribers.push({ user: req.user.id });
    await calendar.save();

    res.json({ message: 'Subscribed successfully.', subscriberCount: calendar.subscribers.length });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ message: 'Failed to subscribe.' });
  }
});

/**
 * DELETE /api/calendars/:slug/unsubscribe
 * Unsubscribe from a calendar
 */
router.delete('/:slug/unsubscribe', auth, async (req, res) => {
  try {
    const calendar = await Calendar.findOne({ slug: req.params.slug });
    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found.' });
    }

    calendar.subscribers = calendar.subscribers.filter(
      (s) => s.user.toString() !== req.user.id.toString()
    );
    await calendar.save();

    res.json({ message: 'Unsubscribed.', subscriberCount: calendar.subscribers.length });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).json({ message: 'Failed to unsubscribe.' });
  }
});

/**
 * POST /api/calendars/:slug/events
 * Add an event to a calendar
 */
router.post('/:slug/events', auth, async (req, res) => {
  try {
    const { eventId } = req.body;
    const calendar = await Calendar.findOne({ slug: req.params.slug });

    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found.' });
    }

    // Must be owner or admin
    const isAdmin = calendar.owner.toString() === req.user.id.toString()
      || calendar.admins.some((a) => a.toString() === req.user.id.toString());

    if (!isAdmin) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    const Event = require('../models/Event');
    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (!calendar.events.includes(event._id)) {
      calendar.events.push(event._id);
      await calendar.save();
    }

    res.json({ message: 'Event added to calendar.' });
  } catch (err) {
    console.error('Add event to calendar error:', err);
    res.status(500).json({ message: 'Failed to add event.' });
  }
});

module.exports = router;
