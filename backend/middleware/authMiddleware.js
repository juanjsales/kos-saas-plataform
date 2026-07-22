import { supabase } from '../config/supabase.js';

/**
 * Middleware: Check if tenant is active. If suspended, block request with 403 Forbidden.
 * Bypasses checks for administrative routes (/api/admin/*) and Super Admin requests.
 */
export async function checkTenantStatus(req, res, next) {
  try {
    // 1. Bypass tenant status check for administrative and health routes
    if (
      req.path.startsWith('/admin') ||
      req.originalUrl.includes('/admin/') ||
      req.user?.role === 'super_admin' ||
      req.headers['x-user-role'] === 'super_admin'
    ) {
      return next();
    }

    const tenantId = req.query.tenant_id || req.body.tenant_id || req.headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('id', tenantId)
      .single();

    // If tenant does not exist in DB yet (e.g. initial setup or test tenant), allow request to proceed gracefully
    if (error || !tenant) {
      return next();
    }

    if (tenant.status === 'suspended') {
      return res.status(403).json({
        error: `A conta da empresa "${tenant.name}" está suspensa. Entre em contato com o suporte para reativar seu acesso.`,
        code: 'TENANT_SUSPENDED'
      });
    }

    req.tenant = tenant;
    next();
  } catch (err) {
    console.error('Error in checkTenantStatus middleware:', err);
    next();
  }
}

/**
 * Middleware: Role-Based Access Control (RBAC)
 * @param {Array<string>} allowedRoles List of roles permitted (e.g. ['super_admin', 'tenant_admin'])
 */
export function checkRole(allowedRoles = []) {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'] || req.user?.role || 'tenant_operator';

    if (userRole === 'super_admin') {
      return next(); // Super admin bypass
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: `Acesso negado: Seu perfil (${userRole}) não possui permissão para realizar esta ação.`
      });
    }

    next();
  };
}
