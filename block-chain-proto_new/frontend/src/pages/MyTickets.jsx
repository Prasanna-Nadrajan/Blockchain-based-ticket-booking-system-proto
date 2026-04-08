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
        try { await updateWallet(addr); } catch (e) { }
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
      showToast('Error', 'Failed to load tickets', true);
    } finally {
      setLoading(false);
    }
  };

  const showQR = async (tokenId, eventId) => {
    setModal({ open: true, content: <div className="text-center py-8 text-sm text-[var(--color-text-tertiary)]">Generating QR...</div> });
    try {
      const { data } = await api.get(`/tickets/${tokenId}/qr`);
      const payload = JSON.stringify({ token_id: tokenId, event_id: eventId });

      setModal({
        open: true,
        content: (
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">Entry Pass #{tokenId}</h3>
            <img src={data.qr_base64} alt="QR" className="w-48 h-48 mx-auto rounded-xl border-4 border-[var(--color-bg-secondary)]" />
            <div className="mt-4 p-3 bg-[var(--color-bg)] rounded-lg">
              <p className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Payload</p>
              <code className="text-xs text-[var(--color-luma-purple)] break-all">{payload}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(payload); showToast('Copied', 'Payload copied'); }}
                className="mt-2 w-full px-3 py-1.5 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-md text-xs font-medium cursor-pointer border-0 hover:bg-[var(--color-accent-hover)]"
              >
                Copy
              </button>
            </div>
          </div>
        ),
      });
    } catch (e) {
      setModal({ open: true, content: <p className="text-center text-[var(--color-danger)] text-sm py-8">Failed to generate QR</p> });
    }
  };

  const showTransfer = (tokenId) => {
    setModal({ open: true, content: <TransferForm tokenId={tokenId} showToast={showToast} closeModal={() => setModal({ open: false, content: null })} /> });
  };

  if (!walletAddr) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="luma-card p-8">
          <p className="text-4xl mb-4">🦊</p>
          <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-6">Connect MetaMask to view your NFT tickets.</p>
          <button onClick={handleConnect} className="px-6 py-2.5 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer border-0">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">My Tickets</h1>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Your NFT tickets and entry passes</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="luma-card p-5 animate-pulse">
              <div className="h-4 w-20 bg-[var(--color-bg-secondary)] rounded mb-3" />
              <div className="h-5 w-36 bg-[var(--color-bg-secondary)] rounded mb-4" />
              <div className="h-8 w-full bg-[var(--color-bg-secondary)] rounded" />
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-[var(--color-border)] rounded-2xl">
          <p className="text-4xl mb-3">🎫</p>
          <h3 className="text-lg font-semibold text-[var(--color-text-secondary)] mb-1">No tickets yet</h3>
          <p className="text-sm text-[var(--color-text-tertiary)]">Purchase tickets from the marketplace to see them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tickets.map((t, idx) => (
            <div
              key={t.token_id}
              className="luma-card overflow-hidden animate-fade-in"
              style={{ animationDelay: `${idx * 60}ms`, opacity: 0 }}
            >
              {/* Header band */}
              <div className="h-1.5 bg-gradient-to-r from-[var(--color-luma-purple)] to-[var(--color-luma-pink)]" />

              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Token #{t.token_id}
                  </span>
                  {t.is_used ? (
                    <span className="px-2 py-0.5 bg-[var(--color-danger-soft)] text-[var(--color-danger)] rounded-full text-[10px] font-semibold">
                      Used
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-[var(--color-success-soft)] text-[var(--color-success)] rounded-full text-[10px] font-semibold">
                      Valid
                    </span>
                  )}
                </div>

                <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
                  {t.event_name || `Event ${t.event_id}`}
                </h3>

                <div className="flex gap-2">
                  <button
                    onClick={() => showQR(t.token_id, t.event_id)}
                    className="flex-1 px-3 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg text-xs font-medium cursor-pointer border-0 hover:bg-[var(--color-accent-hover)] transition-colors"
                  >
                    Show QR
                  </button>
                  <button
                    onClick={() => showTransfer(t.token_id)}
                    disabled={t.is_used}
                    className="flex-1 px-3 py-2 border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] rounded-lg text-xs font-medium cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Transfer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setModal({ open: false, content: null })}>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-sm shadow-lg animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setModal({ open: false, content: null })} className="absolute top-4 right-4 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer bg-transparent border-0 text-lg">×</button>
            {modal.content}
          </div>
        </div>
      )}
    </div>
  );
}

function TransferForm({ tokenId, showToast, closeModal }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const api_instance = api;

  const handleTransfer = async () => {
    if (!email || !email.includes('@')) { alert('Invalid email'); return; }
    setSending(true);
    try {
      await api_instance.post(`/email/tickets/${tokenId}/transfer-email`, { email });
      showToast('Success', `Ticket sent to ${email}`);
      closeModal();
    } catch (e) {
      showToast('Error', 'Transfer failed', true);
      setSending(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Transfer Ticket #{tokenId}</h3>
      <p className="text-xs text-[var(--color-text-tertiary)] mb-4">Send the entry QR code to a friend via email.</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="friend@example.com"
        className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm outline-none mb-3 focus:border-[var(--color-border-focus)]"
      />
      <button onClick={handleTransfer} disabled={sending} className="w-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium py-2.5 rounded-lg text-sm cursor-pointer border-0 hover:bg-[var(--color-accent-hover)] disabled:opacity-50">
        {sending ? 'Sending...' : 'Send Ticket'}
      </button>
    </div>
  );
}
