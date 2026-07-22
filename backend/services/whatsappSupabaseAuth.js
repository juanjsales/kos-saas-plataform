import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys';
import { supabase } from '../config/supabase.js';

/**
 * Custom Baileys Auth State handler that persists WhatsApp session keys in Supabase database.
 * Prevents WhatsApp disconnects on Render.com container redeploys or restarts.
 */
export async function useSupabaseAuthState(tenantId) {
  const readData = async (key) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('data_val')
        .eq('tenant_id', tenantId)
        .eq('data_key', key)
        .maybeSingle();

      if (error || !data?.data_val) return null;
      return JSON.parse(data.data_val, BufferJSON.reviver);
    } catch (err) {
      return null;
    }
  };

  const writeData = async (key, val) => {
    try {
      const serialized = JSON.stringify(val, BufferJSON.replacer);
      await supabase
        .from('whatsapp_sessions')
        .upsert({
          tenant_id: tenantId,
          data_key: key,
          data_val: serialized,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id,data_key' });
    } catch (err) {
      console.error(`Error saving WhatsApp auth key (${key}) to Supabase:`, err);
    }
  };

  const removeData = async (key) => {
    try {
      await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('data_key', key);
    } catch (err) {}
  };

  // Ensure table exists on first use (graceful fallback)
  try {
    await supabase.rpc('execute_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
          tenant_id UUID NOT NULL,
          data_key TEXT NOT NULL,
          data_val TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (tenant_id, data_key)
        );
      `
    }).catch(() => {});
  } catch (e) {}

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = typeof value === 'object' ? value : JSON.parse(JSON.stringify(value), BufferJSON.reviver);
              }
              if (value) {
                data[id] = value;
              }
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(key, value));
              } else {
                tasks.push(removeData(key));
              }
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => writeData('creds', creds)
  };
}
