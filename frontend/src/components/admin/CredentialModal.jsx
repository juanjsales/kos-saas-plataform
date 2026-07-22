import React, { useState } from 'react';
import { KeyRound, Check, Copy, X, ShieldCheck } from 'lucide-react';

export function CredentialModal({ credentials, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!credentials) return null;

  const email = credentials.email || credentials.owner_email || 'dono@empresa.com';
  const temporaryPassword = credentials.temporaryPassword || credentials.provisional_password || 'Kos123456!';

  const textToCopy = `📋 CREDENCIAIS DE ACESSO KOS\n\nE-mail: ${email}\nSenha Provisória: ${temporaryPassword}\n\nAcesse: http://localhost:5173/login`;

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content glass-card" style={{ maxWidth: '440px', position: 'relative', textAlign: 'center', padding: '32px 24px' }}>
        <button className="btn-icon modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.2)',
          color: '#10b981',
          margin: '0 auto 16px'
        }}>
          <ShieldCheck size={32} />
        </div>

        <h3 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0, color: '#f8fafc' }}>
          Cliente Cadastrado com Sucesso!
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Copie as credenciais de acesso provisórias e envie para o seu cliente:
        </p>

        <div className="glass-subcard" style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', textAlign: 'left', background: 'rgba(15, 23, 42, 0.7)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>E-mail de Acesso:</div>
          <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#f8fafc', margin: '2px 0 12px' }}>{email}</div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Senha Provisória:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <KeyRound size={18} style={{ color: '#f59e0b' }} />
            <code style={{
              fontSize: '1.1rem',
              fontWeight: '800',
              color: '#10b981',
              fontFamily: 'monospace',
              letterSpacing: '1px',
              background: 'rgba(0,0,0,0.4)',
              padding: '4px 10px',
              borderRadius: '6px'
            }}>
              {temporaryPassword}
            </code>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            type="button"
            className="btn primary"
            onClick={handleCopy}
            style={{ padding: '10px', justifyContent: 'center', fontSize: '0.88rem' }}
          >
            {copied ? <><Check size={16} /> Copiado!</> : <><Copy size={16} /> Copiar Credenciais</>}
          </button>

          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
            style={{ padding: '10px', justifyContent: 'center', fontSize: '0.88rem' }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
