import { getSystemLicenseState } from '../utils/licenseKey.js';

/**
 * License Middleware for KOS On-Premise
 * Enforces valid subscription license state while allowing auth, license, health and static assets.
 */
export async function licenseMiddleware(req, res, next) {
  const path = req.path;

  // Bypass open routes: auth, license activation/status, health, and static uploads
  if (
    path.startsWith('/api/license') ||
    path.startsWith('/api/auth') ||
    path.startsWith('/health') ||
    path.startsWith('/uploads')
  ) {
    return next();
  }

  try {
    const licenseState = await getSystemLicenseState();

    // Allow active or grace period licenses
    if (licenseState.status === 'active' || licenseState.status === 'grace_period') {
      req.licenseState = licenseState;
      return next();
    }

    // In development or local mode without an installed license, allow operation with dev bypass
    if ((!process.env.NODE_ENV || process.env.NODE_ENV === 'development') && !licenseState.has_license) {
      req.licenseState = { ...licenseState, dev_bypass: true };
      return next();
    }

    // Block request with 402 Payment Required
    return res.status(402).json({
      error: 'LICENSE_PAYMENT_REQUIRED',
      status: licenseState.status,
      hardware_id: licenseState.hardware_id,
      message: licenseState.message || 'Assinatura suspensa. Entre em contato com o suporte para regularizar a licença do KOS.'
    });
  } catch (err) {
    console.error('License middleware error:', err);
    return next();
  }
}

export default licenseMiddleware;
