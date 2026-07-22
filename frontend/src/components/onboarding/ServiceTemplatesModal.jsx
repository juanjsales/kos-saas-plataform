import React from 'react';
import { Calendar, Package, Bot, Sparkles, X, Check } from 'lucide-react';

export function ServiceTemplatesModal({ onClose, onSelectTemplate }) {
  const templates = [
    {
      id: 'appointments',
      icon: Calendar,
      title: '📅 Agendamento & Consultas',
      tagline: 'Ideal para clínicas, escritórios e serviços agendados',
      data: {
        title: 'Agendamento de Consulta / Atendimento',
        description: 'Serviço de agendamento de consultas com lembrete automático no WhatsApp 24h antes.',
        completion_type: 'simple',
        require_document_upload: false,
        custom_fields: [
          { field_label: 'Data e Hora do Agendamento', field_type: 'datetime', options: '', is_required: true },
          { field_label: 'Tipo de Atendimento', field_type: 'select', options: 'Presencial, Online, Domiciliar', is_required: true },
          { field_label: 'Observações do Cliente', field_type: 'text', options: '', is_required: false }
        ],
        external_url: '',
        automation_mapping: { mappings: [], submit_selector: '' },
        workflow_rules: [
          {
            id: 'r1',
            title: 'Confirmação Imediata no WhatsApp',
            trigger_type: 'on_card_created',
            action_type: 'send_whatsapp',
            action_config: { template_body: 'Olá {contact_name}, seu agendamento para {service_title} no dia {Data e Hora do Agendamento} foi confirmado com sucesso!' }
          },
          {
            id: 'r2',
            title: 'Lembrete de Agendamento 24h antes',
            trigger_type: 'on_time_offset',
            trigger_config: { offset_minutes: 1440 },
            action_type: 'send_whatsapp',
            action_config: { template_body: 'Olá {contact_name}, lembramos da sua consulta agendada para amanhã ({Data e Hora do Agendamento}). Responda 1 para confirmar.' }
          }
        ]
      }
    },
    {
      id: 'custom_orders',
      icon: Package,
      title: '🎨 Encomendas & Pedidos Personalizados',
      tagline: 'Ideal para gráficas, marcenarias e produtos sob medida',
      data: {
        title: 'Pedido de Encomenda Personalizada',
        description: 'Serviço com upload de arte/comprovante e atualizações de status via WhatsApp.',
        completion_type: 'financial',
        require_document_upload: true,
        custom_fields: [
          { field_label: 'Descrição do Pedido', field_type: 'text', options: '', is_required: true },
          { field_label: 'Data Limite de Entrega', field_type: 'date', options: '', is_required: true },
          { field_label: 'Anexo / Foto de Referência', field_type: 'file', options: '', is_required: false }
        ],
        external_url: '',
        automation_mapping: { mappings: [], submit_selector: '' },
        workflow_rules: [
          {
            id: 'r3',
            title: 'Aviso de Início da Produção',
            trigger_type: 'on_status_change',
            trigger_config: { target_status: 'in_progress' },
            action_type: 'send_whatsapp',
            action_config: { template_body: 'Olá {contact_name}, seu pedido foi enviado para a produção! Prazo estimado: {Data Limite de Entrega}.' }
          },
          {
            id: 'r4',
            title: 'Aviso de Pronto para Retirada',
            trigger_type: 'on_status_change',
            trigger_config: { target_status: 'completed' },
            action_type: 'send_whatsapp',
            action_config: { template_body: 'Olá {contact_name}, seu pedido está pronto para retirada! Seu comprovante anexo já foi gerado.' }
          }
        ]
      }
    },
    {
      id: 'rpa_automation',
      icon: Bot,
      title: '🤖 Atendimento com Automação RPA',
      tagline: 'Preenchimento automático em portais externos e governamentais',
      data: {
        title: 'Emissão de Certidões e Documentos (RPA)',
        description: 'Serviço que utiliza o robô RPA para preencher os dados do cliente no portal externo.',
        completion_type: 'identity',
        require_document_upload: true,
        custom_fields: [
          { field_label: 'CPF / CNPJ do Titular', field_type: 'text', options: '', is_required: true },
          { field_label: 'Nº do Protocolo / Requerimento', field_type: 'text', options: '', is_required: false }
        ],
        external_url: 'https://portal.governo.gov.br/requerimento',
        automation_mapping: {
          mappings: [
            { css_selector: 'input#input-cpf', source_field: 'CPF / CNPJ do Titular' },
            { css_selector: 'input#input-nome', source_field: 'Nome do Cliente' }
          ],
          submit_selector: 'button#btn-emitir'
        },
        workflow_rules: [
          {
            id: 'r5',
            title: 'Notificação de Protocolo Emitido via RPA',
            trigger_type: 'on_rpa_success',
            action_type: 'send_whatsapp',
            action_config: { template_body: 'Olá {contact_name}, seu requerimento foi processado pelo robô RPA com sucesso! O comprovante oficial foi anexado.' }
          }
        ]
      }
    }
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxWidth: '680px', position: 'relative' }}>
        <button className="btn-icon modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-title-group">
          <h3><Sparkles size={24} style={{ color: 'var(--primary-accent)' }} /> Templates Prontos No-Code (1-Click Setup)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Escolha um modelo pronto para preencher automaticamente os formulários, robôs RPA e mensagens do seu serviço:
          </p>
        </div>

        <div className="templates-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginTop: '20px' }}>
          {templates.map((tmpl) => {
            const Icon = tmpl.icon;

            return (
              <div
                key={tmpl.id}
                className="template-card glass-subcard hover-glass"
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--border-glass)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => {
                  onSelectTemplate(tmpl.data);
                  onClose();
                }}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '12px', borderRadius: '12px' }}>
                    <Icon size={24} style={{ color: 'var(--primary-accent)' }} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>{tmpl.title}</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tmpl.tagline}</p>
                    <span style={{ fontSize: '0.72rem', color: 'var(--secondary-accent)', marginTop: '4px', display: 'block' }}>
                      ✓ {tmpl.data.custom_fields.length} campos • {tmpl.data.workflow_rules.length} réguas automáticas
                    </span>
                  </div>
                </div>

                <button type="button" className="btn primary" style={{ fontSize: '0.8rem', padding: '8px 14px' }}>
                  Usar Template <Check size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button type="button" className="btn secondary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
            Começar do Zero (Sem Template)
          </button>
        </div>
      </div>
    </div>
  );
}
