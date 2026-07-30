/**
 * WhatsApp Session Alert & Monitoring Service
 * Notifies system admin/webhook when a WhatsApp session is revoked, logged out, or disconnected permanently.
 */

export async function sendWhatsAppSessionAlert({ tenantId, reason, statusCode, details }) {
  const timestamp = new Date().toISOString();
  const alertData = {
    event: 'WHATSAPP_SESSION_REVOKED',
    tenant_id: tenantId,
    reason: reason || 'SESSION_LOGGED_OUT',
    status_code: statusCode || 401,
    details: details || 'A conexão do WhatsApp foi revogada pelo aplicativo no celular do cliente.',
    timestamp
  };

  console.warn(`🚨 [WHATSAPP SESSION ALERT] Tenant ${tenantId}: ${alertData.details} (Code: ${statusCode})`);

  const webhookUrl = process.env.WHATSAPP_ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData)
      });
      console.log(`📡 [WHATSAPP SESSION ALERT] Webhook enviado para ${webhookUrl} (Status: ${response.status})`);
    } catch (err) {
      console.error(`❌ [WHATSAPP SESSION ALERT] Falha ao enviar Webhook de alerta: ${err.message}`);
    }
  }

  return alertData;
}
