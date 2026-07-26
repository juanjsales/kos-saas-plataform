import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, CalendarPlus, User, Phone, CheckCircle, RefreshCw, Search,
  Paperclip, CheckCheck, Sparkles, Filter, Bot, ChevronRight, X, Image, FileText,
  Clock, AlertCircle, Zap, Tag, ChevronLeft, Check, Edit3, ArrowRight, CornerDownLeft
} from 'lucide-react';
import { supabase } from '../config/supabaseClient';

export function LiveChatCentral({ tenantId, apiBaseUrl }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'unread', 'active'
  const [services, setServices] = useState([]);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [collectedData, setCollectedData] = useState({});
  const [isSending, setIsSending] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showCustomerDrawer, setShowCustomerDrawer] = useState(true);
  const [customerCards, setCustomerCards] = useState([]);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const messagesContainerRef = useRef(null);

  // Auto-scroll inside chat messages container
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

  // 3. Fetch messages & customer cards for selected chat
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

  const fetchCustomerCards = async (senderPhone) => {
    if (!senderPhone || !tenantId) return;
    const cleanPhone = senderPhone.replace(/\D/g, '');
    try {
      const res = await fetch(`${apiBaseUrl}/api/cards?tenant_id=${tenantId}`);
      if (res.ok) {
        const allCards = await res.json();
        const linked = allCards.filter(card => {
          const cardPhone = card.contacts?.phone?.replace(/\D/g, '') || '';
          return cardPhone.includes(cleanPhone) || cleanPhone.includes(cardPhone);
        });
        setCustomerCards(linked);
      }
    } catch (err) {
      console.error('Error fetching customer cards:', err);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchChats();
      fetchServices();
    }
  }, [tenantId]);

  useEffect(() => {
    if (selectedChat) {
      const phone = selectedChat.id.replace('@s.whatsapp.net', '');
      fetchCustomerCards(phone);
    }
  }, [selectedChat, tenantId]);

  // 4. Supabase Realtime Subscription
  useEffect(() => {
    if (!tenantId) return;

    const channelName = `live-whatsapp-${tenantId}`;
    const channel = supabase
      .channel(channelName)
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
        { event: '*', schema: 'public', table: 'chats', filter: `tenant_id=eq.${tenantId}` },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, selectedChat]);

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.id);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
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
          chatId: selectedChat.id,
          tenant_id: tenantId
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

  // Quick Replies Template Injector
  const handleQuickReply = (text) => {
    const contactName = selectedChat?.contact_name || 'Cliente';
    const formatted = text.replace('{contact_name}', contactName);
    setReplyText(prev => prev ? `${prev} ${formatted}` : formatted);
  };

  // AI Text Refiner & AI Suggestion
  const handleAiRefineText = () => {
    if (!replyText.trim()) return;
    setIsAiLoading(true);
    setTimeout(() => {
      let refined = replyText.trim();
      if (!refined.endsWith('.') && !refined.endsWith('!') && !refined.endsWith('?')) {
        refined += '.';
      }
      refined = `Olá, *${selectedChat?.contact_name || 'Cliente'}*! ` + refined + ` Qualquer dúvida, estamos à disposição! 😊`;
      setReplyText(refined);
      setIsAiLoading(false);
    }, 600);
  };

  const handleAiSuggestReply = () => {
    setIsAiLoading(true);
    setTimeout(() => {
      const lastInbound = [...messages].reverse().find(m => m.sender_phone !== 'System/Agent');
      const clientText = lastInbound?.content?.toLowerCase() || '';

      let suggestion = '';
      if (clientText.includes('valor') || clientText.includes('preço') || clientText.includes('quanto')) {
        suggestion = `Olá, *${selectedChat?.contact_name || 'Cliente'}*! Nossos valores variam de acordo com o serviço desejado. Qual atendimento você gostaria de realizar hoje?`;
      } else if (clientText.includes('horário') || clientText.includes('agendar') || clientText.includes('data')) {
        suggestion = `Olá, *${selectedChat?.contact_name || 'Cliente'}*! Temos horários disponíveis para esta semana. Qual o melhor dia e período para você?`;
      } else if (clientText.includes('pix') || clientText.includes('pagamento') || clientText.includes('pagar')) {
        suggestion = `Olá, *${selectedChat?.contact_name || 'Cliente'}*! Você pode realizar o pagamento via PIX. Em breve enviaremos os dados da nossa chave.`;
      } else {
        suggestion = `Olá, *${selectedChat?.contact_name || 'Cliente'}*! Recebemos sua mensagem com sucesso. Como podemos te ajudar agora?`;
      }

      setReplyText(suggestion);
      setIsAiLoading(false);
    }, 600);
  };

  // Handle Card Status Change directly from Chat Drawer
  const handleChangeCardStatus = async (cardId, newStatus) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/cards/${cardId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchCustomerCards(selectedChat.id.replace('@s.whatsapp.net', ''));
      }
    } catch (err) {
      console.error('Error changing card status:', err);
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
        fetchCustomerCards(selectedChat.id.replace('@s.whatsapp.net', ''));
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

    const matchesSearch = c.contact_name?.toLowerCase().includes(query) || c.id?.toLowerCase().includes(query);
    if (!matchesSearch) return false;

    if (filterType === 'unread') return c.unread_count > 0;
    return true;
  });

  const currentSelectedService = services.find(s => s.id === selectedServiceId);

  return (
    <div className="wa-web-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)' }}>
      <div className="wa-web-app" style={{ display: 'flex', width: '100%', flex: 1, borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
        
        {/* LEFT PANEL: CONTACTS LIST (WHATSAPP WEB SIDEBAR) */}
        <div className="wa-sidebar" style={{ width: '340px', minWidth: '300px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-light)', background: 'var(--bg-subcard)' }}>
          {/* Header Bar */}
          <div className="wa-sidebar-header" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', background: 'rgba(15, 23, 42, 0.3)' }}>
            <div className="wa-my-profile" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="wa-avatar-circle my-avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #10b981)', color: '#fff', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                <span>KOS</span>
              </div>
              <span className="wa-my-name" style={{ fontWeight: '700', fontSize: '0.92rem' }}>Central WhatsApp</span>
            </div>

            <div className="wa-header-actions" style={{ display: 'flex', gap: '8px' }}>
              <button className="wa-icon-btn" onClick={fetchChats} title="Atualizar Conversas" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}>
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {/* Search Box Bar & Filter Tabs */}
          <div className="wa-search-bar" style={{ padding: '12px 16px 8px' }}>
            <div className="wa-search-input-wrapper" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '10px', padding: '8px 12px', border: '1px solid var(--border-light)' }}>
              <Search size={16} className="wa-search-icon" style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
              <input
                type="text"
                placeholder="Pesquisar conversa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="wa-search-input"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            {/* Quick Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              <button
                type="button"
                className={`filter-pill ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
                style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: filterType === 'all' ? 'var(--primary-accent)' : 'rgba(255,255,255,0.06)', color: filterType === 'all' ? '#fff' : 'var(--text-muted)' }}
              >
                Todas ({chats.length})
              </button>
              <button
                type="button"
                className={`filter-pill ${filterType === 'unread' ? 'active' : ''}`}
                onClick={() => setFilterType('unread')}
                style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: filterType === 'unread' ? 'var(--primary-accent)' : 'rgba(255,255,255,0.06)', color: filterType === 'unread' ? '#fff' : 'var(--text-muted)' }}
              >
                Não Lidas
              </button>
            </div>
          </div>

          {/* Contact List */}
          <div className="wa-chats-list" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {filteredChats.map((chat) => {
              const isSelected = selectedChat?.id === chat.id;
              const phoneClean = chat.id.replace('@s.whatsapp.net', '');
              const initial = chat.contact_name ? chat.contact_name.charAt(0).toUpperCase() : 'C';

              return (
                <div
                  key={chat.id}
                  className={`wa-chat-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectChat(chat)}
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    borderLeft: isSelected ? '4px solid var(--primary-accent)' : '4px solid transparent',
                    transition: 'background 0.2s'
                  }}
                >
                  <div className="wa-avatar-circle" style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #06b6d4)', color: '#fff', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                    {initial}
                  </div>

                  <div className="wa-chat-details" style={{ flex: 1, minWidth: 0 }}>
                    <div className="wa-chat-top-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="wa-chat-name" style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {chat.contact_name || phoneClean}
                      </span>
                      <span className="wa-chat-time" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {chat.updated_at ? new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoje'}
                      </span>
                    </div>

                    <div className="wa-chat-bottom-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="wa-chat-preview" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Phone size={11} style={{ display: 'inline', marginRight: '4px' }} />
                        {phoneClean}
                      </span>
                      <span className="wa-unread-badge" style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '10px', fontWeight: '700' }}>
                        Ativo
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredChats.length === 0 && (
              <div className="wa-empty-sidebar" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <MessageSquare size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <p style={{ fontSize: '0.85rem' }}>Nenhuma conversa encontrada.</p>
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE PANEL: MAIN WHATSAPP CHAT THREAD */}
        <div className="wa-chat-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)' }}>
          {selectedChat ? (
            <>
              {/* WhatsApp Web Chat Header */}
              <div className="wa-chat-header" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', background: 'rgba(15, 23, 42, 0.3)' }}>
                <div className="wa-contact-header-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="wa-avatar-circle" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #3b82f6)', color: '#fff', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedChat.contact_name ? selectedChat.contact_name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div>
                    <h3 className="wa-contact-title" style={{ fontSize: '0.98rem', fontWeight: '800', margin: 0 }}>{selectedChat.contact_name}</h3>
                    <span className="wa-contact-subtext" style={{ fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="wa-online-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                      WhatsApp Online • {selectedChat.id.replace('@s.whatsapp.net', '')}
                    </span>
                  </div>
                </div>

                <div className="wa-chat-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    className="btn secondary"
                    onClick={() => setShowCustomerDrawer(!showCustomerDrawer)}
                    title="Informações do Cliente"
                    style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <User size={14} />
                    <span>{showCustomerDrawer ? 'Ocultar Painel' : 'Ver Dados'}</span>
                  </button>

                  <button
                    className="btn primary"
                    onClick={() => setShowConvertModal(true)}
                    style={{ fontSize: '0.78rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #6366f1, #10b981)' }}
                  >
                    <CalendarPlus size={15} />
                    <span>➕ Criar Atendimento</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp Messages Area */}
              <div className="wa-messages-area" ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(15, 23, 42, 0.15)' }}>
                <div className="wa-encryption-banner" style={{ alignSelf: 'center', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '6px 14px', borderRadius: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '10px' }}>
                  🔒 Mensagens protegidas com a criptografia oficial de ponta a ponta do WhatsApp.
                </div>

                {messages.map((msg) => {
                  const isOutbound = msg.sender_phone === 'System/Agent';
                  const timeFormatted = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={msg.id}
                      className={`wa-bubble-wrapper ${isOutbound ? 'outbound' : 'inbound'}`}
                      style={{ display: 'flex', justifyContent: isOutbound ? 'flex-end' : 'flex-start' }}
                    >
                      <div
                        className={`wa-bubble ${isOutbound ? 'outbound-bubble' : 'inbound-bubble'}`}
                        style={{
                          maxWidth: '75%',
                          padding: '10px 14px',
                          borderRadius: isOutbound ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                          background: isOutbound ? 'linear-gradient(135deg, #1e293b, #0f172a)' : 'rgba(30, 41, 59, 0.6)',
                          border: isOutbound ? '1px solid var(--primary-accent)' : '1px solid var(--border-light)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          color: '#fff'
                        }}
                      >
                        <div className="wa-msg-text" style={{ fontSize: '0.88rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{msg.content}</div>

                        <div className="wa-msg-meta" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <span className="wa-msg-time" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{timeFormatted}</span>
                          {isOutbound && (
                            <CheckCheck size={14} style={{ color: '#10b981' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* QUICK REPLIES BAR (1-CLICK TEMPLATES) */}
              <div className="quick-replies-bar" style={{ padding: '8px 16px', background: 'rgba(15, 23, 42, 0.4)', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '8px', overflowX: 'auto' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <Zap size={13} style={{ color: '#f59e0b' }} /> Respostas Rápidas:
                </span>
                <button type="button" className="btn secondary" onClick={() => handleQuickReply('Olá {contact_name}! Como posso te ajudar hoje?')} style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                  👋 Boas-vindas
                </button>
                <button type="button" className="btn secondary" onClick={() => handleQuickReply('Nosso endereço é Posto Central, de Seg a Sex das 08h às 18h.')} style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                  📍 Localização
                </button>
                <button type="button" className="btn secondary" onClick={() => handleQuickReply('Sua chave PIX para pagamento é 123.456.789-00.')} style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                  💳 Dados PIX
                </button>
                <button type="button" className="btn secondary" onClick={() => handleQuickReply('Seu agendamento foi confirmado com sucesso!')} style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                  📅 Agendamento
                </button>
                <button type="button" className="btn secondary" onClick={() => handleQuickReply('Seu pedido foi concluído com sucesso! Obrigado pelo contato!')} style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                  ✅ Concluído
                </button>
              </div>

              {/* WhatsApp Web Bottom Input Bar */}
              <form onSubmit={handleSendMessage} className="wa-input-bar" style={{ padding: '12px 16px', background: 'var(--bg-subcard)', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button type="button" className="wa-input-icon-btn" title="Anexar Arquivo" onClick={() => setShowAttachmentModal(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px' }}>
                  <Paperclip size={20} />
                </button>

                {/* AI Text Assistant Actions */}
                <button
                  type="button"
                  className="btn secondary"
                  disabled={isAiLoading || !replyText.trim()}
                  onClick={handleAiRefineText}
                  title="Aprimorar estilo e pontuação do texto com IA"
                  style={{ fontSize: '0.75rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary-accent)' }}
                >
                  <Sparkles size={14} /> Refinar com IA
                </button>

                <button
                  type="button"
                  className="btn secondary"
                  disabled={isAiLoading}
                  onClick={handleAiSuggestReply}
                  title="Sugerir resposta contextual baseada nas mensagens do cliente"
                  style={{ fontSize: '0.75rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}
                >
                  <Bot size={14} /> Sugerir Resposta
                </button>

                <input
                  type="text"
                  className="wa-message-input"
                  placeholder="Digite uma mensagem ou selecione uma resposta rápida..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '10px 14px', color: '#fff', outline: 'none', fontSize: '0.88rem' }}
                />

                <button
                  type="submit"
                  className="btn primary"
                  disabled={!replyText.trim() || isSending}
                  style={{ padding: '10px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          ) : (
            <div className="wa-no-chat-screen" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
              <div className="wa-welcome-box" style={{ maxWidth: '420px' }}>
                <MessageSquare size={56} className="wa-welcome-icon" style={{ color: 'var(--primary-accent)', margin: '0 auto 16px', opacity: 0.8 }} />
                <h2 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Central de Conversas KOS WhatsApp</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
                  Selecione uma conversa na lista lateral para visualizar as mensagens, responder com IA e gerenciar os atendimentos no Kanban.
                </p>
                <div className="wa-secure-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '20px', fontSize: '0.78rem' }}>
                  <Sparkles size={14} /> Criptografia & Sincronização em Tempo Real
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: CUSTOMER INFO & KANBAN CARDS DRAWER */}
        {selectedChat && showCustomerDrawer && (
          <div className="customer-info-drawer" style={{ width: '300px', minWidth: '280px', borderLeft: '1px solid var(--border-light)', background: 'var(--bg-subcard)', padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Contact Header */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #10b981)', color: '#fff', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', margin: '0 auto 10px' }}>
                {selectedChat.contact_name ? selectedChat.contact_name.charAt(0).toUpperCase() : 'C'}
              </div>
              <h3 style={{ fontSize: '1.02rem', fontWeight: '800', margin: '0 0 4px' }}>{selectedChat.contact_name}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Phone size={12} /> {selectedChat.id.replace('@s.whatsapp.net', '')}
              </p>
            </div>

            {/* Linked Kanban Cards */}
            <div className="glass-subcard" style={{ padding: '14px', borderRadius: '12px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-accent)' }}>
                <CalendarPlus size={16} /> Atendimentos no Kanban ({customerCards.length}):
              </h4>

              {customerCards.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Nenhum cartão no Kanban. Crie um novo atendimento abaixo!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {customerCards.map(card => (
                    <div key={card.id} style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {card.services?.title || 'Serviço'}
                        </span>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: '800', padding: '2px 8px', borderRadius: '10px',
                          background: card.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' :
                                      card.status === 'in_progress' ? 'rgba(99, 102, 241, 0.15)' :
                                      card.status === 'cancelled' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: card.status === 'completed' ? '#10b981' :
                                 card.status === 'in_progress' ? 'var(--primary-accent)' :
                                 card.status === 'cancelled' ? '#ef4444' : '#f59e0b'
                        }}>
                          {card.status === 'created' ? 'Criado' :
                           card.status === 'in_progress' ? 'Em Andamento' :
                           card.status === 'completed' ? 'Concluído' : 'Cancelado'}
                        </span>
                      </div>

                      {/* Quick Column Shift Selector */}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                        <select
                          className="input-control select-sm"
                          value={card.status}
                          onChange={(e) => handleChangeCardStatus(card.id, e.target.value)}
                          style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                        >
                          <option value="created">📌 Mover para: Criado</option>
                          <option value="in_progress">⚡ Mover para: Em Andamento</option>
                          <option value="completed">✅ Mover para: Concluído</option>
                          <option value="cancelled">❌ Mover para: Cancelado</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Action Button */}
            <button
              type="button"
              className="btn primary"
              onClick={() => setShowConvertModal(true)}
              style={{ width: '100%', padding: '10px', borderRadius: '10px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <CalendarPlus size={16} /> ➕ Criar Atendimento
            </button>
          </div>
        )}
      </div>

      {/* Modal: Convert Chat to Service Appointment/Card */}
      {showConvertModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '520px', width: '90%', padding: '24px', borderRadius: '16px' }}>
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

              <div className="modal-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
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

      {/* Modal: Attachment File Upload */}
      {showAttachmentModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '440px', width: '90%', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Paperclip size={18} className="accent-icon" /> Anexar Documento ou Foto
            </h3>

            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              className="input-control"
              style={{ marginBottom: '16px' }}
            />

            {attachmentFile && (
              <div style={{ fontSize: '0.82rem', color: '#10b981', marginBottom: '16px', fontWeight: '600' }}>
                ✓ Arquivo selecionado: {attachmentFile.name}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn secondary" onClick={() => { setShowAttachmentModal(false); setAttachmentFile(null); }}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!attachmentFile}
                onClick={() => {
                  setReplyText(`[Anexo: ${attachmentFile?.name}] ` + replyText);
                  setShowAttachmentModal(false);
                  setAttachmentFile(null);
                }}
              >
                Anexar ao Texto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
