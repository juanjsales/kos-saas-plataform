import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Layers, HelpCircle, FileText, GripVertical, ArrowUp, ArrowDown, Bot, Globe, Link2, Zap, Settings, MessageSquare, Clock, ShieldCheck, Check, Sparkles, Edit3, X, Search, Copy, ArrowLeft } from 'lucide-react';
import { ServiceTemplatesModal } from './onboarding/ServiceTemplatesModal';

export function ServiceBuilder({ tenantId, apiBaseUrl }) {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'form'
  const [activeTab, setActiveTab] = useState('form'); // 'form', 'confirmation', 'rpa', 'workflows'
  const [services, setServices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
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
  const [confirmationTemplate, setConfirmationTemplate] = useState('Olá {contact_name}, seu agendamento para *{service_title}* foi confirmado com sucesso!');
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

  // Start Creating a New Service
  const handleStartCreateNew = () => {
    setEditingServiceId(null);
    setTitle('');
    setDescription('');
    setCompletionType('identity');
    setConfirmationTemplate('Olá {contact_name}, seu agendamento para *{service_title}* foi confirmado com sucesso!');
    setExternalUrl('');
    setSubmitSelector('');
    setAutomationMappings([{ css_selector: '', source_field: 'Nome do Cliente' }]);
    setWorkflowRules([]);
    setCustomFields([{ field_label: '', field_type: 'text', options: '', is_required: false }]);
    setMessage(null);
    setActiveTab('form');
    setViewMode('form');
  };

  // Start Editing an existing Service
  const handleStartEditService = (service) => {
    setEditingServiceId(service.id);
    setTitle(service.title || '');
    setDescription(service.description || '');
    setCompletionType(service.completion_type || 'identity');
    setConfirmationTemplate(service.confirmation_template || 'Olá {contact_name}, seu agendamento para *{service_title}* foi confirmado com sucesso!');
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

    setMessage(null);
    setActiveTab('form');
    setViewMode('form');

    const elem = document.getElementById('tour-service-builder');
    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
  };

  // Duplicate a Service
  const handleDuplicateService = (service) => {
    setEditingServiceId(null);
    setTitle(`${service.title} (Cópia)`);
    setDescription(service.description || '');
    setCompletionType(service.completion_type || 'identity');
    setConfirmationTemplate(service.confirmation_template || 'Olá {contact_name}, seu agendamento para *{service_title}* foi confirmado com sucesso!');
    setExternalUrl(service.external_url || '');

    if (service.custom_fields && service.custom_fields.length > 0) {
      setCustomFields(service.custom_fields.map(f => ({
        field_label: f.field_label || '',
        field_type: f.field_type || 'text',
        options: f.options || '',
        is_required: !!f.is_required
      })));
    }

    if (service.automation_mapping?.mappings && service.automation_mapping.mappings.length > 0) {
      setAutomationMappings(service.automation_mapping.mappings);
      setSubmitSelector(service.automation_mapping.submit_selector || '');
    }

    setActiveTab('form');
    setViewMode('form');
    setMessage({ type: 'info', text: `Cópia criada a partir do serviço "${service.title}". Ajuste o nome e clique em Salvar.` });
  };

  // Cancel Form and Return to List
  const handleBackToList = () => {
    setViewMode('list');
    setEditingServiceId(null);
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
          handleBackToList();
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

  // Apply Template
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

    setActiveTab('form');
    setViewMode('form');
    setMessage({ type: 'success', text: `Template "${tmplData.title}" carregado! Confira os dados e clique em Salvar.` });
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
          confirmation_template: confirmationTemplate,
          external_url: externalUrl,
          automation_mapping: automationPayload,
          custom_fields: validFields
        })
      });

      if (res.ok) {
        setMessage({
          type: 'success',
          text: isEdit
            ? `Serviço "${title}" atualizado com sucesso!`
            : `Novo serviço "${title}" criado com sucesso!`
        });

        fetchServices();
        setViewMode('list');
        setEditingServiceId(null);
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

  const filteredServices = services.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const availableSourceFields = [
    'Nome do Cliente',
    'Telefone',
    'ID do Card',
    'Título do Serviço',
    ...customFields.map(f => f.field_label).filter(l => l.trim() !== '')
  ];

  return (
    <div id="tour-service-builder" className="builder-container glass-card">
      {message && (
        <div className={`alert-banner ${message.type}`} style={{ marginBottom: '16px' }}>
          {message.text}
        </div>
      )}

      {/* VIEW MODE 1: SERVICES LISTING & DASHBOARD */}
      {viewMode === 'list' ? (
        <div className="services-dashboard">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h2><Layers size={26} className="accent-icon" /> Gestão de Serviços da Sua Empresa</h2>
              <p>Gerencie, crie e edite os serviços prestados aos seus clientes.</p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowTemplatesModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
              >
                <Sparkles size={18} /> Usar Template Pronto
              </button>

              <button
                type="button"
                className="btn primary"
                onClick={handleStartCreateNew}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: 'linear-gradient(135deg, #6366f1, #10b981)' }}
              >
                <Plus size={20} /> Cadastrar Novo Serviço
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="search-box glass-subcard" style={{ marginBottom: '24px', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Search size={18} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar serviço por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', color: 'var(--text-primary)', fontSize: '0.9rem' }}
            />
          </div>

          {/* Services Grid */}
          {filteredServices.length === 0 ? (
            <div className="glass-subcard" style={{ padding: '40px', textAlign: 'center', borderRadius: '16px' }}>
              <Layers size={48} style={{ color: 'var(--primary-accent)', opacity: 0.5, margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>
                {searchTerm ? 'Nenhum serviço encontrado para essa busca.' : 'Nenhum serviço cadastrado ainda.'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
                {searchTerm ? 'Tente buscar com outro termo.' : 'Clique no botão abaixo para cadastrar o primeiro serviço da sua empresa!'}
              </p>
              {!searchTerm && (
                <button type="button" className="btn primary" onClick={handleStartCreateNew} style={{ padding: '10px 20px' }}>
                  <Plus size={18} /> Cadastrar Meu Primeiro Serviço
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {filteredServices.map((service) => (
                <div key={service.id} className="glass-card service-crud-card" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-light)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: '800', color: 'var(--text-primary)' }}>{service.title}</h3>
                      <span className="badge" style={{ fontSize: '0.72rem', fontWeight: '700', padding: '4px 10px', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary-accent)', borderRadius: '20px' }}>
                        {service.completion_type === 'document_delivery' ? '📄 Documento' :
                         service.completion_type === 'appointment' ? '📅 Agendamento' :
                         service.completion_type === 'pix_payment' ? '💳 PIX' : '📝 Personalizado'}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', minHeight: '40px', lineHeight: '1.4' }}>
                      {service.description || 'Sem descrição cadastrada.'}
                    </p>

                    <div className="tags-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.75rem', background: 'var(--bg-subcard)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>
                        📝 {service.custom_fields?.length || 0} Perguntas
                      </span>
                      {service.external_url && (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: '6px', color: '#10b981' }}>
                          🤖 Automação RPA Ativa
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '14px', marginTop: '10px' }}>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => handleDuplicateService(service)}
                      title="Duplicar Serviço"
                      style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                    >
                      <Copy size={14} /> Duplicar
                    </button>

                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => handleStartEditService(service)}
                      style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                    >
                      <Edit3 size={14} /> Editar
                    </button>

                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => handleDeleteService(service.id, service.title)}
                      style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VIEW MODE 2: FORM / EDITING SERVICE */
        <div className="service-form-editor">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '20px' }}>
            <div>
              <button
                type="button"
                className="btn secondary"
                onClick={handleBackToList}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.82rem', padding: '6px 12px' }}
              >
                <ArrowLeft size={16} /> Voltar para Lista de Serviços
              </button>
              <h2><Zap size={24} className="accent-icon" /> {editingServiceId ? `Editar Serviço: ${title}` : 'Cadastrar Novo Serviço'}</h2>
              <p>Configure os dados do serviço, perguntas para os clientes e automações.</p>
            </div>

            <button
              type="button"
              className="btn secondary"
              onClick={() => setShowTemplatesModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
            >
              <Sparkles size={18} /> Usar Template Pronto
            </button>
          </div>

          {/* 2-Tab Navigation Bar */}
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
              className={`nocode-tab ${activeTab === 'rpa' ? 'active' : ''}`}
              onClick={() => setActiveTab('rpa')}
            >
              <Bot size={18} /> 2. Robô RPA (Opcional)
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Basic Info */}
            <div className="glass-subcard" style={{ padding: '20px', marginBottom: '20px', borderRadius: '12px' }}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Nome do Serviço:</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Ex: Segundas Vias de Documentos, Agendamento de Consultas..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descrição Simples do Serviço (Opcional):</label>

                <textarea
                  className="input-control textarea-control"
                  placeholder="Ex: Serviço de emissão rápida de certidões e 2ª via com envio de comprovante."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {/* Tab 1: Custom Form Fields */}
            {activeTab === 'form' && (
              <div className="tab-pane">
                <div className="section-header" style={{ marginBottom: '16px' }}>
                  <h3><FileText size={20} className="accent-icon" /> Perguntas e Formulário Inicial</h3>
                  <p>Adicione as perguntas que o cliente ou o atendente deve preencher ao abrir o pedido.</p>
                </div>

                <div className="custom-fields-list">
                  {customFields.map((field, index) => (
                    <div key={index} className="field-card glass-subcard" style={{ padding: '16px', marginBottom: '12px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="field-drag-handle" style={{ color: 'var(--text-muted)', cursor: 'grab' }}>
                        <GripVertical size={20} />
                      </div>

                      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', gap: '12px', alignItems: 'center' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Pergunta / Rótulo:</label>
                          <input
                            type="text"
                            className="input-control select-sm"
                            placeholder="Ex: Número do CPF"
                            value={field.field_label}
                            onChange={(e) => handleFieldChange(index, 'field_label', e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Tipo da Resposta:</label>
                          <select
                            className="input-control select-control select-sm"
                            value={field.field_type}
                            onChange={(e) => handleFieldChange(index, 'field_type', e.target.value)}
                          >
                            <option value="text">Texto Curto</option>
                            <option value="textarea">Texto Longo</option>
                            <option value="number">Número</option>
                            <option value="date">Data</option>
                            <option value="time">Hora</option>
                            <option value="select">Lista de Opções (Select)</option>
                            <option value="checkbox">Caixa de Seleção (Checkbox)</option>
                            <option value="cpf">CPF / CNPJ</option>
                            <option value="phone">Telefone / WhatsApp</option>
                          </select>
                        </div>

                        {(field.field_type === 'select' || field.field_type === 'checkbox') ? (
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Opções (Separe por vírgula):</label>
                            <input
                              type="text"
                              className="input-control select-sm"
                              placeholder="Opção 1, Opção 2"
                              value={field.options}
                              onChange={(e) => handleFieldChange(index, 'options', e.target.value)}
                            />
                          </div>
                        ) : <div />}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                          <label className="toggle-switch" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                            <input
                              type="checkbox"
                              checked={field.is_required}
                              onChange={(e) => handleFieldChange(index, 'is_required', e.target.checked)}
                            />
                            <span>Obrigatório</span>
                          </label>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button type="button" className="btn-icon" onClick={() => moveField(index, index - 1)} disabled={index === 0} style={{ padding: '6px' }}>
                          <ArrowUp size={16} />
                        </button>
                        <button type="button" className="btn-icon" onClick={() => moveField(index, index + 1)} disabled={index === customFields.length - 1} style={{ padding: '6px' }}>
                          <ArrowDown size={16} />
                        </button>
                        <button type="button" className="btn-icon danger" onClick={() => removeCustomField(index)} style={{ padding: '6px' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" className="btn secondary" onClick={addCustomField} style={{ marginTop: '12px' }}>
                  <Plus size={18} /> Adicionar Mais Uma Pergunta
                </button>
              </div>
            )}

            {/* Tab 2: RPA Automation */}
            {activeTab === 'rpa' && (
              <div className="tab-pane">
                <div className="section-header" style={{ marginBottom: '16px' }}>
                  <h3><Bot size={20} className="accent-icon" /> Robô de Automação RPA (Opcional)</h3>
                  <p>Conecte um site externo onde um robô irá preencher os dados dos clientes automaticamente.</p>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Link do Site Externo (URL):</label>
                  <input
                    type="url"
                    className="input-control"
                    placeholder="https://exemplo.com.br/portal-do-cliente"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                  />
                </div>

                {externalUrl && (
                  <div className="rpa-mappings-box glass-subcard" style={{ padding: '16px', borderRadius: '12px' }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Mapeamento de Campos (Seletor CSS → Dado):</h4>
                    {automationMappings.map((row, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="input-control select-sm"
                          placeholder="Seletor CSS (ex: #cpf-input)"
                          value={row.css_selector}
                          onChange={(e) => handleMappingChange(idx, 'css_selector', e.target.value)}
                          style={{ flex: 1 }}
                        />

                        <select
                          className="input-control select-control select-sm"
                          value={row.source_field}
                          onChange={(e) => handleMappingChange(idx, 'source_field', e.target.value)}
                          style={{ flex: 1 }}
                        >
                          {availableSourceFields.map((sf, i) => (
                            <option key={i} value={sf}>{sf}</option>
                          ))}
                        </select>

                        <button type="button" className="btn-icon danger" onClick={() => removeMappingRow(idx)} style={{ padding: '6px' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}

                    <button type="button" className="btn secondary" onClick={addMappingRow} style={{ marginTop: '8px' }}>
                      <Plus size={16} /> Adicionar Mapeamento
                    </button>
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="btn primary submit-btn" disabled={loading} style={{ marginTop: '28px', width: '100%', padding: '14px', justifyContent: 'center' }}>
              {loading ? 'Salvando...' : editingServiceId ? <><Edit3 size={20} /> Salvar Alterações no Serviço</> : <><CheckCircle2 size={20} /> Concluir e Salvar Serviço</>}
            </button>
          </form>
        </div>
      )}

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
