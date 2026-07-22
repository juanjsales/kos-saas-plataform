import React, { useState } from 'react';
import { KeyRound, X, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await resetPassword(email);
      setSuccessMsg('As instruções de redefinição de senha foram enviadas para o seu e-mail.');
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao solicitar redefinição de senha.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxWidth: '440px', position: 'relative' }}>
        <button className="btn-icon modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <h3><KeyRound size={22} className="accent-icon" /> Recuperação de Senha</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Digite o seu e-mail cadastrado para receber o link de redefinição de senha.
        </p>

        {successMsg && (
          <div className="alert-banner success" style={{ marginTop: '14px', fontSize: '0.85rem' }}>
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="alert-banner error" style={{ marginTop: '14px', fontSize: '0.85rem' }}>
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
          <div className="form-group">
            <label className="form-label">E-mail Cadastrado</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="input-control"
                placeholder="seu.email@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '24px' }}>
            <button type="button" className="btn secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar Link de Redefinição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
