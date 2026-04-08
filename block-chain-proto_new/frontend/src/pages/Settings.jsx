import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../utils/api';
import { connectWallet, signMessage } from '../utils/web3';

export default function Settings() {
  const { user, logout, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [profile, setProfile] = useState({
    name: user?.name || '',
    username: user?.username || '',
    bio: user?.bio || '',
    avatarUrl: user?.avatarUrl || '',
    socialLinks: {
      x: user?.socialLinks?.x || '',
      instagram: user?.socialLinks?.instagram || '',
      linkedin: user?.socialLinks?.linkedin || '',
      github: user?.socialLinks?.github || '',
      website: user?.socialLinks?.website || '',
    },
  });

  const handleProfileSave = async () => {
    setLoading(true);
    try {
      await api.put('/auth/profile', profile);
      showToast('Success', 'Profile updated');
    } catch (err) {
      showToast('Error', err.response?.data?.message || 'Failed to update', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete('/auth/account');
      showToast('Account Deleted', 'Your account has been deleted');
      logout();
    } catch {
      showToast('Error', 'Failed to delete account', true);
    }
  };

  const handleLinkWallet = async () => {
    setWalletLoading(true);
    try {
      const address = await connectWallet();
      if (!address) return;
      
      const message = `Sign in to block-chain-proto tickets.\nWallet: ${address}\nNonce: ${Date.now()}`;
      const signature = await signMessage(message);

      await api.post('/auth/wallet/link', {
        chain: 'ethereum',
        address,
        signature,
        message,
      });

      await refreshUser();
      showToast('Wallet Linked', 'Your wallet has been verified and linked successfully.');
    } catch (err) {
      showToast('Error', err.response?.data?.message || err.message || 'Failed to link wallet', true);
    } finally {
      setWalletLoading(false);
    }
  };

  const handleUnlinkWallet = async (chain, address) => {
    try {
      await api.delete('/auth/wallet/unlink', { data: { chain, address } });
      await refreshUser();
      showToast('Unlinked', 'Wallet removed from your account.');
    } catch (err) {
      showToast('Error', 'Failed to unlink wallet', true);
    }
  };

  const inputClass = "w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] outline-none transition-all focus:border-[var(--color-border-focus)] placeholder:text-[var(--color-text-tertiary)]";
  const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5";

  const sections = [
    { id: 'profile', label: 'Profile' },
    { id: 'wallets', label: 'Connected Wallets' },
    { id: 'security', label: 'Security' },
    { id: 'danger', label: 'Account' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight mb-8">Settings</h1>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Sidebar */}
        <div className="sm:w-48 flex-shrink-0">
          <div className="flex sm:flex-col gap-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors cursor-pointer bg-transparent border-0 w-full ${
                  activeSection === s.id
                    ? 'bg-[var(--color-surface-active)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Profile */}
          {activeSection === 'profile' && (
            <div className="luma-card p-6 space-y-5">
              <h2 className="text-lg font-semibold">Profile Information</h2>

              <div className="flex items-center gap-4 pb-5 border-b border-[var(--color-border)]">
                <div className="w-16 h-16 rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] flex items-center justify-center text-xl font-bold">
                  {profile.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <input type="url" value={profile.avatarUrl} onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })} placeholder="Avatar URL" className={`${inputClass} text-xs`} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Full Name</label>
                  <input type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Username</label>
                  <input type="text" value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Bio</label>
                <textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Tell people about yourself..." rows={3} className={`${inputClass} resize-none`} maxLength={500} />
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">{profile.bio.length}/500</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Social Links</h3>
                <div className="space-y-3">
                  {[
                    { key: 'x', label: '𝕏 (Twitter)', placeholder: 'https://x.com/username' },
                    { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username' },
                    { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/username' },
                    { key: 'github', label: 'GitHub', placeholder: 'https://github.com/username' },
                    { key: 'website', label: 'Website', placeholder: 'https://yoursite.com' },
                  ].map((s) => (
                    <div key={s.key} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-[var(--color-text-tertiary)] w-20">{s.label}</span>
                      <input
                        type="url"
                        value={profile.socialLinks[s.key]}
                        onChange={(e) => setProfile({
                          ...profile,
                          socialLinks: { ...profile.socialLinks, [s.key]: e.target.value },
                        })}
                        placeholder={s.placeholder}
                        className={`flex-1 ${inputClass}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleProfileSave}
                disabled={loading}
                className="px-6 py-2.5 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg text-sm font-medium cursor-pointer border-0 hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Wallets */}
          {activeSection === 'wallets' && (
            <div className="luma-card p-6">
              <h2 className="text-lg font-semibold mb-4">Connected Wallets</h2>

              <div className="space-y-3 mb-6">
                {user?.wallets && user.wallets.length > 0 ? (
                  user.wallets.map((w, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)]">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{w.chain === 'ethereum' ? '⟠' : '◎'}</span>
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-primary)] capitalize">{w.chain}</p>
                          <p className="text-xs font-mono text-[var(--color-text-tertiary)]">
                            {w.address.substring(0, 8)}...{w.address.substring(w.address.length - 6)}
                          </p>
                        </div>
                      </div>
                      {w.isPrimary && (
                        <span className="text-[10px] font-semibold bg-[var(--color-success-soft)] text-[var(--color-success)] px-2 py-0.5 rounded-full">Primary</span>
                      )}
                      {!w.isPrimary && (
                        <button
                          onClick={() => handleUnlinkWallet(w.chain, w.address)}
                          className="text-xs text-[var(--color-danger)] hover:underline border-0 bg-transparent cursor-pointer"
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  ))
                ) : user?.walletAddress ? (
                  <div className="flex items-center gap-3 p-3 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)]">
                    <span className="text-lg">⟠</span>
                    <div>
                      <p className="text-sm font-medium">Ethereum</p>
                      <p className="text-xs font-mono text-[var(--color-text-tertiary)]">{user.walletAddress}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-text-tertiary)]">No wallets connected</p>
                )}
              </div>

              <div className="pt-4 border-t border-[var(--color-border)]">
                <button
                  onClick={handleLinkWallet}
                  disabled={walletLoading}
                  className="w-full px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg text-sm font-medium hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {walletLoading ? 'Linking...' : '+ Connect New Wallet'}
                </button>
              </div>
            </div>
          )}

          {/* Security */}
          {activeSection === 'security' && (
            <div className="luma-card p-6">
              <h2 className="text-lg font-semibold mb-4">Security</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Two-Factor Authentication</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Add an extra layer of security</p>
                  </div>
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)]">Coming soon</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Active Sessions</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Manage your active devices</p>
                  </div>
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)]">Coming soon</span>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          {activeSection === 'danger' && (
            <div className="luma-card p-6 border-[var(--color-danger)]">
              <h2 className="text-lg font-semibold text-[var(--color-danger)] mb-4">Danger Zone</h2>

              <div className="p-4 bg-[var(--color-danger-soft)] rounded-lg">
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Delete Account</p>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
                  This will permanently delete your account and all associated data. This action cannot be undone.
                </p>

                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="px-4 py-2 bg-[var(--color-danger)] text-white rounded-lg text-sm font-medium cursor-pointer border-0 hover:opacity-90"
                  >
                    Delete My Account
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      className="px-4 py-2 bg-[var(--color-danger)] text-white rounded-lg text-sm font-medium cursor-pointer border-0 hover:opacity-90"
                    >
                      Yes, Delete Everything
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="px-4 py-2 border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] rounded-lg text-sm font-medium cursor-pointer hover:bg-[var(--color-surface-hover)]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
