import React, { useState, useEffect } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Sparkles, MessageSquare, Layers, Zap, LayoutGrid, HelpCircle } from 'lucide-react';
import { startProductTour } from './ProductTour';

export function OnboardingChecklist({ onNavigateTab, whatsappConnected, serviceCount, cardsCount }) {
  const [isOpen, setIsOpen] = useState(true);
  const [progress, setProgress] = useState({
    whatsapp: false,
    service: false,
    rule: false,
    card: false
  });

  useEffect(() => {
    const hasService = serviceCount > 0;
    const hasCard = cardsCount > 0;

    setProgress(prev => ({
      ...prev,
      whatsapp: !!whatsappConnected,
      service: hasService,
      card: hasCard,
      rule: hasService // If service created, rules are active
    }));
  }, [whatsappConnected, serviceCount, cardsCount]);

  const completedItems = Object.values(progress).filter(Boolean).length;
  const totalItems = 4;
  const percentage = Math.round((completedItems / totalItems) * 100);

  return (
    <div
      className="onboarding-checklist-floating glass-card"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '320px',
        zIndex: 9999,
        borderRadius: '16px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Widget Header */}
      <div
        className="checklist-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          cursor: 'pointer',
          borderBottom: isOpen ? '1px solid var(--border-glass)' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} style={{ color: 'var(--primary-accent)' }} />
          <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#f8fafc' }}>
            Checklist de Configuração ({completedItems}/{totalItems})
          </span>
        </div>
        {isOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </div>

      {/* Progress Bar */}
      <div style={{ padding: '0 16px', marginTop: isOpen ? '10px' : '0' }}>
        <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${percentage}%`,
              background: 'linear-gradient(90deg, #6366f1, #10b981)',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
      </div>

      {/* Widget Body */}
      {isOpen && (
        <div className="checklist-body" style={{ padding: '14px 16px' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Step 1: WhatsApp */}
            <li
              onClick={() => onNavigateTab && onNavigateTab('whatsapp')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                opacity: progress.whatsapp ? 0.6 : 1,
                textDecoration: progress.whatsapp ? 'line-through' : 'none'
              }}
            >
              <CheckCircle2 size={16} style={{ color: progress.whatsapp ? 'var(--secondary-accent)' : 'var(--text-muted)' }} />
              <MessageSquare size={14} style={{ color: 'var(--primary-accent)' }} />
              <span>Conectar conta do WhatsApp</span>
            </li>

            {/* Step 2: Service */}
            <li
              onClick={() => onNavigateTab && onNavigateTab('services')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                opacity: progress.service ? 0.6 : 1,
                textDecoration: progress.service ? 'line-through' : 'none'
              }}
            >
              <CheckCircle2 size={16} style={{ color: progress.service ? 'var(--secondary-accent)' : 'var(--text-muted)' }} />
              <Layers size={14} style={{ color: 'var(--primary-accent)' }} />
              <span>Criar ou importar 1º Serviço</span>
            </li>

            {/* Step 3: Workflow Rule */}
            <li
              onClick={() => onNavigateTab && onNavigateTab('services')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                opacity: progress.rule ? 0.6 : 1,
                textDecoration: progress.rule ? 'line-through' : 'none'
              }}
            >
              <CheckCircle2 size={16} style={{ color: progress.rule ? 'var(--secondary-accent)' : 'var(--text-muted)' }} />
              <Zap size={14} style={{ color: 'var(--primary-accent)' }} />
              <span>Ativar Regra de Mensagem / Lembrete</span>
            </li>

            {/* Step 4: Kanban Card */}
            <li
              onClick={() => onNavigateTab && onNavigateTab('kanban')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                opacity: progress.card ? 0.6 : 1,
                textDecoration: progress.card ? 'line-through' : 'none'
              }}
            >
              <CheckCircle2 size={16} style={{ color: progress.card ? 'var(--secondary-accent)' : 'var(--text-muted)' }} />
              <LayoutGrid size={14} style={{ color: 'var(--primary-accent)' }} />
              <span>Mover o 1º Card no Kanban</span>
            </li>

          </ul>

          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="btn secondary"
              onClick={startProductTour}
              style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <HelpCircle size={12} /> Reiniciar Tour
            </button>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No-Code Onboarding</span>
          </div>
        </div>
      )}
    </div>
  );
}
