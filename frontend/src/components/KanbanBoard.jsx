import React, { useState, useEffect } from 'react';
import { LayoutGrid, Clock, CheckCircle2, XCircle, ArrowRight, User, Phone, Tag, RefreshCw, Plus, CalendarPlus, X, FileText, ExternalLink, GripVertical, CheckSquare, Bot, AlertTriangle, Eye, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { CompletionModal } from './CompletionModal';
import { ServiceConfirmationModal } from './ServiceConfirmationModal';

export function KanbanBoard({ tenantId, apiBaseUrl }) {
  const [cards, setCards] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const [cardToComplete, setCardToComplete] = useState(null);
  const [cardToConfirm, setCardToConfirm] = useState(null);
  const [rpaCardResult, setRpaCardResult] = useState(null);
  const [runningRpaId, setRunningRpaId] = useState(null);
  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [expandedCardIds, setExpandedCardIds] = useState({});

  const toggleCardExpanded = (cardId, e) => {
    if (e) e.stopPropagation();
    setExpandedCardIds(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  // New Card Form state
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [initialStatus, setInitialStatus] = useState('created');
  const [collectedData, setCollectedData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const columns = [
    { status: 'created', title: '📌 1. Novos Pedidos', icon: Clock, color: 'blue' },
    { status: 'in_progress', title: '⏳ 2. Em Andamento', icon: ArrowRight, color: 'amber' },
    { status: 'completed', title: '✅ 3. Concluídos', icon: CheckCircle2, color: 'emerald' },
    { status: 'cancelled', title: '❌ 4. Cancelados', icon: XCircle, color: 'rose' }
  ];

  const fetchCards = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/cards?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setCards(data);
      }
    } catch (err) {
      console.error('Error fetching cards:', err);
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    if (tenantId) {
      fetchCards();
      fetchServices();
    }
  }, [tenantId]);

  // Realtime subscription on cards table
  useEffect(() => {
    const channel = supabase
      .channel('kanban-cards-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards' },
        () => {
          fetchCards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const handleUpdateStatus = async (card, newStatus) => {
    if (newStatus === 'completed') {
      setCardToComplete(card);
      return;
    }

    try {
      // Optimistic update
      setCards(cards.map(c => c.id === card.id ? { ...c, status: newStatus } : c));

      const res = await fetch(`${apiBaseUrl}/api/cards/${card.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        fetchCards();
      }
    } catch (err) {
      console.error('Failed to update card status:', err);
      fetchCards();
    }
  };

  // Drag and Drop Handlers for Kanban Cards
  const handleDragStart = (e, card) => {
    setDraggedCard(card);
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverColumn(null);
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedCard || draggedCard.status === targetStatus) return;

    handleUpdateStatus(draggedCard, targetStatus);
    setDraggedCard(null);
  };

  // Execute RPA Automation
  const handleExecuteRpa = async (card) => {
    setRunningRpaId(card.id);
    try {
      const res = await fetch(`${apiBaseUrl}/api/cards/${card.id}/execute-automation`, {
        method: 'POST'
      });

      const data = await res.json();
      fetchCards();

      if (res.ok && data.success) {
        setRpaCardResult({ card, result: data });
      } else {
        alert(`Erro ou falha no RPA: ${data.error || 'Falha na execução'}`);
        setRpaCardResult({ card, result: data });
      }
    } catch (err) {
      alert(`Falha ao disparar RPA: ${err.message}`);
    } finally {
      setRunningRpaId(null);
    }
  };

  const handleCreateCard = async (e) => {
    e.preventDefault();
    if (!selectedServiceId || !contactName.trim() || !contactPhone.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          service_id: selectedServiceId,
          contact_name: contactName,
          contact_phone: contactPhone,
          status: initialStatus,
          collected_data: collectedData
        })
      });

      if (res.ok) {
        const newCard = await res.json();
        setShowNewCardModal(false);
        setContactName('');
        setContactPhone('');
        setCollectedData({});
        fetchCards();

        if (initialStatus === 'completed') {
          setCardToComplete(newCard);
        }
      } else {
        const err = await res.json();
        alert(`Erro ao criar cartão: ${err.error}`);
      }
    } catch (err) {
      alert(`Erro ao criar cartão: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSelectedService = services.find(s => s.id === selectedServiceId);

  return (
    <div className="kanban-container glass-card">
      <div className="section-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h2><LayoutGrid size={24} className="accent-icon" /> 📌 Quadro de Pedidos dos Clientes</h2>
            <p>Acompanhe e confirme os pedidos dos seus clientes em colunas organizadas.</p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn secondary" onClick={fetchCards} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} /> Atualizar Lista
            </button>

            <button className="btn primary" onClick={() => setShowNewCardModal(true)}>
              <Plus size={18} /> ➕ Abrir Novo Pedido
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Grid */}
      <div className="kanban-grid">
        {columns.map((col) => {
          const ColumnIcon = col.icon;
          const columnCards = cards.filter(c => c.status === col.status);
          const isTarget = dragOverColumn === col.status;

          return (
            <div
              key={col.status}
              className={`kanban-column column-${col.color} glass-subcard ${isTarget ? 'drag-target' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              <div className="column-header">
                <div className="column-title">
                  <ColumnIcon size={18} />
                  <h3>{col.title}</h3>
                </div>
                <span className="card-count-badge">{columnCards.length}</span>
              </div>

              <div className="cards-stack">
                {columnCards.map((card) => {
                  const autoStatus = card.automation_status || 'idle';
                  const isRpaRunning = runningRpaId === card.id || autoStatus === 'running';
                  const isExpanded = !!expandedCardIds[card.id];

                  return (
                    <div
                      key={card.id}
                      className={`kanban-card glass-subcard draggable-card ${isExpanded ? 'is-expanded' : ''} ${draggedCard?.id === card.id ? 'is-dragging' : ''}`}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, card)}
                      onClick={(e) => toggleCardExpanded(card.id, e)}
                    >
                      <div className="card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="service-tag">
                          <Tag size={12} /> {card.services?.title || 'Serviço'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-icon card-expand-toggle-btn"
                            onClick={(e) => toggleCardExpanded(card.id, e)}
                            title={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                            style={{ padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <GripVertical size={16} className="drag-handle" style={{ cursor: 'grab', color: 'var(--text-muted)' }} />
                        </div>
                      </div>

                      <div className="card-contact">
                        <div className="contact-name"><User size={14} /> {card.contacts?.name || 'Cliente'}</div>
                        <div className="contact-phone"><Phone size={12} /> {card.contacts?.phone}</div>
                      </div>

                      {/* Small Hover & Collapsed Indicator Hint */}
                      <div className="card-expand-hint">
                        <span>{isExpanded ? '▲ Detalhes Abertos' : '👉 Clique ou passe o mouse para ver os detalhes'}</span>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </div>

                      {/* Collapsible Container (Expands on Hover or Click) */}
                      <div className="card-collapsible-body" onClick={(e) => e.stopPropagation()}>
                        {card.collected_data && Object.keys(card.collected_data).length > 0 && (
                          <div className="collected-data-box">
                            {Object.entries(card.collected_data).map(([key, val]) => (
                              <div key={key} className="data-row">
                                <strong>{key}:</strong> {String(val)}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* RPA Automation Status Badge & Execution Button */}
                        <div className="rpa-badge-container glass-subcard" style={{ marginTop: '8px', padding: '8px', fontSize: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Bot size={12} className="accent-icon" /> Preenchimento no Site:
                            </span>
                            <span className={`status-tag status-${autoStatus}`} style={{ textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                              {autoStatus === 'idle' && '⚪ Inativo'}
                              {autoStatus === 'running' && '🟡 Digitando...'}
                              {autoStatus === 'success' && '🟢 Concluído'}
                              {autoStatus === 'failed' && '🔴 Falha'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn primary"
                              disabled={isRpaRunning || !card.services?.external_url}
                              onClick={() => handleExecuteRpa(card)}
                              style={{ fontSize: '0.7rem', padding: '4px 8px', width: '100%', justifyContent: 'center' }}
                              title={!card.services?.external_url ? 'Cadastre o site externo nas configurações do serviço' : 'Executar preenchimento no site'}
                            >
                              {isRpaRunning ? <><RefreshCw size={12} className="spin" /> Digitando...</> : <><Bot size={12} /> Preencher no Site</>}
                            </button>

                            {card.automation_result && (
                              <button
                                type="button"
                                className="btn secondary"
                                onClick={() => setRpaCardResult({ card, result: card.automation_result })}
                                style={{ fontSize: '0.7rem', padding: '4px 6px' }}
                                title="Ver comprovante da digitação"
                              >
                                <Eye size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Attachment Metadata Box if card is completed */}
                        {card.attachment_url && (
                          <div className="attachment-box glass-subcard" style={{ marginTop: '8px', padding: '8px', fontSize: '0.75rem' }}>
                            <div style={{ fontWeight: '600', color: 'var(--secondary-accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FileText size={12} /> Comprovante de Agendamento Anexo
                            </div>
                            {(card.attachment_metadata?.protocol_number || card.attachment_metadata?.document_number) && (
                              <div>📑 Protocolo: <strong>{card.attachment_metadata.protocol_number || card.attachment_metadata.document_number}</strong></div>
                            )}
                            {card.attachment_metadata?.appointment_location && (
                              <div>📍 Local: <strong>{card.attachment_metadata.appointment_location}</strong></div>
                            )}
                            {(card.attachment_metadata?.appointment_date || card.attachment_metadata?.appointment_time) && (
                              <div>📅 Data: <strong>{card.attachment_metadata.appointment_date || card.attachment_metadata.document_date} {card.attachment_metadata.appointment_time ? `às ${card.attachment_metadata.appointment_time}` : ''}</strong></div>
                            )}
                            {card.attachment_metadata?.total_value && (
                              <div>Valor: <strong>R$ {card.attachment_metadata.total_value}</strong></div>
                            )}
                            <a
                              href={card.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--primary-accent)', display: 'inline-flex', alignItems: 'center', gap: '2px', marginTop: '4px', textDecoration: 'none' }}
                            >
                              Ver documento de agendamento <ExternalLink size={10} />
                            </a>
                          </div>
                        )}

                        <div className="card-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                          <button
                            type="button"
                            className="btn secondary"
                            style={{ fontSize: '0.75rem', padding: '4px 8px', justifyContent: 'center' }}
                            onClick={() => setCardToConfirm(card)}
                          >
                            <CheckSquare size={12} /> 💬 Confirmar com o Cliente
                          </button>

                          <div>
                            <label className="action-label">Mover este pedido para:</label>
                            <select
                              className="input-control select-sm"
                              value={card.status}
                              onChange={(e) => handleUpdateStatus(card, e.target.value)}
                            >
                              <option value="created">1. Novos Pedidos</option>
                              <option value="in_progress">2. Em Andamento</option>
                              <option value="completed">3. Concluídos ✅</option>
                              <option value="cancelled">4. Cancelados</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {columnCards.length === 0 && (
                  <div className="column-empty">Nenhum pedido nesta coluna no momento.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Novo Cartão / Atendimento */}
      {showNewCardModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ position: 'relative' }}>
            <button className="btn-icon modal-close-btn" onClick={() => setShowNewCardModal(false)}>
              <X size={20} />
            </button>

            <h3><CalendarPlus size={22} className="accent-icon" /> ➕ Abrir Novo Pedido</h3>
            <p style={{ margin: '8px 0 16px', color: 'var(--text-secondary)' }}>
              Preencha os dados simples abaixo para cadastrar o cliente no quadro:
            </p>

            <form onSubmit={handleCreateCard}>
              <div className="form-group">
                <label className="form-label">Serviço</label>
                <select
                  className="input-control"
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  required
                >
                  <option value="">-- Selecione um Serviço --</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Nome do Cliente</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Ex: João da Silva"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="Ex: 5511999999999"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status Inicial do Cartão</label>
                <select
                  className="input-control"
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value)}
                >
                  <option value="created">Criado / Solicitado</option>
                  <option value="in_progress">Em Andamento</option>
                  <option value="completed">Concluído</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              {/* Dynamic Question Fields */}
              {currentSelectedService && currentSelectedService.custom_fields?.map((field) => (
                <div key={field.id} className="form-group">
                  <label className="form-label">
                    {field.field_label} {field.is_required && '*'}
                  </label>
                  <input
                    type={field.field_type === 'number' ? 'number' : 'text'}
                    className="input-control"
                    placeholder={`Preencha ${field.field_label.toLowerCase()}`}
                    required={field.is_required}
                    onChange={(e) => setCollectedData({ ...collectedData, [field.field_label]: e.target.value })}
                  />
                </div>
              ))}

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="btn secondary" onClick={() => setShowNewCardModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Criar Cartão & Disparar Notificação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal with Real-Time WhatsApp Live Message Preview */}
      {cardToConfirm && (
        <ServiceConfirmationModal
          card={cardToConfirm}
          tenantId={tenantId}
          apiBaseUrl={apiBaseUrl}
          onClose={() => setCardToConfirm(null)}
          onConfirmed={() => {
            setCardToConfirm(null);
            fetchCards();
          }}
        />
      )}

      {/* Completion Modal with Document Upload & OCR Analysis */}
      {cardToComplete && (
        <CompletionModal
          card={cardToComplete}
          tenantId={tenantId}
          apiBaseUrl={apiBaseUrl}
          onClose={() => setCardToComplete(null)}
          onCompleted={() => {
            setCardToComplete(null);
            fetchCards();
          }}
        />
      )}

      {/* RPA Result & Screenshot Modal */}
      {rpaCardResult && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '640px', position: 'relative' }}>
            <button className="btn-icon modal-close-btn" onClick={() => setRpaCardResult(null)}>
              <X size={20} />
            </button>

            <h3><Bot size={22} className="accent-icon" /> Comprovação de Execução RPA</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 16px' }}>
              Card: <strong>{rpaCardResult.card?.contacts?.name || 'Cliente'}</strong> - Status: <strong style={{ textTransform: 'uppercase' }}>{rpaCardResult.result?.status}</strong>
            </p>

            {rpaCardResult.result?.screenshot_url && (
              <div style={{ background: '#000', padding: '8px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center' }}>
                <img
                  src={rpaCardResult.result.screenshot_url}
                  alt="Print de Comprovação RPA"
                  style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '8px' }}
                />
                <a
                  href={rpaCardResult.result.screenshot_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--primary-accent)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', textDecoration: 'none' }}
                >
                  Abrir print em tamanho real <ExternalLink size={12} />
                </a>
              </div>
            )}

            {rpaCardResult.result?.error && (
              <div className="alert-banner error" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} /> <strong>Erro:</strong> {rpaCardResult.result.error}
              </div>
            )}

            {/* Execution Logs */}
            <div className="logs-box glass-subcard" style={{ background: '#090d16', padding: '12px', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              <div style={{ fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Logs de Execução:</div>
              {rpaCardResult.result?.logs?.map((log, i) => (
                <div key={i} style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: log.message?.includes('ERROR') ? '#f87171' : '#94a3b8', marginBottom: '4px' }}>
                  [{new Date(log.time).toLocaleTimeString()}] {log.message}
                </div>
              ))}
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn primary" onClick={() => setRpaCardResult(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
