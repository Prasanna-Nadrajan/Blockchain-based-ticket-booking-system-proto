const express = require('express');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/notifications
 * Get notifications for current user
 */
router.get('/', auth, async (req, res) => {
  try {
    const { unreadOnly } = req.query;
    const filter = { recipient: req.user.id };
    if (unreadOnly === 'true') {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .populate('event', 'eventId name')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ recipient: req.user.id, isRead: false });

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ message: 'Failed to load notifications.' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', auth, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { isRead: true }
    );
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update notification.' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update notifications.' });
  }
});

/**
 * POST /api/notifications/blast
 * Send a blast notification to event registrants (organizer only)
 */
router.post('/blast', auth, async (req, res) => {
  try {
    const { eventId, title, message } = req.body;

    if (!eventId || !title || !message) {
      return res.status(400).json({ message: 'eventId, title, and message are required.' });
    }

    const Event = require('../models/Event');
    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.createdBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    const Registration = require('../models/Registration');
    const registrations = await Registration.find({
      event: event._id,
      status: 'approved',
    });

    const notifications = registrations.map((reg) => ({
      recipient: reg.user,
      type: 'blast',
      title,
      message,
      event: event._id,
    }));

    await Notification.insertMany(notifications);

    res.json({ message: `Blast sent to ${notifications.length} attendees.` });
  } catch (err) {
    console.error('Blast error:', err);
    res.status(500).json({ message: 'Failed to send blast.' });
  }
});

module.exports = router;
