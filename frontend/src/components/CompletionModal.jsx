import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, RefreshCw, X, Eye, FileCheck, HelpCircle, Receipt, UserCheck, FileQuestion } from 'lucide-react';

export function CompletionModal({ card, tenantId, apiBaseUrl, onClose, onCompleted }) {
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetService, setTargetService] = useState(null);
  
  const [attachmentUrl, setAttachmentUrl] = useState(card.attachment_url || '');
  const [collectedData, setCollectedData] = useState(card.collected_data || {});
  const [metadata, setMetadata] = useState(card.attachment_metadata || {
    document_number: '',
    rg_number: '',
    cpf: '',
    full_name: '',
    birth_date: '',
    issuing_organ: '',
    total_value: '',
    document_date: new Date().toISOString().split('T')[0],
    notes: 'Atendimento concluído com sucesso.'
  });

  // Fetch Service Details & completion_type
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
        console.error('Error fetching service details:', err);
      }
    }
    fetchServiceDetails();
  }, [card.service_id, tenantId, apiBaseUrl]);

  const completionType = targetService?.completion_type || 'identity';

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      autoAnalyzeFile(selectedFile);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      autoAnalyzeFile(selectedFile);
    }
  };

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
          full_name: ext.full_name || card.contacts?.name || prev.full_name,
          birth_date: ext.birth_date || prev.birth_date,
          issuing_organ: ext.issuing_organ || prev.issuing_organ,
          document_date: ext.document_date || prev.document_date,
          total_value: ext.total_value || prev.total_value
        }));
      }
    } catch (err) {
      console.error('Error analyzing document:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      if (file && !attachmentUrl) {
        formData.append('document', file);
      }
      formData.append('tenant_id', tenantId);
      formData.append('attachment_url', attachmentUrl);
      formData.append('collected_data', JSON.stringify(collectedData));
      formData.append('attachment_metadata', JSON.stringify({
        ...metadata,
        ...collectedData
      }));

      const res = await fetch(`${apiBaseUrl}/api/cards/${card.id}/complete-with-attachment`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        onCompleted();
      } else {
        const err = await res.json();
        alert(`Erro ao concluir cartão: ${err.error}`);
      }
    } catch (err) {
      alert(`Erro na conclusão: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxWidth: '580px', position: 'relative' }}>
        <button className="btn-icon modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-title-group">
          <h3>
            {completionType === 'identity' && <UserCheck size={24} style={{ color: 'var(--secondary-accent)' }} />}
            {completionType === 'financial' && <Receipt size={24} style={{ color: 'var(--secondary-accent)' }} />}
            {completionType === 'custom_fields' && <FileQuestion size={24} style={{ color: 'var(--secondary-accent)' }} />}
            {completionType === 'simple' && <FileCheck size={24} style={{ color: 'var(--secondary-accent)' }} />}
            {' '} Conclusão de Servico ({card.services?.title})
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Cliente: <strong>{card.contacts?.name || 'Cliente'}</strong>
          </p>
        </div>

        <form onSubmit={handleFinalSubmit} style={{ marginTop: '20px' }}>

          {/* MODE 1: IDENTITY (RG / CPF) */}
          {completionType === 'identity' && (
            <>
              <div className="alert-banner info" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
                🆔 Modal de Leitura de Identidade: Arraste o RG/CPF do cliente ou digite os dados abaixo.
              </div>

              {/* Upload Dropzone */}
              <div
                className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('identity-file-input').click()}
                style={{
                  border: '2px dashed var(--border-glass)',
                  borderRadius: '12px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragOver ? 'rgba(99, 102, 241, 0.15)' : 'rgba(15, 23, 42, 0.4)',
                  marginBottom: '16px'
                }}
              >
                <input id="identity-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={handleFileChange} />
                <Upload size={28} style={{ color: 'var(--primary-accent)', margin: '0 auto 6px' }} />
                <p style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  {file ? file.name : 'Arraste o documento de Identidade (RG/CPF) ou clique aqui'}
                </p>
              </div>

              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">RG / Nº da Identidade</label>
                  <input type="text" className="input-control" placeholder="12.345.678-9" value={metadata.rg_number || ''} onChange={(e) => setMetadata({ ...metadata, rg_number: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">CPF</label>
                  <input type="text" className="input-control" placeholder="000.000.000-00" value={metadata.cpf || ''} onChange={(e) => setMetadata({ ...metadata, cpf: e.target.value })} />
                </div>
              </div>

              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Nome Completo</label>
                  <input type="text" className="input-control" value={metadata.full_name || ''} onChange={(e) => setMetadata({ ...metadata, full_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Órgão Emissor</label>
                  <input type="text" className="input-control" placeholder="SSP/SP" value={metadata.issuing_organ || ''} onChange={(e) => setMetadata({ ...metadata, issuing_organ: e.target.value })} />
                </div>
              </div>
            </>
          )}

          {/* MODE 2: FINANCIAL (NFE / RECEIPT) */}
          {completionType === 'financial' && (
            <>
              <div className="alert-banner info" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
                🧾 Modal Financeiro: Arraste a Nota Fiscal/Recibo para extrair Valor R$ e Nº do Comprovante.
              </div>

              <div
                className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('financial-file-input').click()}
                style={{
                  border: '2px dashed var(--border-glass)',
                  borderRadius: '12px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragOver ? 'rgba(99, 102, 241, 0.15)' : 'rgba(15, 23, 42, 0.4)',
                  marginBottom: '16px'
                }}
              >
                <input id="financial-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={handleFileChange} />
                <Upload size={28} style={{ color: 'var(--primary-accent)', margin: '0 auto 6px' }} />
                <p style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                  {file ? file.name : 'Arraste a Nota Fiscal / Recibo ou clique para selecionar'}
                </p>
              </div>

              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Nº da Nota Fiscal / Recibo</label>
                  <input type="text" className="input-control" placeholder="NF-10293" value={metadata.document_number || ''} onChange={(e) => setMetadata({ ...metadata, document_number: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Valor Total (R$)</label>
                  <input type="text" className="input-control" placeholder="150,00" value={metadata.total_value || ''} onChange={(e) => setMetadata({ ...metadata, total_value: e.target.value })} />
                </div>
              </div>
            </>
          )}

          {/* MODE 3: CUSTOM FIELDS CHECKLIST */}
          {completionType === 'custom_fields' && targetService?.custom_fields?.length > 0 && (
            <div className="service-custom-fields-box glass-subcard" style={{ marginBottom: '16px', padding: '16px' }}>
              <h4 style={{ fontSize: '0.85rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HelpCircle size={16} className="accent-icon" /> Checklist Final do Serviço ({targetService.title})
              </h4>
              {targetService.custom_fields.map((field) => (
                <div key={field.id} className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label">
                    {field.field_label} {field.is_required && '*'}
                  </label>
                  <input
                    type={field.field_type === 'number' ? 'number' : 'text'}
                    className="input-control"
                    placeholder={`Informe ${field.field_label.toLowerCase()}`}
                    value={collectedData[field.field_label] || ''}
                    required={field.is_required}
                    onChange={(e) => setCollectedData({ ...collectedData, [field.field_label]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          {/* MODE 4: SIMPLE NOTES (Common to all modes) */}
          <div className="form-group">
            <label className="form-label">Observações / Resumo da Conclusão</label>
            <textarea
              className="input-control textarea-control"
              placeholder="Observações enviadas ao cliente no WhatsApp..."
              value={metadata.notes || ''}
              onChange={(e) => setMetadata({ ...metadata, notes: e.target.value })}
              rows={2}
            />
          </div>

          {attachmentUrl && (
            <div style={{ fontSize: '0.8rem', color: 'var(--primary-accent)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={14} /> Documento armazenado: <a href={attachmentUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>Ver arquivo original</a>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button type="button" className="btn secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={submitting || analyzing}>
              {submitting ? 'Concluindo...' : <><CheckCircle2 size={16} /> Confirmar & Disparar Notificação</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
