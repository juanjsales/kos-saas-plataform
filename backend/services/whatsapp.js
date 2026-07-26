import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  downloadMediaMessage
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
 * Robust WhatsApp Message Unpacker for all Baileys message types
 */
export function extractWhatsAppMessageContent(msg) {
  if (!msg) return '[Mensagem no WhatsApp]';

  if (typeof msg === 'string') return msg.trim() || '[Mensagem no WhatsApp]';

  let m = msg.message || msg;

  // Unpack all nested wrapper objects recursively up to 5 levels
  let depth = 0;
  while (m && depth < 5) {
    if (m.ephemeralMessage?.message) { m = m.ephemeralMessage.message; depth++; continue; }
    if (m.viewOnceMessage?.message) { m = m.viewOnceMessage.message; depth++; continue; }
    if (m.viewOnceMessageV2?.message) { m = m.viewOnceMessageV2.message; depth++; continue; }
    if (m.viewOnceMessageV2Extension?.message) { m = m.viewOnceMessageV2Extension.message; depth++; continue; }
    if (m.documentWithCaptionMessage?.message) { m = m.documentWithCaptionMessage.message; depth++; continue; }
    if (m.editedMessage?.message) { m = m.editedMessage.message; depth++; continue; }
    if (m.deviceSentMessage?.message) { m = m.deviceSentMessage.message; depth++; continue; }
    break;
  }

  if (!m) return '[Mensagem no WhatsApp]';

  // 1. Direct text message
  if (typeof m.conversation === 'string' && m.conversation.trim()) {
    return m.conversation.trim();
  }

  // 2. Extended text message (replies, formatting, quotes)
  if (typeof m.extendedTextMessage?.text === 'string' && m.extendedTextMessage.text.trim()) {
    return m.extendedTextMessage.text.trim();
  }

  // 3. Image with caption or image tag
  if (m.imageMessage) {
    return m.imageMessage.caption ? `📷 ${m.imageMessage.caption}` : '📷 [Imagem]';
  }

  // 4. Video with caption or video tag
  if (m.videoMessage) {
    return m.videoMessage.caption ? `🎥 ${m.videoMessage.caption}` : '🎥 [Vídeo]';
  }

  // 5. Audio / Voice note
  if (m.audioMessage) {
    const isPtt = m.audioMessage.ptt ? 'Áudio de Voz' : 'Áudio';
    return `🎵 [${isPtt}]`;
  }

  // 6. Document / File attachment
  if (m.documentMessage) {
    const fileName = m.documentMessage.fileName || 'Arquivo';
    return m.documentMessage.caption ? `📄 ${m.documentMessage.caption} (${fileName})` : `📄 [Documento: ${fileName}]`;
  }

  // 7. Sticker
  if (m.stickerMessage) return '🎨 [Figurinha]';

  // 8. Contact card
  if (m.contactMessage) {
    const vcardName = m.contactMessage.displayName || 'Contato';
    return `👤 [Contato: ${vcardName}]`;
  }

  // 9. Location
  if (m.locationMessage || m.liveLocationMessage) {
    const loc = m.locationMessage || m.liveLocationMessage;
    const locName = loc.name || loc.address || 'Localização enviada';
    return `📍 [${locName}]`;
  }

  // 10. Buttons Response
  if (m.buttonsResponseMessage) {
    return m.buttonsResponseMessage.selectedDisplayText || m.buttonsResponseMessage.selectedButtonId || '🔘 [Botão clicado]';
  }

  // 11. List Response
  if (m.listResponseMessage) {
    return m.listResponseMessage.title || m.listResponseMessage.singleSelectReply?.selectedRowId || '📋 [Opção selecionada]';
  }

  // 12. Template Button Reply
  if (m.templateButtonReplyMessage) {
    return m.templateButtonReplyMessage.selectedDisplayText || m.templateButtonReplyMessage.selectedId || '🔘 [Resposta de Botão]';
  }

  // 13. Interactive Response (Flows / Native Flow)
  if (m.interactiveResponseMessage) {
    try {
      const params = JSON.parse(m.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson || '{}');
      return m.interactiveResponseMessage.body?.text || params.id || '🔘 [Resposta Interativa]';
    } catch (e) {
      return '🔘 [Resposta Interativa]';
    }
  }

  // 14. Emoji Reaction
  if (m.reactionMessage) {
    return `Reagiu ${m.reactionMessage.text || '👍'}`;
  }

  // Deep recursive key inspection for nested text/caption
  for (const k of Object.keys(m)) {
    if (!m[k] || typeof m[k] !== 'object') continue;
    if (typeof m[k].text === 'string' && m[k].text.trim()) return m[k].text.trim();
    if (typeof m[k].caption === 'string' && m[k].caption.trim()) return m[k].caption.trim();
    if (typeof m[k].conversation === 'string' && m[k].conversation.trim()) return m[k].conversation.trim();
  }

  return '[Mensagem no WhatsApp]';
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
    syncDebounceTimers.delete(tenantId);
    try {
      const authFolder = `baileys_auth_info_${tenantId}`;
      if (!fs.existsSync(authFolder)) return;

      const files = fs.readdirSync(authFolder);
      if (files.length === 0) return;

      const rowsToUpsert = [];
      for (const file of files) {
        const filePath = path.join(authFolder, file);
        if (fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, 'utf-8');
          rowsToUpsert.push({
            tenant_id: tenantId,
            file_name: file,
            file_data: content,
            updated_at: new Date().toISOString()
          });
        }
      }

      if (rowsToUpsert.length > 0) {
        await supabase
          .from('whatsapp_sessions')
          .upsert(rowsToUpsert, { onConflict: 'tenant_id,file_name' });
      }
    } catch (err) {
      console.error(`[WhatsApp Multi-Session] Error auto-backing up session to Supabase for tenant ${tenantId}:`, err);
    }
  }, 1000);

  syncDebounceTimers.set(tenantId, timer);
}

