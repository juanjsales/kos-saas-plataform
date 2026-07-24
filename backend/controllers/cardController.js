import { supabase } from '../config/supabase.js';
import { triggerCardNotification, interpolateTemplate } from '../services/notificationEngine.js';
import { processDocumentAttachment } from '../services/documentProcessor.js';
import { sendWhatsAppMessage, getOrEnsureValidTenant } from '../services/whatsapp.js';

export async function createCard(req, res) {
  try {
    const { tenant_id, service_id, contact_id, contact_name, contact_phone, status, collected_data } = req.body;

    if (!tenant_id || !service_id) {
      return res.status(400).json({ error: 'tenant_id and service_id are required' });
    }

    let finalContactId = contact_id;

    // Auto upsert contact if name and phone are provided
    if (!finalContactId && contact_name && contact_phone) {
      const cleanPhone = contact_phone.replace(/\D/g, '');
      const { data: contact, error: contactErr } = await supabase
        .from('contacts')
        .upsert({
          tenant_id,
          name: contact_name,
          phone: cleanPhone
        }, { onConflict: 'tenant_id,phone' })
        .select()
        .single();

      if (contactErr) throw contactErr;
      finalContactId = contact.id;
    }

    if (!finalContactId) {
      return res.status(400).json({ error: 'contact_id or contact_name + contact_phone is required' });
    }

    const cardStatus = status || 'created';

    const { data: card, error } = await supabase
      .from('cards')
      .insert({
        tenant_id,
        service_id,
        contact_id: finalContactId,
        status: cardStatus,
        collected_data: collected_data || {}
      })
      .select()
      .single();

    if (error) throw error;

    // Trigger notification and workflows asynchronously
    const triggerEvent = cardStatus === 'created' ? 'card_created' : `status_${cardStatus}`;
    triggerCardNotification(card.id, triggerEvent).catch(err => {
      console.error(`Async notification error on card create (${triggerEvent}):`, err);
    });

    const { evaluateCardWorkflows } = await import('../services/workflowEngine.js');
    evaluateCardWorkflows(card.id, 'on_card_created').catch(err => {
      console.error('Workflow engine error on card create:', err);
    });

    return res.status(201).json(card);
  } catch (err) {
    console.error('Error creating card:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function updateCardStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const { data: card, error } = await supabase
      .from('cards')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Trigger notification for status update (e.g. status_in_progress, status_completed, status_cancelled)
    const triggerEvent = `status_${status}`;
    triggerCardNotification(card.id, triggerEvent).catch(err => {
      console.error(`Async notification error on trigger ${triggerEvent}:`, err);
    });

    const { evaluateCardWorkflows } = await import('../services/workflowEngine.js');
    evaluateCardWorkflows(card.id, 'on_status_change').catch(err => {
      console.error('Workflow engine error on status change:', err);
    });

    return res.json(card);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getCards(req, res) {
  try {
    const activeTenantId = await getOrEnsureValidTenant(req.query.tenant_id);

    let { data: cards, error } = await supabase
      .from('cards')
      .select(`
        *,
        services ( title, description, confirmation_template, completion_type ),
        contacts ( name, phone )
      `)
      .eq('tenant_id', activeTenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json(cards || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Service Confirmation endpoint POST /api/cards/:id/confirm
 */
export async function confirmCard(req, res) {
  try {
    const { id } = req.params;
    const { collected_data, confirmed_by } = req.body;

    const now = new Date().toISOString();

    // 1. Update card in Supabase
    const { data: card, error } = await supabase
      .from('cards')
      .update({
        collected_data: collected_data || {},
        confirmed_at: now,
        confirmed_by: confirmed_by || null,
        updated_at: now
      })
      .eq('id', id)
      .select(`
        *,
        services ( title, confirmation_template ),
        contacts ( name, phone )
      `)
      .single();

    if (error || !card) {
      return res.status(400).json({ error: error?.message || 'Card not found' });
    }

    // 2. Format & send confirmation message via WhatsApp
    const contactPhone = card.contacts?.phone;
    const template = card.services?.confirmation_template || 
      'Olá {contact_name}, seu agendamento para {service_title} foi confirmado com sucesso!';

    if (contactPhone) {
      const templateVars = {
        card_id: card.id,
        contact_name: card.contacts?.name || 'Cliente',
        service_title: card.services?.title || 'Serviço',
        confirmed_at: new Date(now).toLocaleDateString(),
        status: card.status,
        ...(card.collected_data || {})
      };

      const finalMessageText = interpolateTemplate(template, templateVars);
      console.log(`[Card Confirmation] Dispatching WhatsApp confirmation message to ${contactPhone}: "${finalMessageText}"`);

      try {
        await sendWhatsAppMessage(contactPhone, finalMessageText, card.tenant_id);
      } catch (err) {
        console.error('Failed sending WhatsApp confirmation message:', err);
      }
    }

    return res.json(card);
  } catch (err) {
    console.error('Error confirming card:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Analyzes uploaded attachment document via OCR and uploads to Supabase Storage
 */
export async function analyzeCardAttachment(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;

    // Strict MIME-Type validation to prevent RCE / malicious script uploads
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Tipo de arquivo não permitido. Envie apenas imagens (JPG, PNG, WEBP), PDF ou arquivo TXT.' });
    }

    const tenantId = req.body.tenant_id || '00000000-0000-0000-0000-000000000001';
    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    const filePath = `${tenantId}/${fileName}`;

    // 1. Upload file to Supabase Storage bucket 'card-attachments'
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('card-attachments')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadErr) {
      console.error('Supabase storage upload error:', uploadErr);
    }

    // 2. Get Public URL
    const { data: urlData } = supabase.storage
      .from('card-attachments')
      .getPublicUrl(filePath);

    const attachmentUrl = urlData?.publicUrl || uploadData?.path || filePath;

    // 3. Extract OCR metadata
    const extractedMetadata = await processDocumentAttachment(file.buffer, file.mimetype, file.originalname);

    return res.json({
      success: true,
      attachment_url: attachmentUrl,
      attachment_metadata: extractedMetadata
    });
  } catch (err) {
    console.error('Error analyzing attachment:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Completes a card with attachment URL and OCR metadata
 */
export async function completeCardWithAttachment(req, res) {
  try {
    const { id } = req.params;
    let { attachment_url, attachment_metadata, collected_data } = req.body;

    if (typeof attachment_metadata === 'string') {
      try {
        attachment_metadata = JSON.parse(attachment_metadata);
      } catch (e) {}
    }

    if (typeof collected_data === 'string') {
      try {
        collected_data = JSON.parse(collected_data);
      } catch (e) {}
    }

    // If file is directly uploaded in this request
    if (req.file) {
      const file = req.file;
      const tenantId = req.body.tenant_id || '00000000-0000-0000-0000-000000000001';
      const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
      const filePath = `${tenantId}/${id}/${fileName}`;

      await supabase.storage
        .from('card-attachments')
        .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });

      const { data: urlData } = supabase.storage
        .from('card-attachments')
        .getPublicUrl(filePath);

      attachment_url = urlData?.publicUrl || filePath;
      if (!attachment_metadata) {
        attachment_metadata = await processDocumentAttachment(file.buffer, file.mimetype, file.originalname);
      }
    }

    const now = new Date().toISOString();

    const updatePayload = {
      status: 'completed',
      attachment_url: attachment_url || null,
      attachment_metadata: attachment_metadata || {},
      completed_at: now,
      updated_at: now
    };

    if (collected_data) {
      updatePayload.collected_data = collected_data;
    }

    const { data: card, error } = await supabase
      .from('cards')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Trigger WhatsApp notification for completion
    triggerCardNotification(card.id, 'status_completed').catch(err => {
      console.error('Async notification error on completion:', err);
    });

    return res.json(card);
  } catch (err) {
    console.error('Error completing card with attachment:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Endpoint POST /api/cards/:id/execute-automation
 * Triggers RPA external form filling automation worker
 */
export async function executeAutomation(req, res) {
  try {
    const { id } = req.params;
    const { executeExternalAutomation } = await import('../services/automationService.js');

    // Trigger automation asynchronously or await result
    const result = await executeExternalAutomation(id);
    return res.json(result);
  } catch (err) {
    console.error('Error executing automation endpoint:', err);
    return res.status(500).json({ error: err.message });
  }
}
