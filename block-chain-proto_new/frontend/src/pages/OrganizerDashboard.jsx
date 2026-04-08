import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { connectWallet, checkConnection, getContract, loadDeployment } from '../utils/web3';
import { ethers } from 'ethers';
import api from '../utils/api';

export default function OrganizerDashboard() {
  const { user, updateWallet } = useAuth();
  const { showToast } = useToast();
  const [walletAddr, setWalletAddr] = useState(null);
  const [activeTab, setActiveTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [mintEventId, setMintEventId] = useState('');
  const [mintCount, setMintCount] = useState(10);
  const [mintLoading, setMintLoading] = useState(false);
  const [verifierAddr, setVerifierAddr] = useState('');
  const [verifierLoading, setVerifierLoading] = useState(false);

  const [blastEventId, setBlastEventId] = useState('');
  const [blastTitle, setBlastTitle] = useState('');
  const [blastMessage, setBlastMessage] = useState('');
  const [blastLoading, setBlastLoading] = useState(false);

  // Scanner State
  const [mode, setMode] = useState('manual'); // 'manual' | 'scan'
  const [manualInput, setManualInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef(null);

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
        try { await updateWallet(addr); } catch (e) { }
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

  const loadRegistrations = async (eventId) => {
    if (!eventId) return;
    setSelectedEvent(eventId);
    try {
      const { data } = await api.get(`/registrations/event/${eventId}`);
      setRegistrations(data);
    } catch (e) {
      showToast('Error', 'Failed to load registrations', true);
    }
  };

  const handleApprove = async (regId) => {
    try {
      await api.put(`/registrations/${regId}/approve`);
      showToast('Success', 'Registration approved');
      loadRegistrations(selectedEvent);
    } catch (e) {
      showToast('Error', 'Failed to approve', true);
    }
  };

  const handleDecline = async (regId) => {
    try {
      await api.put(`/registrations/${regId}/decline`);
      showToast('Success', 'Registration declined');
      loadRegistrations(selectedEvent);
    } catch (e) {
      showToast('Error', 'Failed to decline', true);
    }
  };

  const handleMint = async (e) => {
    e.preventDefault();
    if (!mintEventId) { showToast('Error', 'Select an event', true); return; }
    if (!walletAddr) { showToast('Error', 'Connect wallet first', true); return; }
    setMintLoading(true);
    try {
      const contract = getContract();
      if (!contract) throw new Error('Contract not loaded');
      const tx = await contract.mintBatch(mintEventId, mintCount, walletAddr);
      await tx.wait();
      showToast('Success', `${mintCount} tickets minted!`);
    } catch (err) {
      showToast('Error', err.message || 'Minting failed', true);
    } finally {
      setMintLoading(false);
    }
  };

  const verifyTicket = async (payload) => {
    setVerifying(true);
    setResult(null);
    try {
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        throw new Error('Invalid QR payload format');
      }

      const { token_id, event_id } = parsed;
      if (token_id === undefined || !event_id) {
        throw new Error('Missing token_id or event_id');
      }

      const { data } = await api.post('/verify', { token_id, event_id });

      if (data.status === 'INVALID') {
        throw new Error(data.message || 'Ticket is invalid or already used');
      }

      setResult({
        success: true,
        tokenId: token_id,
        eventId: event_id,
        message: data.message || 'Ticket verified successfully!',
      });
      showToast('Verified ✅', 'Ticket is valid and has been marked as used');
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.message || err.message || 'Verification failed',
      });
      showToast('Failed ❌', err.response?.data?.message || err.message, true);
    } finally {
      setVerifying(false);
    }
  };

  const handleManualVerify = () => {
    if (!manualInput.trim()) return;
    verifyTicket(manualInput.trim());
  };

  const startScanner = async () => {
    setScannerActive(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
          scanner.stop().catch(() => {});
          setScannerActive(false);
          verifyTicket(text);
        },
        () => {}
      );
    } catch (err) {
      setScannerActive(false);
      showToast('Error', 'Camera access denied or not available', true);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  const handleSendBlast = async (e) => {
    e.preventDefault();
    if (!blastEventId) { showToast('Error', 'Select an event', true); return; }
    setBlastLoading(true);
    try {
      const { data } = await api.post('/notifications/blast', {
        eventId: blastEventId,
        title: blastTitle,
        message: blastMessage,
      });
      showToast('Blast Sent', data.message);
      setBlastTitle('');
      setBlastMessage('');
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to send blast', true);
    } finally {
      setBlastLoading(false);
    }
  };

  if (!walletAddr) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="luma-card p-8">
          <p className="text-4xl mb-4">🦊</p>
          <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-6">
            Your MetaMask wallet is required to manage events on-chain.
          </p>
          <button onClick={handleConnect} className="px-6 py-2.5 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer border-0">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'events', label: 'My Events' },
    { id: 'registrations', label: 'Registrations' },
    { id: 'blasts', label: 'Notifications' },
    { id: 'mint', label: 'Mint Tickets' },
    { id: 'scanner', label: 'Scan Tickets' },
  ];

  const inputClass = "w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-border-focus)] placeholder:text-[var(--color-text-tertiary)]";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Host Dashboard</h1>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
          Manage your events, registrations, and on-chain operations
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer bg-transparent ${
              activeTab === t.id
                ? 'border-[var(--color-accent)] text-[var(--color-text-primary)]'
                : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-[var(--color-border)] rounded-2xl">
              <p className="text-sm text-[var(--color-text-tertiary)]">No events created yet</p>
            </div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="luma-card p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">{ev.id}</span>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{ev.name}</h3>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{ev.date || new Date(ev.startTime).toLocaleDateString()} · {ev.venue || 'Virtual'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    ev.status === 'published' ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                    : ev.status === 'draft' ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
                    : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                  }`}>
                    {ev.status || 'published'}
                  </span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">{ev.registrationCount || 0} guests</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Registrations Tab */}
      {activeTab === 'registrations' && (
        <div>
          <select value={selectedEvent} onChange={(e) => loadRegistrations(e.target.value)} className={`${inputClass} mb-4`}>
            <option value="">Select an event</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>

          {registrations.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--color-text-tertiary)]">
              {selectedEvent ? 'No registrations yet' : 'Select an event to view registrations'}
            </div>
          ) : (
            <div className="space-y-2">
              {registrations.map((reg) => (
                <div key={reg._id} className="luma-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center text-xs font-bold">
                      {reg.user?.name?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{reg.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">{reg.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      reg.status === 'approved' ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                      : reg.status === 'pending' ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
                      : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                    }`}>
                      {reg.status}
                    </span>
                    {reg.status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(reg._id)} className="px-2.5 py-1 text-[10px] font-semibold bg-[var(--color-success)] text-white rounded-md cursor-pointer border-0 hover:opacity-90">
                          Approve
                        </button>
                        <button onClick={() => handleDecline(reg._id)} className="px-2.5 py-1 text-[10px] font-semibold bg-[var(--color-danger)] text-white rounded-md cursor-pointer border-0 hover:opacity-90">
                          Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Blast Notifications Tab */}
      {activeTab === 'blasts' && (
        <div className="max-w-xl">
          <div className="luma-card p-6">
            <h2 className="text-lg font-semibold mb-1">Send Notification Blast</h2>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
              Send an update to everyone registered for your event.
            </p>
            <form onSubmit={handleSendBlast} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Select Event</label>
                <select value={blastEventId} onChange={(e) => setBlastEventId(e.target.value)} required className={inputClass}>
                  <option value="">Select event</option>
                  {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Notification Title</label>
                <input type="text" value={blastTitle} onChange={(e) => setBlastTitle(e.target.value)} required placeholder="e.g. Venue Change" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Message</label>
                <textarea 
                  value={blastMessage} 
                  onChange={(e) => setBlastMessage(e.target.value)} 
                  required 
                  placeholder="Enter your message here..." 
                  className={inputClass} 
                  rows={4}
                />
              </div>
              <button type="submit" disabled={blastLoading} className="w-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium py-2.5 rounded-lg text-sm hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer border-0 disabled:opacity-50">
                {blastLoading ? 'Sending...' : 'Send Blast'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mint Tab */}
      {activeTab === 'mint' && (
        <div className="max-w-lg">
          <div className="luma-card p-6">
            <h2 className="text-lg font-semibold mb-1">Mint Ticket NFTs</h2>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-4">Mint ERC-721 tokens on the blockchain</p>
            <form onSubmit={handleMint} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Event</label>
                <select value={mintEventId} onChange={(e) => setMintEventId(e.target.value)} required className={inputClass}>
                  <option value="">Select event</option>
                  {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Quantity</label>
                <input type="number" value={mintCount} onChange={(e) => setMintCount(parseInt(e.target.value))} min="1" max="100" className={inputClass} />
              </div>
              <button type="submit" disabled={mintLoading} className="w-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium py-2.5 rounded-lg text-sm hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer border-0 disabled:opacity-50">
                {mintLoading ? 'Minting...' : 'Mint Tickets'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Scanner Tab */}
      {activeTab === 'scanner' && (
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold mb-1">Gate Scanner</h2>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Scan or paste QR codes to verify tickets on-chain</p>
          </div>

          <div className="flex gap-1 bg-[var(--color-bg-secondary)] rounded-lg p-1 mb-6">
            <button
              onClick={() => { setMode('scan'); if (!scannerActive) startScanner(); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium text-center transition-colors cursor-pointer border-0 ${
                mode === 'scan' ? 'bg-[var(--color-surface)] shadow-xs text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)]'
              }`}
            >
              📷 Scan QR
            </button>
            <button
              onClick={() => { setMode('manual'); stopScanner(); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium text-center transition-colors cursor-pointer border-0 ${
                mode === 'manual' ? 'bg-[var(--color-surface)] shadow-xs text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)]'
              }`}
            >
              ⌨️ Manual
            </button>
          </div>

          {mode === 'scan' && (
            <div className="luma-card p-4 mb-6">
              <div id="qr-reader" className="rounded-xl overflow-hidden bg-[var(--color-bg)]" style={{ minHeight: 300 }} />
              {scannerActive && (
                <button onClick={stopScanner} className="mt-3 w-full py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]">
                  Stop Scanner
                </button>
              )}
            </div>
          )}

          {mode === 'manual' && (
            <div className="luma-card p-5 mb-6">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">QR Payload</label>
              <textarea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder='{"token_id": "ticket_id_here", "event_id": "EVT-001"}'
                rows={3}
                className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)] resize-none placeholder:text-[var(--color-text-tertiary)]"
              />
              <button
                onClick={handleManualVerify}
                disabled={verifying || !manualInput.trim()}
                className="mt-3 w-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium py-2.5 rounded-lg text-sm cursor-pointer border-0 hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {verifying ? 'Verifying...' : 'Verify Ticket'}
              </button>
            </div>
          )}

          {result && (
            <div className={`luma-card p-5 animate-fade-in ${
              result.success ? 'border-[var(--color-success)]' : 'border-[var(--color-danger)]'
            }`}>
              <div className="text-center">
                <p className="text-4xl mb-3">{result.success ? '✅' : '❌'}</p>
                <h3 className={`text-lg font-semibold mb-1 ${result.success ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                  {result.success ? 'Ticket Verified' : 'Verification Failed'}
                </h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">{result.message}</p>
                {result.success && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-tertiary)]">Token #{result.tokenId} · {result.eventId}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
