import { supabase } from '../config/supabase.js';
import { triggerCardNotification } from '../services/notificationEngine.js';

export async function getChats(req, res) {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const { data: chats, error } = await supabase
      .from('chats')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return res.json(chats);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getMessages(req, res) {
  try {
    const { chatId } = req.params;

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Converts a WhatsApp Chat into a Service Appointment / Card
 */
export async function convertChatToCard(req, res) {
  try {
    const { tenant_id, chat_id, service_id, contact_name, collected_data } = req.body;

    if (!tenant_id || !chat_id || !service_id) {
      return res.status(400).json({ error: 'tenant_id, chat_id, and service_id are required' });
    }

    const senderPhone = chat_id.replace('@s.whatsapp.net', '');

    // 1. Upsert contact
    const { data: contact, error: contactErr } = await supabase
      .from('contacts')
      .upsert({
        tenant_id,
        name: contact_name || senderPhone,
        phone: senderPhone
      }, { onConflict: 'tenant_id,phone' })
      .select()
      .single();

    if (contactErr) throw contactErr;

    // 2. Create card
    const { data: card, error: cardErr } = await supabase
      .from('cards')
      .insert({
        tenant_id,
        service_id,
        contact_id: contact.id,
        status: 'created',
        collected_data: collected_data || {}
      })
      .select()
      .single();

    if (cardErr) throw cardErr;

    // 3. Trigger card_created notification
    triggerCardNotification(card.id, 'card_created').catch(err => {
      console.error('Async notification error on chat conversion:', err);
    });

    return res.status(201).json(card);
  } catch (err) {
    console.error('Error converting chat to card:', err);
    return res.status(500).json({ error: err.message });
  }
}
