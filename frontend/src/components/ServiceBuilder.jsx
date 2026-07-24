import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Layers, HelpCircle, FileText, GripVertical, ArrowUp, ArrowDown, Bot, Globe, Link2, Zap, Settings, MessageSquare, Clock, ShieldCheck, Check, Sparkles, Edit3, X } from 'lucide-react';
import { ServiceTemplatesModal } from './onboarding/ServiceTemplatesModal';

export function ServiceBuilder({ tenantId, apiBaseUrl }) {
  const [activeTab, setActiveTab] = useState('form'); // 'form', 'confirmation', 'rpa', 'workflows'
  const [services, setServices] = useState([]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);

  // Service Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Tab 1: Custom Form Fields
  const [customFields, setCustomFields] = useState([
    { field_label: '', field_type: 'text', options: '', is_required: false }
  ]);

  // Tab 2: Confirmation & Modals
  const [completionType, setCompletionType] = useState('identity');
  const [requireDocumentUpload, setRequireDocumentUpload] = useState(true);

  // Tab 3: RPA Automation
  const [externalUrl, setExternalUrl] = useState('');
  const [submitSelector, setSubmitSelector] = useState('');
  const [automationMappings, setAutomationMappings] = useState([
    { css_selector: '', source_field: 'Nome do Cliente' }
  ]);

  // Tab 4: Workflows & Communication Rules
  const [workflowRules, setWorkflowRules] = useState([]);
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleTrigger, setNewRuleTrigger] = useState('on_card_created');
  const [newRuleTargetStatus, setNewRuleTargetStatus] = useState('in_progress');
  const [newRuleOffsetMinutes, setNewRuleOffsetMinutes] = useState(30);
  const [newRuleAction, setNewRuleAction] = useState('send_whatsapp');
  const [newRuleTemplate, setNewRuleTemplate] = useState('Olá {contact_name}, seu atendimento de {service_title} foi atualizado!');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchServices = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/services?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (err) {
      console.error('Failed to fetch services:', err);
    }
  };

  useEffect(() => {
    if (tenantId) fetchServices();
  }, [tenantId]);

  // Start Editing an existing Service
  const handleStartEditService = (service) => {
    setEditingServiceId(service.id);
    setTitle(service.title || '');
    setDescription(service.description || '');
    setCompletionType(service.completion_type || 'identity');
    setExternalUrl(service.external_url || '');

    if (service.custom_fields && service.custom_fields.length > 0) {
      setCustomFields(service.custom_fields.map(f => ({
        field_label: f.field_label || '',
        field_type: f.field_type || 'text',
        options: f.options || '',
        is_required: !!f.is_required
      })));
    } else {
      setCustomFields([{ field_label: '', field_type: 'text', options: '', is_required: false }]);
    }

    if (service.automation_mapping?.mappings && service.automation_mapping.mappings.length > 0) {
      setAutomationMappings(service.automation_mapping.mappings);
      setSubmitSelector(service.automation_mapping.submit_selector || '');
    } else {
      setAutomationMappings([{ css_selector: '', source_field: 'Nome do Cliente' }]);
      setSubmitSelector('');
    }

    setMessage({ type: 'info', text: `Modo de Edição ativado para o serviço "${service.title}". Faça as alterações e clique em Salvar.` });

    // Scroll to top
    const elem = document.getElementById('tour-service-builder');
    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
  };

  // Cancel Editing
  const handleCancelEdit = () => {
    setEditingServiceId(null);
    setTitle('');
    setDescription('');
    setCompletionType('identity');
    setExternalUrl('');
    setSubmitSelector('');
    setAutomationMappings([{ css_selector: '', source_field: 'Nome do Cliente' }]);
    setWorkflowRules([]);
    setCustomFields([{ field_label: '', field_type: 'text', options: '', is_required: false }]);
    setMessage(null);
  };

  // Delete Service
  const handleDeleteService = async (serviceId, serviceTitle) => {
    if (!confirm(`Deseja realmente excluir o serviço "${serviceTitle}"?`)) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/services/${serviceId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setMessage({ type: 'success', text: `Serviço "${serviceTitle}" excluído com sucesso!` });
        if (editingServiceId === serviceId) {
          handleCancelEdit();
        }
        fetchServices();
      } else {
        const err = await res.json();
        alert(`Erro ao excluir serviço: ${err.error}`);
      }
    } catch (err) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  // Apply 1-Click Setup Template Data
  const handleApplyTemplate = (tmplData) => {
    setEditingServiceId(null);
    setTitle(tmplData.title || '');
    setDescription(tmplData.description || '');
    setCompletionType(tmplData.completion_type || 'identity');
    setRequireDocumentUpload(!!tmplData.require_document_upload);
    setCustomFields(tmplData.custom_fields || [{ field_label: '', field_type: 'text', options: '', is_required: false }]);
    setExternalUrl(tmplData.external_url || '');
    setAutomationMappings(tmplData.automation_mapping?.mappings || [{ css_selector: '', source_field: 'Nome do Cliente' }]);
    setSubmitSelector(tmplData.automation_mapping?.submit_selector || '');
    setWorkflowRules(tmplData.workflow_rules || []);

    setMessage({ type: 'success', text: `Template "${tmplData.title}" carregado! Todas as abas foram preenchidas. Clique em Salvar.` });
  };

  // Custom Fields Handlers
  const addCustomField = () => {
    setCustomFields([
      ...customFields,
      { field_label: '', field_type: 'text', options: '', is_required: false }
    ]);
  };

  const removeCustomField = (index) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index, prop, value) => {
    const updated = [...customFields];
    updated[index][prop] = value;
    setCustomFields(updated);
  };

  const moveField = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= customFields.length) return;
    const updated = [...customFields];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setCustomFields(updated);
  };

  // RPA Mapping Handlers
  const addMappingRow = () => {
    setAutomationMappings([
      ...automationMappings,
      { css_selector: '', source_field: 'Nome do Cliente' }
    ]);
  };

  const removeMappingRow = (idx) => {
    setAutomationMappings(automationMappings.filter((_, i) => i !== idx));
  };

  const handleMappingChange = (idx, prop, value) => {
    const updated = [...automationMappings];
    updated[idx][prop] = value;
    setAutomationMappings(updated);
  };

  // Workflow Rules Handlers
  const addWorkflowRule = () => {
    if (!newRuleTitle.trim()) return;

    const newRule = {
      id: Date.now().toString(),
      title: newRuleTitle,
      trigger_type: newRuleTrigger,
      trigger_config: {
        target_status: newRuleTargetStatus,
        offset_minutes: newRuleOffsetMinutes
      },
      action_type: newRuleAction,
      action_config: {
        template_body: newRuleTemplate,
        target_status: newRuleTargetStatus
      },
      is_active: true
    };

    setWorkflowRules([...workflowRules, newRule]);
    setNewRuleTitle('');
    setNewRuleTemplate('Olá {contact_name}, seu agendamento foi confirmado!');
  };

  const removeWorkflowRule = (id) => {
    setWorkflowRules(workflowRules.filter(r => r.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setMessage(null);

    const validFields = customFields.filter(f => f.field_label.trim() !== '');
    const validMappings = automationMappings.filter(m => m.css_selector.trim() !== '');

    const automationPayload = {
      mappings: validMappings,
      submit_selector: submitSelector
    };

    const isEdit = !!editingServiceId;
    const url = isEdit ? `${apiBaseUrl}/api/services/${editingServiceId}` : `${apiBaseUrl}/api/services`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          title,
          description,
          completion_type: completionType,
          external_url: externalUrl || null,
          automation_mapping: automationPayload,
          custom_fields: validFields
        })
      });

      if (res.ok) {
        const savedService = await res.json();

        // Save Workflow Rules for this service if any
        for (const rule of workflowRules) {
          await fetch(`${apiBaseUrl}/api/notifications/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant_id: tenantId,
              service_id: savedService.id,
              trigger_event: rule.trigger_type,
              template_body: rule.action_config?.template_body || 'Notificação',
              is_active: true
            })
          }).catch(() => {});
        }

        setMessage({
          type: 'success',
          text: isEdit
            ? `Serviço "${title}" atualizado com sucesso!`
            : 'Serviço No-Code criado e salvo com sucesso!'
        });

        handleCancelEdit();
        fetchServices();
      } else {
        const errData = await res.json();
        setMessage({ type: 'error', text: errData.error || 'Erro ao salvar serviço' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const availableSourceFields = [
    'Nome do Cliente',
    'Telefone',
    'ID do Card',
    'Título do Serviço',
    ...customFields.map(f => f.field_label).filter(l => l.trim() !== '')
  ];

  return (
    <div id="tour-service-builder" className="builder-container glass-card">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div>
          <h2><Zap size={26} className="accent-icon" /> Cadastrar e Editar Serviços da Sua Empresa</h2>
          <p>Configure o nome dos seus serviços, perguntas para os clientes e mensagens automáticas de forma muito fácil!</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {editingServiceId && (
            <button
              type="button"
              className="btn secondary"
              onClick={handleCancelEdit}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <X size={16} /> Cancelar Edição
            </button>
          )}

          <button
            type="button"
            className="btn primary"
            onClick={() => setShowTemplatesModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'linear-gradient(135deg, #6366f1, #10b981)' }}
          >
            <Sparkles size={18} /> Usar um Modelo Já Pronto
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert-banner ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* 4-Tab Navigation Bar */}
      <div className="nocode-tabs-bar glass-subcard" style={{ display: 'flex', gap: '8px', padding: '6px', marginBottom: '24px', borderRadius: '12px' }}>
        <button
          type="button"
          className={`nocode-tab ${activeTab === 'form' ? 'active' : ''}`}
          onClick={() => setActiveTab('form')}
        >
          <FileText size={18} /> 1. Perguntas do Serviço
        </button>

        <button
          type="button"
          className={`nocode-tab ${activeTab === 'confirmation' ? 'active' : ''}`}
          onClick={() => setActiveTab('confirmation')}
        >
          <CheckCircle2 size={18} /> 2. Foto ou Recibo de Conclusão
        </button>

        <button
          type="button"
          className={`nocode-tab ${activeTab === 'rpa' ? 'active' : ''}`}
          onClick={() => setActiveTab('rpa')}
        >
          <Bot size={18} /> 3. Digitação Automática (Opcional)
        </button>

        <button
          type="button"
          className={`nocode-tab ${activeTab === 'workflows' ? 'active' : ''}`}
          onClick={() => setActiveTab('workflows')}
        >
          <Zap size={18} /> 4. Avisos Automáticos no WhatsApp
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit}>
        <div className="form-group glass-subcard" style={{ padding: '16px', marginBottom: '20px' }}>
          <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '700' }}>Nome do Serviço *</label>
              <input
                type="text"
                className="input-control"
                placeholder="Ex: Agendamento, Venda, Segunda Via, Consulta"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '700' }}>Descrição Simples</label>
              <input
                type="text"
                className="input-control"
                placeholder="Uma explicação curta sobre o que é esse serviço..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* TAB 1: FORMULÁRIO PERSONALIZADO */}
        {activeTab === 'form' && (
          <div className="glass-subcard" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} className="accent-icon" /> Perguntas que o Cliente ou Atendente Deve Preencher
            </h3>

            {customFields.map((field, index) => (
              <div
                key={index}
                className="field-row glass-row"
                style={{ display: 'grid', gridTemplateColumns: '30px 2fr 1.5fr 1fr 40px', gap: '12px', alignItems: 'center', marginBottom: '10px', padding: '10px 14px' }}
              >
                <GripVertical size={20} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />

                <input
                  type="text"
                  className="input-control"
                  placeholder="Escreva a pergunta (Ex: Qual o seu CPF?, Endereço)"
                  value={field.field_label}
                  onChange={(e) => handleFieldChange(index, 'field_label', e.target.value)}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <select
                    className="input-control select-control"
                    value={field.field_type}
                    onChange={(e) => handleFieldChange(index, 'field_type', e.target.value)}
                  >
                    <option value="text">✏️ Texto Curto (Ex: Nome)</option>
                    <option value="textarea">📝 Texto Grande (Ex: Observações)</option>
                    <option value="number">🔢 Número ou Valor R$</option>
                    <option value="cpf">🪪 CPF ou CNPJ</option>
                    <option value="phone">📞 Telefone com DDD</option>
                    <option value="date">📅 Data (Dia/Mês/Ano)</option>
                    <option value="time">⏰ Horário (Hora:Minuto)</option>
                    <option value="select">📋 Lista de Opções para Escolher</option>
                    <option value="checkbox">☑️ Caixas para Marcar Várias Opções</option>
                    <option value="file">📎 Foto / Documento PDF</option>
                  </select>

                  {(field.field_type === 'select' || field.field_type === 'checkbox') && (
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Opções separadas por vírgula. Ex: Manhã, Tarde, Noite"
                      value={field.options || ''}
                      onChange={(e) => handleFieldChange(index, 'options', e.target.value)}
                    />
                  )}
                </div>

                <label className="checkbox-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    checked={field.is_required}
                    onChange={(e) => handleFieldChange(index, 'is_required', e.target.checked)}
                  />
                  Obrigatório
                </label>

                <button type="button" className="btn-icon danger" onClick={() => removeCustomField(index)}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}

            <button type="button" className="btn secondary" onClick={addCustomField} style={{ marginTop: '12px' }}>
              <Plus size={16} /> Adicionar Nova Pergunta
            </button>
          </div>
        )}

        {/* TAB 2: MODAL DE CONCLUSÃO */}
        {activeTab === 'confirmation' && (
          <div className="glass-subcard" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={20} className="accent-icon" /> O que o atendente deve enviar ao terminar o serviço:
            </h3>

            <div className="form-group">
              <select
                className="input-control select-control"
                value={completionType}
                onChange={(e) => setCompletionType(e.target.value)}
                style={{ fontWeight: '600' }}
              >
                <option value="identity">🆔 Foto do Documento (RG / CPF) com leitura automática de dados</option>
                <option value="financial">🧾 Comprovante / Recibo / Nota Fiscal com leitura do Valor R$</option>
                <option value="custom_fields">📋 Responder as perguntas cadastradas do serviço</option>
                <option value="simple">📝 Apenas uma mensagem simples de confirmação</option>
              </select>
            </div>
          </div>
        )}

        {/* TAB 3: AUTOMAÇÃO RPA */}
        {activeTab === 'rpa' && (
          <div className="glass-subcard" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-accent)' }}>
              <Bot size={20} /> Digitação Automática em Outros Portais (Opcional)
            </h3>

            <div className="form-group">
              <label className="form-label"><Globe size={14} /> Endereço (URL) do Site Externo</label>
              <input
                type="url"
                className="input-control"
                placeholder="Ex: https://portal.saude.gov.br/agendamento"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
              />
            </div>

            <div style={{ marginTop: '16px' }}>
              <label className="form-label" style={{ fontWeight: '600' }}>
                Quais dados o robô deve digitar no outro site:
              </label>

              {automationMappings.map((mapRow, idx) => (
                <div key={idx} className="field-row glass-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '12px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Campo no outro site (Ex: #input-cpf)"
                    value={mapRow.css_selector}
                    onChange={(e) => handleMappingChange(idx, 'css_selector', e.target.value)}
                  />

                  <select
                    className="input-control select-control"
                    value={mapRow.source_field}
                    onChange={(e) => handleMappingChange(idx, 'source_field', e.target.value)}
                  >
                    {availableSourceFields.map(sf => (
                      <option key={sf} value={sf}>{sf}</option>
                    ))}
                  </select>

                  <button type="button" className="btn-icon danger" onClick={() => removeMappingRow(idx)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}

              <button type="button" className="btn secondary" onClick={addMappingRow} style={{ marginTop: '8px', fontSize: '0.8rem' }}>
                <Plus size={14} /> Adicionar Novo Campo para Digitação
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: RÉGUAS & WORKFLOWS */}
        {activeTab === 'workflows' && (
          <div>
            <div className="glass-subcard" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--secondary-accent)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={20} /> Configurar Avisos Automáticos ("Quando acontecer algo ➔ Enviar mensagem")
              </h3>

              <div className="form-group">
                <label className="form-label">Título do Aviso</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Ex: Avisar o cliente que o trabalho ficou pronto"
                  value={newRuleTitle}
                  onChange={(e) => setNewRuleTitle(e.target.value)}
                />
              </div>

              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Quando deve enviar?</label>
                  <select
                    className="input-control select-control"
                    value={newRuleTrigger}
                    onChange={(e) => setNewRuleTrigger(e.target.value)}
                  >
                    <option value="on_card_created">⚡ Quando um novo pedido for aberto</option>
                    <option value="on_status_change">🔄 Quando o pedido mudar de etapa</option>
                    <option value="on_time_offset">⏰ Enviar lembrete após alguns minutos</option>
                    <option value="on_rpa_success">🤖 Quando o robô terminar a digitação</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">O que deve fazer?</label>
                  <select
                    className="input-control select-control"
                    value={newRuleAction}
                    onChange={(e) => setNewRuleAction(e.target.value)}
                  >
                    <option value="send_whatsapp">💬 Enviar mensagem automática no WhatsApp</option>
                    <option value="run_rpa">🤖 Ativar preenchimento automático no site</option>
                    <option value="move_card_status">📌 Mover o pedido para outra etapa</option>
                  </select>
                </div>
              </div>

              <button type="button" className="btn secondary" onClick={addWorkflowRule}>
                <Plus size={16} /> Adicionar Aviso ao Serviço
              </button>
            </div>
          </div>
        )}

        <button type="submit" className="btn primary submit-btn" disabled={loading} style={{ marginTop: '28px', width: '100%', padding: '14px', justifyContent: 'center' }}>
          {loading ? 'Salvando...' : editingServiceId ? <><Edit3 size={20} /> Salvar Alterações no Serviço</> : <><CheckCircle2 size={20} /> Salvar Serviço</>}
        </button>
      </form>

      {/* Lista de Serviços Existentes para Edição / Exclusão */}
      <div className="existing-services-section glass-subcard" style={{ marginTop: '32px', padding: '20px' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={20} className="accent-icon" /> Meus Serviços Cadastrados ({services.length})
        </h3>

        {services.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum serviço cadastrado ainda. Use o formulário acima para criar o primeiro!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {services.map((service) => (
              <div key={service.id} className="glass-card" style={{ padding: '14px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.5)', border: editingServiceId === service.id ? '2px solid var(--primary-accent)' : '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: '700' }}>{service.title}</h4>
                  <span className="badge" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>{service.completion_type}</span>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', minHeight: '32px' }}>
                  {service.description || 'Sem descrição cadastrada'}
                </p>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-glass)', paddingTop: '10px' }}>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => handleStartEditService(service)}
                    style={{ fontSize: '0.78rem', padding: '6px 10px', gap: '4px' }}
                  >
                    <Edit3 size={14} /> Editar
                  </button>

                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => handleDeleteService(service.id, service.title)}
                    style={{ fontSize: '0.78rem', padding: '6px 10px', gap: '4px' }}
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Templates Modal */}
      {showTemplatesModal && (
        <ServiceTemplatesModal
          onClose={() => setShowTemplatesModal(false)}
          onSelectTemplate={handleApplyTemplate}
        />
      )}
    </div>
  );
}
