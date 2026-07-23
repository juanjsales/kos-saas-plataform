import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

export function ThemeProvider({ children, apiBaseUrl, tenantId: propsTenantId, userRole: propsUserRole, userId }) {
  const { profile, tenant: authTenant } = useAuth();

  const activeTenantId = profile?.tenant_id || propsTenantId || '00000000-0000-0000-0000-000000000001';

  // Level 1: Dynamic Whitelabel Branding
  const [tenantName, setTenantName] = useState(authTenant?.name || 'KOS System');
  const [tenantLogo, setTenantLogo] = useState(authTenant?.logo_url || null);
  const [tenantBrandColor, setTenantBrandColor] = useState(authTenant?.brand_colors?.primary || '#6366f1');

  // Level 2: Operator Custom Preferences
  const [themeMode, setThemeMode] = useState('dark'); // 'dark', 'light', 'system'
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [kanbanDensity, setKanbanDensity] = useState('comfortable');

  const rawUrl = apiBaseUrl || import.meta.env.VITE_API_URL || 'https://kos-backend-tuqi.onrender.com';
  const safeApiUrl = (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1')))
    ? 'https://kos-backend-tuqi.onrender.com'
    : rawUrl;

  // Fetch Tenant Company Branding in Real Time
  useEffect(() => {
    async function fetchTenantBrand() {
      if (!activeTenantId) return;
      try {
        const res = await fetch(`${safeApiUrl}/api/admin/tenants`);
        if (res.ok) {
          const tenants = await res.json();
          if (Array.isArray(tenants)) {
            const current = tenants.find(t => t.id === activeTenantId);
            if (current) {
              setTenantName(current.name || 'KOS System');
              setTenantLogo(current.logo_url || null);
              if (current.brand_colors?.primary) {
                setTenantBrandColor(current.brand_colors.primary);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching tenant brand:', err);
      }
    }
    fetchTenantBrand();
  }, [activeTenantId, safeApiUrl]);

  // Sync document title with dynamic company name
  useEffect(() => {
    if (tenantName) {
      document.title = `${tenantName} - Atendimentos e Mensagens`;
    }
  }, [tenantName]);

  // Fetch Operator Visual Preferences
  useEffect(() => {
    async function fetchUserPrefs() {
      try {
        const res = await fetch(`${safeApiUrl}/api/user/preferences?user_id=${userId || '00000000-0000-0000-0000-000000000001'}`);
        if (res.ok) {
          const prefs = await res.json();
          if (prefs.theme_mode) setThemeMode(prefs.theme_mode);
          if (prefs.accent_color) setAccentColor(prefs.accent_color);
          if (prefs.kanban_density) setKanbanDensity(prefs.kanban_density);
        }
      } catch (err) {
        console.error('Error fetching user preferences:', err);
      }
    }
    fetchUserPrefs();
  }, [userId, safeApiUrl]);

  // Apply CSS Custom Variables dynamically on HTML document root
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary-accent', accentColor);
    root.style.setProperty('--brand-primary', tenantBrandColor);

    if (themeMode === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
  }, [accentColor, tenantBrandColor, themeMode]);

  const updatePreferences = async (newPrefs) => {
    if (newPrefs.theme_mode) setThemeMode(newPrefs.theme_mode);
    if (newPrefs.accent_color) setAccentColor(newPrefs.accent_color);
    if (newPrefs.kanban_density) setKanbanDensity(newPrefs.kanban_density);

    try {
      await fetch(`${apiBaseUrl}/api/user/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId || '00000000-0000-0000-0000-000000000001',
          tenant_id: activeTenantId,
          ...newPrefs
        })
      });
    } catch (err) {
      console.error('Error saving user preferences:', err);
    }
  };

  const updateTenantBranding = (newName, newLogo, newColor) => {
    if (newName) setTenantName(newName);
    if (newLogo !== undefined) setTenantLogo(newLogo);
    if (newColor) setTenantBrandColor(newColor);
  };

  return (
    <ThemeContext.Provider value={{
      tenantName,
      tenantLogo,
      tenantBrandColor,
      themeMode,
      accentColor,
      kanbanDensity,
      updatePreferences,
      updateTenantBranding,
      userRole: profile?.role || propsUserRole || 'super_admin'
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
