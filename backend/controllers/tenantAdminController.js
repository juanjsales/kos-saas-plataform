import { supabase } from '../config/supabase.js';

/**
 * Super Admin Controller for global Tenant & User Management (Full Admin Suite with Granular Diagnostics)
 */
export async function getAllTenants(req, res) {
  try {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json(tenants);
  } catch (err) {
    console.error('[Diagnostic] Error fetching all tenants:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro ao buscar empresas',
      details: err
    });
  }
}

export async function getAllUsersAdmin(req, res) {
  try {
    const { tenant_id } = req.query;

    let query = supabase
      .from('users')
      .select('*, tenants(name)')
      .order('created_at', { ascending: false });

    if (tenant_id) {
      query = query.eq('tenant_id', tenant_id);
    }

    const { data: users, error } = await query;
    if (error) throw error;

    return res.json(users);
  } catch (err) {
    console.error('[Diagnostic] Error fetching all users for admin:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro ao buscar usuários',
      details: err
    });
  }
}

export async function resetUserPasswordAdmin(req, res) {
  try {
    const { user_id, email, password } = req.body;
    const temporaryPassword = password || 'Kos123456!';

    if (!user_id && !email) {
      return res.status(400).json({
        success: false,
        error: 'ID do Usuário ou E-mail é obrigatório.'
      });
    }

    let targetUserId = user_id;
    let targetEmail = email;

    if (!targetUserId && targetEmail) {
      const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) {
        console.error('[Diagnostic Auth Reset] Error listing auth users:', listErr);
      }
      const existing = listData?.users?.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
      if (existing) {
        targetUserId = existing.id;
      }
    }

    if (targetUserId) {
      const { error: updateErr } = await supabase.auth.admin.updateUserById(targetUserId, {
        password: temporaryPassword,
        email_confirm: true
      });
      if (updateErr) {
        console.error('[Diagnostic Auth Reset] Error updating password in auth.users:', updateErr);
        throw updateErr;
      }
    }

    console.log(`✅ [Diagnostic Auth Reset] Password successfully reset for user ${targetEmail || targetUserId}`);

    return res.json({
      success: true,
      message: 'Senha provisória gerada com sucesso!',
      credentials: {
        email: targetEmail || 'usuario@empresa.com',
        temporaryPassword: temporaryPassword
      }
    });
  } catch (err) {
    console.error('[Diagnostic Error] Password reset failed:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro ao redefinir senha do usuário',
      details: err
    });
  }
}

