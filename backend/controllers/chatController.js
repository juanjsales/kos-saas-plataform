import { prisma } from '../config/db.js';
import { triggerCardNotification } from '../services/notificationEngine.js';
import { getOrEnsureValidTenant, sendTypingPresence, markMessageAsRead } from '../services/whatsapp.js';

export async function getChats(req, res) {
  try {
    const activeTenantId = await getOrEnsureValidTenant(req.query.tenant_id);

    const chats = await prisma.chat.findMany({
      where: {
        tenant_id: activeTenantId,
        NOT: [
          { id: { contains: '@lid' } },
          { id: { contains: 'status@broadcast' } },
          { id: { contains: '@g.us' } }
        ]
      },
      orderBy: { updated_at: 'desc' }
    });

    return res.json(chats || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getMessages(req, res) {
  try {
    const { chatId } = req.params;

    const messages = await prisma.message.findMany({
      where: { chat_id: chatId },
      orderBy: { timestamp: 'asc' }
    });

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

    // 1. Find or Create Contact in SQLite
    let contact = await prisma.contact.findUnique({
      where: { tenant_id_phone: { tenant_id: activeTenantId, phone } }
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenant_id: activeTenantId,
          name: contact_name || phone,
          phone: phone
        }
      });
    }

    // 2. Fetch service questions schema to build title & metadata
    const service = await prisma.service.findUnique({
      where: { id: service_id }
    });

    // 3. Create Card in Kanban Board
    const card = await prisma.card.create({
      data: {
        tenant_id: activeTenantId,
        service_id: service_id,
        contact_id: contact.id,
        status: 'created',
        collected_data: typeof collected_data === 'string' ? collected_data : JSON.stringify(collected_data || {})
      },
      include: {
        service: true,
        contact: true
      }
    });

    // 4. Trigger Automatic WhatsApp Notification for Card Created Trigger
    triggerCardNotification({
      tenantId: activeTenantId,
      triggerType: 'card_created',
      card: card,
      service: service || card.service,
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
