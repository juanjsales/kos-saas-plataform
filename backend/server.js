import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import servicesRouter from './routes/services.js';
import cardsRouter from './routes/cards.js';
import chatsRouter from './routes/chats.js';
import notificationsRouter from './routes/notifications.js';
import messagesRouter from './routes/messages.js';
import whatsappRouter from './routes/whatsappRoutes.js';
import { getAllTenants, createOrUpdateTenant, updateTenantStatus, deleteTenant, getAllUsersAdmin, resetUserPasswordAdmin } from './controllers/tenantAdminController.js';
import { getTeamMembers, createTeamMember } from './controllers/teamController.js';
import { getUserPreferences, saveUserPreferences } from './controllers/userPreferencesController.js';
import { anonymizeContactLGPD } from './controllers/gdprController.js';
import { apiRateLimiter, authRateLimiter, adminRateLimiter } from './middleware/rateLimiter.js';
import { checkTenantStatus } from './middleware/authMiddleware.js';
import { initWhatsAppEngine } from './services/whatsapp.js';
import { initCardStatusWatcher } from './jobs/cardStatusWatcher.js';
import { startScheduledWorker } from './services/scheduledNotificationWorker.js';

import { autoRestoreActiveWhatsAppSessions } from './services/whatsapp.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Enable trust proxy for cloud deployment (Render/Railway/Vercel)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// Security & Multi-Tenant Status Middlewares
app.use('/api/', apiRateLimiter);
app.use('/api/admin/', adminRateLimiter);
app.use('/api/', checkTenantStatus);

// Routes
app.use('/api/services', servicesRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/whatsapp', whatsappRouter);

// LGPD & Data Protection Routes
app.post('/api/contacts/:id/anonymize', anonymizeContactLGPD);

// Super Admin Routes (Full Tenant & User Management)
app.get('/api/admin/tenants', getAllTenants);
app.post('/api/admin/tenants', createOrUpdateTenant);
app.patch('/api/admin/tenants/:id/status', updateTenantStatus);
app.delete('/api/admin/tenants/:id', deleteTenant);

app.get('/api/admin/users', getAllUsersAdmin);
app.post('/api/admin/users/reset-password', resetUserPasswordAdmin);

// Team Management Routes
app.get('/api/team', getTeamMembers);
app.post('/api/team', createTeamMember);

// User Preferences Routes
app.get('/api/user/preferences', getUserPreferences);
app.post('/api/user/preferences', saveUserPreferences);

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
  console.log(`🚀 Multi-Tenant SaaS Backend server listening on port ${PORT}`);

  // Initialize Realtime Card Watcher
  initCardStatusWatcher();

  // Start Scheduled Notification Anti-Duplication Queue Worker
  startScheduledWorker();

  // Initialize WhatsApp Baileys Engine (Auto Restore Saved Tenant Sessions)
  if (process.env.ENABLE_WHATSAPP !== 'false') {
    console.log('🤖 WhatsApp Engine Multi-Session Ready...');
    await autoRestoreActiveWhatsAppSessions();
  }
});
