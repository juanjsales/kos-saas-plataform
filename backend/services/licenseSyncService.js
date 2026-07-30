import { prisma } from '../config/db.js';
import { getHardwareId } from '../utils/hardwareId.js';

const LICENSING_SERVER_URL = process.env.LICENSING_SERVER_URL || 'http://localhost:5000';

/**
 * Synchronizes local machine license state with Central Turso Cloud Licensing Server
 */
export async function syncLicenseWithTursoServer() {
  try {
    const localLicense = await prisma.systemLicense.findFirst({
      where: { id: 'license_config' }
    });

    const currentHwId = getHardwareId();
    const tenantId = localLicense?.tenant_id || '00000000-0000-0000-0000-000000000001';
    const licenseKey = localLicense?.license_key || 'KOS-LAN3JR-ACTIVE-2026';

    console.log(`📡 [License Sync] Syncing local license (${licenseKey}) with Turso Licensing Server (${LICENSING_SERVER_URL})...`);

    const response = await fetch(`${LICENSING_SERVER_URL}/api/master/verify-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenantId,
        tenant_name: 'Lan 3JR',
        license_key: licenseKey,
        signed_token: localLicense?.signed_token || null,
        hardware_id: currentHwId
      })
    });

    if (!response.ok) {
      console.warn(`⚠️ [License Sync] Server returned status ${response.status}. Retaining local offline grace period.`);
      return null;
    }

    const result = await response.json();

    if (result.valid && result.status === 'active') {
      const updated = await prisma.systemLicense.upsert({
        where: { id: 'license_config' },
        update: {
          signed_token: result.signed_token || localLicense?.signed_token || '',
          expires_at: new Date(result.expires_at),
          grace_period_days: result.grace_period_days || 7,
          last_online_check: new Date(),
          status: 'active'
        },
        create: {
          id: 'license_config',
          tenant_id: tenantId,
          license_key: licenseKey,
          signed_token: result.signed_token || '',
          hardware_id: currentHwId,
          expires_at: new Date(result.expires_at),
          grace_period_days: result.grace_period_days || 7,
          last_online_check: new Date(),
          status: 'active'
        }
      });
      console.log(`✅ [License Sync] License synchronized and verified with Turso Cloud! Valid until ${result.expires_at}`);
      return updated;
    } else if (result.status === 'revoked' || result.status === 'expired') {
      if (localLicense) {
        await prisma.systemLicense.update({
          where: { id: 'license_config' },
          data: {
            status: result.status,
            last_online_check: new Date()
          }
        });
      }
      console.warn(`🚨 [License Sync] License status updated from Turso Cloud: ${result.status.toUpperCase()} (${result.message})`);
      return null;
    }

    return null;
  } catch (err) {
    console.warn(`⚠️ [License Sync] Could not connect to Turso Licensing Server: ${err.message}. Operating in offline grace period.`);
    return null;
  }
}

/**
 * Initializes automatic background synchronization worker
 */
export function initLicenseSyncWorker() {
  console.log('⏰ [License Sync] Initializing Turso Cloud License Sync Worker...');

  // Sync 5 seconds after startup
  setTimeout(() => {
    syncLicenseWithTursoServer();
  }, 5000);

  // Sync every 1 hour (3,600,000 ms)
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(() => {
    syncLicenseWithTursoServer();
  }, ONE_HOUR);
}
