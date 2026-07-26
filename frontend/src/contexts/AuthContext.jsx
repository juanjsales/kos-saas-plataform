import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children, apiBaseUrl }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const getSafeApiUrl = () => {
    if (apiBaseUrl) return apiBaseUrl;
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      return `http://${hostname}:4000`;
    }
    return 'http://localhost:4000';
  };

  useEffect(() => {
    async function initSession() {
      try {
        const storedToken = localStorage.getItem('kos_jwt_token');
        const storedSession = localStorage.getItem('saas_user_session');

        if (storedSession) {
          const parsed = JSON.parse(storedSession);
          setUser(parsed.user);
          setProfile(parsed.profile || parsed.user);
          setTenant(parsed.tenant);
        }

        if (storedToken) {
          const safeUrl = getSafeApiUrl();
          const res = await fetch(`${safeUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setProfile(data.profile);
            setTenant(data.tenant);
          }
        }
      } catch (err) {
        console.error('Error initializing auth session:', err);
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    const safeApiUrl = getSafeApiUrl();
    try {
      const res = await fetch(`${safeApiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao autenticar. Verifique suas credenciais.');
      }

      localStorage.setItem('kos_jwt_token', data.token);
      const sessionObj = {
        user: data.user,
        profile: data.profile,
        tenant: data.tenant,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('saas_user_session', JSON.stringify(sessionObj));

      setUser(data.user);
      setProfile(data.profile);
      setTenant(data.tenant);

      return { user: data.user, profile: data.profile, tenant: data.tenant };
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('kos_jwt_token');
    localStorage.removeItem('saas_user_session');
    setUser(null);
    setProfile(null);
    setTenant(null);
  };

  const value = {
    user: user || { id: 'local-admin', email: 'admin@kos.local' },
    profile: profile || { full_name: 'Operador Local' },
    tenant: tenant || { id: '00000000-0000-0000-0000-000000000001', name: 'Lan 3JR' },
    loading,
    login,
    logout,
    apiBaseUrl: getSafeApiUrl()
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: { id: 'local-admin', email: 'admin@kos.local' },
      profile: { full_name: 'Operador Local' },
      tenant: { id: '00000000-0000-0000-0000-000000000001', name: 'Lan 3JR' },
      loading: false,
      login: async () => {},
      logout: () => {},
      apiBaseUrl: 'http://localhost:4000'
    };
  }
  return context;
}
