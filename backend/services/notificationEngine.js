import { supabase } from '../config/supabase.js';
import { sendWhatsAppMessage } from './whatsapp.js';

/**
 * Formats ISO date strings or Date objects into Brazilian local date string (DD/MM/YYYY HH:mm)
 */
export function formatDateValue(val) {
  if (!val) return '';
  const str = String(val).trim();

  // Match ISO date YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}.*)?$/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const datePart = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      if (str.includes('T')) {
        const timePart = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        return `${datePart} às ${timePart}`;
      }
      return datePart;
    }
  }
  return str;
}

/**
 * Replaces placeholders like {contact_name}, {service_title}, {status}, {card_id} in template text
 */
export function interpolateTemplate(template, data) {
  let result = template || '';
  if (!data || typeof data !== 'object') return result;

  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{${key}}`;
    const formattedVal = formatDateValue(value);
    const repVal = (formattedVal !== undefined && formattedVal !== null) ? String(formattedVal) : '';
    result = result.split(placeholder).join(repVal);
  }
  return result;
}

// Deduplication cache to prevent sending duplicate messages within 5 seconds
const recentDispatches = new Map();

function isDuplicateDispatch(cardId, phone, text) {
  const key = `${cardId}_${phone}_${text?.trim()}`;
  const now = Date.now();
  if (recentDispatches.has(key)) {
    const lastTime = recentDispatches.get(key);
    if (now - lastTime < 5000) { // 5-second window
      return true;
    }
  }
  recentDispatches.set(key, now);
  // Cleanup old entries
  if (recentDispatches.size > 200) {
    for (const [k, time] of recentDispatches.entries()) {
      if (now - time > 10000) recentDispatches.delete(k);
    }
  }
  return false;
}

/**
 * Triggers notification check and message dispatch for a given card event
 */
export async function triggerCardNotification(cardId, triggerEvent) {
  try {
    // 1. Fetch complete card details with service and contact metadata
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select(`
        id,
        status,
        tenant_id,
        service_id,
        collected_data,
        attachment_metadata,
        attachment_url,
        services ( title, description ),
        contacts ( name, phone )
      `)
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      console.error(`Card notification error: card ${cardId} not found`, cardError);
      return { success: false, reason: 'Card not found' };
    }

    const contactName = card.contacts?.name || 'Cliente';
    const contactPhone = card.contacts?.phone;
    const serviceTitle = card.services?.title || 'Serviço';

    if (!contactPhone) {
      console.error('Notification error: Contact has no phone number recorded');
      return { success: false, reason: 'No contact phone' };
    }

    // Expand trigger event aliases
    const triggerAliases = [triggerEvent];
    if (triggerEvent === 'status_created' || triggerEvent === 'created') {
      triggerAliases.push('on_card_created', 'status_created');
    } else if (triggerEvent === 'status_completed' || triggerEvent === 'completed') {
      triggerAliases.push('on_card_completed', 'on_status_change', 'status_completed');
    } else {
      triggerAliases.push('on_status_change');
    }

    // 2. Query active notification rules for this tenant & service
    const { data: rules } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('tenant_id', card.tenant_id)
      .eq('service_id', card.service_id)
      .in('trigger_event', triggerAliases)
      .eq('is_active', true);

    const templateVariables = {
      card_id: card.id,
      contact_name: contactName,
      service_title: serviceTitle,
      status: card.status === 'completed' ? 'Concluído' : card.status,
      attachment_url: card.attachment_url || '',
      ...(card.collected_data || {}),
      ...(card.attachment_metadata || {})
    };

    let dispatchedCount = 0;

    // Dispatched custom rules if configured
    if (rules && rules.length > 0) {
      for (const rule of rules) {
        const messageText = interpolateTemplate(rule.template_body, templateVariables);
        
        if (isDuplicateDispatch(card.id, contactPhone, messageText)) {
          console.log(`[Notification Engine] Skipping duplicate WhatsApp alert to ${contactPhone}: "${messageText}"`);
          continue;
        }

        console.log(`[Notification Engine] Dispatching WhatsApp alert to ${contactPhone}: "${messageText}"`);

        try {
          const res = await sendWhatsAppMessage(contactPhone, messageText, card.tenant_id);
          if (res?.success) dispatchedCount++;
        } catch (err) {
          console.error(`Failed sending WhatsApp message for rule ${rule.id}:`, err.message);
        }
      }
    } else if (triggerEvent.includes('completed') || card.status === 'completed') {
      // Default fallback confirmation message if no custom rules exist for completed cards
      const defaultText = `Olá ${contactName}! Seu atendimento referente a *${serviceTitle}* foi concluído com sucesso. Obrigado pela preferência!`;
      
      if (!isDuplicateDispatch(card.id, contactPhone, defaultText)) {
        console.log(`[Notification Engine] Dispatching default WhatsApp completion alert to ${contactPhone}`);
        try {
          const res = await sendWhatsAppMessage(contactPhone, defaultText, card.tenant_id);
          if (res?.success) dispatchedCount++;
        } catch (err) {
          console.error(`Failed sending default WhatsApp completion message:`, err.message);
        }
      }
    } else {
      console.log(`No active notification rule for service ${card.service_id} on triggers [${triggerAliases.join(', ')}]`);
    }

    return { success: true, dispatched: dispatchedCount };

  } catch (err) {
    console.error('Unhandled exception in triggerCardNotification:', err);
    return { success: false, error: err.message };
  }
}
