import React from 'react';
import { ShieldCheck, X, FileText, Lock } from 'lucide-react';

export function LgpdTermsModal({ onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxWidth: '640px', position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="btn-icon modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-title-group">
          <h3><ShieldCheck size={24} style={{ color: 'var(--secondary-accent)' }} /> Política de Privacidade & Conformidade LGPD</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Transparência e proteção no tratamento de dados pessoais (Lei nº 13.709/2018)
          </p>
        </div>

        <div className="terms-body" style={{ fontSize: '0.88rem', lineHeight: '1.6', marginTop: '20px', color: '#cbd5e1' }}>
          <h4 style={{ color: '#f8fafc', marginBottom: '6px' }}>1. Coleta e Finalidade do Tratamento</h4>
          <p>
            Nossa plataforma SaaS Multi-Tenant processa informações pessoais (como Nome, Telefone e histórico de atendimentos) exclusivamente para viabilizar a prestação dos serviços contratados, agendamentos, confirmações de ordens de serviço e envio de notificações automáticas via WhatsApp.
          </p>

          <h4 style={{ color: '#f8fafc', margin: '16px 0 6px' }}>2. Direitos do Titular dos Dados (LGPD Art. 18)</h4>
          <p>
            Em conformidade com a LGPD, os titulares dos dados têm o direito de confirmar a existência de tratamento, acessar seus dados, solicitar a correção de dados incompletos ou a anonimização/exclusão de suas informações.
          </p>

          <h4 style={{ color: '#f8fafc', margin: '16px 0 6px' }}>3. Controle de Opt-Out e Consentimento no WhatsApp</h4>
          <p>
            A qualquer momento, o titular pode revogar seu consentimento para envio de notificações automáticas via WhatsApp enviando uma das palavras-chave de cancelamento (como <strong>"PARAR"</strong>, <strong>"SAIR"</strong> ou <strong>"CANCELAR"</strong>). O sistema interromperá imediatamente todos os envios futuros.
          </p>

          <h4 style={{ color: '#f8fafc', margin: '16px 0 6px' }}>4. Segurança e Isolamento Multi-Tenant</h4>
          <p>
            Todos os dados são protegidos por criptografia em trânsito (TLS/HTTPS) e isolados por políticas de segurança a nível de linha (Supabase Row Level Security - RLS), garantindo que nenhuma informação seja acessada por outras empresas ou terceiros não autorizados.
          </p>
        </div>

        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button className="btn primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
            Compreendo e Concordo
          </button>
        </div>
      </div>
    </div>
  );
}
