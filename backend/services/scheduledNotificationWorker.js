import { supabase } from '../config/supabase.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import { interpolateTemplate } from './notificationEngine.js';

let isProcessing = false;

/**
 * Worker process that checks for pending scheduled messages in queue (send_at <= NOW())
 */
export async function processScheduledMessagesQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date().toISOString();

    // 1. Fetch pending scheduled messages whose send_at time has arrived
    const { data: queueItems, error } = await supabase
      .from('scheduled_messages_queue')
      .select(`
        *,
        cards (
          id,
          status,
          collected_data,
          attachment_metadata,
          services ( title ),
          contacts ( name, phone )
        )
      `)
      .eq('status', 'pending')
      .lte('send_at', now)
      .limit(50);

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('scheduled_messages_queue')) {
        console.log('[Scheduled Worker] Notice: Table "scheduled_messages_queue" is pending migration or schema cache reload in Supabase.');
      } else {
        console.error('[Scheduled Worker] Error querying queue:', error);
      }
      return;
    }

    if (!queueItems || queueItems.length === 0) {
      return;
    }

    console.log(`[Scheduled Worker] Processing ${queueItems.length} pending scheduled messages...`);

    for (const item of queueItems) {
      // Atomic Lock: Transição imediata de status para 'processing' para evitar corrida entre workers
      const { data: lockedItem, error: lockErr } = await supabase
        .from('scheduled_messages_queue')
        .update({ status: 'processing' })
        .eq('id', item.id)
        .eq('status', 'pending')
        .select()
        .maybeSingle();

      if (!lockedItem || lockErr) {
        continue; // Ignorar se outro worker já assumiu o processamento do item
      }

      const card = item.cards;
      const payload = item.payload || {};
      const contactPhone = card?.contacts?.phone || payload.contact_phone;
      const templateBody = payload.template_body;
      const isOptedIn = card?.contacts?.opt_in !== false;

      if (!isOptedIn) {
        console.log(`[Scheduled Worker] Skipping queue item ${item.id}: Contact ${contactPhone} opted out (opt_in=false).`);
        await supabase
          .from('scheduled_messages_queue')
          .update({ status: 'failed', payload: { ...payload, error: 'LGPD Opt-Out' } })
          .eq('id', item.id);
        continue;
      }

      if (!contactPhone || !templateBody) {
        console.error(`[Scheduled Worker] Skipping queue item ${item.id}: missing phone or template`);
        await supabase
          .from('scheduled_messages_queue')
          .update({ status: 'failed', payload: { ...payload, error: 'Missing phone or template' } })
          .eq('id', item.id);
        continue;
      }

      const templateData = {
        card_id: card?.id || item.card_id,
        contact_name: card?.contacts?.name || 'Cliente',
        service_title: card?.services?.title || 'Serviço',
        status: card?.status || 'pendente',
        ...(card?.collected_data || {}),
        ...(card?.attachment_metadata || {})
      };

      const messageText = interpolateTemplate(templateBody, templateData);
      console.log(`[Scheduled Worker] Dispatching scheduled WhatsApp message to ${contactPhone}: "${messageText}"`);

      try {
        await sendWhatsAppMessage(contactPhone, messageText);

        // Update queue item status to 'sent'
        await supabase
          .from('scheduled_messages_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', item.id);

      } catch (err) {
        console.error(`[Scheduled Worker] Failed dispatching message for queue item ${item.id}:`, err);
        await supabase
          .from('scheduled_messages_queue')
          .update({
            status: 'failed',
            payload: { ...payload, error: err.message }
          })
          .eq('id', item.id);
      }
    }

  } catch (err) {
    console.error('[Scheduled Worker] Unhandled exception in worker:', err);
  } finally {
    isProcessing = false;
  }
}

/**
 * Starts periodic worker interval running every 5 minutes (300,000ms)
 */
export function startScheduledWorker(intervalMs = 300000) {
  console.log(`[Scheduled Worker] Starting anti-duplication queue worker (interval: ${intervalMs / 1000}s)...`);
  
  // Run immediate first pass
  processScheduledMessagesQueue();

  // Run on interval
  setInterval(() => {
    processScheduledMessagesQueue();
  }, intervalMs);
}
