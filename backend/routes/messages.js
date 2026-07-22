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
    const { recipientPhone, content, chatId } = req.body;

    if (!recipientPhone || !content) {
      return res.status(400).json({ error: 'recipientPhone and content are required' });
    }

    // 1. Dispatch outbound WhatsApp message
    const result = await sendWhatsAppMessage(recipientPhone, content);

    // 2. Log message to Supabase
    const targetChatId = chatId || (recipientPhone.includes('@s.whatsapp.net') ? recipientPhone : `${recipientPhone}@s.whatsapp.net`);
    
    await supabase.from('messages').insert({
      chat_id: targetChatId,
      sender_phone: 'System/Agent',
      content: content,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({ success: true, messageId: result?.key?.id, result });
  } catch (err) {
    console.error('Failed to send WhatsApp message:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
