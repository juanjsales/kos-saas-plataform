import React, { useState, useEffect } from 'react';
import { Bell, Save, Power, CheckCircle, Info, Eye, ChevronDown, ChevronUp, FileText, Scan, Calendar, CreditCard, Sparkles, Layers, MessageSquare, X } from 'lucide-react';
import { ServiceConfirmationModal } from './ServiceConfirmationModal';

export function NotificationSettings({ tenantId, apiBaseUrl }) {
  const [services, setServices] = useState([]);
  const [rules, setRules] = useState([]);
  const [expandedServiceId, setExpandedServiceId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);
  const [activeWaPreview, setActiveWaPreview] = useState(null); // { title, templateText, serviceTitle }

  const fetchServicesAndRules = async () => {
    try {
      const [resServices, resRules] = await Promise.all([
        fetch(`${apiBaseUrl}/api/services?tenant_id=${tenantId}`),
        fetch(`${apiBaseUrl}/api/notifications?tenant_id=${tenantId}`)
      ]);

      if (resServices.ok) {
        const sData = await resServices.json();
        setServices(sData);
        if (sData.length > 0 && !expandedServiceId) {
          setExpandedServiceId(sData[0].id);
        }
      }

      if (resRules.ok) {
        const rData = await resRules.json();
        setRules(rData);
      }
    } catch (err) {
      console.error('Error fetching notification data:', err);
    }
  };

  useEffect(() => {
    if (tenantId) fetchServicesAndRules();
  }, [tenantId]);

  const handleToggleExpand = (serviceId) => {
    setExpandedServiceId(prev => prev === serviceId ? null : serviceId);
  };

  const handleOpenPreviewModal = (service, templateBody) => {
    const mockCard = {
      id: 'preview-card-id',
      service_id: service.id,
      status: 'in_progress',
      contacts: { name: 'João Silva (Cliente Exemplo)', phone: '5511999999999' },
      services: {
        title: service.title || 'Serviço Selecionado',
        ocr_enabled: service.ocr_enabled !== false,
        ocr_fields: service.ocr_fields || ['protocol_number', 'document_date', 'full_name', 'cpf', 'total_value'],
        confirmation_template: templateBody || service.confirmation_template || 'Olá {contact_name}, seu agendamento para *{service_title}* foi confirmado com sucesso!'
      },
      collected_data: { 'Exemplo': 'Teste de preenchimento' }
    };
    setPreviewCard(mockCard);
  };

  return (
    <div className="notification-settings-container glass-card">
      <div className="section-header">
        <h2><Bell size={26} className="accent-icon" /> Lembretes, Avisos e Confirmação de Atendimento por Serviço</h2>
        <p>Configure e teste a leitura inteligente de OCR e os avisos do WhatsApp para cada etapa de cada serviço da sua empresa.</p>
      </div>

      {message && (
        <div className={`alert-banner ${message.type}`} style={{ marginBottom: '20px' }}>
          {message.text}
        </div>
      )}

      {/* Magic Variables Legend */}
      <div className="placeholder-info-box glass-subcard" style={{ padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
        <h4 style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={16} /> Palavras mágicas que o sistema substitui sozinho no texto do WhatsApp:
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '8px' }}>
          Copie e cole qualquer uma dessas palavras abaixo dentro da mensagem do WhatsApp:
        </p>
        <div className="tags-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <code className="var-tag">&#123;contact_name&#125; (Nome do Cliente)</code>
          <code className="var-tag">&#123;service_title&#125; (Nome do Serviço)</code>
          <code className="var-tag">&#123;status&#125; (Situação Atual)</code>
          <code className="var-tag">&#123;document_number&#125; (Nº do Recibo/Protocolo)</code>
          <code className="var-tag">&#123;appointment_date&#125; (Data)</code>
          <code className="var-tag">&#123;total_value&#125; (Valor Total)</code>
          <code className="var-tag">&#123;notes&#125; (Observações)</code>
        </div>
      </div>

      {/* Empty State */}
      {services.length === 0 ? (
        <div className="glass-subcard" style={{ padding: '40px', textAlign: 'center', borderRadius: '16px' }}>
          <Layers size={48} style={{ color: 'var(--primary-accent)', opacity: 0.5, margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Nenhum serviço cadastrado ainda.</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '16px' }}>
            Cadastre os serviços da sua empresa na aba "3. Serviços" para configurar os avisos automáticos e o modal de conclusão.
          </p>
        </div>
      ) : (
        /* EXPANDABLE ACCORDION CARDS LIST FOR EACH SERVICE */
        <div className="services-accordion-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {services.map((service) => (
            <ServiceAccordionCard
              key={service.id}
              service={service}
              rules={rules.filter(r => r.service_id === service.id)}
              isExpanded={expandedServiceId === service.id}
              onToggleExpand={() => handleToggleExpand(service.id)}
              apiBaseUrl={apiBaseUrl}
              tenantId={tenantId}
              onRefresh={fetchServicesAndRules}
              onPreviewModal={(tmpl) => handleOpenPreviewModal(service, tmpl)}
              onPreviewWaMessage={(title, text) => setActiveWaPreview({ title, templateText: text, serviceTitle: service.title })}
              setMessage={setMessage}
            />
          ))}
        </div>
      )}

      {/* Confirmation Modal Preview */}
      {previewCard && (
        <ServiceConfirmationModal
          card={previewCard}
          tenantId={tenantId}
          apiBaseUrl={apiBaseUrl}
          onClose={() => setPreviewCard(null)}
        />
      )}

      {/* Generic WhatsApp Message Live Preview Modal */}
      {activeWaPreview && (
        <WhatsAppPreviewModal
          title={activeWaPreview.title}
          templateText={activeWaPreview.templateText}
          serviceTitle={activeWaPreview.serviceTitle}
          onClose={() => setActiveWaPreview(null)}
        />
      )}
    </div>
  );
}

