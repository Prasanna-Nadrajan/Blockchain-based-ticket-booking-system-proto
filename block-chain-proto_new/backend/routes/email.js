const express = require('express');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const Event = require('../models/Event');
const auth = require('../middleware/auth');
const { getContract } = require('../utils/blockchain');

const router = express.Router();

/**
 * Create reusable SMTP transporter.
 */
function getTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpServer = process.env.SMTP_SERVER || 'localhost';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);

  if (smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpServer,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
  }

  // Fallback: local test SMTP (e.g. MailHog)
  return nodemailer.createTransport({
    host: 'localhost',
    port: 1025,
    ignoreTLS: true,
  });
}

/**
 * POST /api/email/events/:eventId/send-receipt
 * Send an email receipt with QR code after ticket purchase.
 * Body: { email: string, walletAddress?: string }
 */
router.post('/events/:eventId/send-receipt', auth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { email, walletAddress } = req.body;

    // Use walletAddress from body (sent by frontend) OR fall back to user profile
    const wallet = (walletAddress || req.user.walletAddress || '').toLowerCase();

    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    if (!wallet) {
      return res.status(400).json({ message: 'Wallet address is required. Please connect MetaMask first.' });
    }

    const c = getContract();
    if (!c) {
      return res.status(500).json({ message: 'Smart contract not configured. Please deploy the contract first.' });
    }

    // Find user's most recent ticket for this event
    const totalMinted = Number(await c.totalMinted());
    let myTokenId = null;

    for (let i = totalMinted - 1; i >= 0; i--) {
      try {
        const owner = (await c.ownerOf(i)).toLowerCase();
        const tokenEvent = await c.tokenEvent(i);
        if (owner === wallet && tokenEvent === eventId) {
          myTokenId = i;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (myTokenId === null) {
      return res.status(404).json({ message: 'No ticket found for this wallet and event.' });
    }

    // Get event details
    const ev = await Event.findOne({ eventId });
    const eventName = ev ? ev.name : 'Unknown Event';
    const eventDate = ev ? ev.date : 'N/A';
    const eventVenue = ev ? ev.venue : 'N/A';

    // Generate QR
    const payload = JSON.stringify({ token_id: myTokenId, event_id: eventId });
    const qrBuffer = await QRCode.toBuffer(payload, { width: 400, margin: 3 });

    // Build a nice HTML email with event details
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #ffffff; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c3aed, #06b6d4); padding: 2rem; text-align: center;">
          <h1 style="margin: 0; font-size: 2rem; color: #fff;">🎫 NFTTix</h1>
          <p style="margin: 0.5rem 0 0; color: rgba(255,255,255,0.85); font-size: 1rem;">Your Ticket Confirmation</p>
        </div>
        <div style="padding: 2rem;">
          <h2 style="color: #10b981; margin-bottom: 1rem;">Registration Successful!</h2>
          <p style="color: #9ca3af; line-height: 1.6;">Thank you for registering. Please find your entry QR code below. Show this at the gate for entry.</p>
          
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <h3 style="color: #7c3aed; margin: 0 0 1rem; font-size: 1.1rem;">Event Details</h3>
            <table style="width: 100%; color: #fff; font-size: 0.95rem;">
              <tr><td style="color: #9ca3af; padding: 4px 0;">Event</td><td style="padding: 4px 0; font-weight: 600;">${eventName}</td></tr>
              <tr><td style="color: #9ca3af; padding: 4px 0;">Date</td><td style="padding: 4px 0;">${eventDate}</td></tr>
              <tr><td style="color: #9ca3af; padding: 4px 0;">Venue</td><td style="padding: 4px 0;">${eventVenue}</td></tr>
              <tr><td style="color: #9ca3af; padding: 4px 0;">Ticket ID</td><td style="padding: 4px 0; font-family: monospace; color: #06b6d4;">#${myTokenId}</td></tr>
            </table>
          </div>

          <div style="text-align: center; margin: 1.5rem 0;">
            <p style="color: #9ca3af; margin-bottom: 0.75rem; font-size: 0.875rem;">Your Entry QR Code:</p>
            <img src="cid:ticket_qr" alt="Entry QR Code" style="width: 250px; border-radius: 8px; border: 8px solid #fff;" />
          </div>

          <p style="color: #9ca3af; font-size: 0.875rem; text-align: center; margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem;">
            This ticket is secured on the blockchain as an NFT.<br/>
            Do not share this QR code with anyone else.<br/><br/>
            Enjoy the event! 🎉<br/>
            <strong style="color: #7c3aed;">The NFTTix Team</strong>
          </p>
        </div>
      </div>
    `;

    // Send email
    const transporter = getTransporter();
    const senderEmail = process.env.SMTP_USER || 'tickets@nfttix.local';

    await transporter.sendMail({
      from: `"NFTTix" <${senderEmail}>`,
      to: email,
      subject: `🎫 Your Ticket for ${eventName} — NFTTix`,
      html: htmlBody,
      text: `Hello!\n\nThank you for registering for ${eventName}.\n\nEvent Details:\nName: ${eventName}\nDate: ${eventDate}\nVenue: ${eventVenue}\nTicket ID: #${myTokenId}\n\nPlease find your entry QR code attached to this email. Show this at the gate.\n\nEnjoy the event!\nThe NFTTix Team`,
      attachments: [
        {
          filename: `ticket_${myTokenId}.png`,
          content: qrBuffer,
          contentType: 'image/png',
          cid: 'ticket_qr',
        },
      ],
    });

    console.log(`✅ Email receipt sent to ${email} for event ${eventName} (token #${myTokenId})`);
    res.json({ message: 'Receipt processed successfully', token_id: myTokenId });
  } catch (err) {
    console.error('Email receipt error:', err);
    res.status(500).json({ message: `Email send failed: ${err.message}` });
  }
});

