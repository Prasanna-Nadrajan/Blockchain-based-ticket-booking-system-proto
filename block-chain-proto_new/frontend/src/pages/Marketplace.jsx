import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { connectWallet, checkConnection, getContract, loadDeployment } from '../utils/web3';
import { ethers } from 'ethers';
import api from '../utils/api';

export default function Marketplace() {
  const { user, updateWallet } = useAuth();
  const { showToast } = useToast();
  const [walletAddr, setWalletAddr] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Email modal state
  const [emailModal, setEmailModal] = useState({ open: false, eventId: '' });
  const [emailInput, setEmailInput] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    loadDeployment();
    checkConnection().then((addr) => {
      if (addr) setWalletAddr(addr);
    });
    loadMarketplace();
  }, []);

  const loadMarketplace = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/events/marketplace');
      setEvents(data);
    } catch (err) {
      showToast('Error', 'Failed to load marketplace', true);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) {
      setWalletAddr(addr);
      try { await updateWallet(addr); } catch (e) { /* ignore */ }
    }
  };

  const buyTicket = async (eventId, priceEth) => {
    if (!walletAddr) {
      await handleConnect();
      return;
    }

    try {
      const contract = getContract();
      if (!contract) throw new Error('Contract not loaded');

      const priceWei = ethers.parseEther(priceEth.toString());
      const tx = await contract.buyTicket(eventId, { value: priceWei });
      await tx.wait();

      showToast('Success!', "You purchased a ticket! Visit 'My Tickets' to see it.");
      loadMarketplace();

      // Show email modal
      setTimeout(() => {
        setEmailModal({ open: true, eventId });
        setEmailInput('');
      }, 500);
    } catch (err) {
      showToast('Registration Failed', err.reason || err.message, true);
    }
  };

  const sendReceipt = async () => {
    if (!emailInput.trim()) { alert('Please enter an email'); return; }
    setEmailSending(true);
    try {
      await api.post(`/email/events/${emailModal.eventId}/send-receipt`, { email: emailInput.trim(), walletAddress: walletAddr });
      showToast('Email Sent!', 'Your ticket QR has been sent to your email.');
      setEmailModal({ open: false, eventId: '' });
    } catch (err) {
      showToast('Email Error', 'Failed to send email receipt, but you still own the ticket.', true);
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Explore Events</h1>
          <p style={{ color: 'var(--text-muted)' }}>Real-time ticket availability synced with the blockchain.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {!walletAddr && (
            <button className="btn btn-primary" onClick={handleConnect}>Connect Wallet</button>
          )}
          <Link to="/my-tickets" className="btn">View My Tickets</Link>
        </div>
      </div>

      {/* Event Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
        {loading ? (
          <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: '5rem' }}>Loading events from blockchain...</p>
        ) : events.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
            <h3 style={{ color: 'var(--text-muted)' }}>No events active on-chain</h3>
            <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>Organizers must create and register events before they appear here.</p>
          </div>
        ) : (
          events.map((ev) => {
            const isSoldOut = ev.available <= 0;
            return (
              <div key={ev.id} className="card animate" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary-accent)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{ev.id}</div>
                <h2 style={{ fontSize: '1.5rem' }}>{ev.name}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>📍 {ev.venue}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>📅 {ev.date}</p>
                <div style={{ background: 'var(--surface-color)', color: 'var(--primary-accent)', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 700, display: 'inline-block', marginTop: '0.5rem' }}>
                  {ev.price_eth} ETH
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{ev.available} / {ev.total} Tickets Left</div>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 'auto', width: '100%' }}
                  onClick={() => buyTicket(ev.id, ev.price_eth)}
                  disabled={isSoldOut}
                >
                  {isSoldOut ? 'SOLD OUT' : 'Register'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Email Modal */}
      {emailModal.open && (
        <div className="modal-overlay active" onClick={() => setEmailModal({ open: false, eventId: '' })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setEmailModal({ open: false, eventId: '' })}>&times;</button>
            <h3 style={{ marginBottom: '1rem' }}>Registration Successful!</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Enter your email address to receive your QR code entry ticket.
            </p>
            <div className="form-group">
              <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="you@example.com" />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={sendReceipt} disabled={emailSending}>
              {emailSending ? 'Sending...' : 'Send Ticket'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
