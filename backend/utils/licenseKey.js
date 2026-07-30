import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { getHardwareId } from './hardwareId.js';

// Secret or Public key used to verify License Tokens emitted by Central Master Server
const MASTER_LICENSE_SECRET = process.env.KOS_MASTER_LICENSE_SECRET || 'kos_master_license_secret_key_2026_verifying';

/**
 * Validates a license token payload against current machine hardware ID and date.
 */
export function verifyLicenseTokenPayload(token) {
  try {
    const payload = jwt.verify(token, MASTER_LICENSE_SECRET);
    const currentHwId = getHardwareId();

    if (payload.hardware_id && payload.hardware_id !== currentHwId && payload.hardware_id !== '*') {
      return { valid: false, reason: 'INVALID_HARDWARE_ID', message: 'Licença vinculada a outro computador.' };
    }

    const expiresAt = new Date(payload.expires_at);
    if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
      return { valid: false, reason: 'EXPIRED', message: 'Licença expirada.' };
    }

    return {
      valid: true,
      payload: {
        tenant_id: payload.tenant_id || '00000000-0000-0000-0000-000000000001',
        hardware_id: payload.hardware_id || currentHwId,
        expires_at: expiresAt.toISOString(),
        grace_period_days: payload.grace_period_days || 7
      }
    };
  } catch (err) {
    return { valid: false, reason: 'INVALID_SIGNATURE', message: 'Assinatura do token de licença inválida.' };
  }
}

/**
 * Retrieves current license state from SQLite database.
 */
export async function getSystemLicenseState() {
  const currentHwId = getHardwareId();
  try {
    const license = await prisma.systemLicense.findFirst({
      where: { id: 'license_config' }
    });

    if (!license) {
      return {
        has_license: false,
        status: 'unlicensed',
        hardware_id: currentHwId,
        days_remaining: 0,
        message: 'Nenhuma licença ativa. Ative seu serial para utilizar o KOS.'
      };
    }

    const now = new Date();
    const expiresAt = new Date(license.expires_at);
    const diffMs = expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Check hardware ID match
    if (license.hardware_id !== currentHwId && license.hardware_id !== '*') {
      return {
        has_license: true,
        status: 'invalid_hardware',
        hardware_id: currentHwId,
        license_hardware_id: license.hardware_id,
        days_remaining: 0,
        message: 'A licença instalada pertence a outro computador.'
      };
    }

    // Check expiration and offline grace period
    if (now > expiresAt) {
      const graceDays = license.grace_period_days || 7;
      const lastCheck = new Date(license.last_online_check);
      const daysSinceCheck = Math.floor((now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceCheck <= graceDays) {
        return {
          has_license: true,
          status: 'grace_period',
          hardware_id: currentHwId,
          days_remaining: 0,
          grace_days_remaining: graceDays - daysSinceCheck,
          expires_at: license.expires_at,
          message: `Licença em período de tolerância offline (${graceDays - daysSinceCheck} dias restantes).`
        };
      }

      return {
        has_license: true,
        status: 'expired',
        hardware_id: currentHwId,
        days_remaining: 0,
        expires_at: license.expires_at,
        message: 'Sua assinatura expirou. Regularize seu plano para continuar atendendo.'
      };
    }

    return {
      has_license: true,
      status: 'active',
      hardware_id: currentHwId,
      days_remaining: Math.max(0, daysRemaining),
      expires_at: license.expires_at,
      license_key: license.license_key,
      message: 'Licença ativa e regular.'
    };
  } catch (err) {
    console.error('Error fetching system license state:', err);
    return {
      has_license: false,
      status: 'error',
      hardware_id: currentHwId,
      days_remaining: 0,
      message: 'Erro ao verificar licença local.'
    };
  }
}