/**
 * POST /api/email/tickets/:ticketId/transfer-email
 * Send a ticket QR code to a friend via email.
 * Body: { email: string, walletAddress?: string }
 */
router.post('/tickets/:ticketId/transfer-email', auth, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const { email, walletAddress } = req.body;
    const wallet = (walletAddress || req.user.walletAddress || '').toLowerCase();

    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const c = getContract();
    if (!c) {
      return res.status(500).json({ message: 'Contract not configured.' });
    }

    // Verify ownership
    const owner = (await c.ownerOf(ticketId)).toLowerCase();
    if (owner !== wallet) {
      return res.status(403).json({ message: 'You do not own this ticket.' });
    }

    const eventId = await c.tokenEvent(ticketId);
    const ev = await Event.findOne({ eventId });
    const eventName = ev ? ev.name : 'Unknown Event';
    const eventDate = ev ? ev.date : 'N/A';
    const eventVenue = ev ? ev.venue : 'N/A';

    // Generate QR
    const payload = JSON.stringify({ token_id: ticketId, event_id: eventId });
    const qrBuffer = await QRCode.toBuffer(payload, { width: 400, margin: 3 });

    // Send email
    const transporter = getTransporter();
    const senderEmail = process.env.SMTP_USER || 'tickets@nfttix.local';

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #ffffff; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c3aed, #06b6d4); padding: 2rem; text-align: center;">
          <h1 style="margin: 0; font-size: 2rem; color: #fff;">🎫 NFTTix</h1>
          <p style="margin: 0.5rem 0 0; color: rgba(255,255,255,0.85);">Ticket Transfer</p>
        </div>
        <div style="padding: 2rem;">
          <h2 style="color: #10b981;">You received a ticket!</h2>
          <p style="color: #9ca3af; line-height: 1.6;">A friend has transferred a ticket to you for <strong style="color:#fff;">${eventName}</strong>.</p>
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <table style="width: 100%; color: #fff; font-size: 0.95rem;">
              <tr><td style="color: #9ca3af; padding: 4px 0;">Event</td><td style="padding: 4px 0; font-weight: 600;">${eventName}</td></tr>
              <tr><td style="color: #9ca3af; padding: 4px 0;">Date</td><td style="padding: 4px 0;">${eventDate}</td></tr>
              <tr><td style="color: #9ca3af; padding: 4px 0;">Venue</td><td style="padding: 4px 0;">${eventVenue}</td></tr>
              <tr><td style="color: #9ca3af; padding: 4px 0;">Ticket ID</td><td style="padding: 4px 0; font-family: monospace; color: #06b6d4;">#${ticketId}</td></tr>
            </table>
          </div>
          <div style="text-align: center; margin: 1.5rem 0;">
            <img src="cid:ticket_qr" alt="Entry QR Code" style="width: 250px; border-radius: 8px; border: 8px solid #fff;" />
          </div>
          <p style="color: #9ca3af; font-size: 0.875rem; text-align: center;">
            Show this QR code at the gate for entry.<br/><br/>
            <strong style="color: #7c3aed;">The NFTTix Team</strong>
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"NFTTix" <${senderEmail}>`,
      to: email,
      subject: `🎫 Ticket Transfer: ${eventName} — NFTTix`,
      html: htmlBody,
      text: `Hello!\n\nA friend has transferred a ticket to you for ${eventName}!\n\nEvent: ${eventName}\nDate: ${eventDate}\nVenue: ${eventVenue}\nTicket ID: #${ticketId}\n\nPlease find your entry QR code attached. Show this at the gate.\n\nEnjoy the event!\nThe NFTTix Team`,
      attachments: [
        {
          filename: `transfer_ticket_${ticketId}.png`,
          content: qrBuffer,
          contentType: 'image/png',
          cid: 'ticket_qr',
        },
      ],
    });

    console.log(`✅ Transfer email sent to ${email}`);
    res.json({ message: 'Ticket successfully emailed', token_id: ticketId });
  } catch (err) {
    console.error('Transfer email error:', err);
    res.status(500).json({ message: `Email send failed: ${err.message}` });
  }
});

module.exports = router;
