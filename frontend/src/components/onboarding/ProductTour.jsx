import React, { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function startProductTour() {
  const driverObj = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    doneBtnText: 'Concluir Tour 🚀',
    nextBtnText: 'Próximo ➔',
    prevBtnText: '← Anterior',
    progressText: 'Passo {{current}} de {{total}}',
    onDestroyed: () => {
      localStorage.setItem('has_seen_tour', 'true');
    },
    steps: [
      {
        element: '#tour-service-builder',
        popover: {
          title: '👋 Bem-vindo! Crie ou Importe Serviços',
          description: 'Aqui você cria novos serviços do zero ou escolhe templates 1-Click Setup pré-prontos para acelerar sua operação.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-tab-form',
        popover: {
          title: '📝 Formulários Personalizados No-Code',
          description: 'Monte perguntas dinâmicas (texto, datas, seleção, uploads) para capturar todas as informações do cliente.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-tab-rpa',
        popover: {
          title: '🤖 Robô RPA (Preenchimento Externo)',
          description: 'Mapeie o robô para acessar sites e portais governamentais ou sistemas legados e digitar os dados do cliente sozinho.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-tab-workflows',
        popover: {
          title: '⚡ Réguas de Comunicação no WhatsApp',
          description: 'Crie automações "Quando [Gatilho] ➔ Faça [Ação]" para notificar o cliente via WhatsApp e agendar lembretes automáticos.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-kanban-board',
        popover: {
          title: '📌 Gestão Visual de Atendimentos no Kanban',
          description: 'Arraste os cartões entre as etapas de atendimento para atualizar o status, acionar o robô RPA e disparar mensagens!',
          side: 'top',
          align: 'center'
        }
      }
    ]
  });

  driverObj.drive();
}

export function ProductTourAutoStart() {
  useEffect(() => {
    const hasSeen = localStorage.getItem('has_seen_tour');
    if (!hasSeen) {
      setTimeout(() => {
        startProductTour();
      }, 1000);
    }
  }, []);

  return null;
}
