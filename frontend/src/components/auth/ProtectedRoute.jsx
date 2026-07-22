import React from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginPage } from './LoginPage';

export function ProtectedRoute({ allowedRoles = [], children, apiBaseUrl }) {
  const { isAuthenticated, profile, loading, logout } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <p>Carregando autenticação...</p>
      </div>
    );
  }

  // 1. If not authenticated, show Login Page
  if (!isAuthenticated) {
    return <LoginPage apiBaseUrl={apiBaseUrl} />;
  }

  // 2. Super Admin bypasses all role checks
  const userRole = profile?.role || 'tenant_operator';
  if (userRole === 'super_admin') {
    return children;
  }

  // 3. Role check validation
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div className="glass-card" style={{ maxWidth: '480px', textAlign: 'center', padding: '36px 24px', borderRadius: '16px' }}>
          <ShieldAlert size={56} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px' }}>Acesso Negado (403 Forbidden)</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Seu perfil de usuário (<strong>{userRole}</strong>) não possui permissão para acessar este módulo administrativo.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn secondary" onClick={logout}>
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
