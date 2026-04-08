import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { connectWallet, checkConnection, getContract, loadDeployment } from '../utils/web3';
import { ethers } from 'ethers';
import api from '../utils/api';

export default function EventDetail() {
  const { eventId } = useParams();
  const { user, updateWallet } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [walletAddr, setWalletAddr] = useState(null);
  const [registered, setRegistered] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState(user?.email || '');
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    loadDeployment();
    checkConnection().then((addr) => {
      if (addr) setWalletAddr(addr);
    });
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      const { data } = await api.get(`/events/${eventId}`);
      setEvent(data);
    } catch (err) {
      showToast('Error', 'Event not found', true);
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

  const handleRegister = async () => {
    if (!user) { navigate('/login'); return; }
    if (!walletAddr) { await handleConnect(); return; }

    setRegistering(true);
    try {
      // Register via API
      await api.post('/registrations', { eventId: event.id });

      // Try blockchain purchase if paid
      if (!event.isFree && event.price_eth > 0) {
        const contract = getContract();
        if (contract) {
          const priceWei = ethers.parseEther(event.price_eth.toString());
          const tx = await contract.buyTicket(event.id, { value: priceWei });
          await tx.wait();
        }
      }

      setRegistered(true);
      setShowEmailModal(true);
      loadEvent();
    } catch (err) {
      showToast('Error', err.response?.data?.message || err.message || 'Registration failed', true);
    } finally {
      setRegistering(false);
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!emailInput) return;
    setEmailSending(true);
    try {
      await api.post(`/email/events/${eventId}/send-receipt`, {
        email: emailInput,
        walletAddress: walletAddr
      });
      showToast('Success', 'Ticket QR sent to your email!');
      setShowEmailModal(false);
    } catch (err) {
      showToast('Error', err.response?.data?.message || err.message || 'Failed to send email', true);
    } finally {
      setEmailSending(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 animate-pulse">
        <div className="aspect-[21/9] rounded-2xl bg-[var(--color-bg-secondary)] mb-8" />
        <div className="h-8 w-64 bg-[var(--color-bg-secondary)] rounded mb-4" />
        <div className="h-4 w-48 bg-[var(--color-bg-secondary)] rounded" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
        <p className="text-4xl mb-4">😕</p>
        <h2 className="text-xl font-semibold mb-2">Event not found</h2>
        <Link to="/discover" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] no-underline">
          ← Back to Discover
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Cover Image */}
      <div className="aspect-[21/9] rounded-2xl overflow-hidden bg-[var(--color-bg-secondary)] mb-8">
        {event.coverImageUrl ? (
          <img src={event.coverImageUrl} alt={event.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-border)]">
            <span className="text-6xl opacity-30">🎪</span>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Date */}
          <div className="text-xs font-bold text-[var(--color-luma-purple)] uppercase tracking-wider mb-3">
            {formatDate(event.startTime || event.date)}
            {event.startTime && ` · ${formatTime(event.startTime)}`}
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4 leading-tight">
            {event.name}
          </h1>

          {/* Host */}
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[var(--color-border)]">
            <div className="w-10 h-10 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] flex items-center justify-center font-semibold text-sm">
              {typeof event.createdBy === 'object' ? event.createdBy.name?.[0] : '?'}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {typeof event.createdBy === 'object' ? event.createdBy.name : 'Event Organizer'}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)]">Host</p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-base mt-0.5">📍</span>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {event.locationType === 'virtual' ? 'Virtual Event' : event.venue || event.location?.address || 'Location TBA'}
                </p>
                {event.location?.city && (
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {event.location.city}{event.location.state ? `, ${event.location.state}` : ''}{event.location.country ? `, ${event.location.country}` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-base mt-0.5">🕐</span>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {formatDate(event.startTime || event.date)}
                </p>
                {event.startTime && (
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {formatTime(event.startTime)}
                    {event.endTime && ` — ${formatTime(event.endTime)}`}
                    {event.timezone && ` (${event.timezone})`}
                  </p>
                )}
              </div>
            </div>

            {event.tags && event.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {event.tags.map((tag) => (
                  <span key={tag} className="luma-pill text-xs">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3">About this event</h2>
              <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                {event.description}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Sidebar */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="lg:sticky lg:top-20">
            <div className="luma-card p-6">
              {/* Price */}
              <div className="text-center mb-4">
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {event.isFree || event.price_eth === 0 ? 'Free' : `${event.price_eth} ETH`}
                </p>
                {event.totalCapacity && (
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                    {event.available !== undefined ? `${event.available} / ${event.total} spots left` : `${event.totalCapacity} capacity`}
                  </p>
                )}
              </div>

              {/* Register Button */}
              {registered ? (
                <div className="text-center">
                  <div className="bg-[var(--color-success-soft)] text-[var(--color-success)] font-medium py-3 rounded-xl text-sm mb-2">
                    ✅ You're registered!
                  </div>
                  <Link to="/my-tickets" className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] no-underline">
                    View your tickets →
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleRegister}
                  disabled={registering || (event.available !== undefined && event.available <= 0)}
                  className="w-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold py-3 rounded-xl text-sm hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {registering
                    ? 'Processing...'
                    : event.available !== undefined && event.available <= 0
                      ? 'Sold Out'
                      : event.requireApproval
                        ? 'Request to Join'
                        : 'Register'}
                </button>
              )}

              {/* Meta */}
              <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
                {event.requireApproval && (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                    <span>🔒</span> Approval required
                  </div>
                )}
                {event.visibility === 'private' && (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                    <span>👁️</span> Private event
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <span>📋</span> {event.registrationCount || 0} registered
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold">Registration Successful! 🎉</h3>
              <button onClick={() => setShowEmailModal(false)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] bg-transparent border-0 text-xl cursor-pointer">×</button>
            </div>
            
            <p className="text-sm text-[var(--color-text-secondary)] mb-6 leading-relaxed">
              Where should we send your ticket? Enter your email below to receive your QR code for event entry.
            </p>
            
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-sm outline-none focus:border-[var(--color-border-focus)] transition-colors"
                  placeholder="hello@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={emailSending}
                className="w-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium py-3 rounded-xl text-sm hover:bg-[var(--color-accent-hover)] transition-colors border-0 cursor-pointer disabled:opacity-50"
              >
                {emailSending ? 'Sending...' : 'Send Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