/**
 * Restore auth state folder from Supabase DB to local disk if missing
 */
async function restoreAuthFolderFromSupabase(tenantId) {
  const authFolder = `baileys_auth_info_${tenantId}`;
  try {
    const { data: rows, error } = await supabase
      .from('whatsapp_sessions')
      .select('file_name, file_data')
      .eq('tenant_id', tenantId);

    if (error || !rows || rows.length === 0) {
      return false;
    }

    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }

    for (const row of rows) {
      const filePath = path.join(authFolder, row.file_name);
      fs.writeFileSync(filePath, row.file_data, 'utf-8');
    }

    console.log(`✅ [WhatsApp Multi-Session] Restored ${rows.length} session files from DB for Tenant ${tenantId}`);
    return true;
  } catch (err) {
    console.error(`[WhatsApp Multi-Session] Error restoring auth session for tenant ${tenantId}:`, err);
    return false;
  }
}

/**
 * Returns default tenant ID or validates input tenant ID
 */
export async function getOrEnsureValidTenant(reqTenantId) {
  if (reqTenantId && reqTenantId !== 'null' && reqTenantId !== 'undefined' && reqTenantId.trim() !== '') {
    return reqTenantId.trim();
  }

  try {
    const { data } = await supabase.from('tenants').select('id').limit(1).single();
    if (data?.id) return data.id;
  } catch (e) {}

  return '00000000-0000-0000-0000-000000000001';
}

/**
 * Returns session object for a given tenantId
 */
export function getWhatsAppSession(tenantId) {
  return tenantSessions.get(tenantId) || null;
}

/**
 * Sends a typing/recording presence update to WhatsApp contact
 */
