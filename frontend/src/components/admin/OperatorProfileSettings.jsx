import React, { useState } from 'react';
import { Palette, Moon, Sun, Monitor, CheckCircle2, User, LayoutGrid, KeyRound, Check, AlertCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabaseClient';

export function OperatorProfileSettings() {
  const { themeMode, accentColor, kanbanDensity, updatePreferences, tenantName } = useTheme();

  const [newPassword, setNewPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  const colorPalettes = [
    { name: 'Azul Real', hex: '#6366f1' },
    { name: 'Verde Esmeralda', hex: '#10b981' },
    { name: 'Rosa Vivo', hex: '#ec4899' },
    { name: 'Laranja Amarelado', hex: '#f59e0b' },
    { name: 'Azul Claro', hex: '#06b6d4' },
    { name: 'Roxo Violeta', hex: '#8b5cf6' }
  ];

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim() || newPassword.length < 6) {
      setPasswordError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setSubmittingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPasswordSuccess(true);
      setNewPassword('');
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err) {
      setPasswordError(err.message || 'Erro ao alterar senha. Tente novamente.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <div className="profile-settings-container glass-card" style={{ maxWidth: '640px' }}>
      <div className="section-header">
        <h2><Palette size={26} className="accent-icon" /> Mudar Cores e Minha Senha de Acesso</h2>
        <p>Escolha as cores que você acha mais bonitas e altere sua senha de acesso ({tenantName}).</p>
      </div>

      {/* Trocar Senha */}
      <div className="form-group glass-subcard" style={{ padding: '20px', marginTop: '20px' }}>
        <label className="form-label" style={{ fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={20} style={{ color: '#f59e0b' }} /> Trocar Minha Senha de Acesso:
        </label>

        {passwordSuccess && (
          <div className="alert-banner success" style={{ marginTop: '10px', fontSize: '0.85rem' }}>
            <CheckCircle2 size={16} /> Sua nova senha foi salva com sucesso!
          </div>
        )}

        {passwordError && (
          <div className="alert-banner error" style={{ marginTop: '10px', fontSize: '0.85rem' }}>
            <AlertCircle size={16} /> {passwordError}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <input
            type="password"
            className="input-control"
            placeholder="Digite sua nova senha aqui..."
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            style={{ padding: '10px 14px' }}
          />

          <button
            type="submit"
            className="btn primary"
            disabled={submittingPassword}
            style={{ whiteSpace: 'nowrap', padding: '10px 16px' }}
          >
            {submittingPassword ? 'Salvando...' : 'Salvar Nova Senha'}
          </button>
        </form>
      </div>

      {/* Fundo da Tela */}
      <div className="form-group glass-subcard" style={{ padding: '20px', marginTop: '20px' }}>
        <label className="form-label" style={{ fontWeight: '700', fontSize: '0.95rem' }}>
          Cor do Fundo da Tela:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
          <button
            type="button"
            className={`btn ${themeMode === 'dark' ? 'primary' : 'secondary'}`}
            onClick={() => updatePreferences({ theme_mode: 'dark' })}
            style={{ padding: '12px', justifyContent: 'center', gap: '8px', fontSize: '0.85rem' }}
          >
            <Moon size={18} /> Tela Escura (Para não cansar a vista)
          </button>

          <button
            type="button"
            className={`btn ${themeMode === 'light' ? 'primary' : 'secondary'}`}
            onClick={() => updatePreferences({ theme_mode: 'light' })}
            style={{ padding: '12px', justifyContent: 'center', gap: '8px', fontSize: '0.85rem' }}
          >
            <Sun size={18} /> Tela Clara (Dia)
          </button>

          <button
            type="button"
            className={`btn ${themeMode === 'system' ? 'primary' : 'secondary'}`}
            onClick={() => updatePreferences({ theme_mode: 'system' })}
            style={{ padding: '12px', justifyContent: 'center', gap: '8px', fontSize: '0.85rem' }}
          >
            <Monitor size={18} /> Igual ao Celular
          </button>
        </div>
      </div>

      {/* Personalização do Gradiente RGB do Fundo da Tela */}
      <div className="form-group glass-subcard" style={{ padding: '20px', marginTop: '20px' }}>
        <label className="form-label" style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={18} style={{ color: 'var(--primary-accent)' }} /> Gradiente RGB do Fundo da Sua Tela:
        </label>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Personalize as cores do gradiente RGB que flui ao fundo da sua tela. Cada usuário (dono ou funcionário) pode definir o seu estilo visual exclusivo!
        </p>

        {/* Preset Gradients */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
          {[
            { name: '🌌 Aurora Neon', c1: '#6366f1', c2: '#10b981' },
            { name: '🌊 Oceano Profundo', c1: '#06b6d4', c2: '#3b82f6' },
            { name: '🔥 Pôr do Sol Mágico', c1: '#f59e0b', c2: '#ec4899' },
            { name: '💜 Cyberpunk Violeta', c1: '#8b5cf6', c2: '#22d3ee' }
          ].map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="btn secondary"
              onClick={() => updatePreferences({ rgb_color1: preset.c1, rgb_color2: preset.c2, accent_color: preset.c1 })}
              style={{
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                padding: '10px 14px',
                fontSize: '0.82rem',
                border: '1px solid var(--border-light)',
                borderRadius: '10px'
              }}
            >
              <span>{preset.name}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: preset.c1 }} />
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: preset.c2 }} />
              </div>
            </button>
          ))}
        </div>

        {/* Custom RGB Color Pickers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-card)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Tom RGB Principal 1:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="color"
                value={accentColor || '#6366f1'}
                onChange={(e) => updatePreferences({ rgb_color1: e.target.value, accent_color: e.target.value })}
                style={{ width: '36px', height: '36px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
              />
              <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{accentColor || '#6366f1'}</span>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Tom RGB Secundário 2:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="color"
                value={rgbColor2 || '#10b981'}
                onChange={(e) => updatePreferences({ rgb_color2: e.target.value })}
                style={{ width: '36px', height: '36px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
              />
              <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{rgbColor2 || '#10b981'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cor dos Botões */}
      <div className="form-group glass-subcard" style={{ padding: '20px', marginTop: '20px' }}>
        <label className="form-label" style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '12px' }}>
          Escolha sua Cor Favorita para os Botões:
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {colorPalettes.map((c) => (
            <div
              key={c.hex}
              onClick={() => updatePreferences({ accent_color: c.hex, rgb_color1: c.hex })}
              style={{
                background: 'var(--bg-card)',
                border: accentColor === c.hex ? `2px solid ${c.hex}` : '1px solid var(--border-light)',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: c.hex }} />
              <span style={{ fontSize: '0.85rem', fontWeight: accentColor === c.hex ? '700' : '500' }}>{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Densidade */}
      <div className="form-group glass-subcard" style={{ padding: '20px', marginTop: '20px' }}>
        <label className="form-label" style={{ fontWeight: '700', fontSize: '0.95rem' }}>
          Tamanho das Cartelas de Pedido:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
          <button
            type="button"
            className={`btn ${kanbanDensity === 'comfortable' ? 'primary' : 'secondary'}`}
            onClick={() => updatePreferences({ kanban_density: 'comfortable' })}
            style={{ padding: '12px', justifyContent: 'center', gap: '8px', fontSize: '0.85rem' }}
          >
            <LayoutGrid size={18} /> Tamanho Normal (Fácil de ler)
          </button>

          <button
            type="button"
            className={`btn ${kanbanDensity === 'compact' ? 'primary' : 'secondary'}`}
            onClick={() => updatePreferences({ kanban_density: 'compact' })}
            style={{ padding: '12px', justifyContent: 'center', gap: '8px', fontSize: '0.85rem' }}
          >
            <LayoutGrid size={14} /> Tamanho Pequeno (Cabe mais coisas)
          </button>
        </div>
      </div>
    </div>
  );
}
