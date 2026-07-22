import React, { useState } from 'react';
import { Sparkles, Lock, Mail, ArrowRight, Shield, AlertCircle, KeyRound, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';

export function LoginPage({ apiBaseUrl }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await login(email, password);
    } catch (err) {
      setErrorMessage(err.message || 'E-mail ou senha incorretos. Por favor, confira e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await login(demoEmail, demoPassword);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), transparent 40%), radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.1), transparent 40%)'
    }}>
      <div className="login-card glass-card" style={{ width: '100%', maxWidth: '440px', padding: '36px 28px', borderRadius: '20px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--primary-accent), #4f46e5)',
            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)',
            marginBottom: '14px'
          }}>
            <Sparkles size={28} style={{ color: '#fff' }} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#f8fafc' }}>
            Entrar na Minha Conta
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Digite seu e-mail e senha para acessar os atendimentos
          </p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="alert-banner error" style={{ marginBottom: '20px', fontSize: '0.85rem' }}>
            <AlertCircle size={18} /> {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.85rem' }}>Seu E-mail</label>
            <input
              type="email"
              className="input-control"
              placeholder="seu.email@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: '12px 14px' }}
            />
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ fontSize: '0.85rem', margin: 0 }}>Sua Senha</label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                style={{ background: 'none', border: 'none', color: 'var(--primary-accent)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Precisa de ajuda para entrar?
              </button>
            </div>
            <input
              type="password"
              className="input-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ padding: '12px 14px' }}
            />
          </div>

          <button
            type="submit"
            className="btn primary"
            disabled={submitting}
            style={{ width: '100%', marginTop: '24px', padding: '12px', justifyContent: 'center', fontSize: '0.95rem', fontWeight: '700' }}
          >
            {submitting ? 'Aguarde um momentinho...' : <><ArrowRight size={18} /> Entrar na Minha Conta</>}
          </button>
        </form>

        {/* 1-Click Demo Login Shortcuts */}
        <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border-glass)' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '12px', fontWeight: '600' }}>
            ⚡ ENTRAR DIRETO (BOTÕES DE TESTE):
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => handleDemoLogin('admin@saas.com', '123456')}
              style={{ fontSize: '0.72rem', padding: '8px 4px', justifyContent: 'center', flexDirection: 'column', gap: '2px' }}
            >
              <Shield size={14} style={{ color: '#f59e0b' }} /> Dono Geral
            </button>

            <button
              type="button"
              className="btn secondary"
              onClick={() => handleDemoLogin('dono@clinica.com', '123456')}
              style={{ fontSize: '0.72rem', padding: '8px 4px', justifyContent: 'center', flexDirection: 'column', gap: '2px' }}
            >
              <Shield size={14} style={{ color: 'var(--primary-accent)' }} /> Empresa A
            </button>

            <button
              type="button"
              className="btn secondary"
              onClick={() => handleDemoLogin('dono@oficina.com', '123456')}
              style={{ fontSize: '0.72rem', padding: '8px 4px', justifyContent: 'center', flexDirection: 'column', gap: '2px' }}
            >
              <Shield size={14} style={{ color: '#10b981' }} /> Empresa B
            </button>
          </div>
        </div>
      </div>

      {showForgotModal && (
        <ForgotPasswordModal onClose={() => setShowForgotModal(false)} />
      )}
    </div>
  );
}