export async function sendTypingPresence(tenantId, remoteJid, presenceState = 'composing') {
  const session = tenantSessions.get(tenantId);
  if (!session?.sock) return false;
  try {
    const jid = formatToJid(remoteJid);
    await session.sock.sendPresenceUpdate(presenceState, jid);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Marks messages as read (Blue Double Check) for a contact
 */
export async function markMessageAsRead(tenantId, remoteJid, messageKeys = []) {
  const session = tenantSessions.get(tenantId);
  if (!session?.sock) return false;
  try {
    if (Array.isArray(messageKeys) && messageKeys.length > 0) {
      await session.sock.readMessages(messageKeys);
    } else {
      await session.sock.readMessages([{ remoteJid: formatToJid(remoteJid), id: '', fromMe: false }]);
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Initializes or returns existing WhatsApp socket engine for a tenant
 */
export async function initWhatsAppEngine(tenantId = '00000000-0000-0000-0000-000000000001', forceReinit = false) {
  const activeTenantId = await getOrEnsureValidTenant(tenantId);

  if (tenantSessions.has(activeTenantId)) {
    const existing = tenantSessions.get(activeTenantId);
    if (!forceReinit && existing.status === 'connected' && existing.sock) {
      return existing;
    }
    if (existing.isInitializing && existing.initPromise) {
      return existing.initPromise;
    }
  }

  const session = {
    sock: null,
    status: 'connecting',
    lastQrData: null,
    qrCodeImage: null,
    isInitializing: true,
    initPromise: null
  };

  tenantSessions.set(activeTenantId, session);

  const initTask = (async () => {
    try {
      const authFolder = `baileys_auth_info_${activeTenantId}`;

      // Restore folder from Supabase DB if missing from local disk
      if (!fs.existsSync(authFolder)) {
        await restoreAuthFolderFromSupabase(activeTenantId);
      }

      const { state, saveCreds } = await useMultiFileAuthState(authFolder);

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
        keepAliveIntervalMs: 15000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: undefined,
        retryRequestDelayMs: 500,
        maxMsgRetryCount: 5,
        getMessage: async (key) => {
          return { conversation: 'Mensagem do WhatsApp' };
        }
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
            console.log(`[WhatsApp Multi-Session] Notice: Session for tenant ${activeTenantId} marked disconnected.`);
            if (fs.existsSync(`baileys_auth_info_${activeTenantId}`)) {
              try { fs.rmSync(`baileys_auth_info_${activeTenantId}`, { recursive: true, force: true }); } catch (e) {}
            }
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

          // Heartbeat KeepAlive: Keep session active
          try {
            await sock.sendPresenceUpdate('available');
          } catch (e) {}
        }
      });

      // Handle synced chats list from Baileys
      sock.ev.on('chats.upsert', async (chatsList) => {
        for (const c of chatsList) {
          if (!c.id || c.id.includes('@lid') || c.id.includes('status@broadcast') || c.id.includes('@g.us')) continue;
          try {
            await supabase.from('chats').upsert({
              id: c.id,
              tenant_id: activeTenantId,
              contact_name: c.name || c.id.replace('@s.whatsapp.net', ''),
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          } catch (e) {}
        }
      });

      // Handle incoming & outgoing messages per tenant session
      sock.ev.on('messages.upsert', async ({ messages: newMessages, type }) => {
        for (const msg of newMessages) {
          const remoteJid = msg.key.remoteJid;

          if (
            !remoteJid ||
            remoteJid.includes('@lid') ||
            remoteJid === 'status@broadcast' ||
            remoteJid.includes('@g.us') ||
            remoteJid.endsWith('@status.whatsapp.net') ||
            remoteJid.endsWith('@newsletter')
          ) {
            continue;
          }

          const isFromMe = msg.key.fromMe;
          const senderPhone = remoteJid.replace('@s.whatsapp.net', '');
          const content = extractWhatsAppMessageContent(msg) || '[Mensagem no WhatsApp]';

          const contactName = msg.pushName || senderPhone;
          const timestampMs = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now();
          const timestampIso = new Date(timestampMs).toISOString();

          try {
            const { processWhatsAppConsentKeywords } = await import('./whatsappOptOutService.js');
            await processWhatsAppConsentKeywords(activeTenantId, senderPhone, content);

            // 1. Save chat & message IMMEDIATELY into Supabase with ZERO latency
            await supabase
              .from('chats')
              .upsert({
                id: remoteJid,
                tenant_id: activeTenantId,
                contact_name: contactName,
                updated_at: timestampIso
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
                timestamp: timestampIso
              });

            // 2. Fetch profile picture asynchronously in background (Non-blocking)
            if (sock && typeof sock.profilePictureUrl === 'function') {
              sock.profilePictureUrl(remoteJid, 'image').then(async (url) => {
                if (url) {
                  await supabase.from('chats').update({ profile_picture_url: url }).eq('id', remoteJid);
                  await supabase.from('contacts').update({ profile_picture_url: url }).eq('tenant_id', activeTenantId).eq('phone', senderPhone);
                }
              }).catch(() => {});
            }

          } catch (err) {
            console.error(`[WhatsApp Engine Tenant ${activeTenantId}] Error processing inbound message:`, err);
          }
        }
      });

      return session;
    } finally {
      session.isInitializing = false;
    }
  })();

  session.initPromise = initTask;
  return initTask;
}

/**
 * Sends a text message over WhatsApp socket
 */
export async function sendWhatsAppMessage(tenantId, phone, messageText) {
  const activeTenantId = await getOrEnsureValidTenant(tenantId);
  const session = await initWhatsAppEngine(activeTenantId);

  if (!session?.sock || session.status !== 'connected') {
    throw new Error(`WhatsApp do tenant ${activeTenantId} não está conectado no momento. Por favor, leia o QR Code no painel.`);
  }

  const jid = formatToJid(phone);
  const result = await session.sock.sendMessage(jid, { text: messageText });
  return result;
}
