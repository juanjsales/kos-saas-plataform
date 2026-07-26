import path from 'path';
import fs from 'fs';

/**
 * Dynamic Storage Path Resolver for On-Premise LAN & Electron Desktop
 * Ensures database, uploads, and Baileys session files are saved in AppData
 * when running packaged Electron desktop app to prevent Windows 'Program Files' permission errors.
 */
function getStorageBaseDir() {
  if (process.env.KOS_STORAGE_DIR) {
    return process.env.KOS_STORAGE_DIR;
  }

  // If running in packaged Electron or explicitly requested AppData
  if (process.env.ELECTRON_RUN_AS_NODE || process.env.USE_APPDATA === 'true') {
    if (process.env.APPDATA) {
      return path.join(process.env.APPDATA, 'KOS', 'data');
    }
  }

  // Development & standalone node server mode fallback
  return path.join(process.cwd(), 'data');
}

const baseDir = getStorageBaseDir();
const uploadsPath = path.join(baseDir, 'uploads');
const whatsappSessionsPath = path.join(baseDir, 'whatsapp_sessions');
const dbDir = path.join(baseDir, 'database');
const dbPath = path.join(dbDir, 'kos_database.db');

// Ensure directories exist on startup
[baseDir, uploadsPath, whatsappSessionsPath, dbDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error(`Error creating directory ${dir}:`, e);
    }
  }
});

export const pathConfig = {
  baseDir,
  uploadsPath,
  whatsappSessionsPath,
  dbDir,
  dbPath,
  sqliteUrl: `file:${dbPath.replace(/\\/g, '/')}`
};

export default pathConfig;
