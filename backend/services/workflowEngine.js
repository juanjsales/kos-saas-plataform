import { supabase } from '../config/supabase.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import { interpolateTemplate, formatDateValue } from './notificationEngine.js';

/**
 * No-Code Workflow Engine Interpreter
 * Evaluates active workflow_rules when card events occur (created, status_change, rpa_success)
 */
export async function evaluateCardWorkflows(cardId, eventType, context = {}) {
  try {
    console.log(`[Workflow Engine] Evaluating workflows for card ${cardId} on event '${eventType}'`);

    // 1. Fetch complete card details with service and contact
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select(`
        id,
        tenant_id,
        service_id,
        status,
        collected_data,
        attachment_metadata,
        services ( title, description, external_url ),
        contacts ( name, phone )
      `)
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      console.error(`[Workflow Engine] Error: Card ${cardId} not found`, cardError);
      return { success: false, reason: 'Card not found' };
    }

    // 2. Fetch active workflow_rules for this service
    const { data: rules, error: rulesError } = await supabase
      .from('workflow_rules')
      .select('*')
      .eq('tenant_id', card.tenant_id)
      .eq('service_id', card.service_id)
      .eq('is_active', true);

    if (rulesError || !rules || rules.length === 0) {
      console.log(`[Workflow Engine] No active rules for service ${card.service_id}`);
      return { success: true, executedCount: 0 };
    }

    const contactName = card.contacts?.name || 'Cliente';
    const contactPhone = card.contacts?.phone;
    const isOptedIn = card.contacts?.opt_in !== false;

    if (!isOptedIn) {
      console.log(`[Workflow Engine] LGPD Notice: Contact ${contactPhone} has opted out (opt_in=false). Skipping workflow alerts.`);
      return { success: true, executedCount: 0, reason: 'Contact opted out' };
    }

    const templateData = {
      card_id: card.id,
      contact_name: contactName,
      service_title: card.services?.title || 'Serviço',
      status: card.status,
      confirmed_at: new Date().toLocaleDateString('pt-BR'),
      ...(card.collected_data || {}),
      ...(card.attachment_metadata || {})
    };

    let executedCount = 0;

    for (const rule of rules) {
      const triggerType = rule.trigger_type;
      const triggerConfig = rule.trigger_config || {};

      let matchesTrigger = false;

      if (triggerType === 'on_card_created' && eventType === 'on_card_created') {
        matchesTrigger = true;
      } else if (triggerType === 'on_status_change' && eventType === 'on_status_change') {
        const targetStatus = triggerConfig.target_status || triggerConfig.to_status;
        if (!targetStatus || targetStatus === card.status || targetStatus === 'any') {
          matchesTrigger = true;
        }
      } else if (triggerType === 'on_rpa_success' && eventType === 'on_rpa_success') {
        matchesTrigger = true;
      } else if (triggerType === 'on_time_offset' && (eventType === 'on_card_created' || eventType === 'on_status_change')) {
        // Enqueue time-offset message in scheduled_messages_queue with anti-duplication
        const offsetMinutes = parseInt(triggerConfig.offset_minutes || 60, 10);
        const sendAt = new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();

        console.log(`[Workflow Engine] Scheduling time-offset rule ${rule.id} for card ${cardId} at ${sendAt}`);

        const { error: queueErr } = await supabase
          .from('scheduled_messages_queue')
          .insert({
            tenant_id: card.tenant_id,
            card_id: card.id,
            rule_id: rule.id,
            send_at: sendAt,
            status: 'pending',
            payload: {
              template_body: rule.action_config?.template_body,
              contact_phone: contactPhone,
              template_data: templateData
            }
          });

        if (queueErr) {
          if (queueErr.code === '23505') { // Unique constraint violation
            console.log(`[Workflow Engine] Idempotency: Card ${cardId} already has scheduled message for rule ${rule.id}`);
          } else {
            console.error(`[Workflow Engine] Error enqueuing scheduled message:`, queueErr);
          }
        } else {
          executedCount++;
        }
        continue;
      }

      if (!matchesTrigger) continue;

      // Execute Immediate Action
      const actionType = rule.action_type;
      const actionConfig = rule.action_config || {};

      if (actionType === 'send_whatsapp' && contactPhone && actionConfig.template_body) {
        const messageText = interpolateTemplate(actionConfig.template_body, templateData);
        console.log(`[Workflow Engine] Executing WhatsApp action for rule ${rule.title} -> ${contactPhone}: "${messageText}"`);

        try {
          await sendWhatsAppMessage(contactPhone, messageText);
          executedCount++;
        } catch (err) {
          console.error(`[Workflow Engine] Failed sending WhatsApp for rule ${rule.id}:`, err);
        }
      } else if (actionType === 'run_rpa') {
        console.log(`[Workflow Engine] Executing RPA action for rule ${rule.title} on card ${cardId}`);
        const { executeExternalAutomation } = await import('./automationService.js');
        executeExternalAutomation(cardId).catch(err => {
          console.error(`[Workflow Engine] Async RPA error:`, err);
        });
        executedCount++;
      } else if (actionType === 'move_card_status' && actionConfig.target_status) {
        console.log(`[Workflow Engine] Executing move_card_status to '${actionConfig.target_status}' on card ${cardId}`);
        await supabase
          .from('cards')
          .update({ status: actionConfig.target_status, updated_at: new Date().toISOString() })
          .eq('id', cardId);
        executedCount++;
      }
    }

    return { success: true, executedCount };

  } catch (err) {
    console.error('[Workflow Engine] Error in evaluateCardWorkflows:', err);
    return { success: false, error: err.message };
  }
}
