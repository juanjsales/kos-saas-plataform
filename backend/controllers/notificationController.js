import { supabase } from '../config/supabase.js';

export async function getNotificationRules(req, res) {
  try {
    const { tenant_id, service_id } = req.query;
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id query parameter is required' });
    }

    let query = supabase.from('notification_rules').select('*').eq('tenant_id', tenant_id);
    if (service_id) {
      query = query.eq('service_id', service_id);
    }

    const { data: rules, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    return res.json(rules);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function upsertNotificationRule(req, res) {
  try {
    const { id, tenant_id, service_id, trigger_event, is_active, template_body } = req.body;

    if (!tenant_id || !service_id || !trigger_event || !template_body) {
      return res.status(400).json({ error: 'tenant_id, service_id, trigger_event, and template_body are required' });
    }

    const payload = {
      tenant_id,
      service_id,
      trigger_event,
      is_active: is_active !== undefined ? is_active : true,
      template_body
    };

    if (id) payload.id = id;

    const { data: rule, error } = await supabase
      .from('notification_rules')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json(rule);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function toggleNotificationRule(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (is_active === undefined) {
      return res.status(400).json({ error: 'is_active boolean field is required' });
    }

    const { data: rule, error } = await supabase
      .from('notification_rules')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json(rule);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
