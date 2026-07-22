import { Router } from 'express';
import { getWhatsAppSessionStatus, logoutWhatsAppEngine, initWhatsAppEngine } from '../services/whatsapp.js';
import fs from 'fs';

const router = Router();

router.get('/status', async (req, res) => {
  const tenantId = req.query.tenant_id || req.headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
  const shouldInit = req.query.init === 'true';

  let statusData = getWhatsAppSessionStatus(tenantId);

  // Trigger engine init if explicitly requested (e.g. user clicked "Conectar WhatsApp") or if saved session exists
  const authFolder = `baileys_auth_info_${tenantId}`;
  const hasSavedSession = fs.existsSync(authFolder);

  if (!statusData.connected && statusData.status === 'disconnected' && (shouldInit || hasSavedSession)) {
    initWhatsAppEngine(tenantId).catch(err => {
      console.error(`Error initializing WhatsApp for tenant ${tenantId}:`, err);
    });
  }

  return res.json(statusData);
});

router.post('/disconnect', async (req, res) => {
  const tenantId = req.body?.tenant_id || req.query.tenant_id || req.headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
  const result = await logoutWhatsAppEngine(tenantId);

  return res.json(result);
});

export default router;
