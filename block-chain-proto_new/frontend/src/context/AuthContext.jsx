import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('nfttix_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('nfttix_token');
      if (storedToken) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data.user);
          setToken(storedToken);
        } catch {
          localStorage.removeItem('nfttix_token');
          localStorage.removeItem('nfttix_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('nfttix_token', data.token);
    localStorage.setItem('nfttix_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password, role, walletAddress) => {
    const { data } = await api.post('/auth/register', {
      name, email, password, role, walletAddress,
    });
    localStorage.setItem('nfttix_token', data.token);
    localStorage.setItem('nfttix_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const loginWithWallet = async (address, signature, message) => {
    const { data } = await api.post('/auth/wallet-login', { address, signature, message });
    localStorage.setItem('nfttix_token', data.token);
    localStorage.setItem('nfttix_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('nfttix_token');
    localStorage.removeItem('nfttix_user');
    setToken(null);
    setUser(null);
  };

  const updateWallet = async (walletAddress) => {
    const { data } = await api.put('/auth/wallet', { walletAddress });
    setUser(data.user);
    localStorage.setItem('nfttix_user', JSON.stringify(data.user));
  };

  const refreshUser = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    localStorage.setItem('nfttix_user', JSON.stringify(data.user));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithWallet, register, logout, updateWallet, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
