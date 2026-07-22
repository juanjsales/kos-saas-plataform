import React, { useState, useEffect } from 'react';
import { CheckCircle2, MessageSquare, Lock, X, Send } from 'lucide-react';

export function ServiceConfirmationModal({ card, tenantId, apiBaseUrl, onClose, onConfirmed }) {
  const [targetService, setTargetService] = useState(null);
  const [collectedData, setCollectedData] = useState(card.collected_data || {});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchServiceDetails() {
      if (!card.service_id) return;
      try {
        const res = await fetch(`${apiBaseUrl}/api/services?tenant_id=${tenantId}`);
        if (res.ok) {
          const services = await res.json();
          const found = services.find(s => s.id === card.service_id);
          if (found) {
            setTargetService(found);
          }
        }
      } catch (err) {
        console.error('Error fetching service for confirmation:', err);
      }
    }
    fetchServiceDetails();
  }, [card.service_id, tenantId, apiBaseUrl]);

  const customFields = targetService?.custom_fields || [];
  const rawTemplate = targetService?.confirmation_template || 
    'Olá {contact_name}, seu agendamento para {service_title} foi confirmado com sucesso!';

  // Safety Lock check: verify all required fields are filled
  const isFormValid = customFields.every(field => {
    if (!field.is_required) return true;
    const val = collectedData[field.field_label];
    return val !== undefined && val !== null && String(val).trim() !== '';
  });

  // Helper to format ISO date strings into DD/MM/YYYY
  const formatValue = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}.*)?$/.test(str)) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const datePart = d.toLocaleDateString('pt-BR');
        if (str.includes('T')) {
          const timePart = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return `${datePart} às ${timePart}`;
        }
        return datePart;
      }
    }
    return str;
  };

  // Calculate Real-Time WhatsApp Live Message Preview
  const generateLiveMessage = () => {
    let message = rawTemplate;
    const variables = {
      contact_name: card.contacts?.name || 'Cliente',
      service_title: card.services?.title || targetService?.title || 'Serviço',
      status: card.status || 'Confirmado',
      confirmed_at: new Date().toLocaleDateString('pt-BR'),
      ...collectedData
    };

    for (const [key, val] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      const displayVal = formatValue(val);
      message = message.replace(regex, displayVal !== undefined && displayVal !== null && String(displayVal).trim() !== '' ? String(displayVal) : `[${key}]`);
    }

    return message;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/cards/${card.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collected_data: collectedData
        })
      });

      if (res.ok) {
        onConfirmed();
      } else {
        const err = await res.json();
        alert(`Erro na confirmação: ${err.error}`);
      }
    } catch (err) {
      alert(`Erro ao confirmar: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card confirmation-modal-responsive" style={{ maxWidth: '840px', width: '95%', position: 'relative' }}>
        <button className="btn-icon modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-title-group">
          <h3><CheckCircle2 size={24} style={{ color: 'var(--primary-accent)' }} /> Confirmação do Atendimento / Agendamento</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Serviço: <strong>{targetService?.title || card.services?.title || 'Serviço'}</strong> - Cliente: <strong>{card.contacts?.name || 'Cliente'}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
          {/* Responsive Side-by-Side Grid Layout */}
          <div className="confirmation-grid">
            {/* Left Side: Form Inputs */}
            <div className="confirmation-form-side">
              {customFields.length > 0 ? (
                <div className="custom-fields-box glass-subcard" style={{ padding: '16px', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '0.85rem', marginBottom: '12px', color: 'var(--primary-accent)' }}>
                    Campos do Serviço ({targetService?.title}):
                  </h4>
                  {customFields.map((field) => (
                    <div key={field.id} className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label">
                        {field.field_label} {field.is_required && <span style={{ color: 'var(--danger-accent)' }}>*</span>}
                      </label>
                      <input
                        type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                        className="input-control"
                        placeholder={`Informe ${field.field_label.toLowerCase()}`}
                        value={collectedData[field.field_label] || ''}
                        onChange={(e) => setCollectedData({ ...collectedData, [field.field_label]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="alert-banner info" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                  Confirme o agendamento para enviar a notificação formatada para o cliente.
                </div>
              )}

              {!isFormValid && (
                <div className="alert-banner error" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={14} /> Preencha todos os campos obrigatórios (*) para enviar.
                </div>
              )}
            </div>

            {/* Right Side: Real-Time WhatsApp Live Message Preview */}
            <div className="confirmation-preview-side">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <MessageSquare size={16} style={{ color: '#25D366' }} /> Prévia do WhatsApp (Ao Vivo):
              </label>
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
                  minHeight: '180px'
                }}
              >
                {generateLiveMessage()}
                <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#8696a0', marginTop: '12px' }}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                </div>
              </div>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '24px' }}>
            <button type="button" className="btn secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={!isFormValid || submitting}>
              {submitting ? 'Confirmando...' : <><Send size={16} /> Confirmar & Enviar WhatsApp</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
