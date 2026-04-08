import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function Discover() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { label: 'All', value: null, emoji: '✨' },
    { label: 'Tech', value: 'tech', emoji: '💻' },
    { label: 'AI', value: 'ai', emoji: '🤖' },
    { label: 'Crypto', value: 'crypto', emoji: '₿' },
    { label: 'Design', value: 'design', emoji: '🎨' },
    { label: 'Art', value: 'art', emoji: '🖼️' },
    { label: 'Music', value: 'music', emoji: '🎵' },
    { label: 'Fitness', value: 'fitness', emoji: '💪' },
    { label: 'Business', value: 'business', emoji: '📊' },
    { label: 'Social', value: 'social', emoji: '🎉' },
  ];

  useEffect(() => {
    loadEvents();
  }, [activeCategory, searchQuery]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory) params.set('category', activeCategory);
      if (searchQuery) params.set('search', searchQuery);
      params.set('upcoming', 'true');

      const { data } = await api.get(`/events/discover?${params.toString()}`);
      setEvents(data);
    } catch (e) {
      // Fallback to marketplace
      try {
        const { data } = await api.get('/events/marketplace');
        setEvents(data);
      } catch {
        setEvents([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 animate-fade-in">
          Discover Events
        </h1>
        <p className="text-[var(--color-text-secondary)] text-base animate-fade-in animate-delay-100">
          Find amazing events happening around you
        </p>
      </div>

      {/* Search */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-6 animate-fade-in animate-delay-100">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)] transition-colors placeholder:text-[var(--color-text-tertiary)]"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-8 animate-fade-in animate-delay-200">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setActiveCategory(cat.value)}
              className={`luma-pill flex items-center gap-1.5 ${
                activeCategory === cat.value ? 'luma-pill-active' : ''
              }`}
            >
              <span className="text-sm">{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Local Events Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Near Chennai, IN
            </h2>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">
              {events.length} events found
            </p>
          </div>
          <button className="text-sm font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer bg-transparent border-0">
            Change location
          </button>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="luma-card overflow-hidden animate-pulse">
                <div className="aspect-[16/9] bg-[var(--color-bg-secondary)]" />
                <div className="p-4 space-y-2">
                  <div className="h-3 w-24 bg-[var(--color-bg-secondary)] rounded" />
                  <div className="h-4 w-40 bg-[var(--color-bg-secondary)] rounded" />
                  <div className="h-3 w-32 bg-[var(--color-bg-secondary)] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[var(--color-border)] rounded-2xl">
            <p className="text-4xl mb-3">🔍</p>
            <h3 className="text-lg font-semibold text-[var(--color-text-secondary)] mb-1">No events found</h3>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Try adjusting your filters or{' '}
              <Link to="/create" className="text-[var(--color-text-primary)] font-medium hover:underline no-underline">
                create your own event
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((ev, idx) => (
              <Link
                key={ev.id}
                to={`/events/${ev.id}`}
                className={`group luma-card luma-card-hover overflow-hidden no-underline animate-fade-in`}
                style={{ animationDelay: `${idx * 60}ms`, opacity: 0 }}
              >
                {/* Cover Image */}
                <div className="aspect-[16/9] bg-[var(--color-bg-secondary)] overflow-hidden relative">
                  {ev.coverImageUrl ? (
                    <img src={ev.coverImageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-border)]">
                      <span className="text-4xl opacity-40">🎪</span>
                    </div>
                  )}
                  {/* Tags */}
                  {ev.tags && ev.tags.length > 0 && (
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      <span className="px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        {ev.tags[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5">
                    {formatDate(ev.startTime || ev.date)}
                    {ev.startTime && ` · ${formatTime(ev.startTime)}`}
                  </div>
                  <h3 className="font-semibold text-base text-[var(--color-text-primary)] leading-snug mb-1.5 line-clamp-2">
                    {ev.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[var(--color-text-tertiary)]">
                      {ev.venue || ev.location?.city || 'Virtual'}
                    </p>
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      {ev.isFree || ev.price_eth === 0 ? 'Free' : `${ev.price_eth} ETH`}
                    </span>
                  </div>

                  {/* Host avatar row */}
                  {ev.createdBy && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
                      <div className="w-5 h-5 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center text-[8px] font-bold">
                        {typeof ev.createdBy === 'object' ? ev.createdBy.name?.[0] : '?'}
                      </div>
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {typeof ev.createdBy === 'object' ? ev.createdBy.name : 'Organizer'}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
