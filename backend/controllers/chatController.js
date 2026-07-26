import { supabase } from '../config/supabase.js';
import { triggerCardNotification } from '../services/notificationEngine.js';
import { getOrEnsureValidTenant, sendTypingPresence, markMessageAsRead } from '../services/whatsapp.js';

export async function getChats(req, res) {
  try {
    const activeTenantId = await getOrEnsureValidTenant(req.query.tenant_id);

    let { data: chats, error } = await supabase
      .from('chats')
      .select('*')
      .eq('tenant_id', activeTenantId)
      .not('id', 'like', '%@lid%')
      .not('id', 'like', '%status@broadcast%')
      .not('id', 'like', '%@g.us%')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return res.json(chats || []);
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
 * Updates WhatsApp typing/recording presence status for a contact
 */
export async function updateChatPresence(req, res) {
  try {
    const { tenant_id, chat_id, state } = req.body;
    const activeTenantId = await getOrEnsureValidTenant(tenant_id);
    await sendTypingPresence(activeTenantId, chat_id, state || 'composing');
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Marks messages as read (Blue Double Check) on WhatsApp
 */
export async function markChatRead(req, res) {
  try {
    const { tenant_id, chat_id } = req.body;
    const activeTenantId = await getOrEnsureValidTenant(tenant_id);
    await markMessageAsRead(activeTenantId, chat_id);
    return res.json({ success: true });
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

    const activeTenantId = await getOrEnsureValidTenant(tenant_id);

    if (!chat_id || !service_id) {
      return res.status(400).json({ error: 'chat_id e service_id são obrigatórios.' });
    }

    const phone = chat_id.replace('@s.whatsapp.net', '').replace(/\D/g, '');

    // 1. Find or Create Contact in Supabase
    let { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('tenant_id', activeTenantId)
      .eq('phone', phone)
      .maybeSingle();

    if (!contact) {
      const { data: newContact, error: cErr } = await supabase
        .from('contacts')
        .insert({
          tenant_id: activeTenantId,
          name: contact_name || phone,
          phone: phone
        })
        .select()
        .single();

      if (cErr) throw cErr;
      contact = newContact;
    }

    // 2. Fetch service questions schema to build title & metadata
    const { data: service } = await supabase
      .from('services')
      .select('*')
      .eq('id', service_id)
      .single();

    // 3. Create Card in Kanban Board
    const { data: card, error: cardErr } = await supabase
      .from('cards')
      .insert({
        tenant_id: activeTenantId,
        service_id: service_id,
        contact_id: contact.id,
        status: 'created',
        collected_data: collected_data || {}
      })
      .select('*, services(*), contacts(*)')
      .single();

    if (cardErr) throw cardErr;

    // 4. Trigger Automatic WhatsApp Notification for Card Created Trigger
    triggerCardNotification({
      tenantId: activeTenantId,
      triggerType: 'card_created',
      card: card,
      service: service || card.services,
      contactPhone: phone
    }).catch(err => console.error('Error triggering automated WhatsApp notification:', err));

    return res.status(201).json({
      message: 'Conversa convertida em Cartão de Atendimento com sucesso!',
      card
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
