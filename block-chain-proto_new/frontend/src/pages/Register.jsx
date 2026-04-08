import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.role, '');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-accent)]/10 placeholder:text-[var(--color-text-tertiary)]";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4 py-12">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            Create your <span className="gradient-text">NFTTix</span> account
          </h1>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            Join the community of event creators
          </p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Full Name</label>
              <input id="register-name" type="text" name="name" value={form.name} onChange={handleChange} required placeholder="John Doe" className={inputClass} />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Email address</label>
              <input id="register-email" type="email" name="email" value={form.email} onChange={handleChange} required placeholder="you@example.com" className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Password</label>
                <input id="register-password" type="password" name="password" value={form.password} onChange={handleChange} required placeholder="••••••••" minLength={6} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Confirm</label>
                <input id="register-confirm" type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required placeholder="••••••••" className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">I want to</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'user', label: 'Attend Events', icon: '🎫' },
                  { value: 'organizer', label: 'Host Events', icon: '🎪' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, role: opt.value })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
                      form.role === opt.value
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text-primary)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-[var(--color-danger-soft)] text-[var(--color-danger)] text-xs font-medium px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-medium py-2.5 rounded-lg text-sm hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--color-text-tertiary)] mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--color-text-primary)] font-medium hover:underline no-underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
