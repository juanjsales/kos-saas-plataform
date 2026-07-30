import React, { useState } from 'react';
import { KeyRound, ShieldAlert, Copy, Check, Lock, Cpu, Sparkles, MessageCircle, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

export function LicenseBlockScreen({ licenseState, apiBaseUrl, onActivationSuccess }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const hardwareId = licenseState?.hardware_id || 'KOS-HWID-DESCONHECIDO';
  const status = licenseState?.status || 'unlicensed';
  const message = licenseState?.message || 'Sistema aguardando chave de ativação.';

  const handleCopyHwId = () => {
    navigator.clipboard.writeText(hardwareId);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setErrorMsg('Por favor, informe a Chave de Ativação / Serial Key.');
      return;
    }

    setActivating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: licenseKey.trim(),
          signed_token: licenseKey.trim().startsWith('eyJ') ? licenseKey.trim() : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao ativar licença. Verifique o código digitado.');
      }

      setSuccessMsg('Licença ativada com sucesso! Desbloqueando sistema...');
      setTimeout(() => {
        if (onActivationSuccess) onActivationSuccess();
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || 'Chave de licença inválida.');
    } finally {
      setActivating(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'expired':
        return { label: 'Assinatura Expirada', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' };
      case 'invalid_hardware':
        return { label: 'Hardware Não Autorizado', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' };
      case 'grace_period':
        return { label: 'Tolerância Offline Expirada', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' };
      default:
        return { label: 'Ativação Necessária', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)' };
    }
  };

  const statusBadge = getStatusBadge();
  const waSupportUrl = `https://wa.me/5521999999999?text=${encodeURIComponent(`Olá! Preciso regularizar minha licença do KOS.\nMeu Hardware ID: ${hardwareId}`)}`;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'radial-gradient(circle at top, #1e1b4b 0%, #0f172a 60%, #020617 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      <div className="glass-card" style={{
        maxWidth: '540px',
        width: '100%',
        padding: '36px',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        textAlign: 'center'
      }}>
        {/* Logo & Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
          <Sparkles size={32} style={{ color: '#6366f1' }} />
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>KOS System</h1>
        </div>

        {/* Lock Icon & Title */}
        <div style={{ margin: '20px 0' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Lock size={30} style={{ color: '#ef4444' }} />
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: '700', marginBottom: '8px' }}>
            Acesso Temporariamente Suspenso
          </h2>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            background: statusBadge.bg,
            color: statusBadge.color,
            fontSize: '0.82rem',
            fontWeight: '700',
            marginBottom: '16px'
          }}>
            <AlertTriangle size={14} />
            {statusBadge.label}
          </div>

          <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: '1.5', margin: 0 }}>
            {message} Para liberar o acesso à sua loja, insira sua Chave de Ativação abaixo.
          </p>
        </div>

        {/* Hardware ID Display */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '24px',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={14} style={{ color: '#6366f1' }} /> Identificador do Computador (Hardware ID)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <code style={{ fontSize: '0.95rem', fontWeight: '700', color: '#38bdf8', fontFamily: 'monospace' }}>
              {hardwareId}
            </code>
            <button
              type="button"
              onClick={handleCopyHwId}
              style={{
                background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: copied ? '#10b981' : '#f8fafc',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
            </button>
          </div>
        </div>

        {/* Activation Form */}
        <form onSubmit={handleActivate} style={{ textAlign: 'left' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '8px' }}>
            Chave de Ativação / Serial Key:
          </label>

          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Cole aqui a sua licença (ex: KOS-SERIAL-XXXX ou Token JWT)"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 40px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          </div>

          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.83rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ShieldAlert size={16} /> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#6ee7b7',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.83rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Check size={16} /> {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={activating}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.95rem',
              cursor: activating ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              transition: 'all 0.2s'
            }}
          >
            {activating ? (
              <><RefreshCw size={18} className="spin" /> Validando Licença...</>
            ) : (
              <><KeyRound size={18} /> Ativar e Desbloquear KOS</>
            )}
          </button>
        </form>

        {/* WhatsApp Support Link */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <a
            href={waSupportUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#22c55e',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MessageCircle size={16} /> Falar com o Suporte / Regularizar Assinatura <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

export default LicenseBlockScreen;
