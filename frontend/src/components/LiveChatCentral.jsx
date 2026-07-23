import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, CalendarPlus, User, Phone, CheckCircle, RefreshCw, Search, Paperclip, CheckCheck, Check, MoreVertical, Smile, Bot, Sparkles, Filter } from 'lucide-react';
import { supabase } from '../config/supabaseClient';

export function LiveChatCentral({ tenantId, apiBaseUrl }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState([]);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [collectedData, setCollectedData] = useState({});
  const [isSending, setIsSending] = useState(false);
  const messagesContainerRef = useRef(null);

  // Auto-scroll inside chat messages container ONLY (does NOT scroll page or hide sidebar)
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Fetch initial chats
  const fetchChats = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/chats?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setChats(data);
        if (data.length > 0 && !selectedChat) {
          setSelectedChat(data[0]);
          fetchMessages(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  };

  // 2. Fetch services for conversion modal
  const fetchServices = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/services?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (err) {
      console.error('Error fetching services:', err);
    }
  };

  // 3. Fetch messages for selected chat
  const fetchMessages = async (chatId) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/chats/${encodeURIComponent(chatId)}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchChats();
      fetchServices();
    }
  }, [tenantId]);

  // 4. Supabase Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel('live-whatsapp-central')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new;
          if (selectedChat && newMsg.chat_id === selectedChat.id) {
            setMessages((prev) => [...prev, newMsg]);
          }
          fetchChats();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat]);

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.id);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedChat) return;

    setIsSending(true);
    const recipientPhone = selectedChat.id.replace('@s.whatsapp.net', '');
    const messageContent = replyText;

    // Optimistic local message add
    const tempMsg = {
      id: Date.now().toString(),
      chat_id: selectedChat.id,
      sender_phone: 'System/Agent',
      content: messageContent,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempMsg]);
    setReplyText('');

    try {
      const res = await fetch(`${apiBaseUrl}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone,
          content: messageContent,
          chatId: selectedChat.id
        })
      });

      if (!res.ok) {
        fetchMessages(selectedChat.id);
      }
    } catch (err) {
      console.error('Error sending WhatsApp message:', err);
      fetchMessages(selectedChat.id);
    } finally {
      setIsSending(false);
    }
  };

  const handleConvertChatToCard = async (e) => {
    e.preventDefault();
    if (!selectedChat || !selectedServiceId) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/chats/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          chat_id: selectedChat.id,
          service_id: selectedServiceId,
          contact_name: selectedChat.contact_name,
          collected_data: collectedData
        })
      });

      if (res.ok) {
        setShowConvertModal(false);
        setCollectedData({});
        alert('Conversa convertida em Cartão de Atendimento com sucesso!');
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (err) {
      alert(`Erro ao converter conversa: ${err.message}`);
    }
  };

  const filteredChats = chats.filter((c) => {
    const query = searchQuery.toLowerCase();
    const isSelfOrBroadcast =
      c.id?.includes('status@broadcast') ||
      c.id?.includes('@g.us') ||
      c.id?.endsWith('@newsletter');

    if (isSelfOrBroadcast) return false;

    return (
      c.contact_name?.toLowerCase().includes(query) ||
      c.id?.toLowerCase().includes(query)
    );
  });

  const currentSelectedService = services.find(s => s.id === selectedServiceId);

  return (
    <div className="wa-web-container">
      <div className="wa-web-app">
        {/* LEFT PANEL: CONTACTS LIST (WHATSAPP WEB SIDEBAR) */}
        <div className="wa-sidebar">
          {/* Header Bar */}
          <div className="wa-sidebar-header">
            <div className="wa-my-profile">
              <div className="wa-avatar-circle my-avatar">
                <span>KOS</span>
              </div>
              <span className="wa-my-name">Atendimento WhatsApp</span>
            </div>

            <div className="wa-header-actions">
              <button className="wa-icon-btn" onClick={fetchChats} title="Atualizar Conversas">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {/* Search Box Bar */}
          <div className="wa-search-bar">
            <div className="wa-search-input-wrapper">
              <Search size={16} className="wa-search-icon" />
              <input
                type="text"
                placeholder="Pesquisar ou começar uma nova conversa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="wa-search-input"
              />
            </div>
          </div>

          {/* Contact List */}
          <div className="wa-chats-list">
            {filteredChats.map((chat) => {
              const isSelected = selectedChat?.id === chat.id;
              const phoneClean = chat.id.replace('@s.whatsapp.net', '');
              const initial = chat.contact_name ? chat.contact_name.charAt(0).toUpperCase() : 'C';

              return (
                <div
                  key={chat.id}
                  className={`wa-chat-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectChat(chat)}
                >
                  <div className="wa-avatar-circle">
                    {initial}
                  </div>

                  <div className="wa-chat-details">
                    <div className="wa-chat-top-row">
                      <span className="wa-chat-name">{chat.contact_name || phoneClean}</span>
                      <span className="wa-chat-time">
                        {chat.updated_at ? new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoje'}
                      </span>
                    </div>

                    <div className="wa-chat-bottom-row">
                      <span className="wa-chat-preview">
                        <Phone size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        {phoneClean}
                      </span>

                      <span className="wa-unread-badge">Ativo</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredChats.length === 0 && (
              <div className="wa-empty-sidebar">
                <MessageSquare size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <p>Nenhuma conversa encontrada.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: MAIN WHATSAPP CHAT THREAD */}
        <div className="wa-chat-panel">
          {selectedChat ? (
            <>
              {/* WhatsApp Web Chat Header */}
              <div className="wa-chat-header">
                <div className="wa-contact-header-info">
                  <div className="wa-avatar-circle">
                    {selectedChat.contact_name ? selectedChat.contact_name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div>
                    <h3 className="wa-contact-title">{selectedChat.contact_name}</h3>
                    <span className="wa-contact-subtext">
                      <span className="wa-online-dot"></span> online no WhatsApp • {selectedChat.id.replace('@s.whatsapp.net', '')}
                    </span>
                  </div>
                </div>

                <div className="wa-chat-header-actions">
                  <button
                    className="wa-btn-convert"
                    onClick={() => setShowConvertModal(true)}
                  >
                    <CalendarPlus size={16} />
                    <span>Criar Atendimento / Cartão</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp Authentic Pattern Messages Area */}
              <div className="wa-messages-area" ref={messagesContainerRef}>
                <div className="wa-encryption-banner">
                  🔒 As mensagens e chamadas são protegidas com a criptografia de ponta a ponta do WhatsApp.
                </div>

                {messages.map((msg) => {
                  const isOutbound = msg.sender_phone === 'System/Agent';
                  const timeFormatted = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={msg.id}
                      className={`wa-bubble-wrapper ${isOutbound ? 'outbound' : 'inbound'}`}
                    >
                      <div className={`wa-bubble ${isOutbound ? 'outbound-bubble' : 'inbound-bubble'}`}>
                        <div className="wa-msg-text">{msg.content}</div>

                        <div className="wa-msg-meta">
                          <span className="wa-msg-time">{timeFormatted}</span>
                          {isOutbound && (
                            <CheckCheck size={15} className="wa-double-check" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* WhatsApp Web Bottom Input Bar */}
              <form onSubmit={handleSendMessage} className="wa-input-bar">
                <button type="button" className="wa-input-icon-btn" title="Anexar">
                  <Paperclip size={20} />
                </button>

                <input
                  type="text"
                  className="wa-message-input"
                  placeholder="Digite uma mensagem..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />

                <button
                  type="submit"
                  className="wa-send-btn"
                  disabled={!replyText.trim() || isSending}
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div className="wa-no-chat-screen">
              <div className="wa-welcome-box">
                <MessageSquare size={64} className="wa-welcome-icon" />
                <h2>KOS WhatsApp Web Central</h2>
                <p>Envie e receba mensagens do WhatsApp em tempo real com sincronização automática!</p>
                <div className="wa-secure-badge">
                  <Sparkles size={14} /> Criptografia de Ponta a Ponta Ativa
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Convert Chat to Service Appointment/Card */}
      {showConvertModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '520px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarPlus size={22} className="accent-icon" /> Converter Conversa em Cartão
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Cliente: <strong>{selectedChat?.contact_name}</strong> ({selectedChat?.id.replace('@s.whatsapp.net', '')})
            </p>

            <form onSubmit={handleConvertChatToCard}>
              <div className="form-group">
                <label className="form-label">Selecione o Serviço</label>
                <select
                  className="input-control select-control"
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  required
                >
                  <option value="">-- Escolha o serviço desejado --</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              {currentSelectedService && currentSelectedService.custom_fields?.map((field) => (
                <div key={field.id} className="form-group">
                  <label className="form-label">
                    {field.field_label} {field.is_required && '*'}
                  </label>
                  <input
                    type={field.field_type === 'number' ? 'number' : 'text'}
                    className="input-control"
                    required={field.is_required}
                    placeholder={`Informe ${field.field_label.toLowerCase()}`}
                    onChange={(e) => setCollectedData({ ...collectedData, [field.field_label]: e.target.value })}
                  />
                </div>
              ))}

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="btn secondary" onClick={() => setShowConvertModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary">
                  <CheckCircle size={16} /> Confirmar & Criar Atendimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
