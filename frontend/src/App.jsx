import React, { useState, useEffect } from 'react';
import {
  Layers, MessageSquare, Bell, LayoutGrid, Sparkles, Building, QrCode, CheckCircle2,
  AlertCircle, X, HelpCircle, ShieldAlert, Users, Palette, Shield, LogOut, UserCheck,
  Columns, Maximize2, Split
} from 'lucide-react';
import { ServiceBuilder } from './components/ServiceBuilder';
import { LiveChatCentral } from './components/LiveChatCentral';
import { NotificationSettings } from './components/NotificationSettings';
import { KanbanBoard } from './components/KanbanBoard';
import { ProductTourAutoStart, startProductTour } from './components/onboarding/ProductTour';
import { OnboardingChecklist } from './components/onboarding/OnboardingChecklist';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard';
import { TeamManagement } from './components/admin/TeamManagement';
import { OperatorProfileSettings } from './components/admin/OperatorProfileSettings';
import { LgpdTermsModal } from './components/common/LgpdTermsModal';
import { OfflineBanner } from './components/common/OfflineBanner';
import { InstallPwaButton } from './components/common/InstallPwaButton';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

function AppContent() {
  const { user, profile, logout } = useAuth();
  const userRole = profile?.role || 'tenant_operator';
  const isSuperAdmin = userRole === 'super_admin';

  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'super_admin' : 'workspace');
  const [workspaceMode, setWorkspaceMode] = useState('split'); // 'split', 'kanban_full', 'chat_full'
  const [tenantId, setTenantId] = useState(profile?.tenant_id || '00000000-0000-0000-0000-000000000001');

  const [showQrModal, setShowQrModal] = useState(false);
  const [showLgpdModal, setShowLgpdModal] = useState(false);
  const [waStatus, setWaStatus] = useState({ connected: false, qrCode: null, status: 'checking' });
  const [serviceCount, setServiceCount] = useState(0);
  const [cardsCount, setCardsCount] = useState(0);

  const { tenantName, tenantLogo } = useTheme();
  const getSanitizedApiUrl = () => {
    const rawUrl = import.meta.env.VITE_API_URL || 'https://kos-backend-tuqi.onrender.com';
    if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1'))) {
      return 'https://kos-backend-tuqi.onrender.com';
    }
    return rawUrl;
  };
  const API_BASE_URL = getSanitizedApiUrl();

  useEffect(() => {
    if (isSuperAdmin) {
      setActiveTab('super_admin');
    }
  }, [userRole]);

  useEffect(() => {
    if (profile?.tenant_id) {
      setTenantId(profile.tenant_id);
    }
  }, [profile]);

  const getRoleLabel = (role) => {
    if (role === 'super_admin') return 'Dono Principal (KOS Master)';
    if (role === 'tenant_admin') return 'Gerente da Empresa';
    return 'Atendente';
  };

  const checkWaStatus = async (init = false) => {
    const activeTenant = tenantId || profile?.tenant_id || '00000000-0000-0000-0000-000000000001';
    try {
      const initParam = init || showQrModal ? '&init=true' : '';
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/status?tenant_id=${activeTenant}${initParam}`);
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data);
      }
    } catch (err) {
      setWaStatus({ connected: false, qrCode: null, status: 'offline' });
    }
  };

  const fetchStats = async () => {
    if (!tenantId) return;
    try {
      const sRes = await fetch(`${API_BASE_URL}/api/services?tenant_id=${tenantId}`);
      if (sRes.ok) {
        const sData = await sRes.json();
        setServiceCount(sData.length);
      }

      const cRes = await fetch(`${API_BASE_URL}/api/cards?tenant_id=${tenantId}`);
      if (cRes.ok) {
        const cData = await cRes.json();
        setCardsCount(cData.length);
      }
    } catch (err) {}
  };

  // Polling effect for WhatsApp status & stats
  useEffect(() => {
    fetchStats();
    checkWaStatus();

    const interval = setInterval(() => {
      checkWaStatus(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [tenantId]);

  // Effect for QR code modal open
  useEffect(() => {
    if (showQrModal) {
      checkWaStatus(true);
    }
  }, [showQrModal]);

  const handleNavigateFromChecklist = (target) => {
    if (target === 'whatsapp') {
      setShowQrModal(true);
      checkWaStatus(true);
    } else if (target === 'services') {
      setActiveTab('services');
    } else if (target === 'kanban') {
      setActiveTab('workspace');
      setWorkspaceMode('kanban_full');
    }
  };

  const handleDisconnectWa = async () => {
    if (!confirm('Deseja realmente desligar o WhatsApp deste sistema?')) return;
    try {
      const activeTenant = tenantId || profile?.tenant_id || '00000000-0000-0000-0000-000000000001';
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: activeTenant })
      });
      if (res.ok) {
        setWaStatus({ connected: false, qrCode: null, status: 'disconnected' });
        setShowQrModal(false);
      }
    } catch (err) {
      alert(`Erro ao desligar: ${err.message}`);
    }
  };

  return (
    <div className="app-shell">
      <OfflineBanner />
      <ProductTourAutoStart accountKey={tenantId || user?.id || 'default'} />

      {!isSuperAdmin && (
        <OnboardingChecklist
          accountKey={tenantId || user?.id || 'default'}
          onNavigateTab={handleNavigateFromChecklist}
          whatsappConnected={waStatus.connected}
          serviceCount={serviceCount}
          cardsCount={cardsCount}
        />
      )}

      {/* Top Navbar with Dynamic Tenant Whitelabel Brand */}
      <header className="navbar glass-nav">
        <div className="nav-brand">
          {tenantLogo ? (
            <img src={tenantLogo} alt="Logo da Empresa" style={{ height: '34px', borderRadius: '6px' }} />
          ) : (
            <Sparkles className="logo-icon" size={28} />
          )}
          <span className="brand-name">{tenantName}</span>
          <span className="tenant-badge"><Building size={12} /> {getRoleLabel(userRole)}</span>
        </div>

        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <InstallPwaButton />

          {/* User Profile Badge & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: '10px' }}>
            <UserCheck size={18} style={{ color: 'var(--primary-accent)' }} />
            <div style={{ fontSize: '0.82rem', lineHeight: '1.2' }}>
              <div style={{ fontWeight: '700' }}>{profile?.full_name || user?.email || 'Usuário'}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{getRoleLabel(userRole)}</div>
            </div>
            <button
              className="btn-icon"
              title="Sair do Sistema"
              onClick={logout}
              style={{ marginLeft: '6px', color: '#ef4444' }}
            >
              <LogOut size={16} />
            </button>
          </div>

          {!isSuperAdmin && (
            <button
              type="button"
              className="btn secondary"
              onClick={startProductTour}
              style={{ fontSize: '0.82rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <HelpCircle size={16} /> Como Usar o Sistema
            </button>
          )}

          {!isSuperAdmin && (
            (userRole === 'tenant_admin') ? (
              <button
                className={`btn-status ${waStatus.connected ? 'status-connected' : 'status-disconnected'}`}
                onClick={() => {
                  setShowQrModal(true);
                  checkWaStatus(true);
                }}
                title="Configurar conexão do WhatsApp da Empresa"
              >
                {waStatus.connected ? <CheckCircle2 size={16} /> : <QrCode size={16} />}
                <span>{waStatus.connected ? 'WhatsApp Funcionando' : 'Conectar WhatsApp'}</span>
              </button>
            ) : (
              <div
                className={`btn-status ${waStatus.connected ? 'status-connected' : 'status-disconnected'}`}
                style={{ cursor: 'default', opacity: 0.9 }}
                title="Conexão do WhatsApp gerenciada exclusivamente pelo Dono da Empresa"
              >
                {waStatus.connected ? <CheckCircle2 size={16} /> : <QrCode size={16} />}
                <span>{waStatus.connected ? 'WhatsApp da Empresa Ativo' : 'WhatsApp Desconectado (Fale com o Dono)'}</span>
              </div>
            )
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="main-wrapper">
        {/* Strict Role-Based Navigation Bar */}
        <nav className="tab-bar">
          {/* Super Admin ONLY sees Master Administration */}
          {isSuperAdmin ? (
            <>
              <button
                className={`tab-btn ${activeTab === 'super_admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('super_admin')}
                style={{ color: '#f59e0b', fontWeight: '800' }}
              >
                <ShieldAlert size={18} /> Painel Geral do Dono (Gestão de Empresas)
              </button>

              <button
                className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <Palette size={18} /> Cores e Letras
              </button>
            </>
          ) : (
            /* Tenant Admin & Operators see Integrated Operational Tabs */
            <>
              <button
                id="tour-kanban-board"
                className={`tab-btn ${activeTab === 'workspace' ? 'active' : ''}`}
                onClick={() => setActiveTab('workspace')}
                style={{ fontWeight: '800' }}
              >
                <Split size={18} /> Central One-Screen (Lado a Lado)
              </button>

              {userRole === 'tenant_admin' && (
                <button
                  className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
                  onClick={() => setActiveTab('services')}
                >
                  <Layers size={18} /> Serviços
                </button>
              )}

              {userRole === 'tenant_admin' && (
                <button
                  className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
                  onClick={() => setActiveTab('notifications')}
                >
                  <Bell size={18} /> Lembretes e Avisos
                </button>
              )}

              {userRole === 'tenant_admin' && (
                <button
                  className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
                  onClick={() => setActiveTab('team')}
                >
                  <Users size={18} /> Nossa Equipe
                </button>
              )}

              <button
                className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <Palette size={18} /> ⚙️ Mudar Cores e Senha
              </button>
            </>
          )}
        </nav>

        {/* View Content */}
        <section className="content-area">
          {isSuperAdmin ? (
            <>
              {activeTab === 'super_admin' && (
                <ProtectedRoute allowedRoles={['super_admin']} apiBaseUrl={API_BASE_URL}>
                  <SuperAdminDashboard apiBaseUrl={API_BASE_URL} />
                </ProtectedRoute>
              )}

              {activeTab === 'profile' && (
                <OperatorProfileSettings />
              )}
            </>
          ) : (
            <>
              {/* UNIFIED ONE-SCREEN WORKSPACE (SPLIT-SCREEN VIEW) */}
              {activeTab === 'workspace' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Mode Selector Sub-header */}
                  <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Split size={20} className="accent-icon" />
                      <h3 style={{ fontSize: '0.98rem', margin: 0, fontWeight: '800' }}>Central Integrada One-Screen</h3>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>— Kanban e Chat do WhatsApp operando juntos na mesma tela</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className={`btn ${workspaceMode === 'split' ? 'primary' : 'secondary'}`}
                        onClick={() => setWorkspaceMode('split')}
                        style={{ fontSize: '0.78rem', padding: '6px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Split size={14} /> 📊 Lado a Lado (50/50)
                      </button>

                      <button
                        type="button"
                        className={`btn ${workspaceMode === 'kanban_full' ? 'primary' : 'secondary'}`}
                        onClick={() => setWorkspaceMode('kanban_full')}
                        style={{ fontSize: '0.78rem', padding: '6px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <LayoutGrid size={14} /> 📌 Apenas Kanban
                      </button>

                      <button
                        type="button"
                        className={`btn ${workspaceMode === 'chat_full' ? 'primary' : 'secondary'}`}
                        onClick={() => setWorkspaceMode('chat_full')}
                        style={{ fontSize: '0.78rem', padding: '6px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <MessageSquare size={14} /> 💬 Apenas Conversas
                      </button>
                    </div>
                  </div>

                  {/* The Split Container */}
                  <div className={`one-screen-workspace mode-${workspaceMode}`}>
                    <div className="one-screen-kanban-col">
                      <KanbanBoard tenantId={tenantId} apiBaseUrl={API_BASE_URL} />
                    </div>

                    <div className="one-screen-chat-col">
                      <LiveChatCentral tenantId={tenantId} apiBaseUrl={API_BASE_URL} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'services' && (
                <ServiceBuilder tenantId={tenantId} apiBaseUrl={API_BASE_URL} />
              )}

              {activeTab === 'notifications' && (
                <NotificationSettings tenantId={tenantId} apiBaseUrl={API_BASE_URL} />
              )}

              {activeTab === 'team' && (
                <ProtectedRoute allowedRoles={['tenant_admin', 'super_admin']} apiBaseUrl={API_BASE_URL}>
                  <TeamManagement tenantId={tenantId} apiBaseUrl={API_BASE_URL} />
                </ProtectedRoute>
              )}

              {activeTab === 'profile' && (
                <OperatorProfileSettings />
              )}
            </>
          )}
        </section>
      </main>

      {/* WhatsApp QR Code & Disconnect Control Modal */}
      {showQrModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '440px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <QrCode size={24} className="accent-icon" /> Conexão do WhatsApp
              </h3>
              <button className="btn-icon" onClick={() => setShowQrModal(false)}>
                <X size={20} />
              </button>
            </div>

            {waStatus.connected ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle2 size={64} style={{ color: '#10b981', margin: '0 auto 16px' }} />
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>WhatsApp Conectado e Ativo! 🎉</h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
                  Sua empresa já está pronta para enviar avisos automáticos e interagir com clientes no Kanban.
                </p>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button className="btn secondary" onClick={() => setShowQrModal(false)}>
                    Fechar
                  </button>
                  <button className="btn danger" onClick={handleDisconnectWa}>
                    Desconectar WhatsApp
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Abra o WhatsApp no seu celular, acesse <strong>Aparelhos Conectados</strong> e aponte a câmera para a imagem abaixo:
                </p>

                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '16px', display: 'inline-block', marginBottom: '20px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-md)' }}>
                  {waStatus.qrCodeImage ? (
                    <img src={waStatus.qrCodeImage} alt="QR Code WhatsApp" style={{ width: '220px', height: '220px', display: 'block' }} />
                  ) : (
                    <div style={{ width: '220px', height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <QrCode size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                      <span style={{ fontSize: '0.85rem' }}>Gerando QR Code...</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <button className="btn secondary" onClick={() => checkWaStatus(true)}>
                    <RefreshCw size={16} /> Atualizar QR Code
                  </button>
                  <button className="btn secondary" onClick={() => setShowQrModal(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LGPD Terms Modal */}
      {showLgpdModal && (
        <LgpdTermsModal onClose={() => setShowLgpdModal(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
