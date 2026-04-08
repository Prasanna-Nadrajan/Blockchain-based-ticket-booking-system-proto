import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { connectWallet, checkConnection, loadDeployment } from '../utils/web3';
import api from '../utils/api';

export default function Dashboard() {
  const { user, updateWallet } = useAuth();
  const [walletAddr, setWalletAddr] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => {
    loadDeployment();
    checkConnection().then((addr) => {
      if (addr) setWalletAddr(addr);
    });
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const { data } = await api.get('/events/marketplace');
      setEvents(data);
    } catch (e) {
      console.error('Failed to load events:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) {
      setWalletAddr(addr);
      if (!user.walletAddress) {
        try { await updateWallet(addr); } catch (e) { }
      }
    }
  };

  const now = new Date();
  const upcomingEvents = events.filter((e) => new Date(e.startTime || e.date) >= now);
  const pastEvents = events.filter((e) => new Date(e.startTime || e.date) < now);
  const displayEvents = tab === 'upcoming' ? upcomingEvents : pastEvents;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-[var(--color-text-secondary)] text-base">
          Discover and manage your events
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          to="/create"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-medium rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors no-underline"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          Create Event
        </Link>
        <Link
          to="/discover"
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text-secondary)] rounded-lg hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)] transition-colors no-underline"
        >
          Explore Events
        </Link>
        {!walletAddr && (
          <button
            onClick={handleConnect}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text-secondary)] rounded-lg hover:border-[var(--color-border-hover)] transition-colors cursor-pointer"
          >
            🦊 Connect Wallet
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Upcoming', value: upcomingEvents.length, icon: '📅' },
          { label: 'Past Events', value: pastEvents.length, icon: '✅' },
          { label: 'Total', value: events.length, icon: '🎪' },
          { label: 'Wallet', value: walletAddr ? '🟢 Connected' : '⚪ Not Connected', icon: '💳' },
        ].map((stat) => (
          <div key={stat.label} className="luma-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{stat.icon}</span>
              <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-[var(--color-border)]">
        {['upcoming', 'past'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer bg-transparent ${
              tab === t
                ? 'border-[var(--color-accent)] text-[var(--color-text-primary)]'
                : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {t === 'upcoming' ? 'Upcoming' : 'Past'} Events
          </button>
        ))}
      </div>

      {/* Event List */}
      {loading ? (
        <div className="text-center py-16 text-[var(--color-text-tertiary)] text-sm">Loading events...</div>
      ) : displayEvents.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--color-border)] rounded-2xl">
          <p className="text-[var(--color-text-tertiary)] text-sm mb-4">
            {tab === 'upcoming' ? 'No upcoming events' : 'No past events'}
          </p>
          <Link
            to="/discover"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] no-underline transition-colors"
          >
            Browse events →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {displayEvents.map((ev) => (
            <Link
              key={ev.id}
              to={`/events/${ev.id}`}
              className="flex items-center gap-4 p-4 luma-card luma-card-hover no-underline group"
            >
              {/* Cover thumbnail */}
              <div className="w-14 h-14 rounded-xl bg-[var(--color-bg-secondary)] flex-shrink-0 overflow-hidden flex items-center justify-center">
                {ev.coverImageUrl ? (
                  <img src={ev.coverImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🎪</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    {formatDate(ev.startTime || ev.date)}
                  </span>
                  {ev.startTime && (
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      • {formatTime(ev.startTime)}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-tight">{ev.name}</h3>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 truncate">{ev.venue || ev.location?.address || 'Virtual'}</p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                {ev.isFree || ev.price_eth === 0 ? (
                  <span className="text-xs font-semibold text-[var(--color-success)]">Free</span>
                ) : (
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{ev.price_eth} ETH</span>
                )}
                <svg width="16" height="16" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" viewBox="0 0 24 24" className="opacity-0 group-hover:opacity-100 transition-opacity"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
