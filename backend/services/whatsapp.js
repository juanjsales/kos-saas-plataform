import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { supabase } from '../config/supabase.js';

/**
 * Multi-Tenant Session Registry: Maps tenantId -> { sock, status, lastQrData, qrCodeImage, isInitializing, initPromise }
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
    await supabase.from('whatsapp_sessions').delete().eq('tenant_id', tenantId);

    const authFolder = `baileys_auth_info_${tenantId}`;
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('Error clearing auth folder:', err);
  }
}

const syncDebounceTimers = new Map();

/**
 * Debounced background backup of auth files to Supabase in a single batch query
 */
function scheduleSyncAuthFolderToSupabase(tenantId) {
  if (syncDebounceTimers.has(tenantId)) {
    clearTimeout(syncDebounceTimers.get(tenantId));
  }

  const timer = setTimeout(async () => {
    const authFolder = `baileys_auth_info_${tenantId}`;
    if (!fs.existsSync(authFolder)) return;

    try {
      const files = fs.readdirSync(authFolder);
      const upserts = files
        .map(fileName => {
          const filePath = path.join(authFolder, fileName);
          if (fs.lstatSync(filePath).isFile()) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            return {
              tenant_id: tenantId,
              data_key: fileName,
              data_val: fileContent,
              updated_at: new Date().toISOString()
            };
          }
          return null;
        })
        .filter(Boolean);

      if (upserts.length > 0) {
        await supabase
          .from('whatsapp_sessions')
          .upsert(upserts, { onConflict: 'tenant_id,data_key' });
      }
    } catch (err) {
      console.error(`Error backing up auth folder for tenant ${tenantId} to Supabase:`, err.message);
    }
  }, 10000);

  syncDebounceTimers.set(tenantId, timer);
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
export async function getOrEnsureValidTenant(requestedTenantId) {
  try {
    if (requestedTenantId && requestedTenantId !== '00000000-0000-0000-0000-000000000001') {
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', requestedTenantId)
        .maybeSingle();

      if (existing) return existing.id;
    }

    // Return the first real active company from Supabase DB
    const { data: anyTenant } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (anyTenant?.id) return anyTenant.id;

    return requestedTenantId;
  } catch (err) {
    return requestedTenantId;
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
      qrCodeImage: null,
      isInitializing: false,
      initPromise: null
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
 * Initializes an isolated Baileys WhatsApp Engine session per tenant with single-flight locking & fast zero-latency auth
 */
export async function initWhatsAppEngine(tenantId = '00000000-0000-0000-0000-000000000001') {
  const session = getTenantSession(tenantId);

  // Single-flight lock: If socket is already connected or currently initializing, reuse instance/promise
  if (session.sock && (session.sock.user || session.qrCodeImage)) {
    return session.sock;
  }
  if (session.isInitializing && session.initPromise) {
    return session.initPromise;
  }

  session.isInitializing = true;
  session.initPromise = (async () => {
    try {
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
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 10000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: undefined,
        retryRequestDelayMs: 2000,
        getMessage: async () => ({ conversation: '' })
      });

      session.sock = sock;
      session.status = 'connecting';

      sock.ev.on('creds.update', async () => {
        await saveCreds();
        scheduleSyncAuthFolderToSupabase(activeTenantId);
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
          const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;

          console.log(`[WhatsApp Multi-Session] Tenant ${activeTenantId} connection closed (Status: ${statusCode}, RestartRequired: ${isRestartRequired}).`);

          session.sock = null;
          session.qrCodeImage = null;

          if (isLoggedOut) {
            session.status = 'disconnected';
            await clearAuthInfoFolder(activeTenantId);
          } else {
            session.status = 'connecting';
            setTimeout(() => {
              initWhatsAppEngine(activeTenantId).catch(() => {});
            }, isRestartRequired ? 500 : 2000);
          }
        } else if (connection === 'open') {
          session.status = 'connected';
          session.lastQrData = null;
          session.qrCodeImage = null;
          console.log(`✅ [WhatsApp Multi-Session] Engine connected for Tenant ${activeTenantId} (${sock.user?.name || sock.user?.id})!`);
          scheduleSyncAuthFolderToSupabase(activeTenantId);
        }
      });

      // Handle incoming & outgoing messages per tenant session
      sock.ev.on('messages.upsert', async ({ messages: newMessages, type }) => {
        if (type !== 'notify') return;

        for (const msg of newMessages) {
          const remoteJid = msg.key.remoteJid;

          const myJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : null;
          if (
            !remoteJid ||
            remoteJid.includes('@lid') ||
            remoteJid === 'status@broadcast' ||
            remoteJid.includes('@g.us') ||
            remoteJid.endsWith('@status.whatsapp.net') ||
            remoteJid.endsWith('@newsletter') ||
            (myJid && remoteJid.replace('@s.whatsapp.net', '') === myJid.replace('@s.whatsapp.net', ''))
          ) {
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

    } finally {
      session.isInitializing = false;
      session.initPromise = null;
    }
  })();

  return session.initPromise;
}

/**
 * Outbound WhatsApp message dispatcher with multi-tenant session fallback
 */
export async function sendWhatsAppMessage(recipientPhone, content, tenantId = '00000000-0000-0000-0000-000000000001') {
  let activeSock = null;
  const realTenantId = await getOrEnsureValidTenant(tenantId);

  // Helper to wait up to 5 seconds for a connecting socket to open
  const waitForSocket = async (targetId) => {
    const s = getTenantSession(targetId);
    if (s.sock?.user) return s.sock;
    if (s.status === 'connected' && s.sock) return s.sock;

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 250));
      if (s.sock?.user) return s.sock;
      if (s.status === 'connected' && s.sock) return s.sock;
    }
    return s.sock || null;
  };

  // 1. Check requested tenant session
  activeSock = await waitForSocket(realTenantId);

  // 2. Attempt fast auto-restore if missing from memory
  if (!activeSock?.user) {
    try {
      const sock = await initWhatsAppEngine(realTenantId);
      if (sock) {
        activeSock = await waitForSocket(realTenantId);
      }
    } catch (e) {}
  }

  if (!activeSock || !activeSock.user) {
    console.warn(`[WhatsApp Dispatcher] Notice: Cannot send message to ${recipientPhone}. No active WhatsApp session connected for tenant ${tenantId}.`);
    return { success: false, reason: 'whatsapp_not_connected' };
  }

  const jid = formatToJid(recipientPhone);
  const result = await activeSock.sendMessage(jid, { text: content });
  return { success: true, result };
}

