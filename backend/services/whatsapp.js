import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { supabase } from '../config/supabase.js';

/**
 * Multi-Tenant Session Registry: Maps tenantId -> { sock, status, lastQrData, qrCodeImage }
 */
const tenantSessions = new Map();

/**
 * Formats phone number to WhatsApp JID format
 */
export function formatToJid(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.includes('@s.whatsapp.net') ? cleaned : `${cleaned}@s.whatsapp.net`;
}

/**
 * Clears session credentials from Supabase DB and disk for a specific tenant
 */
export async function clearAuthInfoFolder(tenantId = '00000000-0000-0000-0000-000000000001') {
  try {
    console.log(`[WhatsApp Multi-Session] Clearing auth session for tenant ${tenantId}...`);
    await supabase.from('whatsapp_sessions').delete().eq('tenant_id', tenantId).catch(() => {});

    const authFolder = `baileys_auth_info_${tenantId}`;
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('Error clearing auth folder:', err);
  }
}

/**
 * Backs up local auth folder files to Supabase DB asynchronously
 */
async function syncAuthFolderToSupabase(tenantId) {
  const authFolder = `baileys_auth_info_${tenantId}`;
  if (!fs.existsSync(authFolder)) return;

  try {
    const files = fs.readdirSync(authFolder);
    for (const fileName of files) {
      const filePath = path.join(authFolder, fileName);
      if (fs.lstatSync(filePath).isFile()) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        await supabase
          .from('whatsapp_sessions')
          .upsert({
            tenant_id: tenantId,
            data_key: fileName,
            data_val: fileContent,
            updated_at: new Date().toISOString()
          }, { onConflict: 'tenant_id,data_key' })
          .catch(() => {});
      }
    }
  } catch (err) {
    console.error(`Error backing up auth folder for tenant ${tenantId} to Supabase:`, err.message);
  }
}

/**
 * Restores auth folder files from Supabase DB to local disk if missing
 */
async function restoreAuthFolderFromSupabase(tenantId) {
  const authFolder = `baileys_auth_info_${tenantId}`;
  try {
    const { data: dbFiles, error } = await supabase
      .from('whatsapp_sessions')
      .select('data_key, data_val')
      .eq('tenant_id', tenantId);

    if (error || !dbFiles || dbFiles.length === 0) return false;

    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }

    for (const item of dbFiles) {
      if (item.data_key && item.data_val) {
        const filePath = path.join(authFolder, item.data_key);
        fs.writeFileSync(filePath, item.data_val, 'utf8');
      }
    }

    return true;
  } catch (err) {
    console.error(`Error restoring auth folder for tenant ${tenantId} from Supabase:`, err.message);
    return false;
  }
}

/**
 * Ensures a valid tenant exists in public.tenants table
 */
async function getOrEnsureValidTenant(requestedTenantId) {
  const targetId = requestedTenantId || '00000000-0000-0000-0000-000000000001';
  try {
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', targetId)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: anyTenant } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (anyTenant) return anyTenant.id;

    const { data: newTenant } = await supabase
      .from('tenants')
      .upsert({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Empresa Principal (Demo)',
        status: 'active',
        max_users: 5
      }, { onConflict: 'id' })
      .select()
      .single();

    return newTenant?.id || targetId;
  } catch (err) {
    return targetId;
  }
}

/**
 * Retrieves session data for a specific tenant
 */
export function getTenantSession(tenantId = '00000000-0000-0000-0000-000000000001') {
  if (!tenantSessions.has(tenantId)) {
    tenantSessions.set(tenantId, {
      sock: null,
      status: 'disconnected',
      lastQrData: null,
      qrCodeImage: null
    });
  }
  return tenantSessions.get(tenantId);
}

/**
 * Automatically restores all active WhatsApp sessions from Supabase DB or disk on server startup
 */
export async function autoRestoreActiveWhatsAppSessions() {
  try {
    const tenantIdsToRestore = new Set();

    // 1. Fetch saved session tenant IDs from Supabase DB
    const { data: dbSessions } = await supabase
      .from('whatsapp_sessions')
      .select('tenant_id');

    if (dbSessions && dbSessions.length > 0) {
      dbSessions.forEach(s => tenantIdsToRestore.add(s.tenant_id));
    }

    // 2. Check local disk fallback
    if (fs.existsSync('.')) {
      const files = fs.readdirSync('.');
      const sessionFolders = files.filter(f => f.startsWith('baileys_auth_info_'));
      sessionFolders.forEach(folder => {
        const tid = folder.replace('baileys_auth_info_', '');
        if (tid) tenantIdsToRestore.add(tid);
      });
    }

    console.log(`🤖 [WhatsApp Multi-Session] Restoring ${tenantIdsToRestore.size} WhatsApp sessions...`);

    for (const tenantId of tenantIdsToRestore) {
      initWhatsAppEngine(tenantId).catch(err => {
        console.error(`Error restoring WhatsApp session for tenant ${tenantId}:`, err);
      });
    }
  } catch (err) {
    console.error('Error auto restoring WhatsApp sessions:', err);
  }
}

/**
 * Initializes an isolated Baileys WhatsApp Engine session per tenant with fast zero-latency auth & Supabase backup
 */