function ServiceAccordionCard({ service, rules, isExpanded, onToggleExpand, apiBaseUrl, tenantId, onRefresh, onPreviewModal, onPreviewWaMessage, setMessage }) {
  const [ocrEnabled, setOcrEnabled] = useState(service.ocr_enabled !== false);
  const [ocrFields, setOcrFields] = useState(service.ocr_fields || ['protocol_number', 'document_date', 'full_name', 'cpf', 'total_value']);
  const [loading, setLoading] = useState(false);

  // States for the 4 notification triggers
  const getRule = (trigger) => rules.find(r => r.trigger_event === trigger) || { is_active: false, template_body: '' };

  const [createdActive, setCreatedActive] = useState(getRule('card_created').is_active);
  const [createdText, setCreatedText] = useState(getRule('card_created').template_body || 'Olá {contact_name}, recebemos seu pedido de *{service_title}*! Em breve iniciaremos o atendimento.');

  const [progressActive, setProgressActive] = useState(getRule('status_in_progress').is_active);
  const [progressText, setProgressText] = useState(getRule('status_in_progress').template_body || 'Olá {contact_name}, seu atendimento de *{service_title}* entrou em andamento!');

  const [completedActive, setCompletedActive] = useState(getRule('status_completed').is_active);
  const [completedText, setCompletedText] = useState(getRule('status_completed').template_body || service.confirmation_template || 'Olá {contact_name}, seu agendamento para *{service_title}* foi confirmado com sucesso!');

  const [cancelledActive, setCancelledActive] = useState(getRule('status_cancelled').is_active);
  const [cancelledText, setCancelledText] = useState(getRule('status_cancelled').template_body || 'Olá {contact_name}, seu atendimento de *{service_title}* foi cancelado.');

  useEffect(() => {
    setOcrEnabled(service.ocr_enabled !== false);
    setOcrFields(service.ocr_fields || ['protocol_number', 'document_date', 'full_name', 'cpf', 'total_value']);
    setCreatedActive(getRule('card_created').is_active);
    setCreatedText(getRule('card_created').template_body || 'Olá {contact_name}, recebemos seu pedido de *{service_title}*! Em breve iniciaremos o atendimento.');
    setProgressActive(getRule('status_in_progress').is_active);
    setProgressText(getRule('status_in_progress').template_body || 'Olá {contact_name}, seu atendimento de *{service_title}* entrou em andamento!');
    setCompletedActive(getRule('status_completed').is_active);
    setCompletedText(getRule('status_completed').template_body || service.confirmation_template || 'Olá {contact_name}, seu agendamento para *{service_title}* foi confirmado com sucesso!');
    setCancelledActive(getRule('status_cancelled').is_active);
    setCancelledText(getRule('status_cancelled').template_body || 'Olá {contact_name}, seu atendimento de *{service_title}* foi cancelado.');
  }, [service, rules]);

  const handleToggleOcrField = (fieldKey) => {
    if (ocrFields.includes(fieldKey)) {
      setOcrFields(ocrFields.filter(f => f !== fieldKey));
    } else {
      setOcrFields([...ocrFields, fieldKey]);
    }
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      // 1. Save rules for each trigger
      const triggersToSave = [
        { trigger_event: 'card_created', is_active: createdActive, template_body: createdText },
        { trigger_event: 'status_in_progress', is_active: progressActive, template_body: progressText },
        { trigger_event: 'status_completed', is_active: completedActive, template_body: completedText, ocr_enabled: ocrEnabled, ocr_fields: ocrFields },
        { trigger_event: 'status_cancelled', is_active: cancelledActive, template_body: cancelledText }
      ];

      for (const item of triggersToSave) {
        const existing = rules.find(r => r.trigger_event === item.trigger_event);
        await fetch(`${apiBaseUrl}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: existing?.id,
            tenant_id: tenantId,
            service_id: service.id,
            trigger_event: item.trigger_event,
            is_active: item.is_active,
            template_body: item.template_body,
            ocr_enabled: item.ocr_enabled,
            ocr_fields: item.ocr_fields
          })
        });
      }

      // 2. Also update service directly
      await fetch(`${apiBaseUrl}/api/services/${service.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          title: service.title,
          description: service.description,
          confirmation_template: completedText,
          ocr_enabled: ocrEnabled,
          ocr_fields: ocrFields
        })
      });

      setMessage({ type: 'success', text: `Configurações do serviço "${service.title}" salvas com sucesso!` });
      onRefresh();
    } catch (err) {
      setMessage({ type: 'error', text: `Erro ao salvar: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`service-accordion-card glass-card ${isExpanded ? 'expanded' : ''}`} style={{ borderRadius: '16px', overflow: 'hidden', border: isExpanded ? '2px solid var(--primary-accent)' : '1px solid var(--border-light)' }}>
      {/* ACCORDION HEADER */}
      <div
        className="accordion-header"
        onClick={onToggleExpand}
        style={{
          padding: '18px 24px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          background: isExpanded ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
          transition: 'background 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Layers size={22} className="accent-icon" />
          <div>
            <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: '800' }}>{service.title}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              {service.description || 'Configuração de mensagens e modal de conclusão'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="badge" style={{ fontSize: '0.75rem', fontWeight: '700', padding: '4px 10px', background: ocrEnabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)', color: ocrEnabled ? '#10b981' : 'var(--text-muted)', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Scan size={12} /> {ocrEnabled ? 'OCR Ativo' : 'OCR Desativado'}
          </span>

          {isExpanded ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
        </div>
      </div>

      {/* ACCORDION EXPANDED BODY */}
      {isExpanded && (
        <div className="accordion-body" style={{ padding: '24px', borderTop: '1px solid var(--border-light)' }}>
          {/* SECTION 1: OCR CONFIGURATION */}
          <div className="glass-subcard" style={{ padding: '18px', marginBottom: '24px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-accent)' }}>
                <Scan size={18} /> 🔍 Leitura Inteligente de Documentos (OCR Opcional)
              </h4>

              <label className="toggle-switch" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
                <input
                  type="checkbox"
                  checked={ocrEnabled}
                  onChange={(e) => setOcrEnabled(e.target.checked)}
                />
                <span>{ocrEnabled ? 'Leitura OCR Ativada ✅' : 'OCR Desativado ❌'}</span>
              </label>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Ao anexar fotos/PDF no modal de conclusão deste serviço, o robô lerá o documento e preencherá automaticamente os campos selecionados:
            </p>

            {ocrEnabled && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {[
                  { key: 'protocol_number', label: '📑 Nº do Protocolo / Recibo' },
                  { key: 'document_date', label: '📅 Data do Documento' },
                  { key: 'full_name', label: '👤 Nome do Cliente' },
                  { key: 'cpf', label: '🪪 CPF / CNPJ' },
                  { key: 'total_value', label: '💰 Valor Total (R$)' }
                ].map(f => (
                  <label key={f.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <input
                      type="checkbox"
                      checked={ocrFields.includes(f.key)}
                      onChange={() => handleToggleOcrField(f.key)}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: MENSAGENS DAS ETAPAS DO WHATSAPP COM BOTÃO DE PRÉVIA EM TODAS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 1. Novo Pedido */}
            <div className="rule-card glass-subcard" style={{ padding: '16px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h5 style={{ fontSize: '0.88rem', margin: 0, fontWeight: '700' }}>1. Mensagem de Boas-Vindas (Novo Pedido Aberto)</h5>
                <label className="toggle-switch" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={createdActive} onChange={(e) => setCreatedActive(e.target.checked)} />
                  <span>{createdActive ? 'Ativado ✅' : 'Desativado ❌'}</span>
                </label>
              </div>
              <textarea
                className="input-control textarea-control"
                value={createdText}
                onChange={(e) => setCreatedText(e.target.value)}
                rows={2}
              />
              <div style={{ marginTop: '8px', textAlign: 'right' }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => onPreviewWaMessage('Novo Pedido Aberto', createdText)}
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                >
                  <Eye size={14} /> 👁️ Ver Prévia do WhatsApp
                </button>
              </div>
            </div>

            {/* 2. Em Andamento */}
            <div className="rule-card glass-subcard" style={{ padding: '16px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h5 style={{ fontSize: '0.88rem', margin: 0, fontWeight: '700' }}>2. Mensagem de Em Andamento</h5>
                <label className="toggle-switch" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={progressActive} onChange={(e) => setProgressActive(e.target.checked)} />
                  <span>{progressActive ? 'Ativado ✅' : 'Desativado ❌'}</span>
                </label>
              </div>
              <textarea
                className="input-control textarea-control"
                value={progressText}
                onChange={(e) => setProgressText(e.target.value)}
                rows={2}
              />
              <div style={{ marginTop: '8px', textAlign: 'right' }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => onPreviewWaMessage('Em Andamento', progressText)}
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                >
                  <Eye size={14} /> 👁️ Ver Prévia do WhatsApp
                </button>
              </div>
            </div>

            {/* 3. Concluído */}
            <div className="rule-card glass-subcard active-rule" style={{ padding: '16px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h5 style={{ fontSize: '0.88rem', margin: 0, fontWeight: '700', color: 'var(--primary-accent)' }}>3. Mensagem de Conclusão / Entrega no WhatsApp</h5>
                <label className="toggle-switch" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={completedActive} onChange={(e) => setCompletedActive(e.target.checked)} />
                  <span>{completedActive ? 'Ativado ✅' : 'Desativado ❌'}</span>
                </label>
              </div>
              <textarea
                className="input-control textarea-control"
                value={completedText}
                onChange={(e) => setCompletedText(e.target.value)}
                rows={3}
              />
              <div style={{ marginTop: '8px', textAlign: 'right' }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => onPreviewModal(completedText)}
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                >
                  <Eye size={14} /> 👁️ Testar & Ver Prévia do Modal de Conclusão
                </button>
              </div>
            </div>

            {/* 4. Cancelado */}
            <div className="rule-card glass-subcard" style={{ padding: '16px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h5 style={{ fontSize: '0.88rem', margin: 0, fontWeight: '700' }}>4. Mensagem de Cancelamento</h5>
                <label className="toggle-switch" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                  <input type="checkbox" checked={cancelledActive} onChange={(e) => setCancelledActive(e.target.checked)} />
                  <span>{cancelledActive ? 'Ativado ✅' : 'Desativado ❌'}</span>
                </label>
              </div>
              <textarea
                className="input-control textarea-control"
                value={cancelledText}
                onChange={(e) => setCancelledText(e.target.value)}
                rows={2}
              />
              <div style={{ marginTop: '8px', textAlign: 'right' }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => onPreviewWaMessage('Cancelado', cancelledText)}
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                >
                  <Eye size={14} /> 👁️ Ver Prévia do WhatsApp
                </button>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS FOR THIS SERVICE */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
            <button
              type="button"
              className="btn primary"
              disabled={loading}
              onClick={handleSaveAll}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'linear-gradient(135deg, #6366f1, #10b981)' }}
            >
              <Save size={18} /> {loading ? 'Salvando...' : 'Salvar Regras Deste Serviço'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WhatsAppPreviewModal({ title, templateText, serviceTitle, onClose }) {
  const formatText = (text) => {
    if (!text) return '';
    return text
      .split('{contact_name}').join('João Silva (Cliente Exemplo)')
      .split('{service_title}').join(serviceTitle || 'Serviço Exemplo')
      .split('{status}').join(title || 'Em Andamento')
      .split('{document_number}').join('PROT-98124')
      .split('{appointment_date}').join('25/08/2026 às 14:30')
      .split('{total_value}').join('R$ 150,00')
      .split('{notes}').join('Atendimento prioritário');
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content glass-card" style={{ maxWidth: '500px', width: '90%', padding: '24px', borderRadius: '16px', position: 'relative' }}>
        <button className="btn-icon modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={20} style={{ color: '#25D366' }} /> Prévia do WhatsApp - {title}
        </h3>

        <div
          className="whatsapp-bubble"
          style={{
            background: '#0b141a',
            border: '1px solid rgba(37, 211, 102, 0.4)',
            borderRadius: '12px',
            padding: '16px',
            color: '#e9edef',
            fontSize: '0.88rem',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.5',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            minHeight: '140px'
          }}
        >
          {formatText(templateText)}
          <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#8696a0', marginTop: '12px' }}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button type="button" className="btn primary" onClick={onClose} style={{ padding: '8px 20px' }}>
            Fechar Prévia
          </button>
        </div>
      </div>
    </div>
  );
}
