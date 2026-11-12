import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { const data = await api('/auth/me'); setUser(data.user); }
    catch { setUser(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = async (credentials) => { const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }); setUser(data.user); return data.user; };
  const register = async (details) => { const data = await api('/auth/register', { method: 'POST', body: JSON.stringify(details) }); setUser(data.user); return data.user; };
  const acceptInvitation = async (details) => { const data = await api('/auth/accept-invitation', { method: 'POST', body: JSON.stringify(details) }); setUser(data.user); return data.user; };
  const logout = async () => {
    // Clear the client session immediately; the server also invalidates the cookie.
    setUser(null);
    try { await api('/auth/logout', { method: 'POST' }); }
    catch (error) { throw error; }
  };
  const value = useMemo(() => ({ user, loading, login, register, acceptInvitation, logout, refresh }), [user, loading, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context; }
