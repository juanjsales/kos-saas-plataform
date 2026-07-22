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
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`\\{${key}\\}`, 'g');
    const formattedVal = formatDateValue(value);
    result = result.replace(placeholder, formattedVal !== undefined && formattedVal !== null ? formattedVal : '');
  }
  return result;
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

    // 2. Query active notification rules for this tenant, service, and trigger_event
    const { data: rules, error: rulesError } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('tenant_id', card.tenant_id)
      .eq('service_id', card.service_id)
      .eq('trigger_event', triggerEvent)
      .eq('is_active', true);

    if (rulesError || !rules || rules.length === 0) {
      console.log(`No active notification rule for service ${card.service_id} on trigger '${triggerEvent}'`);
      return { success: true, dispatched: 0 };
    }

    const contactName = card.contacts?.name || 'Cliente';
    const contactPhone = card.contacts?.phone;
    const serviceTitle = card.services?.title || 'Serviço';

    if (!contactPhone) {
      console.error('Notification error: Contact has no phone number recorded');
      return { success: false, reason: 'No contact phone' };
    }

    const templateVariables = {
      card_id: card.id,
      contact_name: contactName,
      service_title: serviceTitle,
      status: card.status,
      attachment_url: card.attachment_url || '',
      ...(card.collected_data || {}),
      ...(card.attachment_metadata || {})
    };

    let dispatchedCount = 0;
    for (const rule of rules) {
      const messageText = interpolateTemplate(rule.template_body, templateVariables);
      console.log(`[Notification Engine] Dispatching WhatsApp alert to ${contactPhone}: "${messageText}"`);

      try {
        await sendWhatsAppMessage(contactPhone, messageText);
        dispatchedCount++;
      } catch (err) {
        console.error(`Failed sending WhatsApp message for rule ${rule.id}:`, err);
      }
    }

    return { success: true, dispatched: dispatchedCount };

  } catch (err) {
    console.error('Unhandled exception in triggerCardNotification:', err);
    return { success: false, error: err.message };
  }
}
