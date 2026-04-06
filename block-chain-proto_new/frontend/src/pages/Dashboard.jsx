import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { connectWallet, checkConnection, loadDeployment } from '../utils/web3';

export default function Dashboard() {
  const { user, updateWallet } = useAuth();
  const [walletAddr, setWalletAddr] = useState(null);

  useEffect(() => {
    loadDeployment();
    checkConnection().then((addr) => {
      if (addr) setWalletAddr(addr);
    });
  }, []);

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) {
      setWalletAddr(addr);
      // Save wallet to user profile if not already set
      if (!user.walletAddress) {
        try {
          await updateWallet(addr);
        } catch (e) {
          console.warn('Could not update wallet on server:', e);
        }
      }
    }
  };

  const roleLabel =
    user?.role === 'verifier'
      ? 'Gate Verifier'
      : user?.role === 'organizer'
        ? 'Organizer'
        : 'Ticket Holder';

  // Define which cards each role can see
  const cards = [];

  if (user?.role === 'organizer') {
    cards.push({
      to: '/organizer',
      icon: '🏟️',
      title: 'Organizer Dashboard',
      desc: 'Create events, mint tickets, manage verifiers, and track on-chain data.',
    });
    cards.push({
      to: '/my-tickets',
      icon: '👝',
      title: 'My Wallet',
      desc: 'View your purchased tickets, generate entry QRs, and transfer to friends.',
    });
  }

  if (user?.role === 'user') {
    cards.push({
      to: '/marketplace',
      icon: '🎫',
      title: 'Buy Tickets',
      desc: 'Explore the marketplace and purchase NFT tickets directly from promoters.',
    });
    cards.push({
      to: '/my-tickets',
      icon: '👝',
      title: 'My Wallet',
      desc: 'View your purchased tickets, generate entry QRs, and transfer to friends.',
    });
  }

  if (user?.role === 'verifier') {
    cards.push({
      to: '/verifier',
      icon: '🔍',
      title: 'Gate Verifier Terminal',
      desc: 'Scan attendee QR codes and verify ticket authenticity on-chain.',
    });
  }

  return (
    <div className="container animate">
      <div style={{ textAlign: 'center', padding: '4rem 0 2rem' }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
          The Future of <span className="gradient-text">Ticketing</span>
        </h1>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '1.25rem',
            maxWidth: 600,
            margin: '0 auto 2rem',
          }}
        >
          Secure, transparent, and verifiable event tickets powered by the blockchain and NFTs.
        </p>

        <div
          style={{
            display: 'inline-block',
            padding: '1rem 2rem',
            borderRadius: 'var(--radius)',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#10b981', margin: 0 }}>
            Logged in as: <span style={{ textTransform: 'capitalize' }}>{roleLabel}</span>
          </p>
          {walletAddr && (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Wallet: <strong>{walletAddr}</strong>
            </p>
          )}
          {!walletAddr && (
            <button
              className="btn btn-primary"
              style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}
              onClick={handleConnect}
            >
              🦊 Connect MetaMask Wallet
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
          marginTop: '2rem',
        }}
      >
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="card"
            style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>{card.icon}</span>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>{card.title}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
