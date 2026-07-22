import React, { useState, useEffect } from 'react';
import { Layers, MessageSquare, Bell, LayoutGrid, Sparkles, Building, QrCode, CheckCircle2, AlertCircle, X, HelpCircle, ShieldAlert, Users, Palette, Shield, LogOut, UserCheck } from 'lucide-react';
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

  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'super_admin' : 'kanban');
  const [tenantId, setTenantId] = useState(profile?.tenant_id || '00000000-0000-0000-0000-000000000001');

  const [showQrModal, setShowQrModal] = useState(false);
  const [showLgpdModal, setShowLgpdModal] = useState(false);
  const [waStatus, setWaStatus] = useState({ connected: false, qrCode: null, status: 'checking' });
  const [serviceCount, setServiceCount] = useState(0);
  const [cardsCount, setCardsCount] = useState(0);

  const { tenantName, tenantLogo } = useTheme();
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://kos-backend-tuqi.onrender.com';

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

  useEffect(() => {
    fetchStats();
    let interval;
    if (showQrModal && !waStatus.connected) {
      checkWaStatus(true);
      interval = setInterval(() => checkWaStatus(true), 3000);
    } else {
      checkWaStatus();
      interval = setInterval(() => checkWaStatus(), 5000);
    }
    return () => clearInterval(interval);
  }, [showQrModal, waStatus.connected, tenantId]);

  const handleNavigateFromChecklist = (target) => {
    if (target === 'whatsapp') {
      setShowQrModal(true);
      checkWaStatus(true);
    } else if (target === 'services') {
      setActiveTab('services');
    } else if (target === 'kanban') {
      setActiveTab('kanban');
    }
  };

  const handleDisconnectWa = async () => {
    if (!confirm('Deseja realmente desligar o WhatsApp deste sistema?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/disconnect?tenant_id=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
      });
      if (res.ok) {
        checkWaStatus();
      }
    } catch (err) {
      alert(`Erro ao desligar: ${err.message}`);
    }
  };

  return (
    <div className="app-shell">
      <OfflineBanner />
      <ProductTourAutoStart />

      {!isSuperAdmin && (
        <OnboardingChecklist
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
            <button
              className={`btn-status ${waStatus.connected ? 'status-connected' : 'status-disconnected'}`}
              onClick={() => {
                setShowQrModal(true);
                checkWaStatus(true);
              }}
            >
              {waStatus.connected ? <CheckCircle2 size={16} /> : <QrCode size={16} />}
              <span>{waStatus.connected ? 'WhatsApp Funcionando' : 'Conectar WhatsApp'}</span>
            </button>
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
            /* Tenant Admin & Operators see Operational Tabs */
            <>
              <button
                id="tour-kanban-board"
                className={`tab-btn ${activeTab === 'kanban' ? 'active' : ''}`}
                onClick={() => setActiveTab('kanban')}
              >
                <LayoutGrid size={18} /> 1. Fila de Atendimentos
              </button>

              <button
                className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                <MessageSquare size={18} /> 2. Conversas
              </button>

              {userRole === 'tenant_admin' && (
                <button
                  className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
                  onClick={() => setActiveTab('services')}
                >
                  <Layers size={18} /> 3. Criar Serviços
                </button>
              )}

              {userRole === 'tenant_admin' && (
                <button
                  className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
                  onClick={() => setActiveTab('notifications')}
                >
                  <Bell size={18} /> 4. Mensagens Automáticas
                </button>
              )}

              {userRole === 'tenant_admin' && (
                <button
                  className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
                  onClick={() => setActiveTab('team')}
                >
                  <Users size={18} /> 5. Meus Ajudantes
                </button>
              )}

              <button
                className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <Palette size={18} /> Cores e Letras
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
              {activeTab === 'kanban' && (
                <KanbanBoard tenantId={tenantId} apiBaseUrl={API_BASE_URL} />
              )}

              {activeTab === 'chat' && (
                <LiveChatCentral tenantId={tenantId} apiBaseUrl={API_BASE_URL} />
              )}

              {activeTab === 'services' && (
                <ProtectedRoute allowedRoles={['tenant_admin']} apiBaseUrl={API_BASE_URL}>
                  <ServiceBuilder tenantId={tenantId} apiBaseUrl={API_BASE_URL} />
                </ProtectedRoute>
              )}

              {activeTab === 'notifications' && (
                <ProtectedRoute allowedRoles={['tenant_admin']} apiBaseUrl={API_BASE_URL}>
                  <NotificationSettings tenantId={tenantId} apiBaseUrl={API_BASE_URL} />
                </ProtectedRoute>
              )}

              {activeTab === 'team' && (
                <ProtectedRoute allowedRoles={['tenant_admin']} apiBaseUrl={API_BASE_URL}>
                  <TeamManagement tenantId={tenantId} apiBaseUrl={API_BASE_URL} />
                </ProtectedRoute>
              )}

              {activeTab === 'profile' && (
                <OperatorProfileSettings />
              )}
            </>
          )}
        </section>

        {/* Plain Language Footer */}
        <footer style={{ textAlign: 'center', padding: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-glass)' }}>
          <span>Sistema Fácil de Atendimento © 2026. Todos os seus dados estão seguros. </span>
          <button
            type="button"
            onClick={() => setShowLgpdModal(true)}
            style={{ background: 'none', border: 'none', color: 'var(--primary-accent)', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontWeight: '600' }}
          >
            🔒 Proteção dos Seus Dados e Privacidade
          </button>
        </footer>
      </main>

      {/* LGPD Modal */}
      {showLgpdModal && (
        <LgpdTermsModal onClose={() => setShowLgpdModal(false)} />
      )}

      {/* WhatsApp Connection Modal */}
      {showQrModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ textAlign: 'center', position: 'relative' }}>
            <button className="btn-icon modal-close-btn" onClick={() => setShowQrModal(false)}>
              <X size={20} />
            </button>

            <h3><QrCode size={24} className="accent-icon" /> Conectar seu WhatsApp ao Sistema</h3>
            <p style={{ margin: '12px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {waStatus.connected
                ? 'Seu WhatsApp já está conectado e enviando mensagens sozinho!'
                : 'Abra o aplicativo do WhatsApp no seu celular > Toque nos 3 pontinhos (ou Configurações) > Aparelhos Conectados > E aponte a câmera para a imagem abaixo:'}
            </p>

            {waStatus.connected ? (
              <div className="qr-connected-box">
                <CheckCircle2 size={64} style={{ color: 'var(--secondary-accent)', margin: '16px auto' }} />
                <h4>WhatsApp Prontinho e Conectado!</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Aparelho Ativo no Sistema
                </p>
              </div>
            ) : waStatus.qrCode ? (
              <div className="qr-code-box" style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block', margin: '16px 0' }}>
                <img src={waStatus.qrCode} alt="Código para conectar WhatsApp" style={{ width: '220px', height: '220px' }} />
              </div>
            ) : (
              <div className="qr-loading-box" style={{ padding: '32px 0' }}>
                <AlertCircle size={40} style={{ color: 'var(--primary-accent)', margin: '0 auto 12px' }} />
                <p>Aguarde um momentinho... Gerando a imagem de conexão.</p>
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn secondary" onClick={() => setShowQrModal(false)}>Voltar sem salvar</button>
              {waStatus.connected && (
                <button className="btn danger" onClick={handleDisconnectWa}>
                  🔴 Desligar WhatsApp deste Sistema
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://kos-backend-tuqi.onrender.com';

  return (
    <AuthProvider apiBaseUrl={API_BASE_URL}>
      <ThemeProvider apiBaseUrl={API_BASE_URL} tenantId="00000000-0000-0000-0000-000000000001" userRole="super_admin">
        <ProtectedRoute apiBaseUrl={API_BASE_URL}>
          <AppContent />
        </ProtectedRoute>
      </ThemeProvider>
    </AuthProvider>
  );
}