/**
 * Gets session status and QR code image for a specific tenant
 */
export function getWhatsAppSessionStatus(tenantId = '00000000-0000-0000-0000-000000000001') {
  const session = getTenantSession(tenantId);
  const isConnected = session.status === 'connected' || !!session.sock?.user;

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
    const activeTenantId = await getOrEnsureValidTenant(tenantId);

    // Logout all active sessions in memory
    for (const [id, session] of tenantSessions.entries()) {
      if (session.sock) {
        console.log(`[WhatsApp Multi-Session] Logging out session for tenant ${id}...`);
        await session.sock.logout().catch(() => {});
        session.sock.ev.removeAllListeners('connection.update');
        session.sock.ev.removeAllListeners('messages.upsert');
        session.sock.ev.removeAllListeners('creds.update');
        try { session.sock.end(new Error('Manual Tenant Disconnect')); } catch(e) {}
        session.sock = null;
      }
      session.status = 'disconnected';
      session.lastQrData = null;
      session.qrCodeImage = null;
      await clearAuthInfoFolder(id);
    }

    await clearAuthInfoFolder(activeTenantId);
    await supabase.from('whatsapp_sessions').delete().neq('data_key', 'keep_table');
    tenantSessions.clear();

    return { success: true };
  } catch (err) {
    console.error(`Error logging out WhatsApp:`, err);
    return { success: false, error: err.message };
  }
}
