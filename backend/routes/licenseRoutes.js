import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { getHardwareId } from '../utils/hardwareId.js';
import { getSystemLicenseState, verifyLicenseTokenPayload } from '../utils/licenseKey.js';

const router = Router();

/**
 * GET /api/license/status
 * Returns current machine Hardware ID and active license state
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getSystemLicenseState();
    return res.json(status);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/license/activate
 * Receives license_key / signed_token and activates the license locally in SQLite
 */
router.post('/activate', async (req, res) => {
  try {
    const { license_key, signed_token, expires_in_days } = req.body;
    const currentHwId = getHardwareId();
    const tenantId = req.body.tenant_id || '00000000-0000-0000-0000-000000000001';

    let tokenToVerify = signed_token;
    let expiresAtDate;
    let graceDays = 7;

    if (signed_token) {
      const verification = verifyLicenseTokenPayload(signed_token);
      if (!verification.valid) {
        return res.status(400).json({ error: verification.message || 'Token de licença inválido.' });
      }
      expiresAtDate = new Date(verification.payload.expires_at);
      graceDays = verification.payload.grace_period_days || 7;
    } else {
      // Create local activation token — uses expires_in_days from request, or DEFAULT_LICENSE_DAYS from .env
      const defaultDays = parseInt(process.env.DEFAULT_LICENSE_DAYS || '365', 10);
      const days = parseInt(expires_in_days, 10) || defaultDays;
      expiresAtDate = new Date();
      expiresAtDate.setDate(expiresAtDate.getDate() + days);

      const secret = process.env.KOS_MASTER_LICENSE_SECRET || 'kos_master_license_secret_key_2026_verifying';
      tokenToVerify = jwt.sign(
        {
          tenant_id: tenantId,
          hardware_id: currentHwId,
          expires_at: expiresAtDate.toISOString(),
          grace_period_days: graceDays
        },
        secret
      );
    }

    const savedLicense = await prisma.systemLicense.upsert({
      where: { id: 'license_config' },
      update: {
        tenant_id: tenantId,
        license_key: license_key || `KOS-SERIAL-${Date.now()}`,
        signed_token: tokenToVerify,
        hardware_id: currentHwId,
        expires_at: expiresAtDate,
        grace_period_days: graceDays,
        last_online_check: new Date(),
        status: 'active'
      },
      create: {
        id: 'license_config',
        tenant_id: tenantId,
        license_key: license_key || `KOS-SERIAL-${Date.now()}`,
        signed_token: tokenToVerify,
        hardware_id: currentHwId,
        expires_at: expiresAtDate,
        grace_period_days: graceDays,
        last_online_check: new Date(),
        status: 'active'
      }
    });

    const updatedState = await getSystemLicenseState();

    return res.json({
      message: 'Licença ativada com sucesso!',
      license: savedLicense,
      statusState: updatedState
    });
  } catch (err) {
    console.error('Error activating license:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
