import { supabase } from '../config/supabase.js';

/**
 * LGPD Contact Anonymization Endpoint POST /api/contacts/:id/anonymize
 * Hashes personal data, disables opt_in, and cancels pending reminders
 */
export async function anonymizeContactLGPD(req, res) {
  try {
    const { id } = req.params;

    // 1. Fetch contact
    const { data: contact, error: fetchErr } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !contact) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    const now = new Date().toISOString();
    const anonHash = `ANON_${Date.now().toString().slice(-6)}`;

    // 2. Anonymize contact record
    const { data: updatedContact, error: updateErr } = await supabase
      .from('contacts')
      .update({
        name: `Titular Anônimo LGPD (${anonHash})`,
        phone: anonHash,
        opt_in: false,
        opt_out_at: now,
        anonymized_at: now,
        updated_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 3. Cancel pending scheduled messages for this contact's cards
    const { data: cards } = await supabase
      .from('cards')
      .select('id')
      .eq('contact_id', id);

    if (cards && cards.length > 0) {
      const cardIds = cards.map(c => c.id);

      // Cancel scheduled queue items
      await supabase
        .from('scheduled_messages_queue')
        .update({
          status: 'failed',
          payload: { canceled_by: 'LGPD Right to be Forgotten (Anonymization)' }
        })
        .in('card_id', cardIds)
        .eq('status', 'pending');

      // Sanitize collected_data on associated cards
      for (const cardId of cardIds) {
        await supabase
          .from('cards')
          .update({
            collected_data: { lgpd_anonymized: true, anonymized_at: now },
            updated_at: now
          })
          .eq('id', cardId);
      }
    }

    console.log(`[LGPD Controller] Contact ${id} anonymized successfully.`);

    return res.json({
      success: true,
      message: 'Dados pessoais do titular anonimizados com sucesso em conformidade com a LGPD.',
      contact: updatedContact
    });

  } catch (err) {
    console.error('Error anonymizing contact:', err);
    return res.status(500).json({ error: err.message });
  }
}
