import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect } from 'react';
import { connectWallet, checkConnection } from '../utils/web3';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [walletAddr, setWalletAddr] = useState(null);

  useEffect(() => {
    checkConnection().then((addr) => {
      if (addr) setWalletAddr(addr);
    });
  }, []);

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) setWalletAddr(addr);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabel =
    user?.role === 'verifier'
      ? 'Gate Verifier'
      : user?.role === 'organizer'
        ? 'Organizer'
        : 'User';

  return (
    <nav>
      <Link to="/" className="logo">
        <span className="gradient-text">NFTTix</span>
        {user && (
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            | {roleLabel}
          </span>
        )}
      </Link>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button 
          onClick={toggleTheme} 
          className="theme-toggle" 
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        {user && (
          <>
            {walletAddr ? (
              <div className="wallet-badge">
                <div className="status-dot connected"></div>
                {walletAddr.substring(0, 6)}...{walletAddr.substring(38)}
              </div>
            ) : (
              <button className="btn btn-primary" onClick={handleConnect}>
                Connect Wallet
              </button>
            )}
            <button
              className="btn"
              style={{ border: '1px solid var(--danger)', color: 'var(--danger)' }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
