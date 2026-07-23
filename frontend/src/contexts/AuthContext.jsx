import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children, apiBaseUrl }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize session from Supabase or localStorage
  useEffect(() => {
    async function initSession() {
      try {
        const storedUser = localStorage.getItem('saas_user_session');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed.user);
          setProfile(parsed.profile);
          setTenant(parsed.tenant);
        }
      } catch (err) {
        console.error('Error initializing auth session:', err);
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, []);

  const getSafeApiUrl = () => {
    const rawUrl = apiBaseUrl || import.meta.env.VITE_API_URL || 'https://kos-backend-tuqi.onrender.com';
    if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1'))) {
      return 'https://kos-backend-tuqi.onrender.com';
    }
    return rawUrl;
  };

  const login = async (email, password) => {
    setLoading(true);
    const safeApiUrl = getSafeApiUrl();
    try {
      let userData = null;
      let profileData = null;
      let tenantData = null;

      // 1. Authenticate via Supabase Auth
      try {
        const { data: authRes, error: authErr } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (authErr) {
          throw new Error('E-mail ou senha incorretos. Verifique suas credenciais.');
        }

        if (authRes?.user) {
          userData = authRes.user;

          // Fetch matching profile from public.users table
          const { data: pData } = await supabase
            .from('users')
            .select('*')
            .or(`id.eq.${userData.id},email.eq.${email}`)
            .maybeSingle();

          if (pData) {
            profileData = pData;
          } else {
            profileData = {
              id: userData.id,
              full_name: userData.user_metadata?.full_name || email,
              role: userData.user_metadata?.role || 'tenant_admin',
              tenant_id: userData.user_metadata?.tenant_id || null
            };
          }
        }
      } catch (e) {
        throw new Error(e.message || 'Erro ao realizar login. Tente novamente.');
      }

      if (!userData) {
        throw new Error('Não foi possível autenticar o usuário. Verifique suas credenciais.');
      }

      // 3. Fetch Tenant Details to check suspension status (safe non-blocking check)
      try {
        const tRes = await fetch(`${safeApiUrl}/api/admin/tenants`);
        if (tRes.ok) {
          const tenants = await tRes.json();
          if (tenants && tenants.length > 0) {
            const reqId = profileData?.tenant_id;
            const found = reqId ? (tenants.find(t => t.id === reqId) || tenants[0]) : tenants[0];
            if (found) {
              tenantData = found;
              if (!profileData.tenant_id) {
                profileData.tenant_id = found.id;
              }
              if (found.status === 'suspended' && profileData?.role !== 'super_admin') {
                throw new Error(`A conta da empresa "${found.name}" está suspensa. Entre em contato com o suporte.`);
              }
            }
          }
        }
      } catch (tErr) {
        if (tErr.message?.includes('suspensa')) {
          throw tErr;
        }
        console.warn('Backend tenant check skipped or unreachable:', tErr.message);
      }

      const sessionObj = { user: userData, profile: profileData, tenant: tenantData };
      setUser(userData);
      setProfile(profileData);
      setTenant(tenantData);

      localStorage.setItem('saas_user_session', JSON.stringify(sessionObj));
      return sessionObj;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut().catch(() => {});
    } catch (e) {}

    setUser(null);
    setProfile(null);
    setTenant(null);
    localStorage.removeItem('saas_user_session');
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return true;
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      tenant,
      loading,
      login,
      logout,
      resetPassword,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
