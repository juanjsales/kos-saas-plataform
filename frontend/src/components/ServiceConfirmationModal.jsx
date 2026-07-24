import React, { useState, useEffect } from 'react';
import { CheckCircle2, MessageSquare, Lock, X, Send, Upload, FileText, Bot, HelpCircle, Receipt, UserCheck, FileCheck, Eye, RefreshCw } from 'lucide-react';

export function ServiceConfirmationModal({ card, tenantId, apiBaseUrl, onClose, onConfirmed, onCompleted }) {
  const [targetService, setTargetService] = useState(null);
  const [collectedData, setCollectedData] = useState(card?.collected_data || {});
  const [submitting, setSubmitting] = useState(false);

  // Attachment & OCR state
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState(card?.attachment_url || '');
  const [metadata, setMetadata] = useState(card?.attachment_metadata || {
    document_number: '',
    rg_number: '',
    cpf: '',
    full_name: card?.contacts?.name || '',
    total_value: '',
    document_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    async function fetchServiceDetails() {
      if (!card?.service_id) return;
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
  }, [card?.service_id, tenantId, apiBaseUrl]);

  const customFields = targetService?.custom_fields || [];
  const rawTemplate = targetService?.confirmation_template || 
    'Olá {contact_name}, seu agendamento para *{service_title}* foi confirmado com sucesso!';

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
      contact_name: card?.contacts?.name || 'Cliente',
      service_title: card?.services?.title || targetService?.title || 'Serviço',
      status: card?.status === 'completed' ? 'Concluído' : (card?.status || 'Confirmado'),
      confirmed_at: new Date().toLocaleDateString('pt-BR'),
      notes: metadata.notes || '',
      document_number: metadata.document_number || '',
      total_value: metadata.total_value || '',
      ...collectedData
    };

    for (const [key, val] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      const displayVal = formatValue(val);
      message = message.replace(regex, displayVal !== undefined && displayVal !== null && String(displayVal).trim() !== '' ? String(displayVal) : `[${key}]`);
    }

    return message;
  };

  // OCR Attachment Analysis
  const autoAnalyzeFile = async (fileToAnalyze) => {
    setAnalyzing(true);
    const formData = new FormData();
    formData.append('document', fileToAnalyze);
    formData.append('tenant_id', tenantId);

    try {
      const res = await fetch(`${apiBaseUrl}/api/cards/analyze-attachment`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setAttachmentUrl(data.attachment_url);
        
        const ext = data.attachment_metadata || {};
        setMetadata(prev => ({
          ...prev,
          document_number: ext.document_number || prev.document_number,
          rg_number: ext.rg_number || prev.rg_number,
          cpf: ext.cpf || prev.cpf,
          full_name: ext.full_name || card?.contacts?.name || prev.full_name,
          total_value: ext.total_value || prev.total_value
        }));
      }
    } catch (err) {
      console.error('Error analyzing document:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      autoAnalyzeFile(selectedFile);
    }
  };

  // Send WhatsApp Notification Only (without completing card)
  const handleConfirmWhatsAppOnly = async () => {
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
        if (onConfirmed) onConfirmed();
        else if (onCompleted) onCompleted();
        onClose();
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

  // Complete Card and Dispatch WhatsApp Alert
  const handleCompleteCardAndNotify = async (e) => {
    if (e) e.preventDefault();
    if (!isFormValid) return;
    setSubmitting(true);

    try {
      const payload = {
        collected_data: collectedData,
        attachment_url: attachmentUrl,
        attachment_metadata: metadata,
        status: 'completed'
      };

      const res = await fetch(`${apiBaseUrl}/api/cards/${card.id}/complete-attachment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (onCompleted) onCompleted();
        else if (onConfirmed) onConfirmed();
        onClose();
      } else {
        const err = await res.json();
        alert(`Erro ao concluir cartão: ${err.error}`);
      }
    } catch (err) {
      alert(`Erro ao concluir: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card confirmation-modal-responsive" style={{ maxWidth: '900px', width: '95%', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button className="btn-icon modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-title-group">
          <h3><CheckCircle2 size={24} style={{ color: 'var(--primary-accent)' }} /> Confirmação & Conclusão do Atendimento</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Serviço: <strong>{targetService?.title || card?.services?.title || 'Serviço'}</strong> - Cliente: <strong>{card?.contacts?.name || 'Cliente'}</strong> ({card?.contacts?.phone})
          </p>
        </div>

        <form onSubmit={handleCompleteCardAndNotify} style={{ marginTop: '20px' }}>
          {/* Responsive Side-by-Side Grid Layout */}
          <div className="confirmation-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            
            {/* Left Side: Form Inputs, Questions & OCR Attachment */}
            <div className="confirmation-form-side">
              
              {/* Rich Custom Fields Checklist */}
              {customFields.length > 0 && (
                <div className="custom-fields-box glass-subcard" style={{ padding: '16px', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '0.85rem', marginBottom: '12px', color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HelpCircle size={16} /> Perguntas do Serviço ({targetService?.title}):
                  </h4>
                  {customFields.map((field) => (
                    <div key={field.id} className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label" style={{ fontWeight: '700' }}>
                        {field.field_label} {field.is_required && <span style={{ color: 'var(--danger-accent)' }}>*</span>}
                      </label>

                      {field.field_type === 'textarea' ? (
                        <textarea
                          className="input-control textarea-control"
                          placeholder={`Informe ${field.field_label.toLowerCase()}`}
                          value={collectedData[field.field_label] || ''}
                          required={field.is_required}
                          onChange={(e) => setCollectedData({ ...collectedData, [field.field_label]: e.target.value })}
                          rows={2}
                        />
                      ) : field.field_type === 'select' ? (
                        <select
                          className="input-control select-control"
                          value={collectedData[field.field_label] || ''}
                          required={field.is_required}
                          onChange={(e) => setCollectedData({ ...collectedData, [field.field_label]: e.target.value })}
                        >
                          <option value="">-- Escolha uma opção --</option>
                          {(field.options ? field.options.split(',') : []).map((opt, i) => (
                            <option key={i} value={opt.trim()}>{opt.trim()}</option>
                          ))}
                        </select>
                      ) : field.field_type === 'checkbox' ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' }}>
                          {(field.options ? field.options.split(',') : ['Sim']).map((opt, i) => {
                            const cleanOpt = opt.trim();
                            const currentVal = collectedData[field.field_label] || '';
                            const isChecked = currentVal.includes(cleanOpt);

                            const handleToggle = () => {
                              let arr = currentVal ? currentVal.split(', ').filter(Boolean) : [];
                              if (isChecked) {
                                arr = arr.filter(o => o !== cleanOpt);
                              } else {
                                arr.push(cleanOpt);
                              }
                              setCollectedData({ ...collectedData, [field.field_label]: arr.join(', ') });
                            };

                            return (
                              <label key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                <input type="checkbox" checked={isChecked} onChange={handleToggle} />
                                {cleanOpt}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          type={
                            field.field_type === 'number' ? 'number' :
                            field.field_type === 'date' ? 'date' :
                            field.field_type === 'time' ? 'time' :
                            field.field_type === 'phone' ? 'tel' : 'text'
                          }
                          className="input-control"
                          placeholder={field.field_type === 'cpf' ? '000.000.000-00' : `Informe ${field.field_label.toLowerCase()}`}
                          value={collectedData[field.field_label] || ''}
                          required={field.is_required}
                          onChange={(e) => setCollectedData({ ...collectedData, [field.field_label]: e.target.value })}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Document / Receipt Upload Box (Optional OCR) */}
              <div className="glass-subcard" style={{ padding: '14px', marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Upload size={14} className="accent-icon" /> Anexo ou Comprovante (Opcional):
                </label>
                
                <div
                  className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files?.[0]) {
                      setFile(e.dataTransfer.files[0]);
                      autoAnalyzeFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => document.getElementById('unified-file-input').click()}
                  style={{
                    border: '1.5px dashed var(--border-glass)',
                    borderRadius: '10px',
                    padding: '14px 12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: isDragOver ? 'rgba(99, 102, 241, 0.15)' : 'rgba(15, 23, 42, 0.2)'
                  }}
                >
                  <input id="unified-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={handleFileChange} />
                  <Upload size={20} style={{ color: 'var(--primary-accent)', margin: '0 auto 4px' }} />
                  <p style={{ fontWeight: '600', fontSize: '0.8rem', margin: 0 }}>
                    {analyzing ? 'Analisando documento com OCR...' : file ? file.name : 'Arraste um PDF/Foto ou clique para anexa comprovante'}
                  </p>
                </div>

                {attachmentUrl && (
                  <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--primary-accent)' }}>
                    <FileText size={12} /> <a href={attachmentUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>Ver comprovante salvo</a>
                  </div>
                )}
              </div>

              {/* Notes / Summary */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.82rem' }}>Observações do Atendimento</label>
                <textarea
                  className="input-control textarea-control"
                  placeholder="Observações enviadas ou registradas no histórico..."
                  value={metadata.notes || ''}
                  onChange={(e) => setMetadata({ ...metadata, notes: e.target.value })}
                  rows={2}
                />
              </div>

              {!isFormValid && (
                <div className="alert-banner error" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
                  <Lock size={14} /> Preencha os campos obrigatórios (*) marcados para liberar o envio.
                </div>
              )}
            </div>

            {/* Right Side: Real-Time WhatsApp Live Message Preview */}
            <div className="confirmation-preview-side">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: '700' }}>
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
                  minHeight: '220px'
                }}
              >
                {generateLiveMessage()}
                <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#8696a0', marginTop: '12px' }}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                </div>
              </div>

              <div className="alert-banner info" style={{ marginTop: '12px', fontSize: '0.78rem' }}>
                💡 A mensagem acima será formatada e enviada automaticamente para o WhatsApp do cliente!
              </div>
            </div>

          </div>

          {/* Unified Action Buttons */}
          <div className="modal-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn secondary" onClick={onClose}>
              Voltar sem Salvar
            </button>
            
            <button
              type="button"
              className="btn secondary"
              disabled={!isFormValid || submitting}
              onClick={handleConfirmWhatsAppOnly}
              style={{ border: '1px solid #25D366', color: '#25D366' }}
            >
              {submitting ? 'Enviando...' : <><Send size={16} /> Enviar Notificação WhatsApp</>}
            </button>

            <button type="submit" className="btn primary" disabled={!isFormValid || submitting || analyzing}>
              {submitting ? 'Concluindo...' : <><CheckCircle2 size={16} /> Concluir Atendimento & WhatsApp</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
