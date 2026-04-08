const express = require('express');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');

const router = express.Router();

/**
 * POST /api/registrations
 * Register / RSVP for an event
 */
router.post('/', auth, async (req, res) => {
  try {
    const { eventId, ticketTier, note } = req.body;

    const event = await Event.findOne({ eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.status === 'cancelled') {
      return res.status(400).json({ message: 'Event is cancelled.' });
    }

    // Check capacity
    if (event.registrationCount >= event.totalCapacity) {
      return res.status(400).json({ message: 'Event is at full capacity.' });
    }

    // Check if already registered
    const existing = await Registration.findOne({ event: event._id, user: req.user.id });
    if (existing) {
      return res.status(400).json({ message: 'Already registered for this event.', registration: existing });
    }

    const status = event.requireApproval ? 'pending' : 'approved';

    const registration = await Registration.create({
      event: event._id,
      user: req.user.id,
      status,
      ticketTier: ticketTier || 'General Admission',
      note: note || '',
    });

    // Increment registration count
    if (status === 'approved') {
      await Event.findByIdAndUpdate(event._id, { $inc: { registrationCount: 1 } });
    }

    // Send notification to user
    await Notification.create({
      recipient: req.user.id,
      type: status === 'approved' ? 'registration_approved' : 'event_update',
      title: status === 'approved' ? 'Registration Confirmed' : 'Registration Pending',
      message: status === 'approved'
        ? `You're registered for "${event.name}"`
        : `Your registration for "${event.name}" is pending approval`,
      event: event._id,
    });

    const populated = await Registration.findById(registration._id)
      .populate('event', 'eventId name startTime venue')
      .populate('user', 'name email username');

    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Already registered for this event.' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Failed to register.' });
  }
});

/**
 * GET /api/registrations/my
 * List current user's registrations
 */
router.get('/my', auth, async (req, res) => {
  try {
    const registrations = await Registration.find({ user: req.user.id })
      .populate('event', 'eventId name startTime endTime venue coverImageUrl locationType location tags priceEth')
      .sort({ createdAt: -1 });

    res.json(registrations);
  } catch (err) {
    console.error('My registrations error:', err);
    res.status(500).json({ message: 'Failed to load registrations.' });
  }
});

/**
 * GET /api/registrations/event/:eventId
 * List registrations for an event. Organizer/host only.
 */
router.get('/event/:eventId', auth, async (req, res) => {
  try {
    const event = await Event.findOne({ eventId: req.params.eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Check ownership
    if (event.createdBy.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    const registrations = await Registration.find({ event: event._id })
      .populate('user', 'name email username avatarUrl')
      .sort({ createdAt: -1 });

    res.json(registrations);
  } catch (err) {
    console.error('Event registrations error:', err);
    res.status(500).json({ message: 'Failed to load registrations.' });
  }
});

/**
 * PUT /api/registrations/:id/approve
 * Approve a pending registration
 */
router.put('/:id/approve', auth, async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id).populate('event');
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found.' });
    }

    // Check that current user is the event host
    if (registration.event.createdBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    if (registration.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending registrations can be approved.' });
    }

    registration.status = 'approved';
    await registration.save();

    // Increment event registration count
    await Event.findByIdAndUpdate(registration.event._id, { $inc: { registrationCount: 1 } });

    // Notify user
    await Notification.create({
      recipient: registration.user,
      type: 'registration_approved',
      title: 'Registration Approved!',
      message: `Your registration for "${registration.event.name}" has been approved.`,
      event: registration.event._id,
    });

    res.json({ message: 'Registration approved.', registration });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ message: 'Failed to approve registration.' });
  }
});

/**
 * PUT /api/registrations/:id/decline
 * Decline a pending registration
 */
router.put('/:id/decline', auth, async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id).populate('event');
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found.' });
    }

    if (registration.event.createdBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    registration.status = 'declined';
    await registration.save();

    await Notification.create({
      recipient: registration.user,
      type: 'registration_declined',
      title: 'Registration Declined',
      message: `Your registration for "${registration.event.name}" was not approved.`,
      event: registration.event._id,
    });

    res.json({ message: 'Registration declined.', registration });
  } catch (err) {
    console.error('Decline error:', err);
    res.status(500).json({ message: 'Failed to decline registration.' });
  }
});

/**
 * DELETE /api/registrations/:id
 * Cancel own registration
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found.' });
    }

    if (registration.user.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    if (registration.status === 'approved') {
      await Event.findByIdAndUpdate(registration.event, { $inc: { registrationCount: -1 } });
    }

    registration.status = 'cancelled';
    await registration.save();

    res.json({ message: 'Registration cancelled.' });
  } catch (err) {
    console.error('Cancel registration error:', err);
    res.status(500).json({ message: 'Failed to cancel registration.' });
  }
});

module.exports = router;
