const express = require('express');
const { ethers } = require('ethers');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { getContract } = require('../utils/blockchain');

const router = express.Router();

/**
 * POST /api/verify
 * Verify a ticket. Organizers only.
 * Body: { token_id: string|number, event_id: string }
 */
router.post('/', auth, authorize('organizer'), async (req, res) => {
  console.log('--- Verification Request ---');
  console.log('Body:', req.body);
  console.log('User Role:', req.user.role);
  console.log('User ID:', req.user.id);

  try {
    const { token_id, event_id } = req.body;

    if (token_id === undefined || !event_id) {
      console.warn('Missing token_id or event_id');
      return res.status(400).json({ message: 'token_id and event_id are required fields.' });
    }

    // Verify Organizer owns the event
    const event = await Event.findOne({ eventId: event_id });
    if (!event) {
      console.warn('Event not found:', event_id);
      return res.status(404).json({ message: 'Event not found.' });
    }
    
    const creatorId = event.createdBy.toString();
    const userId = req.user.id.toString();
    
    if (creatorId !== userId) {
      console.warn('Unauthorized verifier. Event Creator:', creatorId, 'Requester:', userId);
      return res.status(403).json({ message: 'You are not the organizer of this event.' });
    }

    // Check if token_id is a database Registration ID (24 char hex)
    if (mongoose.Types.ObjectId.isValid(token_id)) {
      console.log('Verifying DB Registration ID:', token_id);
      const reg = await Registration.findById(token_id).populate('user', 'name');
      
      if (!reg) {
        console.warn('Registration not found in DB');
        return res.status(404).json({ message: 'Ticket registration not found.' });
      }

      if (reg.event.toString() !== event._id.toString()) {
        console.warn('Registration event mismatch');
        return res.status(400).json({ message: 'This ticket is for a different event.' });
      }

      if (reg.checkInTime) {
        console.log('Ticket already used');
        return res.json({ 
          status: 'INVALID', 
          reason: 'already_used', 
          message: `Ticket already checked in at ${reg.checkInTime.toLocaleString()}` 
        });
      }

      // Mark as used
      reg.checkInTime = new Date();
      reg.checkedInBy = req.user.id;
      await reg.save();

      console.log('Check-in successful for', reg.user.name);
      return res.json({ 
        status: 'VALID', 
        token_id, 
        owner: reg.user.name,
        message: 'Successfully verified! Guest checked in.'
      });
    }

    // Otherwise, try on-chain token ID
    console.log('Verifying On-Chain Token ID:', token_id);
    const c = getContract();
    if (!c) {
      return res.status(500).json({ message: 'Blockchain contract not configured.' });
    }

    try {
      const owner = await c.ownerOf(token_id);
      console.log('NFT Owner:', owner);
      
      try {
        const isUsed = await c.tokenUsed(token_id);
        if (isUsed) {
          return res.json({ status: 'INVALID', reason: 'already_used', message: 'Blockchain ticket has already been used.' });
        }
      } catch (err) {
        // Contract might not support tokenUsed check, proceed to valid
      }

      return res.json({ 
        status: 'VALID', 
        token_id, 
        owner, 
        message: 'Blockchain NFT ticket verified.' 
      });
    } catch (e) {
      console.warn('Blockchain token not found:', e.message);
      return res.status(400).json({ status: 'INVALID', reason: 'not_found', message: 'Ticket not found on blockchain.' });
    }
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ message: 'Internal verification server error.' });
  }
});

module.exports = router;