export async function initWhatsAppEngine(tenantId = '00000000-0000-0000-0000-000000000001') {
  const session = getTenantSession(tenantId);

  // If already connected or has QR code ready, reuse socket
  if (session.sock && (session.sock.user || session.qrCodeImage)) {
    return session.sock;
  }

  const activeTenantId = await getOrEnsureValidTenant(tenantId);
  const authFolder = `baileys_auth_info_${activeTenantId}`;

  // Restore folder from Supabase DB if missing from local disk
  if (!fs.existsSync(authFolder)) {
    await restoreAuthFolderFromSupabase(activeTenantId);
  }

  // Zero-latency local disk auth state for instant pairing
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  // Robust version fetch with 3s timeout & fallback
  let version;
  try {
    const vData = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Version fetch timeout')), 3000))
    ]);
    version = vData.version;
  } catch (e) {
    version = [2, 3000, 1015901307];
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['KOS SaaS', 'Chrome', '1.0.0']
  });

  session.sock = sock;
  session.status = 'connecting';

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    // Sync updated creds to Supabase Cloud DB in background
    syncAuthFolderToSupabase(activeTenantId);
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      session.lastQrData = qr;
      session.status = 'qr_ready';

      try {
        const qrcodeModule = await import('qrcode');
        session.qrCodeImage = await qrcodeModule.default.toDataURL(qr);
        console.log(`✅ [WhatsApp Multi-Session] Generated QR Code DataURL for Tenant ${activeTenantId}`);
      } catch (err) {
        console.error('Error generating QR DataURL:', err);
        session.qrCodeImage = null;
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
      console.log(`[WhatsApp Multi-Session] Tenant ${activeTenantId} connection closed (Status: ${statusCode}). Auto-renewing QR code: ${!isLoggedOut}`);

      session.sock = null;
      session.qrCodeImage = null;
      session.lastQrData = null;
      session.status = 'disconnected';

      if (isLoggedOut) {
        await clearAuthInfoFolder(activeTenantId);
      } else {
        // Automatically reconnect after 1s to fetch a fresh QR code or restore session
        setTimeout(() => {
          initWhatsAppEngine(activeTenantId).catch(() => {});
        }, 1000);
      }
    } else if (connection === 'open') {
      session.status = 'connected';
      session.lastQrData = null;
      session.qrCodeImage = null;
      console.log(`✅ [WhatsApp Multi-Session] Engine connected for Tenant ${activeTenantId} (${sock.user?.name || sock.user?.id})!`);
      // Sync complete active session keys to Supabase DB
      syncAuthFolderToSupabase(activeTenantId);
    }
  });

  // Handle incoming & outgoing messages per tenant session
  sock.ev.on('messages.upsert', async ({ messages: newMessages, type }) => {
    if (type !== 'notify') return;

    for (const msg of newMessages) {
      const remoteJid = msg.key.remoteJid;

      if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.includes('@g.us') || remoteJid.endsWith('@status.whatsapp.net')) {
        continue;
      }

      const isFromMe = msg.key.fromMe;
      const senderPhone = remoteJid.replace('@s.whatsapp.net', '');
      const content =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '[Media/Outra Mensagem]';

      const contactName = msg.pushName || senderPhone;

      try {
        const { processWhatsAppConsentKeywords } = await import('./whatsappOptOutService.js');
        await processWhatsAppConsentKeywords(activeTenantId, senderPhone, content);

        await supabase
          .from('chats')
          .upsert({
            id: remoteJid,
            tenant_id: activeTenantId,
            contact_name: contactName,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        await supabase
          .from('contacts')
          .upsert({
            tenant_id: activeTenantId,
            name: contactName,
            phone: senderPhone
          }, { onConflict: 'tenant_id,phone' });

        await supabase
          .from('messages')
          .insert({
            chat_id: remoteJid,
            sender_phone: isFromMe ? 'System/Agent' : senderPhone,
            content: content,
            timestamp: new Date(msg.messageTimestamp * 1000).toISOString()
          });

      } catch (err) {
        console.error(`[WhatsApp Engine Tenant ${activeTenantId}] Error processing inbound message:`, err);
      }
    }
  });

  return sock;
}

/**
 * Outbound WhatsApp message dispatcher for a specific tenant
 */
export async function sendWhatsAppMessage(recipientPhone, content, tenantId = '00000000-0000-0000-0000-000000000001') {
  const session = getTenantSession(tenantId);
  if (!session.sock?.user) {
    throw new Error(`Sessão do WhatsApp não conectada para a empresa (Tenant: ${tenantId}).`);
  }

  const jid = formatToJid(recipientPhone);
  const result = await session.sock.sendMessage(jid, { text: content });
  return result;
}

/**
 * Gets session status and QR code image for a specific tenant
 */
export function getWhatsAppSessionStatus(tenantId = '00000000-0000-0000-0000-000000000001') {
  const session = getTenantSession(tenantId);
  const isConnected = !!session.sock?.user;

  return {
    connected: isConnected,
    user: session.sock?.user || null,
    status: isConnected ? 'connected' : session.status,
    qrCode: isConnected ? null : session.qrCodeImage
  };
}

/**
 * Logs out and disconnects WhatsApp session for a specific tenant
 */
export async function logoutWhatsAppEngine(tenantId = '00000000-0000-0000-0000-000000000001') {
  try {
    const session = getTenantSession(tenantId);
    if (session.sock) {
      console.log(`[WhatsApp Multi-Session] Logging out session for tenant ${tenantId}...`);
      await session.sock.logout().catch(() => {});
      session.sock.end(new Error('Manual Tenant Disconnect'));
      session.sock = null;
    }
    session.status = 'disconnected';
    session.lastQrData = null;
    session.qrCodeImage = null;

    await clearAuthInfoFolder(tenantId);
    return { success: true };
  } catch (err) {
    console.error(`Error logging out WhatsApp for tenant ${tenantId}:`, err);
    return { success: false, error: err.message };
  }
}
