import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, CalendarPlus, User, Phone, CheckCircle, RefreshCw, Search,
  Paperclip, CheckCheck, Sparkles, Filter, Bot, ChevronRight, X, Image, FileText,
  Clock, AlertCircle, Zap, Tag, ChevronLeft, Check, Edit3, ArrowRight, CornerDownLeft, Bell
} from 'lucide-react';
import { supabase } from '../config/supabaseClient';

// Helper function for phone formatting & deduplication
const formatPhone = (phoneRaw) => {
  if (!phoneRaw) return '';
  const clean = String(phoneRaw).replace(/\D/g, '');
  if (clean.length === 13 && clean.startsWith('55')) {
    return `+55 (${clean.slice(2,4)}) ${clean.slice(4,9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12 && clean.startsWith('55')) {
    return `+55 (${clean.slice(2,4)}) ${clean.slice(4,8)}-${clean.slice(8)}`;
  }
  if (clean.length === 11) {
    return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
  }
  return clean || phoneRaw;
};

const getContactDisplayInfo = (chat) => {
  if (!chat) return { title: '', subtext: '', initial: 'C', phoneFormatted: '' };
  const phoneClean = (chat.id || '').replace('@s.whatsapp.net', '').replace(/\D/g, '');
  const phoneFormatted = formatPhone(phoneClean);
  
  const rawName = (chat.contact_name || '').trim();
  const nameClean = rawName.replace(/\D/g, '');
  const isNameOnlyPhone = !rawName || nameClean === phoneClean || rawName === phoneClean;

  const title = isNameOnlyPhone ? phoneFormatted : rawName;
  const subtext = isNameOnlyPhone ? 'WhatsApp Conectado' : `${phoneFormatted} • WhatsApp Conectado`;
  const initial = isNameOnlyPhone ? '📱' : rawName.charAt(0).toUpperCase();

  return { title, subtext, initial, phoneFormatted, isNameOnlyPhone };
};

// Web Audio API Synthesizer Sound Chime (No external mp3 assets needed)
const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.12);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.4);
  } catch (e) {}
};

// Browser Push Notification Trigger
const triggerBrowserNotification = (title, body, iconUrl) => {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: iconUrl || '/pwa-192x192.png',
        tag: 'kos-new-message'
      });
    }
  } catch (e) {}
};

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
  const [showCustomerDrawer, setShowCustomerDrawer] = useState(false);
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
          if (newMsg.sender_phone !== 'System/Agent') {
            playNotificationSound();
            const senderChat = chats.find(c => c.id === newMsg.chat_id);
            const info = getContactDisplayInfo(senderChat || { id: newMsg.chat_id });
            triggerBrowserNotification(`💬 Nova mensagem de ${info.title}`, newMsg.content, senderChat?.profile_picture_url);
          }

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

    // Interval fallback polling for 100% message arrival guarantee
    const pollInterval = setInterval(() => {
      fetchChats();
      if (selectedChat) {
        fetchMessages(selectedChat.id);
      }
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
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
      <div className="wa-web-app glass-card" style={{ display: 'flex', width: '100%', flex: 1, borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-lg)' }}>
        
        {/* LEFT PANEL: CONTACTS LIST (WHATSAPP WEB SIDEBAR) */}
        <div className="wa-sidebar" style={{ width: '320px', minWidth: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-light)', background: '#ffffff' }}>
          {/* Header Bar */}
          <div className="wa-sidebar-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', background: '#f8fafc' }}>
            <div className="wa-my-profile" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="wa-avatar-circle my-avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5 0%, #10b981 100%)', color: '#ffffff', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.88rem', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)' }}>
                <span>KOS</span>
              </div>
              <span className="wa-my-name" style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f172a' }}>Central WhatsApp</span>
            </div>

            <div className="wa-header-actions" style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-icon"
                onClick={() => {
                  playNotificationSound();
                  if ('Notification' in window && Notification.permission !== 'granted') {
                    Notification.requestPermission();
                  }
                  triggerBrowserNotification('🔔 Notificações Ativadas!', 'Você receberá avisos sonoros e pop-ups quando chegarem novas mensagens.');
                }}
                title="Testar Som / Ativar Notificações"
                style={{ padding: '8px', borderRadius: '8px', color: '#10b981' }}
              >
                <Bell size={18} />
              </button>
              <button className="btn-icon" onClick={fetchChats} title="Atualizar Conversas" style={{ padding: '8px', borderRadius: '8px' }}>
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {/* Search Box Bar & Filter Tabs */}
          <div className="wa-search-bar" style={{ padding: '14px 16px 10px', background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
            <div className="wa-search-input-wrapper" style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: '12px', padding: '10px 14px', border: '1.5px solid #e2e8f0' }}>
              <Search size={18} className="wa-search-icon" style={{ color: '#64748b', marginRight: '10px' }} />
              <input
                type="text"
                placeholder="Pesquisar por nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="wa-search-input"
                style={{ background: 'transparent', border: 'none', color: '#0f172a', outline: 'none', width: '100%', fontSize: '0.88rem', fontWeight: '600' }}
              />
            </div>

            {/* Quick Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                type="button"
                className={`filter-pill ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
                style={{ fontSize: '0.78rem', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: filterType === 'all' ? '#4f46e5' : '#f1f5f9', color: filterType === 'all' ? '#ffffff' : '#64748b', transition: 'all 0.2s' }}
              >
                Todas ({chats.length})
              </button>
              <button
                type="button"
                className={`filter-pill ${filterType === 'unread' ? 'active' : ''}`}
                onClick={() => setFilterType('unread')}
                style={{ fontSize: '0.78rem', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: filterType === 'unread' ? '#4f46e5' : '#f1f5f9', color: filterType === 'unread' ? '#ffffff' : '#64748b', transition: 'all 0.2s' }}
              >
                Não Lidas
              </button>
            </div>
          </div>

          {/* Contact List */}
          <div className="wa-chats-list" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {filteredChats.map((chat) => {
              const isSelected = selectedChat?.id === chat.id;
              const info = getContactDisplayInfo(chat);

              return (
                <div
                  key={chat.id}
                  className={`wa-chat-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectChat(chat)}
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    cursor: 'pointer',
                    background: isSelected ? '#f1f5f9' : '#ffffff',
                    borderLeft: isSelected ? '4px solid #4f46e5' : '4px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {chat.profile_picture_url ? (
                    <img
                      src={chat.profile_picture_url}
                      alt={info.title}
                      style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: isSelected ? '2px solid #4f46e5' : '1px solid #cbd5e1' }}
                      onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div className="wa-avatar-circle" style={{ display: chat.profile_picture_url ? 'none' : 'flex', width: '44px', height: '44px', borderRadius: '50%', background: isSelected ? 'linear-gradient(135deg, #4f46e5, #10b981)' : '#e2e8f0', color: isSelected ? '#ffffff' : '#475569', fontWeight: '800', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', boxShadow: isSelected ? '0 4px 10px rgba(79, 70, 229, 0.2)' : 'none' }}>
                    {info.initial}
                  </div>

                  <div className="wa-chat-details" style={{ flex: 1, minWidth: 0 }}>
                    <div className="wa-chat-top-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="wa-chat-name" style={{ fontWeight: '800', fontSize: '0.92rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {info.title}
                      </span>
                      <span className="wa-chat-time" style={{ fontSize: '0.72rem', fontWeight: '600', color: '#64748b' }}>
                        {chat.updated_at ? new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoje'}
                      </span>
                    </div>

                    <div className="wa-chat-bottom-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="wa-chat-preview" style={{ fontSize: '0.8rem', fontWeight: '500', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Phone size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                        {info.phoneFormatted}
                      </span>
                      <span className="wa-unread-badge" style={{ fontSize: '0.72rem', padding: '3px 8px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '12px', fontWeight: '800' }}>
                        Ativo
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredChats.length === 0 && (
              <div className="wa-empty-sidebar" style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                <MessageSquare size={36} style={{ opacity: 0.3, marginBottom: '10px' }} />
                <p style={{ fontSize: '0.88rem', fontWeight: '600' }}>Nenhuma conversa encontrada.</p>
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE PANEL: MAIN WHATSAPP CHAT THREAD */}
        <div className="wa-chat-panel" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
          {selectedChat ? (
            <>
              {/* WhatsApp Web Chat Header */}
              <div className="wa-chat-header" style={{ padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
                <div className="wa-contact-header-info" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {selectedChat.profile_picture_url ? (
                    <img
                      src={selectedChat.profile_picture_url}
                      alt={getContactDisplayInfo(selectedChat).title}
                      style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}
                      onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div className="wa-avatar-circle" style={{ display: selectedChat.profile_picture_url ? 'none' : 'flex', width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', fontWeight: '800', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}>
                    {getContactDisplayInfo(selectedChat).initial}
                  </div>
                  <div>
                    <h3 className="wa-contact-title" style={{ fontSize: '1.02rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                      {getContactDisplayInfo(selectedChat).title}
                    </h3>
                    <span className="wa-contact-subtext" style={{ fontSize: '0.8rem', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span className="wa-online-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                      {getContactDisplayInfo(selectedChat).subtext}
                    </span>
                  </div>
                </div>

                <div className="wa-chat-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    className="btn secondary"
                    onClick={() => setShowCustomerDrawer(!showCustomerDrawer)}
                    title="Informações do Cliente"
                    style={{ fontSize: '0.85rem', padding: '8px 16px', borderRadius: '10px', fontWeight: '700', border: '1px solid #cbd5e1' }}
                  >
                    <User size={16} />
                    <span>{showCustomerDrawer ? 'Ocultar Painel' : 'Ver Dados'}</span>
                  </button>

                  <button
                    className="btn primary"
                    onClick={() => setShowConvertModal(true)}
                    style={{ fontSize: '0.85rem', padding: '8px 18px', borderRadius: '10px', fontWeight: '800', background: 'linear-gradient(135deg, #4f46e5 0%, #10b981 100%)', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}
                  >
                    <CalendarPlus size={16} />
                    <span>➕ Criar Atendimento</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp Messages Area (Authentic Light WhatsApp Wallpaper Canvas) */}
              <div className="wa-messages-area" ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#efeae2', backgroundImage: 'radial-gradient(#cbd5e1 0.75px, transparent 0.75px)', backgroundSize: '16px 16px' }}>
                <div className="wa-encryption-banner" style={{ alignSelf: 'center', background: '#ffffff', border: '1px solid #e2e8f0', padding: '8px 18px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700', color: '#475569', textAlign: 'center', marginBottom: '12px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)' }}>
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
                          maxWidth: '70%',
                          padding: '12px 16px',
                          borderRadius: isOutbound ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          background: isOutbound ? '#d9fdd3' : '#ffffff',
                          border: isOutbound ? '1px solid #c2eebe' : '1px solid #e9edef',
                          boxShadow: '0 2px 6px rgba(11, 20, 26, 0.08)',
                          color: '#111b21'
                        }}
                      >
                        <div className="wa-msg-text" style={{ fontSize: '0.92rem', fontWeight: '500', color: '#111b21', whiteSpace: 'pre-wrap', lineHeight: '1.45' }}>
                          {msg.content}
                        </div>

                        <div className="wa-msg-meta" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                          <span className="wa-msg-time" style={{ fontSize: '0.7rem', fontWeight: '600', color: '#667781' }}>{timeFormatted}</span>
                          {isOutbound && (
                            <CheckCheck size={16} style={{ color: '#53bdeb' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* QUICK REPLIES BAR (1-CLICK TEMPLATES) */}
              <div className="quick-replies-bar" style={{ padding: '10px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px', overflowX: 'auto', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <Zap size={15} style={{ color: '#f59e0b' }} /> Respostas Rápidas:
                </span>
                <button type="button" className="btn secondary" onClick={() => handleQuickReply('Olá {contact_name}! Como posso te ajudar hoje?')} style={{ fontSize: '0.78rem', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  👋 Boas-vindas
                </button>
                <button type="button" className="btn secondary" onClick={() => handleQuickReply('Nosso endereço é Posto Central, de Seg a Sex das 08h às 18h.')} style={{ fontSize: '0.78rem', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  📍 Localização
                </button>
                <button type="button" className="btn secondary" onClick={() => handleQuickReply('Sua chave PIX para pagamento é 123.456.789-00.')} style={{ fontSize: '0.78rem', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  💳 Dados PIX
                </button>
                <button type="button" className="btn secondary" onClick={() => handleQuickReply('Seu agendamento foi confirmado com sucesso!')} style={{ fontSize: '0.78rem', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  📅 Agendamento
                </button>
                <button type="button" className="btn secondary" onClick={() => handleQuickReply('Seu pedido foi concluído com sucesso! Obrigado pelo contato!')} style={{ fontSize: '0.78rem', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  ✅ Concluído
                </button>
              </div>

              {/* WhatsApp Web Bottom Input Bar (HIGH CONTRAST & CRISP READABILITY) */}
              <form onSubmit={handleSendMessage} className="wa-input-bar" style={{ padding: '14px 20px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button type="button" className="btn-icon" title="Anexar Arquivo" onClick={() => setShowAttachmentModal(true)} style={{ padding: '10px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
                  <Paperclip size={20} />
                </button>

                {/* AI Text Assistant Actions */}
                <button
                  type="button"
                  className="btn secondary"
                  disabled={isAiLoading || !replyText.trim()}
                  onClick={handleAiRefineText}
                  title="Aprimorar estilo e pontuação do texto com IA"
                  style={{ fontSize: '0.8rem', fontWeight: '800', padding: '8px 14px', borderRadius: '10px', border: '1px solid #c7d2fe', background: '#eff6ff', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Sparkles size={16} /> Refinar com IA
                </button>

                <button
                  type="button"
                  className="btn secondary"
                  disabled={isAiLoading}
                  onClick={handleAiSuggestReply}
                  title="Sugerir resposta contextual baseada nas mensagens do cliente"
                  style={{ fontSize: '0.8rem', fontWeight: '800', padding: '8px 14px', borderRadius: '10px', border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Bot size={16} /> Sugerir Resposta
                </button>

                <input
                  type="text"
                  className="wa-message-input"
                  placeholder="Digite uma mensagem ou escolha uma resposta rápida..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '12px 18px',
                    color: '#0f172a', // CRISP BOLD DARK FONT FOR PERFECT READABILITY!
                    outline: 'none',
                    fontSize: '0.92rem',
                    fontWeight: '600',
                    boxShadow: '0 2px 4px rgba(15, 23, 42, 0.03)'
                  }}
                />

                <button
                  type="submit"
                  className="btn primary"
                  disabled={!replyText.trim() || isSending}
                  style={{ padding: '12px 22px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div className="wa-no-chat-screen" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
              <div className="wa-welcome-box" style={{ maxWidth: '440px', padding: '32px', background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-md)' }}>
                <MessageSquare size={60} className="wa-welcome-icon" style={{ color: '#4f46e5', margin: '0 auto 16px', opacity: 0.9 }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginBottom: '10px' }}>Central de Conversas KOS WhatsApp</h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '24px' }}>
                  Selecione uma conversa na lista lateral para visualizar mensagens, usar assistente de IA e gerenciar os atendimentos no Kanban.
                </p>
                <div className="wa-secure-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '700' }}>
                  <Sparkles size={16} /> Criptografia & Sincronização em Tempo Real
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: CUSTOMER INFO & KANBAN CARDS DRAWER */}
        {selectedChat && showCustomerDrawer && (
          <div className="customer-info-drawer" style={{ width: '300px', minWidth: '280px', flexShrink: 0, borderLeft: '1px solid #e2e8f0', background: '#ffffff', padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Contact Header */}
            <div style={{ textAlign: 'center', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5 0%, #10b981 100%)', color: '#ffffff', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 12px', boxShadow: '0 6px 16px rgba(79, 70, 229, 0.25)' }}>
                {getContactDisplayInfo(selectedChat).initial}
              </div>
              <h3 style={{ fontSize: '1.08rem', fontWeight: '800', color: '#0f172a', margin: '0 0 6px' }}>
                {getContactDisplayInfo(selectedChat).title}
              </h3>
              <p style={{ fontSize: '0.82rem', fontWeight: '600', color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Phone size={14} /> {getContactDisplayInfo(selectedChat).phoneFormatted}
              </p>
            </div>

            {/* Linked Kanban Cards */}
            <div className="glass-subcard" style={{ padding: '16px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: '800', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#4f46e5' }}>
                <CalendarPlus size={18} /> Atendimentos no Kanban ({customerCards.length}):
              </h4>

              {customerCards.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '0.82rem', fontWeight: '600', color: '#64748b' }}>
                  Nenhum cartão no Kanban. Crie um novo atendimento abaixo!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {customerCards.map(card => (
                    <div key={card.id} style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0f172a' }}>
                          {card.services?.title || 'Serviço'}
                        </span>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: '800', padding: '3px 10px', borderRadius: '12px',
                          background: card.status === 'completed' ? '#ecfdf5' :
                                      card.status === 'in_progress' ? '#e0e7ff' :
                                      card.status === 'cancelled' ? '#fef2f2' : '#fffbeb',
                          color: card.status === 'completed' ? '#047857' :
                                 card.status === 'in_progress' ? '#4338ca' :
                                 card.status === 'cancelled' ? '#b91c1c' : '#b45309',
                          border: card.status === 'completed' ? '1px solid #a7f3d0' :
                                  card.status === 'in_progress' ? '1px solid #c7d2fe' :
                                  card.status === 'cancelled' ? '1px solid #fecaca' : '1px solid #fde68a'
                        }}>
                          {card.status === 'created' ? 'Criado' :
                           card.status === 'in_progress' ? 'Em Andamento' :
                           card.status === 'completed' ? 'Concluído' : 'Cancelado'}
                        </span>
                      </div>

                      {/* Quick Column Shift Selector */}
                      <div style={{ marginTop: '8px' }}>
                        <select
                          className="input-control select-control"
                          value={card.status}
                          onChange={(e) => handleChangeCardStatus(card.id, e.target.value)}
                          style={{ fontSize: '0.78rem', fontWeight: '700', padding: '6px 10px', minHeight: '36px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a' }}
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
              style={{ width: '100%', padding: '12px', borderRadius: '12px', fontSize: '0.88rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, #4f46e5 0%, #10b981 100%)', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}
            >
              <CalendarPlus size={18} /> ➕ Criar Atendimento
            </button>
          </div>
        )}
      </div>

      {/* Modal: Convert Chat to Service Appointment/Card */}
      {showConvertModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '520px', width: '90%', padding: '28px', borderRadius: '20px', background: '#ffffff' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CalendarPlus size={24} style={{ color: '#4f46e5' }} /> Converter Conversa em Cartão
            </h3>
            <p style={{ fontSize: '0.88rem', fontWeight: '600', color: '#64748b', marginBottom: '20px' }}>
              Cliente: <strong style={{ color: '#0f172a' }}>{selectedChat?.contact_name}</strong> ({selectedChat?.id.replace('@s.whatsapp.net', '')})
            </p>

            <form onSubmit={handleConvertChatToCard}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.88rem' }}>Selecione o Serviço</label>
                <select
                  className="input-control select-control"
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  required
                  style={{ background: '#ffffff', color: '#0f172a', fontWeight: '700' }}
                >
                  <option value="">-- Escolha o serviço desejado --</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              {currentSelectedService && currentSelectedService.custom_fields?.map((field) => (
                <div key={field.id} className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.85rem' }}>
                    {field.field_label} {field.is_required && '*'}
                  </label>
                  <input
                    type={field.field_type === 'number' ? 'number' : 'text'}
                    className="input-control"
                    required={field.is_required}
                    placeholder={`Informe ${field.field_label.toLowerCase()}`}
                    onChange={(e) => setCollectedData({ ...collectedData, [field.field_label]: e.target.value })}
                    style={{ background: '#ffffff', color: '#0f172a' }}
                  />
                </div>
              ))}

              <div className="modal-actions" style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn secondary" onClick={() => setShowConvertModal(false)} style={{ padding: '10px 20px', borderRadius: '10px' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary" style={{ padding: '10px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f46e5 0%, #10b981 100%)' }}>
                  <CheckCircle size={18} /> Confirmar & Criar Atendimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Attachment File Upload */}
      {showAttachmentModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '460px', width: '90%', padding: '28px', borderRadius: '20px', background: '#ffffff' }}>
            <h3 style={{ fontSize: '1.08rem', fontWeight: '800', color: '#0f172a', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Paperclip size={20} style={{ color: '#4f46e5' }} /> Anexar Documento ou Foto
            </h3>

            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              className="input-control"
              style={{ marginBottom: '18px', background: '#f8fafc', color: '#0f172a' }}
            />

            {attachmentFile && (
              <div style={{ fontSize: '0.85rem', color: '#047857', marginBottom: '18px', fontWeight: '700', padding: '8px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px' }}>
                ✓ Arquivo selecionado: {attachmentFile.name}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn secondary" onClick={() => { setShowAttachmentModal(false); setAttachmentFile(null); }} style={{ padding: '8px 18px', borderRadius: '10px' }}>
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
                style={{ padding: '8px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #4f46e5 0%, #10b981 100%)' }}
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
