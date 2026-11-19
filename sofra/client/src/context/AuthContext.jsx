import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const token = session?.token;

  const login = useCallback(async (credentials) => {
    const result = await api.loginUser(credentials);
    setSession({ token: result.token, user: result.user });
    return result.user;
  }, []);

  const register = useCallback(async (details) => {
    const result = await api.registerUser(details);
    setSession({ token: result.token, user: result.user });
    return result.user;
  }, []);

  const logout = useCallback(() => setSession(null), []);

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    const { user } = await api.getCurrentUser(token);
    setSession((current) => current?.token === token ? { ...current, user } : current);
    return user;
  }, [token]);

  useEffect(() => {
    window.addEventListener('sofra-user-unauthorized', logout);
    return () => window.removeEventListener('sofra-user-unauthorized', logout);
  }, [logout]);

  const value = useMemo(() => ({
    user: session?.user || null,
    token: session?.token || null,
    login,
    register,
    logout,
    refreshUser,
  }), [session, login, register, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
