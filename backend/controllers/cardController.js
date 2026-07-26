import { prisma } from '../config/db.js';
import { triggerCardNotification } from '../services/notificationEngine.js';
import { processDocumentAttachment } from '../services/documentProcessor.js';
import { sendWhatsAppMessage, getOrEnsureValidTenant } from '../services/whatsapp.js';

export async function createCard(req, res) {
  try {
    const { tenant_id, service_id, contact_id, contact_name, contact_phone, status, collected_data } = req.body;

    const activeTenantId = await getOrEnsureValidTenant(tenant_id);

    if (!service_id) {
      return res.status(400).json({ error: 'service_id é obrigatório' });
    }

    let finalContactId = contact_id;

    // Auto upsert contact if name and phone are provided
    if (!finalContactId && contact_name && contact_phone) {
      const cleanPhone = contact_phone.replace(/\D/g, '');
      const existing = await prisma.contact.findUnique({
        where: { tenant_id_phone: { tenant_id: activeTenantId, phone: cleanPhone } }
      });

      if (existing) {
        finalContactId = existing.id;
      } else {
        const newContact = await prisma.contact.create({
          data: {
            tenant_id: activeTenantId,
            name: contact_name,
            phone: cleanPhone
          }
        });
        finalContactId = newContact.id;
      }
    }

    if (!finalContactId) {
      return res.status(400).json({ error: 'contact_id ou nome/telefone são obrigatórios' });
    }

    const cardStatus = status || 'created';

    const card = await prisma.card.create({
      data: {
        tenant_id: activeTenantId,
        service_id,
        contact_id: finalContactId,
        status: cardStatus,
        collected_data: typeof collected_data === 'string' ? collected_data : JSON.stringify(collected_data || {})
      },
      include: {
        service: true,
        contact: true
      }
    });

    // Trigger Automated WhatsApp Notification
    if (card.contact?.phone) {
      triggerCardNotification({
        tenantId: activeTenantId,
        triggerType: 'card_created',
        card: card,
        service: card.service,
        contactPhone: card.contact.phone
      }).catch(err => console.error('Error triggering automated notification:', err));
    }

    return res.status(201).json(card);
  } catch (err) {
    console.error('Error creating card:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function getCards(req, res) {
  try {
    const activeTenantId = await getOrEnsureValidTenant(req.query.tenant_id);

    const cards = await prisma.card.findMany({
      where: { tenant_id: activeTenantId },
      include: {
        service: true,
        contact: true
      },
      orderBy: { created_at: 'desc' }
    });

    const parsed = cards.map(c => {
      let data = {};
      let metadata = {};
      try { data = JSON.parse(c.collected_data); } catch (e) {}
      try { metadata = JSON.parse(c.ocr_metadata); } catch (e) {}

      return {
        ...c,
        collected_data: data,
        ocr_metadata: metadata,
        services: c.service,
        contacts: c.contact
      };
    });

    return res.json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function updateCardStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: 'id and status are required' });
    }

    const validStatuses = ['created', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status inválido. Deve ser um de: ${validStatuses.join(', ')}` });
    }

    const updatedCard = await prisma.card.update({
      where: { id },
      data: { status },
      include: { service: true, contact: true }
    });

    // Trigger status notification
    if (updatedCard.contact?.phone) {
      const triggerType = `status_${status}`;
      triggerCardNotification({
        tenantId: updatedCard.tenant_id,
        triggerType,
        card: updatedCard,
        service: updatedCard.service,
        contactPhone: updatedCard.contact.phone
      }).catch(err => console.error('Error triggering notification on status update:', err));
    }

    return res.json(updatedCard);
  } catch (err) {
    console.error('Error updating card status:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function processCardOcr(req, res) {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Arquivo do documento é obrigatório' });
    }

    const card = await prisma.card.findUnique({
      where: { id },
      include: { service: true, contact: true }
    });

    if (!card) {
      return res.status(404).json({ error: 'Cartão de atendimento não encontrado' });
    }

    const ocrResult = await processDocumentAttachment(file, card.service);

    const updatedCard = await prisma.card.update({
      where: { id },
      data: {
        ocr_metadata: JSON.stringify(ocrResult.extracted_data || {}),
        ocr_file_url: ocrResult.file_url || null
      },
      include: { service: true, contact: true }
    });

    return res.json({
      message: 'Documento processado com sucesso!',
      ocr_result: ocrResult,
      card: updatedCard
    });
  } catch (err) {
    console.error('Error processing card OCR:', err);
    return res.status(500).json({ error: err.message });
  }
}
