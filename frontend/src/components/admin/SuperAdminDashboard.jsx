import React, { useState, useEffect } from 'react';
import { Building, ShieldAlert, Plus, CheckCircle2, XCircle, Users, Palette, ExternalLink, RefreshCw, X, Lock, Unlock, KeyRound, UserCheck, Search, Trash2, Shield, User, Filter } from 'lucide-react';
import { CredentialModal } from './CredentialModal';

export function SuperAdminDashboard({ apiBaseUrl }) {
  const [activeAdminSubtab, setActiveAdminSubtab] = useState('tenants'); // 'tenants' | 'users'
  const [tenants, setTenants] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenantFilter, setSelectedTenantFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [credentialsModalData, setCredentialsModalData] = useState(null);

  // Tenant Form State
  const [editingTenantId, setEditingTenantId] = useState(null);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [maxUsers, setMaxUsers] = useState(5);
  const [status, setStatus] = useState('active');

  // Owner Account Fields
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/tenants`);
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = selectedTenantFilter !== 'all'
        ? `${apiBaseUrl}/api/admin/users?tenant_id=${selectedTenantFilter}`
        : `${apiBaseUrl}/api/admin/users`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
    fetchUsers();
  }, [apiBaseUrl, selectedTenantFilter]);

  const handleOpenModal = (tenant = null) => {
    if (tenant) {
      setEditingTenantId(tenant.id);
      setName(tenant.name || '');
      setLogoUrl(tenant.logo_url || '');
      setPrimaryColor(tenant.brand_colors?.primary || '#6366f1');
      setMaxUsers(tenant.max_users || 5);
      setStatus(tenant.status || 'active');
      setOwnerName('');
      setOwnerEmail('');
    } else {
      setEditingTenantId(null);
      setName('');
      setLogoUrl('');
      setPrimaryColor('#6366f1');
      setMaxUsers(5);
      setStatus('active');
      setOwnerName('');
      setOwnerEmail('');
    }
    setShowModal(true);
  };

  const handleToggleStatus = async (tenant) => {
    const newStatus = tenant.status === 'suspended' ? 'active' : 'suspended';
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/tenants/${tenant.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        fetchTenants();
      }
    } catch (err) {
      alert(`Erro ao alterar status da empresa: ${err.message}`);
    }
  };

  const handleDeleteTenant = async (tenant) => {
    if (!confirm(`Deseja realmente APAGAR PARA SEMPRE a empresa "${tenant.name}"? Todos os usuários e cartões vinculados serão removidos.`)) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/tenants/${tenant.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchTenants();
        fetchUsers();
      } else {
        const err = await res.json();
        alert(`Erro ao apagar empresa: ${err.error}`);
      }
    } catch (err) {
      alert(`Erro ao apagar empresa: ${err.message}`);
    }
  };

  const handleResetUserPassword = async (user) => {
    if (!confirm(`Gerar nova senha provisória para ${user.full_name || user.email}?`)) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          password: 'Kos123456!'
        })
      });

      if (res.ok) {
        const result = await res.json();
        setCredentialsModalData({
          email: result.credentials?.email || user.email,
          temporaryPassword: result.credentials?.temporaryPassword || 'Kos123456!'
        });
      } else {
        const err = await res.json();
        alert(`Erro ao redefinir senha: ${err.error}`);
      }
    } catch (err) {
      alert(`Erro ao redefinir senha: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTenantId,
          name,
          logo_url: logoUrl,
          max_users: maxUsers,
          status,
          brand_colors: { primary: primaryColor, sidebar: '#0f172a' },
          owner_name: ownerName,
          owner_email: ownerEmail
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.credentials?.email && data.credentials?.temporaryPassword) {
          setCredentialsModalData({
            email: data.credentials.email,
            temporaryPassword: data.credentials.temporaryPassword
          });
        }
        setShowModal(false);
        fetchTenants();
        fetchUsers();
      } else {
        const err = await res.json();
        alert(`Erro ao salvar empresa: ${err.error}`);
      }
    } catch (err) {
      alert(`Erro ao salvar empresa: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTenants = tenants.filter(t =>
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = usersList.filter(u =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = tenants.filter(t => t.status === 'active').length;
  const suspendedCount = tenants.filter(t => t.status === 'suspended').length;

  return (
    <div className="superadmin-container glass-card">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2><ShieldAlert size={26} className="accent-icon" /> Painel Geral do Dono (Gestão KOS Master)</h2>
          <p>Gerencie empresas parceiras, licenças de planos e contas de funcionários de todas as empresas.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn secondary" onClick={() => { fetchTenants(); fetchUsers(); }} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Atualizar Lista
          </button>

          <button className="btn primary" onClick={() => handleOpenModal(null)}>
            <Plus size={18} /> Cadastrar Nova Empresa & Dono
          </button>
        </div>
      </div>

      {/* Subtab Navigation: Empresas vs Usuários */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
        <button
          className={`btn ${activeAdminSubtab === 'tenants' ? 'primary' : 'secondary'}`}
          onClick={() => setActiveAdminSubtab('tenants')}
          style={{ fontSize: '0.88rem' }}
        >
          <Building size={16} /> 1. Empresas Parceiras ({tenants.length})
        </button>

        <button
          className={`btn ${activeAdminSubtab === 'users' ? 'primary' : 'secondary'}`}
          onClick={() => setActiveAdminSubtab('users')}
          style={{ fontSize: '0.88rem' }}
        >
          <Users size={16} /> 2. Usuários e Funcionários ({usersList.length})
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginTop: '16px' }}>
        <div className="search-box glass-subcard" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-control"
            placeholder={activeAdminSubtab === 'tenants' ? "Buscar empresa por nome ou ID..." : "Buscar usuário por nome ou e-mail..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent' }}
          />
        </div>

        {activeAdminSubtab === 'users' ? (
          <div className="glass-subcard" style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: 'var(--primary-accent)' }} />
            <select
              className="input-control"
              value={selectedTenantFilter}
              onChange={(e) => setSelectedTenantFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: '0.82rem', padding: '4px' }}
            >
              <option value="all" style={{ background: '#0f172a' }}>Todas as Empresas</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id} style={{ background: '#0f172a' }}>{t.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="glass-subcard" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', fontSize: '0.85rem' }}>
            <div><strong>Total:</strong> {tenants.length}</div>
            <div style={{ color: '#10b981' }}><strong>🟢 Ativas:</strong> {activeCount}</div>
            <div style={{ color: '#ef4444' }}><strong>🔴 Suspensas:</strong> {suspendedCount}</div>
          </div>
        )}
      </div>

      {/* Subtab 1: Tenants Accounts Table */}
      {activeAdminSubtab === 'tenants' && (
        <div className="tenants-table-container glass-subcard" style={{ marginTop: '16px', padding: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px' }}>Empresa Parceira</th>
                <th style={{ padding: '12px' }}>Cor Whitelabel</th>
                <th style={{ padding: '12px' }}>Limite de Licenças</th>
                <th style={{ padding: '12px' }}>Status da Conta</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px', fontWeight: '600' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Building size={18} style={{ color: 'var(--primary-accent)' }} />
                      <div>
                        <div>{t.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {t.id}</div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: t.brand_colors?.primary || '#6366f1', border: '1px solid #fff' }} />
                      <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{t.brand_colors?.primary || '#6366f1'}</span>
                    </div>
                  </td>

                  <td style={{ padding: '12px' }}>
                    <span style={{ fontWeight: '600' }}><Users size={14} /> Max {t.max_users || 5} ajudantes</span>
                  </td>

                  <td style={{ padding: '12px' }}>
                    <span className={`status-tag status-${t.status === 'active' ? 'success' : 'failed'}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: '700', padding: '4px 8px', borderRadius: '4px' }}>
                      {t.status === 'active' ? '🟢 Ativo' : '🔴 Suspenso'}
                    </span>
                  </td>

                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        onClick={() => handleOpenModal(t)}
                      >
                        Editar
                      </button>

                      <button
                        className={`btn ${t.status === 'suspended' ? 'primary' : 'secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        onClick={() => handleToggleStatus(t)}
                      >
                        {t.status === 'suspended' ? <><Unlock size={12} /> Desbloquear</> : <><Lock size={12} /> Suspender</>}
                      </button>

                      {t.id !== '00000000-0000-0000-0000-000000000001' && (
                        <button
                          className="btn danger"
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          onClick={() => handleDeleteTenant(t)}
                          title="Apagar empresa para sempre"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subtab 2: Users Management Table */}
      {activeAdminSubtab === 'users' && (
        <div className="users-table-container glass-subcard" style={{ marginTop: '16px', padding: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px' }}>Nome do Usuário</th>
                <th style={{ padding: '12px' }}>E-mail</th>
                <th style={{ padding: '12px' }}>Empresa Vinculada</th>
                <th style={{ padding: '12px' }}>Papel / Função</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Ações de Senha</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px', fontWeight: '600' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={16} style={{ color: 'var(--primary-accent)' }} />
                      {u.full_name || 'Usuário'}
                    </div>
                  </td>

                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{u.email}</td>

                  <td style={{ padding: '12px', fontWeight: '600', color: '#f8fafc' }}>
                    <Building size={14} style={{ display: 'inline', marginRight: '6px' }} />
                    {u.tenants?.name || u.tenant_id}
                  </td>

                  <td style={{ padding: '12px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: u.role === 'super_admin' ? 'rgba(245, 158, 11, 0.2)' : u.role === 'tenant_admin' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.08)',
                      color: u.role === 'super_admin' ? '#f59e0b' : u.role === 'tenant_admin' ? 'var(--primary-accent)' : 'var(--text-secondary)'
                    }}>
                      <Shield size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {u.role === 'super_admin' ? 'Dono Principal (KOS Master)' : u.role === 'tenant_admin' ? 'Gerente da Empresa' : 'Atendente'}
                    </span>
                  </td>

                  <td style={{ padding: '12px' }}>
                    <span style={{ fontSize: '0.75rem', color: u.is_active !== false ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                      {u.is_active !== false ? '🟢 Ativo' : '🔴 Inativo'}
                    </span>
                  </td>

                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <button
                      className="btn secondary"
                      style={{ fontSize: '0.75rem', padding: '6px 10px', gap: '6px' }}
                      onClick={() => handleResetUserPassword(u)}
                    >
                      <KeyRound size={14} style={{ color: '#f59e0b' }} /> Nova Senha Provisória
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Credenciais e Senha Provisória */}
      {credentialsModalData && (
        <CredentialModal
          credentials={credentialsModalData}
          onClose={() => setCredentialsModalData(null)}
        />
      )}

      {/* Modal: Criar / Editar Tenant */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '520px', position: 'relative' }}>
            <button className="btn-icon modal-close-btn" onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>

            <h3><Building size={22} className="accent-icon" /> {editingTenantId ? 'Editar Empresa Parceira' : 'Cadastrar Nova Empresa & Dono'}</h3>

            <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
              <div className="form-group">
                <label className="form-label">Nome da Empresa Parceira</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Ex: Clínica Saúde Total, Oficina do João"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {!editingTenantId && (
                <div className="glass-subcard" style={{ padding: '12px', marginBottom: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)' }}>
                  <label className="form-label" style={{ fontWeight: '700', color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UserCheck size={16} /> Conta do Dono da Empresa (Gerente):
                  </label>

                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label className="form-label">Nome Completo do Dono</label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Ex: Carlos Silva"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginTop: '8px' }}>
                    <label className="form-label">E-mail de Acesso do Dono</label>
                    <input
                      type="email"
                      className="input-control"
                      placeholder="carlos@empresa.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Link da Logo da Empresa (Opcional)</label>
                <input
                  type="url"
                  className="input-control"
                  placeholder="https://suaempresa.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>

              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Cor dos Botões da Empresa</label>
                  <input
                    type="color"
                    className="input-control"
                    style={{ height: '42px', padding: '4px', cursor: 'pointer' }}
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Limite de Licenças do Plano</label>
                  <input
                    type="number"
                    className="input-control"
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status Inicial da Conta</label>
                <select
                  className="input-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="active">🟢 Ativo (Acesso Liberado)</option>
                  <option value="suspended">🔴 Suspenso (Acesso Bloqueado)</option>
                  <option value="trial">🟡 Período de Testes (Trial)</option>
                </select>
              </div>

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>
                  Voltar sem salvar
                </button>
                <button type="submit" className="btn primary" disabled={submitting}>
                  {submitting ? 'Salvando...' : 'Salvar Empresa e Criar Dono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
