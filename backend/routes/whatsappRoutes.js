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

  // Trigger engine init if disconnected and explicitly requested or saved session exists
  if (!statusData.connected && statusData.status === 'disconnected' && (shouldInit || hasSavedSession)) {
    try {
      // Start or ensure WhatsApp engine is running
      initWhatsAppEngine(tenantId).catch(err => {
        console.error(`Error initializing WhatsApp for tenant ${tenantId}:`, err);
      });

      // Wait up to 5 seconds for cloud hosting (Render.com) to receive QR code from WhatsApp servers
      if (shouldInit && !statusData.connected && !statusData.qrCode) {
        for (let i = 0; i < 25; i++) {
          await new Promise(resolve => setTimeout(resolve, 200));
          statusData = getWhatsAppSessionStatus(tenantId);
          if (statusData.qrCode || statusData.connected) break;
        }
      }
    } catch (err) {
      console.error(`Error in status route for tenant ${tenantId}:`, err);
    }
  }

  statusData = getWhatsAppSessionStatus(tenantId);
  return res.json(statusData);
});

router.post('/disconnect', async (req, res) => {
  const tenantId = req.body?.tenant_id || req.query.tenant_id || req.headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
  const result = await logoutWhatsAppEngine(tenantId);

  return res.json(result);
});

export default router;
