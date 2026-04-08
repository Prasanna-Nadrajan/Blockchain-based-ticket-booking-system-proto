import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';

export default function UserProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    try {
      const { data } = await api.get(`/auth/profile/${username}`);
      setProfile(data.user);
    } catch (e) {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 animate-pulse">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-20 h-20 rounded-full bg-[var(--color-bg-secondary)]" />
          <div>
            <div className="h-6 w-40 bg-[var(--color-bg-secondary)] rounded mb-2" />
            <div className="h-4 w-24 bg-[var(--color-bg-secondary)] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-4">😕</p>
        <h2 className="text-xl font-semibold mb-2">User not found</h2>
        <Link to="/discover" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] no-underline">
          ← Back to Discover
        </Link>
      </div>
    );
  }

  const socialIcons = {
    x: '𝕏',
    instagram: '📸',
    linkedin: '💼',
    github: '💻',
    website: '🌐',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Profile Header */}
      <div className="flex items-start gap-5 mb-6">
        <div className="w-20 h-20 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] flex items-center justify-center text-2xl font-bold flex-shrink-0">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            profile.name?.[0]?.toUpperCase() || '?'
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">@{profile.username}</p>
          {profile.bio && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-2 max-w-md">{profile.bio}</p>
          )}

          {/* Social Links */}
          {profile.socialLinks && Object.entries(profile.socialLinks).some(([, v]) => v) && (
            <div className="flex gap-2 mt-3">
              {Object.entries(profile.socialLinks).map(([key, url]) => (
                url ? (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg bg-[var(--color-bg-secondary)] flex items-center justify-center text-sm hover:bg-[var(--color-surface-active)] transition-colors no-underline"
                    title={key}
                  >
                    {socialIcons[key] || '🔗'}
                  </a>
                ) : null
              ))}
            </div>
          )}
        </div>
        
        {profile.role === 'organizer' && (
          <div className="ml-auto ml-10">
            <button
              onClick={() => setIsSubscribed(!isSubscribed)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer border-0 ${
                isSubscribed 
                  ? 'bg-[var(--color-surface-active)] text-[var(--color-text-primary)] border border-[var(--color-border)]' 
                  : 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]'
              }`}
            >
              {isSubscribed ? 'Subscribed ✓' : 'Subscribe'}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] pt-6">
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}
