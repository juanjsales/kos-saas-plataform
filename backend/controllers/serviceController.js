import { prisma } from '../config/db.js';
import { getOrEnsureValidTenant } from '../services/whatsapp.js';

export async function createService(req, res) {
  try {
    const { tenant_id, title, questions_schema, ocr_enabled, ocr_fields, whatsapp_triggers } = req.body;

    const activeTenantId = await getOrEnsureValidTenant(tenant_id);

    if (!title) {
      return res.status(400).json({ error: 'O título do serviço é obrigatório.' });
    }

    const service = await prisma.service.create({
      data: {
        tenant_id: activeTenantId,
        title,
        questions_schema: typeof questions_schema === 'string' ? questions_schema : JSON.stringify(questions_schema || []),
        ocr_enabled: ocr_enabled !== false,
        ocr_fields: typeof ocr_fields === 'string' ? ocr_fields : JSON.stringify(ocr_fields || []),
        whatsapp_triggers: typeof whatsapp_triggers === 'string' ? whatsapp_triggers : JSON.stringify(whatsapp_triggers || {})
      }
    });

    return res.status(201).json(service);
  } catch (err) {
    console.error('Error creating service:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function updateService(req, res) {
  try {
    const { id } = req.params;
    const { title, questions_schema, ocr_enabled, ocr_fields, whatsapp_triggers } = req.body;

    if (!id || !title) {
      return res.status(400).json({ error: 'O id e o título do serviço são obrigatórios.' });
    }

    const updateData = {
      title
    };

    if (questions_schema !== undefined) {
      updateData.questions_schema = typeof questions_schema === 'string' ? questions_schema : JSON.stringify(questions_schema);
    }
    if (ocr_enabled !== undefined) {
      updateData.ocr_enabled = !!ocr_enabled;
    }
    if (ocr_fields !== undefined) {
      updateData.ocr_fields = typeof ocr_fields === 'string' ? ocr_fields : JSON.stringify(ocr_fields);
    }
    if (whatsapp_triggers !== undefined) {
      updateData.whatsapp_triggers = typeof whatsapp_triggers === 'string' ? whatsapp_triggers : JSON.stringify(whatsapp_triggers);
    }

    const service = await prisma.service.update({
      where: { id },
      data: updateData
    });

    return res.json(service);
  } catch (err) {
    console.error('Error updating service:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function deleteService(req, res) {
  try {
    const { id } = req.params;

    await prisma.service.delete({
      where: { id }
    });

    return res.json({ success: true, message: 'Serviço excluído com sucesso.' });
  } catch (err) {
    console.error('Error deleting service:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function getServices(req, res) {
  try {
    const activeTenantId = await getOrEnsureValidTenant(req.query.tenant_id);

    const services = await prisma.service.findMany({
      where: { tenant_id: activeTenantId },
      orderBy: { created_at: 'desc' }
    });

    // Parse JSON string fields safely for frontend consumption
    const parsed = services.map(s => {
      let questions = [];
      let fields = [];
      let triggers = {};
      try { questions = JSON.parse(s.questions_schema); } catch (e) {}
      try { fields = JSON.parse(s.ocr_fields); } catch (e) {}
      try { triggers = JSON.parse(s.whatsapp_triggers); } catch (e) {}

      return {
        ...s,
        questions_schema: questions,
        ocr_fields: fields,
        whatsapp_triggers: triggers
      };
    });

    return res.json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
