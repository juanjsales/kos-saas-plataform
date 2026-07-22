import { supabase } from '../config/supabase.js';

export async function getUserPreferences(req, res) {
  try {
    const userId = req.query.user_id || req.headers['x-user-id'] || '00000000-0000-0000-0000-000000000001';

    const { data: prefs, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      if (error.code === 'PGRST205') {
        return res.json({
          user_id: userId,
          theme_mode: 'dark',
          accent_color: '#6366f1',
          kanban_density: 'comfortable'
        });
      }
      throw error;
    }

    return res.json(prefs || {
      user_id: userId,
      theme_mode: 'dark',
      accent_color: '#6366f1',
      kanban_density: 'comfortable'
    });
  } catch (err) {
    console.error('Error fetching user preferences:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function saveUserPreferences(req, res) {
  try {
    const { user_id, tenant_id, theme_mode, accent_color, kanban_density } = req.body;
    const userId = user_id || req.headers['x-user-id'] || '00000000-0000-0000-0000-000000000001';

    const payload = {
      user_id: userId,
      tenant_id: tenant_id || '00000000-0000-0000-0000-000000000001',
      theme_mode: theme_mode || 'dark',
      accent_color: accent_color || '#6366f1',
      kanban_density: kanban_density || 'comfortable',
      updated_at: new Date().toISOString()
    };

    const { data: prefs, error } = await supabase
      .from('user_preferences')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    return res.json(prefs);
  } catch (err) {
    console.error('Error saving user preferences:', err);
    return res.status(500).json({ error: err.message });
  }
}
