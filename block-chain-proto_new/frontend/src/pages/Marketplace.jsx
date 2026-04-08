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
      try { await updateWallet(addr); } catch (e) { }
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
      showToast('Success!', "Ticket purchased! View in 'My Tickets'.");
      loadMarketplace();
      setTimeout(() => {
        setEmailModal({ open: true, eventId });
        setEmailInput('');
      }, 500);
    } catch (err) {
      showToast('Failed', err.reason || err.message, true);
    }
  };

  const sendReceipt = async () => {
    if (!emailInput.trim()) { alert('Enter an email'); return; }
    setEmailSending(true);
    try {
      await api.post(`/email/events/${emailModal.eventId}/send-receipt`, { email: emailInput.trim(), walletAddress: walletAddr });
      showToast('Sent!', 'QR ticket sent to your email.');
      setEmailModal({ open: false, eventId: '' });
    } catch (err) {
      showToast('Error', 'Email failed, but you own the ticket.', true);
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Browse and purchase NFT tickets on-chain</p>
        </div>
        <div className="flex gap-2">
          {!walletAddr && (
            <button onClick={handleConnect} className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer border-0">
              Connect Wallet
            </button>
          )}
          <Link to="/my-tickets" className="px-4 py-2 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] no-underline transition-colors">
            My Tickets
          </Link>
        </div>
      </div>

      {/* Event Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="luma-card p-5 animate-pulse">
              <div className="h-3 w-16 bg-[var(--color-bg-secondary)] rounded mb-3" />
              <div className="h-5 w-36 bg-[var(--color-bg-secondary)] rounded mb-2" />
              <div className="h-3 w-28 bg-[var(--color-bg-secondary)] rounded mb-4" />
              <div className="h-9 w-full bg-[var(--color-bg-secondary)] rounded" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[var(--color-border)] rounded-2xl">
          <p className="text-4xl mb-3">🎪</p>
          <h3 className="text-lg font-semibold text-[var(--color-text-secondary)] mb-1">No events on-chain</h3>
          <p className="text-sm text-[var(--color-text-tertiary)]">Organizers must create and register events first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((ev, idx) => {
            const isSoldOut = ev.available <= 0;
            return (
              <div
                key={ev.id}
                className="luma-card p-5 flex flex-col gap-3 animate-fade-in"
                style={{ animationDelay: `${idx * 60}ms`, opacity: 0 }}
              >
                <span className="text-[10px] font-bold text-[var(--color-luma-purple)] uppercase tracking-wider">{ev.id}</span>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)] leading-tight">{ev.name}</h3>
                <p className="text-xs text-[var(--color-text-tertiary)]">📍 {ev.venue || 'Virtual'}</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">📅 {ev.date || new Date(ev.startTime).toLocaleDateString()}</p>

                <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--color-border)]">
                  <span className="text-sm font-bold text-[var(--color-text-primary)]">{ev.price_eth} ETH</span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">{ev.available}/{ev.total} left</span>
                </div>

                <button
                  onClick={() => buyTicket(ev.id, ev.price_eth)}
                  disabled={isSoldOut}
                  className="w-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium py-2.5 rounded-lg text-sm hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer border-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSoldOut ? 'Sold Out' : 'Buy Ticket'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Email Modal */}
      {emailModal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEmailModal({ open: false, eventId: '' })}>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-sm shadow-lg animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Purchase Complete! 🎉</h3>
            <p className="text-xs text-[var(--color-text-tertiary)] mb-4">Enter your email to receive your QR entry ticket.</p>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm outline-none mb-3 focus:border-[var(--color-border-focus)]"
            />
            <button onClick={sendReceipt} disabled={emailSending} className="w-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium py-2.5 rounded-lg text-sm cursor-pointer border-0 hover:bg-[var(--color-accent-hover)] disabled:opacity-50">
              {emailSending ? 'Sending...' : 'Send Ticket'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
