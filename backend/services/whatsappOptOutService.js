import { supabase } from '../config/supabase.js';
import { sendWhatsAppMessage } from './whatsapp.js';

const OPT_OUT_KEYWORDS = ['PARAR', 'SAIR', 'CANCELAR', 'STOP', 'REMOVER', 'NAO QUERO', 'NÃO QUERO'];
const OPT_IN_KEYWORDS = ['REATIVAR', 'VOLTAR', 'START', 'CONTINUAR'];

/**
 * Scans inbound WhatsApp messages for LGPD Opt-Out keywords
 * If keyword matches, updates contact opt_in status and cancels pending reminders
 */
export async function processWhatsAppConsentKeywords(tenantId, senderPhone, messageContent) {
  try {
    const textUpper = messageContent.trim().toUpperCase();

    const isOptOut = OPT_OUT_KEYWORDS.some(k => textUpper === k || textUpper.startsWith(k));
    const isOptIn = OPT_IN_KEYWORDS.some(k => textUpper === k || textUpper.startsWith(k));

    if (!isOptOut && !isOptIn) return false;

    const cleanPhone = senderPhone.replace(/\D/g, '');

    // 1. Fetch contact
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone', cleanPhone)
      .single();

    if (error || !contact) return false;

    if (isOptOut) {
      console.log(`[LGPD Consent Processor] Opt-Out requested by phone ${cleanPhone}`);

      // Update contact opt_in = false
      await supabase
        .from('contacts')
        .update({
          opt_in: false,
          opt_out_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);

      // Cancel pending scheduled messages for this contact's cards
      const { data: cards } = await supabase
        .from('cards')
        .select('id')
        .eq('contact_id', contact.id);

      if (cards && cards.length > 0) {
        const cardIds = cards.map(c => c.id);
        await supabase
          .from('scheduled_messages_queue')
          .update({ status: 'failed', payload: { canceled_by: 'LGPD Opt-Out' } })
          .in('card_id', cardIds)
          .eq('status', 'pending');
      }

      // Send Opt-Out confirmation message
      try {
        await sendWhatsAppMessage(cleanPhone, '🔒 LGPD: Você foi removido com sucesso da nossa lista de lembretes e transmissões automáticas. Caso deseje reativar seu cadastro no futuro, envie a palavra REATIVAR.');
      } catch (e) {}

      return true;
    } else if (isOptIn) {
      console.log(`[LGPD Consent Processor] Opt-In re-activation requested by phone ${cleanPhone}`);

      await supabase
        .from('contacts')
        .update({
          opt_in: true,
          opt_out_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);

      try {
        await sendWhatsAppMessage(cleanPhone, '✅ Suas notificações e lembretes por WhatsApp foram reativados com sucesso!');
      } catch (e) {}

      return true;
    }

    return false;
  } catch (err) {
    console.error('Error processing WhatsApp consent keywords:', err);
    return false;
  }
}
