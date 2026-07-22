import { supabase } from '../config/supabase.js';

export async function getTeamMembers(req, res) {
  try {
    const tenantId = req.query.tenant_id || '00000000-0000-0000-0000-000000000001';

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json(users);
  } catch (err) {
    console.error('Error fetching team members:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function createTeamMember(req, res) {
  try {
    const { tenant_id, full_name, email, role, password } = req.body;
    const tenantId = tenant_id || '00000000-0000-0000-0000-000000000001';
    const provisionalPassword = password || 'Kos123456!';

    if (!full_name || !email) {
      return res.status(400).json({ error: 'Nome e E-mail são obrigatórios.' });
    }

    // 1. Fetch Tenant plan max_users limit
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('max_users, name')
      .eq('id', tenantId)
      .single();

    if (tErr) throw tErr;

    // 2. Count current active users for this tenant
    const { count, error: countErr } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (countErr) throw countErr;

    const maxUsers = tenant?.max_users || 5;
    if (count >= maxUsers) {
      return res.status(400).json({
        error: `Limite do plano atingido: Sua empresa possui permissão para no máximo ${maxUsers} usuários (${count}/${maxUsers} cadastrados). Faça um upgrade de plano para adicionar mais atendentes.`
      });
    }

    // 3. Create or update user in Supabase Auth (auth.users)
    let authUserId = null;
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: provisionalPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: role || 'tenant_operator',
        tenant_id: tenantId
      }
    });

    if (authErr) {
      // If user already exists in auth.users, fetch the existing auth user ID
      if (authErr.message?.includes('already been registered') || authErr.status === 422) {
        console.log(`[Auth Sync] User ${email} already exists in auth.users. Fetching existing auth ID...`);
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existingAuthUser = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (existingAuthUser) {
          authUserId = existingAuthUser.id;
          // Update password and metadata for existing auth user
          await supabase.auth.admin.updateUserById(authUserId, {
            password: provisionalPassword,
            email_confirm: true,
            user_metadata: {
              full_name,
              role: role || 'tenant_operator',
              tenant_id: tenantId
            }
          });
        }
      } else {
        console.error('Error creating user in auth.users:', authErr);
        return res.status(400).json({ error: `Erro ao criar usuário de autenticação: ${authErr.message}` });
      }
    } else if (authData?.user) {
      authUserId = authData.user.id;
    }

    if (!authUserId) {
      return res.status(500).json({ error: 'Não foi possível obter o ID de autenticação do usuário.' });
    }

    // 4. Upsert user record into public.users table using the exact authUserId (PK)
    const insertPayload = {
      id: authUserId,
      tenant_id: tenantId,
      full_name,
      email,
      role: role || 'tenant_operator',
      is_active: true,
      updated_at: new Date().toISOString()
    };

    const { data: newUser, error: createErr } = await supabase
      .from('users')
      .upsert(insertPayload, { onConflict: 'id' })
      .select()
      .single();

    if (createErr) throw createErr;

    console.log(`✅ [Auth Sync] User ${email} (ID: ${authUserId}) synchronized successfully between auth.users and public.users!`);

    return res.status(201).json({
      ...newUser,
      provisional_password: provisionalPassword,
      message: `Usuário cadastrado e sincronizado com sucesso no Supabase Auth! Senha provisória: ${provisionalPassword}`
    });
  } catch (err) {
    console.error('Error creating team member:', err);
    return res.status(500).json({ error: err.message });
  }
}
