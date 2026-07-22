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
    { event: 'card_created', label: 'Cartão Criado / Atendimento Solicitado' },
    { event: 'status_in_progress', label: 'Status Alterado para: Em Andamento' },
    { event: 'status_completed', label: 'Status Alterado para: Concluído' },
    { event: 'status_cancelled', label: 'Status Alterado para: Cancelado' }
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
        setMessage({ type: 'success', text: 'Regra de notificação salva com sucesso!' });
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
        <h2><Bell size={24} className="accent-icon" /> Painel de Configurações de Notificações Automáticas</h2>
        <p>Defina mensagens automáticas no WhatsApp para cada mudança de status do atendimento.</p>
      </div>

      {message && (
        <div className={`alert-banner ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-group service-selector">
        <label className="form-label">Selecione o Serviço para Configurar Regras:</label>
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

      <div className="placeholder-info-box glass-subcard">
        <h4><Info size={16} /> Variáveis disponíveis para o modelo de mensagem no WhatsApp:</h4>
        <div className="tags-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          <code className="var-tag">&#123;contact_name&#125;</code>
          <code className="var-tag">&#123;service_title&#125;</code>
          <code className="var-tag">&#123;status&#125;</code>
          <code className="var-tag">&#123;rg_number&#125;</code>
          <code className="var-tag">&#123;cpf&#125;</code>
          <code className="var-tag">&#123;full_name&#125;</code>
          <code className="var-tag">&#123;birth_date&#125;</code>
          <code className="var-tag">&#123;issuing_organ&#125;</code>
          <code className="var-tag">&#123;document_number&#125;</code>
          <code className="var-tag">&#123;notes&#125;</code>
          <code className="var-tag">&#123;NomeDaPerguntaPersonalizada&#125;</code>
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
    <div className={`rule-card glass-subcard ${isActive ? 'active-rule' : ''}`}>
      <div className="rule-card-header">
        <div className="rule-title-group">
          <Power size={18} className={isActive ? 'power-on' : 'power-off'} />
          <h3>{label}</h3>
        </div>

        {/* Toggle Switch */}
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span className="slider round"></span>
        </label>
      </div>

      <div className="form-group">
        <label className="form-label">Mensagem do WhatsApp (Template Body)</label>
        <textarea
          className="input-control textarea-control"
          placeholder="Ex: Olá {contact_name}, seu atendimento para {service_title} foi atualizado para: {status}."
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
      >
        <Save size={16} /> Salvar Regra
      </button>
    </div>
  );
}
