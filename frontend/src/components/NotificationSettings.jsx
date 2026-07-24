import React, { useState, useEffect } from 'react';
import { Bell, Save, Power, CheckCircle, Info } from 'lucide-react';

export function NotificationSettings({ tenantId, apiBaseUrl }) {
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Available triggers
  const triggers = [
    { event: 'card_created', label: '1. Quando um Novo Pedido for Aberto' },
    { event: 'status_in_progress', label: '2. Quando o Pedido for para: Em Andamento' },
    { event: 'status_completed', label: '3. Quando o Pedido for para: Concluído' },
    { event: 'status_cancelled', label: '4. Quando o Pedido for para: Cancelado' }
  ];

  const fetchServices = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/services?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setServices(data);
        if (data.length > 0 && !selectedServiceId) {
          setSelectedServiceId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching services:', err);
    }
  };

  const fetchRules = async (serviceId) => {
    if (!serviceId) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/notifications?tenant_id=${tenantId}&service_id=${serviceId}`);
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (err) {
      console.error('Error fetching rules:', err);
    }
  };

  useEffect(() => {
    if (tenantId) fetchServices();
  }, [tenantId]);

  useEffect(() => {
    if (selectedServiceId) fetchRules(selectedServiceId);
  }, [selectedServiceId]);

  const getRuleForTrigger = (triggerEvent) => {
    return rules.find(r => r.trigger_event === triggerEvent) || {
      trigger_event: triggerEvent,
      is_active: false,
      template_body: ''
    };
  };

  const handleSaveRule = async (triggerEvent, is_active, template_body) => {
    setLoading(true);
    setMessage(null);

    const existingRule = rules.find(r => r.trigger_event === triggerEvent);

    try {
      const res = await fetch(`${apiBaseUrl}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: existingRule?.id,
          tenant_id: tenantId,
          service_id: selectedServiceId,
          trigger_event: triggerEvent,
          is_active,
          template_body
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Mensagem salva com sucesso!' });
        fetchRules(selectedServiceId);
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notification-settings-container glass-card">
      <div className="section-header">
        <h2><Bell size={24} className="accent-icon" /> Lembretes e Avisos Automáticos pelo WhatsApp</h2>
        <p>Escreva a mensagem que o cliente vai receber automaticamente no WhatsApp em cada etapa do trabalho.</p>
      </div>

      {message && (
        <div className={`alert-banner ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-group service-selector">
        <label className="form-label" style={{ fontWeight: '700' }}>Escolha o Serviço:</label>
        <select
          className="input-control select-control"
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
        >
          {services.map(s => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>

      <div className="placeholder-info-box glass-subcard" style={{ padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
        <h4 style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={16} /> Palavras mágicas que o sistema substitui sozinho no texto:
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '8px' }}>
          Copie e cole qualquer uma dessas palavras abaixo dentro do seu texto:
        </p>
        <div className="tags-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <code className="var-tag">&#123;contact_name&#125; (Nome do Cliente)</code>
          <code className="var-tag">&#123;service_title&#125; (Nome do Serviço)</code>
          <code className="var-tag">&#123;status&#125; (Situação Atual)</code>
          <code className="var-tag">&#123;document_number&#125; (Nº do Recibo/Nota)</code>
          <code className="var-tag">&#123;notes&#125; (Observações)</code>
        </div>
      </div>

      <div className="rules-list">
        {triggers.map(({ event, label }) => {
          const rule = getRuleForTrigger(event);
          return (
            <RuleCard
              key={event}
              label={label}
              rule={rule}
              onSave={(isActive, body) => handleSaveRule(event, isActive, body)}
              loading={loading}
            />
          );
        })}
      </div>
    </div>
  );
}

function RuleCard({ label, rule, onSave, loading }) {
  const [isActive, setIsActive] = useState(rule.is_active || false);
  const [templateBody, setTemplateBody] = useState(rule.template_body || '');

  useEffect(() => {
    setIsActive(rule.is_active || false);
    setTemplateBody(rule.template_body || '');
  }, [rule]);

  return (
    <div className={`rule-card glass-subcard ${isActive ? 'active-rule' : ''}`} style={{ padding: '18px', marginBottom: '16px', borderRadius: '12px' }}>
      <div className="rule-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="rule-title-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Power size={18} style={{ color: isActive ? '#10b981' : 'var(--text-muted)' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', margin: 0 }}>{label}</h3>
        </div>

        {/* Toggle Switch */}
        <label className="toggle-switch" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>{isActive ? 'Ativado ✅' : 'Desativado ❌'}</span>
        </label>
      </div>

      <div className="form-group" style={{ marginBottom: '12px' }}>
        <label className="form-label">Texto da Mensagem Enviada ao Cliente:</label>
        <textarea
          className="input-control textarea-control"
          placeholder="Ex: Olá {contact_name}, seu atendimento para {service_title} foi atualizado com sucesso!"
          value={templateBody}
          onChange={(e) => setTemplateBody(e.target.value)}
          rows={3}
        />
      </div>

      <button
        type="button"
        className="btn primary save-rule-btn"
        disabled={loading}
        onClick={() => onSave(isActive, templateBody)}
        style={{ padding: '8px 16px' }}
      >
        <Save size={16} /> Salvar Esta Mensagem
      </button>
    </div>
  );
}
