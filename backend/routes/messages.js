import { Router } from 'express';
import { sendWhatsAppMessage } from '../services/whatsapp.js';
import { supabase } from '../config/supabase.js';

const router = Router();

/**
 * POST /api/messages/send
 * Dispatches an outbound WhatsApp message and records it in Supabase messages table.
 */
router.post('/send', async (req, res) => {
  try {
    const { recipientPhone, content, chatId, tenant_id } = req.body;
    const targetTenant = tenant_id || req.headers['x-tenant-id'] || req.query.tenant_id;

    if (!recipientPhone || !content) {
      return res.status(400).json({ error: 'recipientPhone and content are required' });
    }

    // 1. Dispatch outbound WhatsApp message
    const result = await sendWhatsAppMessage(recipientPhone, content, targetTenant);

    if (result && result.success === false) {
      return res.status(400).json({
        success: false,
        error: 'Sessão do WhatsApp desconectada. Clique no botão "Conectar WhatsApp" no topo do painel para escanear o QR Code.'
      });
    }

    // 2. Log chat, contact & message to Supabase
    const targetChatId = chatId || (recipientPhone.includes('@s.whatsapp.net') ? recipientPhone : `${recipientPhone}@s.whatsapp.net`);
    const cleanPhone = recipientPhone.replace(/\D/g, '');

    await supabase.from('chats').upsert({
      id: targetChatId,
      tenant_id: targetTenant || '00000000-0000-0000-0000-000000000001',
      contact_name: cleanPhone,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    await supabase.from('contacts').upsert({
      tenant_id: targetTenant || '00000000-0000-0000-0000-000000000001',
      name: cleanPhone,
      phone: cleanPhone
    }, { onConflict: 'tenant_id,phone' });

    await supabase.from('messages').insert({
      chat_id: targetChatId,
      sender_phone: 'System/Agent',
      content: content,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({ success: true, messageId: result?.result?.key?.id || result?.key?.id, result });
  } catch (err) {
    console.error('Failed to send WhatsApp message:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
