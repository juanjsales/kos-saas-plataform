import React, { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function startProductTour() {
  const driverObj = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    doneBtnText: 'Entendi Tudo! 🚀',
    nextBtnText: 'Avançar ➔',
    prevBtnText: '← Voltar',
    progressText: 'Passo {{current}} de {{total}}',
    onDestroyed: () => {
      localStorage.setItem('has_seen_tour', 'true');
    },
    steps: [
      {
        element: '#tour-service-builder',
        popover: {
          title: '👋 Bem-vindo! Aqui você cadastra seus Serviços',
          description: 'Nesta aba você adiciona os serviços que sua empresa oferece aos clientes (ex: Agendamentos, Consultas, Vendas ou Trabalhos).',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-tab-form',
        popover: {
          title: '📝 Perguntas que o Cliente Deve Responder',
          description: 'Crie perguntas simples (nome, data, fotos ou documentos) para guardar tudo o que o cliente precisa informar sobre o pedido.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-tab-rpa',
        popover: {
          title: '🤖 Preenchimento Automático do Sistema',
          description: 'Se precisar digitar dados em outros portais ou sistemas, o robô do sistema pode preencher tudo para você sem complicação.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-tab-workflows',
        popover: {
          title: '💬 Avisos Automáticos pelo WhatsApp',
          description: 'Configure mensagens para avisar o cliente no WhatsApp quando o pedido mudar de fase ou para enviar lembretes importantes.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#tour-kanban-board',
        popover: {
          title: '📌 Quadro Organizado de Pedidos',
          description: 'Aqui você acompanha todos os seus clientes em colunas bem claras. Basta arrastar a cartela com o mouse para atualizar o pedido!',
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
