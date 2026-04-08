import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { connectWallet, checkConnection } from '../utils/web3';
import api from '../utils/api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [walletAddr, setWalletAddr] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    checkConnection().then((addr) => {
      if (addr) setWalletAddr(addr);
    });
  }, []);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) setWalletAddr(addr);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/discover', label: 'Discover' },
    { to: '/create', label: 'Create Event' },
    ...(user?.role === 'organizer' ? [{ to: '/organizer', label: 'Host Dashboard' }] : []),
  ];

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <nav className="sticky top-0 z-50 glass">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] no-underline flex items-center gap-2">
          <span className="gradient-text">NFTTix</span>
        </Link>

        {/* Center Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium no-underline transition-colors ${
                location.pathname === link.to
                  ? 'text-[var(--color-text-primary)] bg-[var(--color-surface-active)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user && (
            <>
              {/* Wallet */}
              {walletAddr ? (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-text-secondary)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]"></span>
                  {walletAddr.substring(0, 6)}...{walletAddr.substring(38)}
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                >
                  Connect Wallet
                </button>
              )}

              {/* Notifications Dropdown */}
              <div className="relative ml-1 mr-2" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xl cursor-pointer border-0 bg-transparent hover:bg-[var(--color-surface-hover)] transition-colors relative"
                >
                  🔔
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-[var(--color-danger)] rounded-full border-2 border-[var(--color-bg)]"></span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg py-2 animate-fade-in z-50">
                    <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Notifications</h3>
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-[10px] text-[var(--color-accent)] hover:underline border-0 bg-transparent cursor-pointer">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif._id} 
                            onClick={() => !notif.isRead && handleMarkAsRead(notif._id)}
                            className={`px-4 py-3 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] cursor-pointer transition-colors ${!notif.isRead ? 'bg-[var(--color-surface-active)]' : ''}`}
                          >
                            <p className="text-xs font-semibold mb-1">{notif.title}</p>
                            <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                              {new Date(notif.createdAt).toLocaleDateString()} {notif.event?.name ? `· ${notif.event.name}` : ''}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Avatar Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-8 h-8 rounded-full bg-[var(--color-text-primary)] text-[var(--color-text-inverse)] flex items-center justify-center text-xs font-semibold cursor-pointer border-0 hover:opacity-90 transition-opacity"
                >
                  {initials}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-lg py-1 animate-fade-in">
                    <div className="px-4 py-3 border-b border-[var(--color-border)]">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{user.name}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">{user.email}</p>
                    </div>

                    <Link
                      to="/my-tickets"
                      className="flex items-center px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] no-underline transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      My Tickets
                    </Link>
                    <Link
                      to="/settings"
                      className="flex items-center px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] no-underline transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Settings
                    </Link>

                    <div className="border-t border-[var(--color-border)] mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] transition-colors cursor-pointer bg-transparent border-0"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
