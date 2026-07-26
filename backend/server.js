import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import servicesRouter from './routes/services.js';
import cardsRouter from './routes/cards.js';
import chatsRouter from './routes/chats.js';
import notificationsRouter from './routes/notifications.js';
import messagesRouter from './routes/messages.js';
import whatsappRouter from './routes/whatsappRoutes.js';
import authRouter from './routes/authRoutes.js';
import { pathConfig } from './config/pathConfig.js';
import { initWhatsAppEngine } from './services/whatsapp.js';
import { initCardStatusWatcher } from './jobs/cardStatusWatcher.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

// Enable Trust Proxy & Permissive CORS for Local Network (LAN) Dynamic IPs
app.set('trust proxy', 1);
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Serve uploads static directory from AppData / local data directory
app.use('/uploads', express.static(pathConfig.uploadsPath));

// Auth & Core Routes
app.use('/api/auth', authRouter);
app.use('/api/services', servicesRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/whatsapp', whatsappRouter);

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'on-premise-lan',
    timestamp: new Date().toISOString(),
    dbPath: pathConfig.dbPath
  });
});

app.listen(PORT, HOST, async () => {
  console.log(`🚀 KOS On-Premise Backend rodando em http://localhost:${PORT}`);
  console.log(`🌐 Acesso na Rede Local (Wi-Fi/LAN): http://${HOST}:${PORT}`);
  console.log(`💾 Banco de Dados SQLite: ${pathConfig.dbPath}`);
  console.log(`📁 Pasta de Uploads: ${pathConfig.uploadsPath}`);

  // Initialize Realtime Card Watcher
  initCardStatusWatcher();

  // Initialize WhatsApp Baileys Engine
  if (process.env.ENABLE_WHATSAPP !== 'false') {
    console.log('🤖 WhatsApp Engine Multi-Session Ready...');
    initWhatsAppEngine('00000000-0000-0000-0000-000000000001').catch(err => {
      console.error('Error starting WhatsApp engine:', err);
    });
  }
});
