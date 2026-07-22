import { supabase } from '../config/supabase.js';

export async function createService(req, res) {
  try {
    const { tenant_id, title, description, completion_type, external_url, automation_mapping, custom_fields } = req.body;

    if (!tenant_id || !title) {
      return res.status(400).json({ error: 'tenant_id and title are required' });
    }

    // 1. Insert service
    const { data: service, error: serviceErr } = await supabase
      .from('services')
      .insert({
        tenant_id,
        title,
        description,
        completion_type: completion_type || 'identity',
        external_url: external_url || null,
        automation_mapping: automation_mapping || {}
      })
      .select()
      .single();

    if (serviceErr) throw serviceErr;

    // 2. Insert custom fields if present
    let fields = [];
    if (custom_fields && Array.isArray(custom_fields) && custom_fields.length > 0) {
      const fieldsToInsert = custom_fields.map(field => ({
        service_id: service.id,
        field_label: field.field_label,
        field_type: field.field_type || 'text',
        is_required: !!field.is_required
      }));

      const { data: createdFields, error: fieldsErr } = await supabase
        .from('custom_fields')
        .insert(fieldsToInsert)
        .select();

      if (fieldsErr) throw fieldsErr;
      fields = createdFields;
    }

    return res.status(201).json({ ...service, custom_fields: fields });
  } catch (err) {
    console.error('Error creating service:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function updateService(req, res) {
  try {
    const { id } = req.params;
    const { title, description, completion_type, external_url, automation_mapping, custom_fields } = req.body;

    if (!id || !title) {
      return res.status(400).json({ error: 'service id and title are required' });
    }

    // 1. Update service details
    const { data: service, error: updateErr } = await supabase
      .from('services')
      .update({
        title,
        description,
        completion_type: completion_type || 'identity',
        external_url: external_url || null,
        automation_mapping: automation_mapping || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 2. Replace custom fields
    if (custom_fields && Array.isArray(custom_fields)) {
      // Delete old fields
      await supabase.from('custom_fields').delete().eq('service_id', id);

      const fieldsToInsert = custom_fields
        .filter(f => f.field_label?.trim())
        .map(field => ({
          service_id: id,
          field_label: field.field_label,
          field_type: field.field_type || 'text',
          is_required: !!field.is_required
        }));

      if (fieldsToInsert.length > 0) {
        const { data: newFields } = await supabase
          .from('custom_fields')
          .insert(fieldsToInsert)
          .select();
        service.custom_fields = newFields;
      } else {
        service.custom_fields = [];
      }
    }

    return res.json(service);
  } catch (err) {
    console.error('Error updating service:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function deleteService(req, res) {
  try {
    const { id } = req.params;

    // Delete custom fields first
    await supabase.from('custom_fields').delete().eq('service_id', id);

    // Delete service
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) throw error;

    return res.json({ success: true, message: 'Serviço excluído com sucesso.' });
  } catch (err) {
    console.error('Error deleting service:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function getServices(req, res) {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id query parameter is required' });
    }

    const { data: services, error } = await supabase
      .from('services')
      .select(`
        *,
        custom_fields (*)
      `)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json(services);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
