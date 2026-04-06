import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { connectWallet, checkConnection, getContract, loadDeployment } from '../utils/web3';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../utils/api';

export default function VerifierTerminal() {
  const { user, updateWallet } = useAuth();
  const { showToast } = useToast();
  const [walletAddr, setWalletAddr] = useState(null);
  const [payload, setPayload] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);

  useEffect(() => {
    loadDeployment();
    checkConnection().then((addr) => {
      if (addr) setWalletAddr(addr);
    });

    // Cleanup scanner on unmount
    return () => {
      stopScanner();
    };
  }, []);

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) {
      setWalletAddr(addr);
      if (!user.walletAddress) {
        try { await updateWallet(addr); } catch (e) { /* ignore */ }
      }
    }
  };

  // ── QR Scanner Functions ──────────────────────────────────
  const startScanner = async () => {
    if (scannerInstanceRef.current) {
      await stopScanner();
    }

    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerInstanceRef.current = html5QrCode;
      setScannerActive(true);
      setResult(null);

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // QR Scanned successfully!
          setPayload(decodedText);
          stopScanner();
          showToast('QR Scanned', 'Ticket payload captured. Click Verify to proceed.');
        },
        () => {
          // Ignore scan failures (camera is just looking)
        }
      );
    } catch (err) {
      console.error('Camera error:', err);
      showToast('Camera Error', typeof err === 'string' ? err : 'Could not access camera. Please grant camera permissions or use the manual paste method.', true);
      setScannerActive(false);
    }
  };

  const stopScanner = async () => {
    if (scannerInstanceRef.current) {
      try {
        const state = scannerInstanceRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerInstanceRef.current.stop();
        }
      } catch (e) {
        // ignore
      }
      try {
        scannerInstanceRef.current.clear();
      } catch (e) {
        // ignore
      }
      scannerInstanceRef.current = null;
    }
    setScannerActive(false);
  };

  // ── Verify Ticket ─────────────────────────────────────────
  const verifyPayload = async () => {
    if (!payload.trim()) { showToast('Error', 'Empty payload. Scan a QR code or paste the ticket JSON.', true); return; }

    let parsed;
    try {
      parsed = JSON.parse(payload.trim());
      if (parsed.token_id === undefined) throw new Error('Missing token_id');
    } catch (e) {
      let errorMsg = 'The scanned payload is not recognized by this system.';
      if (payload.trim().startsWith('0x')) {
        errorMsg = "You pasted a wallet address instead of a ticket payload! Scan the QR code from the attendee's entry pass.";
      }
      setResult({ valid: false, title: 'Invalid Format', desc: errorMsg });
      return;
    }

    setVerifying(true);
    setResult(null);

    try {
      // Step 1: Backend validation
      const { data: check } = await api.post('/verify', {
        token_id: parseInt(parsed.token_id),
        verifier_address: walletAddr,
      });

      if (check.status === 'INVALID') {
        setResult({
          valid: false,
          title: 'TICKET INVALID',
          desc: check.reason === 'already_used' ? 'This ticket has already been used.' : 'Ticket not found or owned by zero address.',
        });
        setVerifying(false);
        return;
      }

      // Step 2: Mark used on-chain via MetaMask
      showToast('Action Required', 'Please confirm the transaction in your MetaMask popup.');
      try {
        const contract = getContract();
        if (!contract) throw new Error('Contract not loaded');
        const tx = await contract.markUsed(parseInt(parsed.token_id));
        await tx.wait();

        setResult({
          valid: true,
          title: 'TICKET VALID ✅',
          desc: `Admit One. Token #${parsed.token_id}<br/>Owner: ${check.owner.substring(0, 12)}...<br/><br/><strong>Marked as used on-chain.</strong>`,
        });
      } catch (txErr) {
        setResult({
          valid: false,
          title: 'TRANSACTION FAILED',
          desc: 'Could not submit markUsed transaction. User rejected or out of gas.',
        });
      }
    } catch (e) {
      let title = 'API ERROR';
      let msg = e.response?.data?.message || e.message;

      if (e.response?.status === 403) {
        title = 'ACCESS DENIED';
        msg = `Your wallet (${walletAddr?.substring(0, 8)}...) is not a registered verifier.<br/><br/><strong>Fix:</strong> The event organizer must go to the 🏟️ Organizer Dashboard → Gate Verifiers tab and register your address.`;
      }

      setResult({ valid: false, title, desc: msg });
    } finally {
      setVerifying(false);
      setPayload('');
    }
  };

  // Guard — no wallet connected
  if (!walletAddr) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>
        <div className="card" style={{ maxWidth: 500, margin: '0 auto', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🦊</div>
          <h2>MetaMask Required</h2>
          <p style={{ color: 'var(--text-muted)', margin: '1rem 0 2rem' }}>Connect your verifier wallet to access this terminal.</p>
          <button className="btn btn-primary" onClick={handleConnect}>Connect Wallet</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate">
      <div className="card" style={{ maxWidth: 550, margin: '2rem auto', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>🔍 Gate Verifier Terminal</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Scan a QR code or paste the ticket payload to verify and mark as used on-chain.</p>

        {/* QR Scanner Area */}
        <div style={{ marginBottom: '1.5rem' }}>
          {/* Always render the container so the DOM element exists, but hide it if not active */}
          <div 
            id="qr-reader" 
            style={{ 
              display: scannerActive ? 'block' : 'none',
              width: '100%',
              maxWidth: 350,
              margin: '0 auto',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '2px solid var(--primary-accent)',
            }} 
          />
          
          {!scannerActive ? (
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
              onClick={startScanner}
            >
              📸 Open QR Scanner
            </button>
          ) : (
            <button
              className="btn"
              style={{ marginTop: '0.75rem', width: '100%', border: '1px solid var(--danger)', color: 'var(--danger)' }}
              onClick={stopScanner}
            >
              Stop Scanner
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>OR PASTE MANUALLY</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
        </div>

        {/* Manual Paste */}
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder={'Paste payload here... e.g. {"token_id": 1, "event_id": "EVT-001"}'}
          style={{
            width: '100%', height: 80, fontFamily: 'monospace', background: 'var(--bg-color)',
            border: '1px dashed var(--border-color)', color: 'var(--text-main)', padding: '1rem',
            marginBottom: '1rem', resize: 'none', outline: 'none', fontSize: '0.875rem', borderRadius: '8px',
          }}
        />

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.875rem', fontSize: '1rem' }}
          onClick={verifyPayload}
          disabled={verifying || !payload.trim()}
        >
          {verifying ? 'Checking on-chain...' : result ? 'Verify Next Ticket' : 'Verify & Mark Used'}
        </button>

        {/* Result Banner */}
        {result && (
          <div
            style={{
              padding: '2rem', borderRadius: 'var(--radius)', textAlign: 'center', marginTop: '2rem',
              background: result.valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `2px solid ${result.valid ? 'var(--success)' : 'var(--danger)'}`,
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{result.valid ? '✅' : '❌'}</div>
            <h2>{result.title}</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }} dangerouslySetInnerHTML={{ __html: result.desc }} />
          </div>
        )}
      </div>
    </div>
  );
}