export async function createOrUpdateTenant(req, res) {
  try {
    const { id, name, logo_url, favicon_url, status, max_users, brand_colors, owner_email, owner_name, owner_password } = req.body;
    const provisionalPassword = owner_password || 'Kos123456!';

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Nome da empresa (name) é obrigatório.'
      });
    }

    const payload = {
      name,
      logo_url: logo_url || null,
      favicon_url: favicon_url || null,
      status: status || 'active',
      max_users: parseInt(max_users || 5, 10),
      brand_colors: brand_colors || { primary: '#6366f1', sidebar: '#0f172a' },
      updated_at: new Date().toISOString()
    };

    // ==========================================
    // STEP 1: Save/Update Tenant in public.tenants
    // ==========================================
    let result;
    if (id) {
      console.log(`[Diagnostic Sync Step 1] Updating tenant ID: ${id}...`);
      const { data, error } = await supabase
        .from('tenants')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[Diagnostic Error Step 1] Failed to update public.tenants:', error);
        return res.status(500).json({
          success: false,
          error: `Erro ao atualizar empresa em public.tenants: ${error.message}`,
          details: error
        });
      }
      result = data;
    } else {
      console.log(`[Diagnostic Sync Step 1] Inserting new tenant: "${name}"...`);
      const { data, error } = await supabase
        .from('tenants')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('[Diagnostic Error Step 1] Failed to insert into public.tenants:', error);
        return res.status(500).json({
          success: false,
          error: `Erro ao criar empresa em public.tenants: ${error.message}`,
          details: error
        });
      }
      result = data;
    }

    console.log(`✅ [Diagnostic Sync Step 1 Success] Tenant saved with ID: ${result.id}`);

    // ==========================================
    // STEP 2 & 3: Create Owner in Supabase Auth & public.users
    // ==========================================
    if (owner_email && result?.id) {
      let authUserId = null;

      console.log(`[Diagnostic Sync Step 2] Creating owner in auth.users (${owner_email})...`);
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: owner_email,
        password: provisionalPassword,
        email_confirm: true,
        user_metadata: {
          full_name: owner_name || `Dono (${name})`,
          role: 'tenant_admin',
          tenant_id: result.id
        }
      });

      if (authErr) {
        if (authErr.message?.includes('already been registered') || authErr.status === 422) {
          console.log(`[Diagnostic Sync Step 2 Notice] User ${owner_email} already exists in auth.users. Fetching ID...`);
          const { data: listData } = await supabase.auth.admin.listUsers();
          const existing = listData?.users?.find(u => u.email?.toLowerCase() === owner_email.toLowerCase());
          if (existing) {
            authUserId = existing.id;
            console.log(`[Diagnostic Sync Step 2 Notice] Updating existing auth user ID: ${authUserId}...`);
            await supabase.auth.admin.updateUserById(authUserId, {
              password: provisionalPassword,
              email_confirm: true,
              user_metadata: { full_name: owner_name || `Dono (${name})`, role: 'tenant_admin', tenant_id: result.id }
            });
          }
        } else {
          console.error('[Diagnostic Error Step 2] Failed to create user in auth.users:', authErr);
          return res.status(500).json({
            success: false,
            error: `Erro ao criar usuário na aba Authentication do Supabase: ${authErr.message}`,
            details: authErr
          });
        }
      } else if (authData?.user) {
        authUserId = authData.user.id;
      }

      console.log(`✅ [Diagnostic Sync Step 2 Success] Auth User ID: ${authUserId}`);

      if (authUserId) {
        console.log(`[Diagnostic Sync Step 3] Upserting user in public.users...`);
        const { error: userErr } = await supabase
          .from('users')
          .upsert({
            id: authUserId,
            tenant_id: result.id,
            full_name: owner_name || `Dono (${name})`,
            email: owner_email,
            role: 'tenant_admin',
            is_active: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        if (userErr) {
          console.error('[Diagnostic Error Step 3] Failed to upsert public.users:', userErr);
          return res.status(500).json({
            success: false,
            error: `Erro ao salvar usuário na tabela publica (public.users): ${userErr.message}`,
            details: userErr
          });
        }

        console.log(`✅ [Diagnostic Sync Step 3 Success] User record synced in public.users!`);

        result.owner_email = owner_email;
        result.provisional_password = provisionalPassword;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Empresa e dono salvos e sincronizados com sucesso!',
      credentials: {
        email: owner_email || null,
        temporaryPassword: provisionalPassword
      },
      tenant: result,
      ...result
    });
  } catch (err) {
    console.error('[Diagnostic Unhandled Error] Exception in createOrUpdateTenant:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro interno de sincronização',
      details: err
    });
  }
}

export async function updateTenantStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active', 'suspended', 'trial'

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status é obrigatório'
      });
    }

    const { data, error } = await supabase
      .from('tenants')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[Diagnostic Error] Failed to update tenant status:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro ao atualizar status da empresa',
      details: err
    });
  }
}

export async function deleteTenant(req, res) {
  try {
    const { id } = req.params;

    // Prevent deletion of default system tenant
    if (id === '00000000-0000-0000-0000-000000000001') {
      return res.status(400).json({
        success: false,
        error: 'A empresa principal de demonstração não pode ser apagada.'
      });
    }

    await supabase.from('users').delete().eq('tenant_id', id);
    const { error } = await supabase.from('tenants').delete().eq('id', id);

    if (error) throw error;

    return res.json({
      success: true,
      message: 'Empresa parceira apagada para sempre com sucesso.'
    });
  } catch (err) {
    console.error('[Diagnostic Error] Failed to delete tenant:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro ao apagar empresa parceira',
      details: err
    });
  }
}
