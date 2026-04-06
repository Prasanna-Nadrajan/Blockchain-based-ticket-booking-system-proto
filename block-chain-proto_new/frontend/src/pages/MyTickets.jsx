import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { connectWallet, checkConnection, loadDeployment } from '../utils/web3';
import api from '../utils/api';

export default function MyTickets() {
  const { user, updateWallet } = useAuth();
  const { showToast } = useToast();
  const [walletAddr, setWalletAddr] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modal, setModal] = useState({ open: false, content: null });

  useEffect(() => {
    loadDeployment();
    checkConnection().then((addr) => {
      if (addr) {
        setWalletAddr(addr);
        loadTickets(addr);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) {
      setWalletAddr(addr);
      if (!user.walletAddress) {
        try { await updateWallet(addr); } catch (e) { /* ignore */ }
      }
      loadTickets(addr);
    }
  };

  const loadTickets = async (address) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/tickets?owner=${address}`);
      setTickets(data);
    } catch (err) {
      showToast('Error', 'Failed to load tickets: ' + (err.response?.data?.message || err.message), true);
    } finally {
      setLoading(false);
    }
  };

  const showQR = async (tokenId, eventId) => {
    setModal({
      open: true,
      content: <h3 style={{ textAlign: 'center' }}>Generating QR...</h3>,
    });

    try {
      const { data } = await api.get(`/tickets/${tokenId}/qr`);
      const payloadStr = JSON.stringify({ token_id: tokenId, event_id: eventId });

      setModal({
        open: true,
        content: (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}>Entry Pass #{tokenId}</h3>
            <img src={data.qr_base64} alt="QR Code" style={{ width: '80%', borderRadius: '8px', border: '10px solid var(--surface-color)', display: 'block', margin: '0 auto' }} />
            <div style={{ marginTop: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 700 }}>Manual Payload (For Testing)</p>
              <code style={{ fontSize: '0.8125rem', wordBreak: 'break-all', color: 'var(--primary-accent)' }}>{payloadStr}</code>
              <button
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', marginTop: '0.8rem', width: '100%' }}
                onClick={() => {
                  navigator.clipboard.writeText(payloadStr)
                    .then(() => showToast('Copied', 'Payload copied to clipboard'))
                    .catch(() => showToast('Error', 'Clipboard access denied', true));
                }}
              >
                Copy Payload
              </button>
            </div>
          </div>
        ),
      });
    } catch (e) {
      setModal({
        open: true,
        content: <p style={{ color: 'var(--danger)', textAlign: 'center' }}>Failed to generate QR</p>,
      });
    }
  };

  const showTransfer = (tokenId) => {
    setModal({
      open: true,
      content: <TransferForm tokenId={tokenId} showToast={showToast} closeModal={() => setModal({ open: false, content: null })} />,
    });
  };

  // Guard
  if (!walletAddr) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>
        <div className="card" style={{ maxWidth: 500, margin: '0 auto', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🦊</div>
          <h2>MetaMask Required</h2>
          <p style={{ color: 'var(--text-muted)', margin: '1rem 0 2rem' }}>Connect your wallet to view your tickets.</p>
          <button className="btn btn-primary" onClick={handleConnect}>Connect Wallet</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate">
      <h2 style={{ marginBottom: '0.5rem' }}>My NFT Tickets</h2>
      <p style={{ color: 'var(--text-muted)' }}>View your digital tickets and generate QR codes for gate entry.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
        {loading ? (
          <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Loading tickets from blockchain...</p>
        ) : tickets.length === 0 ? (
          <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>You don&apos;t own any tickets.</p>
        ) : (
          tickets.map((t) => (
            <div key={t.token_id} className="card animate" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--surface-color)', padding: '0.5rem 1rem', borderBottomLeftRadius: '12px', fontFamily: 'monospace', color: 'var(--text-muted)', borderLeft: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                #{t.token_id}
              </div>
              <h3>{t.event_name}</h3>
              <div style={{ marginTop: 'auto' }}>
                {t.is_used
                  ? <span className="badge badge-used">USED</span>
                  : <span className="badge badge-available">VALID</span>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => showQR(t.token_id, t.event_id)}>Show QR</button>
                <button className="btn" onClick={() => showTransfer(t.token_id)} disabled={t.is_used}>Transfer</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="modal-overlay active" onClick={() => setModal({ open: false, content: null })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setModal({ open: false, content: null })}>&times;</button>
            {modal.content}
          </div>
        </div>
      )}
    </div>
  );
}

// Transfer sub-component
function TransferForm({ tokenId, showToast, closeModal }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleTransfer = async () => {
    if (!email || !email.includes('@')) { alert('Invalid email address'); return; }
    setSending(true);
    try {
      await api.post(`/email/tickets/${tokenId}/transfer-email`, { email });
      showToast('Success', `Ticket entry pass sent to ${email}`);
      closeModal();
    } catch (e) {
      showToast('Transfer Failed', e.response?.data?.message || 'Failed to send email', true);
      setSending(false);
    }
  };

  return (
    <div>
      <h3 style={{ marginBottom: '1rem' }}>Transfer Ticket #{tokenId}</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Send this ticket pass to a friend via email. They will receive the QR code to enter the event.
      </p>
      <div className="form-group">
        <label>Recipient Email Address</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" />
      </div>
      <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleTransfer} disabled={sending}>
        {sending ? 'Sending...' : 'Send Ticket via Email'}
      </button>
    </div>
  );
}
