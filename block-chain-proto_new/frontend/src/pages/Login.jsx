import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { connectWallet, signMessage } from '../utils/web3';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const { login, loginWithWallet } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWalletLogin = async () => {
    setError('');
    setWalletLoading(true);
    try {
      const address = await connectWallet();
      if (!address) return;
      
      const message = `Sign in to block-chain-proto tickets.\nWallet: ${address}\nNonce: ${Date.now()}`;
      const signature = await signMessage(message);

      await loginWithWallet(address, signature, message);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Wallet login failed.');
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="gradient-text">NFTTix</span>
          </h1>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-accent)]/10 placeholder:text-[var(--color-text-tertiary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-accent)]/10 placeholder:text-[var(--color-text-tertiary)]"
              />
            </div>

            {error && (
              <div className="bg-[var(--color-danger-soft)] text-[var(--color-danger)] text-xs font-medium px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium py-2.5 rounded-lg text-sm hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Continue'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
            <button
              type="button"
              onClick={handleWalletLogin}
              disabled={walletLoading}
              className="w-full flex items-center justify-center gap-2 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-lg py-2.5 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-hover)] transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="text-lg">⟠</span>
              {walletLoading ? 'Connecting...' : 'Continue with Ethereum'}
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-lg py-2.5 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-border-hover)] transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--color-text-tertiary)] mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-[var(--color-text-primary)] font-medium hover:underline no-underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
