import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { connectWallet, checkConnection, getContract, loadDeployment } from '../utils/web3';
import { ethers } from 'ethers';
import api from '../utils/api';

export default function OrganizerDashboard() {
  const { user, updateWallet } = useAuth();
  const { showToast } = useToast();
  const [walletAddr, setWalletAddr] = useState(null);
  const [activeTab, setActiveTab] = useState('createEvent');
  const [events, setEvents] = useState([]);

  // Create Event form
  const [eventForm, setEventForm] = useState({ name: '', date: '', venue: '', capacity: 100, price_eth: 0.01 });
  const [createLoading, setCreateLoading] = useState(false);

  // Mint form
  const [mintEventId, setMintEventId] = useState('');
  const [mintCount, setMintCount] = useState(10);
  const [mintLoading, setMintLoading] = useState(false);

  // View tickets
  const [viewEventId, setViewEventId] = useState('');
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Verifier
  const [verifierAddr, setVerifierAddr] = useState('');
  const [verifierLoading, setVerifierLoading] = useState(false);

  useEffect(() => {
    loadDeployment();
    checkConnection().then((addr) => {
      if (addr) setWalletAddr(addr);
    });
    loadEvents();
  }, []);

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) {
      setWalletAddr(addr);
      if (!user.walletAddress) {
        try { await updateWallet(addr); } catch (e) { /* ignore */ }
      }
    }
  };

  const loadEvents = async () => {
    try {
      const { data } = await api.get('/events');
      setEvents(data);
    } catch (e) {
      console.error('Failed to load events:', e);
    }
  };

  // ── Create Event ──────────────────────────────────────────
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!walletAddr) { showToast('Error', 'Connect your wallet first', true); return; }
    setCreateLoading(true);
    try {
      // 1. Save to backend
      const { data: event } = await api.post('/events', eventForm);

      // 2. Register on blockchain
      const contract = getContract();
      if (!contract) throw new Error('Contract not loaded');
      const priceWei = ethers.parseEther(eventForm.price_eth.toString());
      const tx = await contract.setEventParams(event.id, priceWei, eventForm.capacity);
      await tx.wait();

      showToast('Success', 'Event created and registered on-chain!');
      setEventForm({ name: '', date: '', venue: '', capacity: 100, price_eth: 0.01 });
      loadEvents();
    } catch (err) {
      showToast('Error', err.message || 'Failed to create event', true);
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Mint Tickets ──────────────────────────────────────────
  const handleMint = async (e) => {
    e.preventDefault();
    if (!mintEventId) { showToast('Error', 'Select an event', true); return; }
    if (!walletAddr) { showToast('Error', 'Connect your wallet first', true); return; }
    setMintLoading(true);
    try {
      const contract = getContract();
      if (!contract) throw new Error('Contract not loaded');
      const tx = await contract.mintBatch(mintEventId, mintCount, walletAddr);
      await tx.wait();
      showToast('Success', `${mintCount} tickets minted!`);
    } catch (err) {
      showToast('Tx Failed', err.message || 'Minting failed', true);
    } finally {
      setMintLoading(false);
    }
  };

  // ── View Tickets ──────────────────────────────────────────
  const handleViewTickets = async (eventId) => {
    if (!eventId) return;
    setViewEventId(eventId);
    setTicketsLoading(true);
    try {
      const { data } = await api.get(`/events/${eventId}/tickets`);
      setTickets(data);
    } catch (err) {
      showToast('Error', 'Failed to load tickets', true);
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  };

  // ── Add Verifier ──────────────────────────────────────────
  const handleAddVerifier = async (e) => {
    e.preventDefault();
    if (!walletAddr) { showToast('Error', 'Connect your wallet first', true); return; }
    setVerifierLoading(true);
    try {
      const contract = getContract();
      if (!contract) throw new Error('Contract not loaded');
      const tx = await contract.addVerifier(verifierAddr);
      await tx.wait();
      showToast('Success', `Verifier added: ${verifierAddr.substring(0, 8)}...`);
      setVerifierAddr('');
    } catch (err) {
      showToast('Tx Failed', err.message || 'Failed to add verifier', true);
    } finally {
      setVerifierLoading(false);
    }
  };

  // ── Guard ─────────────────────────────────────────────────
  if (!walletAddr) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>
        <div className="card" style={{ maxWidth: 500, margin: '0 auto', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🦊</div>
          <h2>MetaMask Required</h2>
          <p style={{ color: 'var(--text-muted)', margin: '1rem 0 2rem' }}>
            Please connect your organizer wallet to access this dashboard.
          </p>
          <button className="btn btn-primary" onClick={handleConnect}>Connect Wallet</button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'createEvent', label: 'Create Event' },
    { id: 'mintTickets', label: 'Mint Tickets' },
    { id: 'viewTickets', label: 'View Tickets' },
    { id: 'verifiers', label: 'Gate Verifiers' },
  ];

  return (
    <div className="container animate">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: 'none', border: 'none', color: activeTab === t.id ? 'var(--primary-accent)' : 'var(--text-muted)',
              padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 600,
              borderBottom: activeTab === t.id ? '2px solid var(--primary-accent)' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CREATE EVENT */}
      {activeTab === 'createEvent' && (
        <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2>Create New Event</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Event metadata stored in MongoDB, params registered on-chain.</p>
          <form onSubmit={handleCreateEvent}>
            <div className="form-group">
              <label>Event Name</label>
              <input type="text" value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} required placeholder="e.g. Neon Festival 2026" />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Venue</label>
              <input type="text" value={eventForm.venue} onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })} required placeholder="Virtual Arena" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Total Capacity</label>
                <input type="number" value={eventForm.capacity} onChange={(e) => setEventForm({ ...eventForm, capacity: parseInt(e.target.value) })} required min="1" />
              </div>
              <div className="form-group">
                <label>Ticket Price (ETH)</label>
                <input type="number" value={eventForm.price_eth} onChange={(e) => setEventForm({ ...eventForm, price_eth: parseFloat(e.target.value) })} required min="0" step="0.001" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={createLoading}>
              {createLoading ? 'Processing...' : 'Create & Register Event (Requires Tx)'}
            </button>
          </form>
        </div>
      )}

      {/* MINT TICKETS */}
      {activeTab === 'mintTickets' && (
        <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2>Mint Ticket NFTs</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Mints ERC-721 tokens on the Hardhat blockchain.</p>
          <form onSubmit={handleMint}>
            <div className="form-group">
              <label>Select Event</label>
              <select value={mintEventId} onChange={(e) => setMintEventId(e.target.value)} required>
                <option value="">-- Select Event --</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name} ({ev.date})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Number of Tickets to Mint</label>
              <input type="number" value={mintCount} onChange={(e) => setMintCount(parseInt(e.target.value))} required min="1" max="100" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={mintLoading}>
              {mintLoading ? 'Minting...' : 'Mint Tickets (Requires Tx)'}
            </button>
          </form>
        </div>
      )}

      {/* VIEW TICKETS */}
      {activeTab === 'viewTickets' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Event Tickets Ledger</h2>
            <select style={{ width: 250 }} value={viewEventId} onChange={(e) => handleViewTickets(e.target.value)}>
              <option value="">-- Select Event --</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name} ({ev.date})</option>
              ))}
            </select>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Token ID</th><th>Owner Address</th><th>Status</th></tr>
              </thead>
              <tbody>
                {ticketsLoading ? (
                  <tr><td colSpan="3" style={{ textAlign: 'center' }}>Loading from blockchain...</td></tr>
                ) : tickets.length === 0 ? (
                  <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {viewEventId ? 'No tickets minted yet' : 'Select an event to view tickets'}
                  </td></tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.token_id}>
                      <td>#{t.token_id}</td>
                      <td><span style={{ fontFamily: 'monospace' }}>{t.owner}</span></td>
                      <td>
                        {t.is_used
                          ? <span className="badge badge-used">USED</span>
                          : <span className="badge badge-available">AVAILABLE</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GATE VERIFIERS */}
      {activeTab === 'verifiers' && (
        <div className="card" style={{ maxWidth: 650, margin: '0 auto' }}>
          <h2>Register Gate Verifier</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Grant a wallet address permission to verify tickets and mark them as used on-chain.</p>
          
          {/* Instructions */}
          <div style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.3)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
            <h4 style={{ color: 'var(--primary-accent)', marginBottom: '0.75rem' }}>📋 How to Get a Verifier Wallet Address</h4>
            <ol style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '2', paddingLeft: '1.25rem' }}>
              <li>The <strong style={{ color: '#fff' }}>gate verifier</strong> person must have <strong style={{ color: '#fff' }}>MetaMask</strong> installed in their browser.</li>
              <li>They open MetaMask → click on the <strong style={{ color: '#fff' }}>account name</strong> at the top → it copies their wallet address (starts with <code style={{ color: 'var(--secondary-accent)' }}>0x...</code>).</li>
              <li>They send you that address (e.g. via WhatsApp/email).</li>
              <li>Paste it below and click <strong style={{ color: '#fff' }}>"Add Verifier"</strong> — this registers them <strong style={{ color: '#fff' }}>on the smart contract</strong>.</li>
              <li>Now they can log in to NFTTix with the <strong style={{ color: '#fff' }}>Verifier</strong> role, connect their MetaMask, and use the <strong style={{ color: '#fff' }}>Gate Verifier Terminal</strong> to scan QR codes.</li>
            </ol>
            <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
              <strong>⚠️ Important:</strong> The verifier must use the <em>same wallet address</em> in MetaMask that you register here. Otherwise, on-chain verification will fail.
            </p>
          </div>

          <form onSubmit={handleAddVerifier}>
            <div className="form-group">
              <label>Verifier Wallet Address</label>
              <input type="text" value={verifierAddr} onChange={(e) => setVerifierAddr(e.target.value)} required placeholder="0x... (paste the verifier's MetaMask address)" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={verifierLoading}>
              {verifierLoading ? 'Adding...' : 'Add Verifier (Requires Tx)'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
