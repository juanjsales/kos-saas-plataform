import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, CalendarPlus, User, Phone, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../config/supabaseClient';

export function LiveChatCentral({ tenantId, apiBaseUrl }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [services, setServices] = useState([]);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [collectedData, setCollectedData] = useState({});
  const [isSending, setIsSending] = useState(false);

  // 1. Fetch initial chats
  const fetchChats = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/chats?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setChats(data);
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

  // 4. Supabase Realtime Subscription for incoming/outgoing messages & chats
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

    try {
      const res = await fetch(`${apiBaseUrl}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone,
          content: replyText,
          chatId: selectedChat.id
        })
      });

      if (res.ok) {
        setReplyText('');
        fetchMessages(selectedChat.id);
      }
    } catch (err) {
      console.error('Error sending WhatsApp message:', err);
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

  const currentSelectedService = services.find(s => s.id === selectedServiceId);

  return (
    <div className="chat-central-container glass-card">
      <div className="chat-layout">
        {/* Left Sidebar: Active WhatsApp Chats */}
        <div className="chat-sidebar">
          <div className="sidebar-header">
            <h3><MessageSquare size={20} /> Conversas WhatsApp</h3>
            <button className="btn-icon" onClick={fetchChats} title="Atualizar">
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="chat-list">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                onClick={() => handleSelectChat(chat)}
              >
                <div className="chat-avatar">
                  <User size={20} />
                </div>
                <div className="chat-info">
                  <div className="contact-name">{chat.contact_name}</div>
                  <div className="chat-phone">{chat.id.replace('@s.whatsapp.net', '')}</div>
                </div>
              </div>
            ))}
            {chats.length === 0 && (
              <div className="empty-state">Nenhuma conversa recebida ainda.</div>
            )}
          </div>
        </div>

        {/* Right Panel: Conversation View */}
        <div className="chat-main">
          {selectedChat ? (
            <>
              <div className="chat-header">
                <div>
                  <h3>{selectedChat.contact_name}</h3>
                  <span className="phone-sub"><Phone size={14} /> {selectedChat.id.replace('@s.whatsapp.net', '')}</span>
                </div>
                <button
                  className="btn primary convert-btn"
                  onClick={() => setShowConvertModal(true)}
                >
                  <CalendarPlus size={18} /> Converter em Atendimento / Cartão
                </button>
              </div>

              {/* Message Thread */}
              <div className="messages-thread">
                {messages.map((msg) => {
                  const isOutbound = msg.sender_phone === 'System/Agent';
                  return (
                    <div
                      key={msg.id}
                      className={`message-bubble ${isOutbound ? 'outbound' : 'inbound'}`}
                    >
                      <div className="msg-content">{msg.content}</div>
                      <div className="msg-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendMessage} className="reply-form">
                <input
                  type="text"
                  className="input-control reply-input"
                  placeholder="Digite sua resposta no WhatsApp..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <button type="submit" className="btn primary send-btn" disabled={isSending}>
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div className="no-chat-selected">
              <MessageSquare size={48} className="faded-icon" />
              <p>Selecione uma conversa ao lado para visualizar a Central ao vivo.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Convert Chat to Service Appointment/Card */}
      {showConvertModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <h3><CalendarPlus size={20} /> Converter Conversa em Cartão de Serviço</h3>
            <p>Selecione o serviço e preencha os dados coletados do atendimento:</p>

            <form onSubmit={handleConvertChatToCard}>
              <div className="form-group">
                <label className="form-label">Serviço Desejado</label>
                <select
                  className="input-control"
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  required
                >
                  <option value="">-- Selecione o Serviço --</option>
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
                    onChange={(e) => setCollectedData({ ...collectedData, [field.field_label]: e.target.value })}
                  />
                </div>
              ))}

              <div className="modal-actions">
                <button type="button" className="btn secondary" onClick={() => setShowConvertModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary">
                  <CheckCircle size={16} /> Confirmar & Agendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
