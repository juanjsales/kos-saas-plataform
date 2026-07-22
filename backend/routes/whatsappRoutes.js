import { Router } from 'express';
import { getWhatsAppSessionStatus, logoutWhatsAppEngine, initWhatsAppEngine } from '../services/whatsapp.js';
import fs from 'fs';

const router = Router();

router.get('/status', async (req, res) => {
  const tenantId = req.query.tenant_id || req.headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
  const shouldInit = req.query.init === 'true';

  let statusData = getWhatsAppSessionStatus(tenantId);

  const authFolder = `baileys_auth_info_${tenantId}`;
  const hasSavedSession = fs.existsSync(authFolder);

  // Trigger engine init if requested or saved session exists
  if (!statusData.connected && (statusData.status === 'disconnected' || !statusData.sock) && (shouldInit || hasSavedSession)) {
    try {
      await initWhatsAppEngine(tenantId);

      // Give Baileys up to 2.5 seconds to fetch QR code image from WhatsApp servers
      if (shouldInit && !statusData.connected && !statusData.qrCode) {
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 250));
          statusData = getWhatsAppSessionStatus(tenantId);
          if (statusData.qrCode || statusData.connected) break;
        }
      }
    } catch (err) {
      console.error(`Error initializing WhatsApp for tenant ${tenantId}:`, err);
    }
  }

  // Refresh status data before returning
  statusData = getWhatsAppSessionStatus(tenantId);
  return res.json(statusData);
});

router.post('/disconnect', async (req, res) => {
  const tenantId = req.body?.tenant_id || req.query.tenant_id || req.headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
  const result = await logoutWhatsAppEngine(tenantId);

  return res.json(result);
});

export default router;
