import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, User, RefreshCw, X, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

export function TeamManagement({ tenantId, apiBaseUrl }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [maxUsers, setMaxUsers] = useState(5);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('tenant_operator');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [createdUserNotice, setCreatedUserNotice] = useState(null);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/team?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
      }
    } catch (err) {
      console.error('Error fetching team:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) fetchTeam();
  }, [tenantId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          full_name: fullName,
          email,
          role
        })
      });

      if (res.ok) {
        const result = await res.json();
        setCreatedUserNotice(result);
        setShowModal(false);
        setFullName('');
        setEmail('');
        fetchTeam();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Erro ao cadastrar funcionário');
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="team-container glass-card">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2><Users size={26} className="accent-icon" /> Meus Ajudantes & Atendentes</h2>
          <p>Cadastre e gerencie os funcionários e atendentes da sua empresa com controle simples de acesso.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn secondary" onClick={fetchTeam} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Atualizar Lista
          </button>

          <button className="btn primary" onClick={() => setShowModal(true)}>
            <UserPlus size={18} /> Cadastrar Novo Ajudante
          </button>
        </div>
      </div>

      {/* Provisional Password Banner Notice */}
      {createdUserNotice && (
        <div className="glass-subcard" style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h4 style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <CheckCircle2 size={18} /> Novo Usuário Cadastrado e Liberado Instantaneamente!
              </h4>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <strong>Usuário:</strong> {createdUserNotice.full_name} ({createdUserNotice.email})
              </p>
              <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                <KeyRound size={16} style={{ color: '#f59e0b' }} />
                <span>Senha Provisória para Primeiro Acesso: <strong style={{ color: '#f8fafc', letterSpacing: '1px', fontFamily: 'monospace' }}>{createdUserNotice.provisional_password || 'Kos123456!'}</strong></span>
              </div>
            </div>
            <button className="btn-icon" onClick={() => setCreatedUserNotice(null)}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Usage Quota Progress Bar */}
      <div className="quota-bar glass-subcard" style={{ marginTop: '20px', padding: '14px 18px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
          <span>Uso de Licenças do Plano:</span>
          <strong>{team.length} de {maxUsers} Usuários Cadastrados</strong>
        </div>
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min((team.length / maxUsers) * 100, 100)}%`,
              background: team.length >= maxUsers ? '#ef4444' : 'var(--primary-accent)',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
      </div>

      {/* Team Table */}
      <div className="team-table-container glass-subcard" style={{ marginTop: '16px', padding: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px' }}>Nome do Funcionário</th>
              <th style={{ padding: '12px' }}>E-mail</th>
              <th style={{ padding: '12px' }}>Função</th>
              <th style={{ padding: '12px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {team.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px', fontWeight: '600' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={16} style={{ color: 'var(--primary-accent)' }} />
                    {u.full_name || 'Atendente'}
                  </div>
                </td>
                <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{u.email || 'atendente@empresa.com'}</td>
                <td style={{ padding: '12px' }}>
                  <span className={`role-badge role-${u.role}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: '600', padding: '4px 8px', borderRadius: '6px', background: u.role === 'tenant_admin' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.08)' }}>
                    <Shield size={12} /> {u.role === 'tenant_admin' ? 'Gerente da Empresa' : 'Atendente'}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>🟢 Ativo</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Novo Atendente */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '480px', position: 'relative' }}>
            <button className="btn-icon modal-close-btn" onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>

            <h3><UserPlus size={22} className="accent-icon" /> Cadastrar Novo Ajudante / Atendente</h3>

            {errorMessage && (
              <div className="alert-banner error" style={{ marginTop: '12px', fontSize: '0.85rem' }}>
                <AlertCircle size={16} /> {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Nome Completo</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Ex: Ana Souza"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">E-mail de Acesso</label>
                <input
                  type="email"
                  className="input-control"
                  placeholder="ana@suaempresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Função / Permissão</label>
                <select
                  className="input-control"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="tenant_operator">Atendente (Acesso à fila e conversas)</option>
                  <option value="tenant_admin">Gerente da Empresa (Acesso a tudo)</option>
                </select>
              </div>

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>
                  Voltar sem salvar
                </button>
                <button type="submit" className="btn primary" disabled={submitting}>
                  {submitting ? 'Cadastrando...' : 'Cadastrar Ajudante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
