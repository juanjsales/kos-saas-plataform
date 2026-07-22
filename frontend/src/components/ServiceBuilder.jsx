import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Layers, HelpCircle, FileText, GripVertical, ArrowUp, ArrowDown, Bot, Globe, Link2, Zap, Settings, MessageSquare, Clock, ShieldCheck, Check, Sparkles } from 'lucide-react';
import { ServiceTemplatesModal } from './onboarding/ServiceTemplatesModal';

export function ServiceBuilder({ tenantId, apiBaseUrl }) {
  const [activeTab, setActiveTab] = useState('form'); // 'form', 'confirmation', 'rpa', 'workflows'
  const [services, setServices] = useState([]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

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

  const [draggedFieldIndex, setDraggedFieldIndex] = useState(null);
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

  // Apply 1-Click Setup Template Data across all 4 Tabs
  const handleApplyTemplate = (tmplData) => {
    setTitle(tmplData.title || '');
    setDescription(tmplData.description || '');
    setCompletionType(tmplData.completion_type || 'identity');
    setRequireDocumentUpload(!!tmplData.require_document_upload);
    setCustomFields(tmplData.custom_fields || [{ field_label: '', field_type: 'text', options: '', is_required: false }]);
    setExternalUrl(tmplData.external_url || '');
    setAutomationMappings(tmplData.automation_mapping?.mappings || [{ css_selector: '', source_field: 'Nome do Cliente' }]);
    setSubmitSelector(tmplData.automation_mapping?.submit_selector || '');
    setWorkflowRules(tmplData.workflow_rules || []);

    setMessage({ type: 'success', text: `Template "${tmplData.title}" carregado! Todas as 4 abas foram preenchidas. Clique em Salvar para finalizar.` });
  };

  // Tab 1: Custom Fields Handlers
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

  // Tab 3: RPA Mapping Handlers
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

  // Tab 4: Workflow Rules Handlers
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

    try {
      const res = await fetch(`${apiBaseUrl}/api/services`, {
        method: 'POST',
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
        const createdService = await res.json();

        // Save Workflow Rules for this service if any
        for (const rule of workflowRules) {
          await fetch(`${apiBaseUrl}/api/notifications/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant_id: tenantId,
              service_id: createdService.id,
              trigger_event: rule.trigger_type,
              template_body: rule.action_config?.template_body || 'Notificação',
              is_active: true
            })
          }).catch(() => {});
        }

        setMessage({ type: 'success', text: 'Plataforma No-Code: Serviço, robô RPA e réguas de workflow salvos com sucesso!' });
        setTitle('');
        setDescription('');
        setCompletionType('identity');
        setExternalUrl('');
        setSubmitSelector('');
        setAutomationMappings([{ css_selector: '', source_field: 'Nome do Cliente' }]);
        setWorkflowRules([]);
        setCustomFields([{ field_label: '', field_type: 'text', options: '', is_required: false }]);
        fetchServices();
      } else {
        const errData = await res.json();
        setMessage({ type: 'error', text: errData.error || 'Erro ao salvar serviço No-Code' });
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
          <h2><Zap size={26} className="accent-icon" /> Construtor de Serviços & Automações No-Code</h2>
          <p>Crie serviços dinâmicos, réguas de comunicação temporal e robôs RPA sem escrever uma única linha de código!</p>
        </div>

        <button
          type="button"
          className="btn primary"
          onClick={() => setShowTemplatesModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'linear-gradient(135deg, #6366f1, #10b981)' }}
        >
          <Sparkles size={18} /> Usar Template Pronto (1-Click Setup)
        </button>
      </div>

      {message && (
        <div className={`alert-banner ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* 4-Tab Navigation Bar */}
      <div className="nocode-tabs-bar glass-subcard" style={{ display: 'flex', gap: '8px', padding: '6px', marginBottom: '24px', borderRadius: '12px' }}>
        <button
          id="tour-tab-form"
          type="button"
          className={`nocode-tab-btn ${activeTab === 'form' ? 'active' : ''}`}
          onClick={() => setActiveTab('form')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
        >
          <Layers size={18} /> 1. Geral & Formulário
        </button>

        <button
          type="button"
          className={`nocode-tab-btn ${activeTab === 'confirmation' ? 'active' : ''}`}
          onClick={() => setActiveTab('confirmation')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
        >
          <Settings size={18} /> 2. Confirmação & Modais
        </button>

        <button
          id="tour-tab-rpa"
          type="button"
          className={`nocode-tab-btn ${activeTab === 'rpa' ? 'active' : ''}`}
          onClick={() => setActiveTab('rpa')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
        >
          <Bot size={18} /> 3. Automação RPA
        </button>

        <button
          id="tour-tab-workflows"
          type="button"
          className={`nocode-tab-btn ${activeTab === 'workflows' ? 'active' : ''}`}
          onClick={() => setActiveTab('workflows')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
        >
          <Zap size={18} /> 4. Réguas & Workflows
        </button>
      </div>

      <form onSubmit={handleSubmit} className="service-form">
        {/* TAB 1: GERAL & FORMULÁRIO */}
        {activeTab === 'form' && (
          <div>
            <div className="form-group">
              <label className="form-label">Título do Serviço No-Code</label>
              <input
                type="text"
                className="input-control"
                placeholder="Ex: Emissão de Identidade (RG), Agendamento de Exames, Suporte Técnico"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Descrição / Instruções</label>
              <textarea
                className="input-control textarea-control"
                placeholder="Descreva orientações ou pré-requisitos para este atendimento..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="custom-fields-section" style={{ marginTop: '24px' }}>
              <h3><HelpCircle size={18} /> Campos Dinâmicos do Formulário (Arraste para reordenar)</h3>

              {customFields.map((field, idx) => (
                <div
                  key={idx}
                  className={`field-row glass-row draggable-row ${draggedFieldIndex === idx ? 'is-dragging' : ''}`}
                  draggable={true}
                  onDragStart={(e) => { setDraggedFieldIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedFieldIndex !== null && draggedFieldIndex !== idx) moveField(draggedFieldIndex, idx);
                    setDraggedFieldIndex(null);
                  }}
                  style={{ display: 'grid', gridTemplateColumns: '30px 1.5fr 1fr 1fr 90px 40px', gap: '8px', alignItems: 'center' }}
                >
                  <GripVertical size={18} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />

                  <input
                    type="text"
                    className="input-control"
                    placeholder="Rótulo (Ex: Endereço, Data de Nascimento)"
                    value={field.field_label}
                    onChange={(e) => handleFieldChange(idx, 'field_label', e.target.value)}
                  />

                  <select
                    className="input-control select-control"
                    value={field.field_type}
                    onChange={(e) => handleFieldChange(idx, 'field_type', e.target.value)}
                  >
                    <option value="text">Texto livre</option>
                    <option value="number">Número</option>
                    <option value="date">Data</option>
                    <option value="datetime">Data e Hora</option>
                    <option value="select">Seleção / Dropdown</option>
                    <option value="file">Upload de Arquivo</option>
                    <option value="boolean">Sim/Não (Checkbox)</option>
                  </select>

                  {field.field_type === 'select' ? (
                    <input
                      type="text"
                      className="input-control"
                      placeholder="Opções separadas por vírgula"
                      value={field.options || ''}
                      onChange={(e) => handleFieldChange(idx, 'options', e.target.value)}
                    />
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Padrão</span>
                  )}

                  <label className="checkbox-label" style={{ fontSize: '0.8rem' }}>
                    <input
                      type="checkbox"
                      checked={field.is_required}
                      onChange={(e) => handleFieldChange(idx, 'is_required', e.target.checked)}
                    />
                    Obrigatório
                  </label>

                  {customFields.length > 1 && (
                    <button type="button" className="btn-icon danger" onClick={() => removeCustomField(idx)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}

              <button type="button" className="btn secondary" onClick={addCustomField} style={{ marginTop: '12px' }}>
                <Plus size={16} /> Adicionar Novo Campo
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: CONFIRMAÇÃO & MODAIS */}
        {activeTab === 'confirmation' && (
          <div className="glass-subcard" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--primary-accent)', marginBottom: '16px' }}>
              ⚙️ Regras do Modal de Confirmação e Conclusão
            </h3>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '700' }}>
                Tipo de Modal Exibido ao Concluir o Atendimento:
              </label>
              <select
                className="input-control select-control"
                value={completionType}
                onChange={(e) => setCompletionType(e.target.value)}
                style={{ fontWeight: '600' }}
              >
                <option value="identity">🆔 Leitura de Identidade (RG/CPF) - Extração Automática via OCR</option>
                <option value="financial">🧾 Comprovante Financeiro / Nota Fiscal - Leitura R$, NFE e Data</option>
                <option value="custom_fields">📋 Checklist das Perguntas Personalizadas do Serviço</option>
                <option value="simple">📝 Confirmação Simples com Observações</option>
              </select>
            </div>

            <div className="form-group" style={{ marginTop: '20px' }}>
              <label className="checkbox-label" style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                <input
                  type="checkbox"
                  checked={requireDocumentUpload}
                  onChange={(e) => setRequireDocumentUpload(e.target.checked)}
                />
                Exigir Upload de Documento / Comprovante no momento da conclusão do card
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Se ativado, o operador precisará anexar o comprovante em PDF ou Imagem ao concluir o atendimento.
              </span>
            </div>
          </div>
        )}

        {/* TAB 3: AUTOMAÇÃO RPA (PREENCHIMENTO EXTERNO) */}
        {activeTab === 'rpa' && (
          <div className="glass-subcard" style={{ padding: '20px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-accent)' }}>
              <Bot size={20} /> Automação de Preenchimento em Portal Externo (Robô RPA)
            </h3>

            <div className="form-group">
              <label className="form-label"><Globe size={14} /> URL do Site / Portal Externo</label>
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
                Mapeamento Visual "De/Para" (Seletor CSS no Site vs. Dados do Formulário):
              </label>

              {automationMappings.map((mapRow, idx) => (
                <div key={idx} className="field-row glass-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '12px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="Seletor CSS no Site (Ex: #input-cpf, input[name='nome'])"
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
                <Plus size={14} /> Adicionar Mapeamento "De/Para"
              </button>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label"><Link2 size={14} /> Seletor CSS do Botão de Envio (Opcional)</label>
              <input
                type="text"
                className="input-control"
                placeholder="Ex: button#btn-submit, input[type='submit']"
                value={submitSelector}
                onChange={(e) => setSubmitSelector(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* TAB 4: RÉGUAS & WORKFLOWS */}
        {activeTab === 'workflows' && (
          <div>
            <div className="glass-subcard" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--secondary-accent)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={20} /> Construtor de Réguas No-Code ("Quando [Gatilho] ➔ Faça [Ação]")
              </h3>

              <div className="form-group">
                <label className="form-label">Nome da Régua de Automação</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Ex: Confirmar Agendamento via WhatsApp após 30 min"
                  value={newRuleTitle}
                  onChange={(e) => setNewRuleTitle(e.target.value)}
                />
              </div>

              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Gatilho Disparador</label>
                  <select
                    className="input-control select-control"
                    value={newRuleTrigger}
                    onChange={(e) => setNewRuleTrigger(e.target.value)}
                  >
                    <option value="on_card_created">⚡ Quando o Cartão for Criado</option>
                    <option value="on_status_change">🔄 Quando o Status Mudar</option>
                    <option value="on_time_offset">⏰ Lembrete Temporal (X minutos depois)</option>
                    <option value="on_rpa_success">🤖 Quando o RPA for Concluído com Sucesso</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Ação a Ser Executada</label>
                  <select
                    className="input-control select-control"
                    value={newRuleAction}
                    onChange={(e) => setNewRuleAction(e.target.value)}
                  >
                    <option value="send_whatsapp">💬 Disparar Mensagem no WhatsApp</option>
                    <option value="run_rpa">🤖 Executar Robô RPA em Site Externo</option>
                    <option value="move_card_status">📌 Mover Status do Cartão</option>
                  </select>
                </div>
              </div>

              {newRuleTrigger === 'on_time_offset' && (
                <div className="form-group">
                  <label className="form-label"><Clock size={14} /> Intervalo Temporal (Minutos após o evento)</label>
                  <input
                    type="number"
                    className="input-control"
                    placeholder="30"
                    value={newRuleOffsetMinutes}
                    onChange={(e) => setNewRuleOffsetMinutes(e.target.value)}
                  />
                </div>
              )}

              {newRuleAction === 'send_whatsapp' && (
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Mensagem do WhatsApp (Template Text)</label>
                  <textarea
                    className="input-control textarea-control"
                    value={newRuleTemplate}
                    onChange={(e) => setNewRuleTemplate(e.target.value)}
                    rows={3}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Inserir tags:</span>
                    {['{contact_name}', '{service_title}', '{status}', '{confirmed_at}'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className="var-tag"
                        onClick={() => setNewRuleTemplate(prev => `${prev} ${tag}`)}
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--primary-accent)', margin: '12px 0' }}>
                <ShieldCheck size={16} /> Trava Antiduplicidade Ativa: Garante idempotência e previne mensagens duplicadas.
              </div>

              <button type="button" className="btn secondary" onClick={addWorkflowRule}>
                <Plus size={16} /> Adicionar Régua ao Serviço
              </button>
            </div>

            {/* List of Created Workflow Rules */}
            {workflowRules.length > 0 && (
              <div className="rules-list glass-subcard" style={{ padding: '16px' }}>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '12px' }}>Réguas Configuradas ({workflowRules.length}):</h4>
                {workflowRules.map((rule) => (
                  <div key={rule.id} className="glass-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '10px 14px' }}>
                    <div>
                      <strong>{rule.title}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Gatilho: {rule.trigger_type} ➔ Ação: {rule.action_type}
                      </div>
                    </div>
                    <button type="button" className="btn-icon danger" onClick={() => removeWorkflowRule(rule.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button type="submit" className="btn primary submit-btn" disabled={loading} style={{ marginTop: '28px', width: '100%', padding: '14px', justifyContent: 'center' }}>
          {loading ? 'Salvando Configurações...' : <><CheckCircle2 size={20} /> Salvar Serviço & Automações No-Code</>}
        </button>
      </form>

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
