import fs from 'fs';
import path from 'path';
import { pathConfig } from '../config/pathConfig.js';

const BACKUP_RETENTION_DAYS = 7;

/**
 * Creates a timestamped snapshot backup of the SQLite database
 */
export async function runSqliteBackupNow() {
  try {
    const dbPath = pathConfig.dbPath;
    if (!fs.existsSync(dbPath)) {
      console.warn(`[SQLite Backup] DB file does not exist yet at ${dbPath}`);
      return null;
    }

    const backupsDir = path.join(pathConfig.baseDir, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
    const backupFileName = `kos_backup_${dateStr}.db`;
    const backupFilePath = path.join(backupsDir, backupFileName);

    // Copy SQLite database safely
    fs.copyFileSync(dbPath, backupFilePath);
    console.log(`💾 [SQLite Backup] Backup snapshot created successfully: ${backupFileName}`);

    // Cleanup old backups older than BACKUP_RETENTION_DAYS
    cleanupOldBackups(backupsDir);

    return backupFilePath;
  } catch (err) {
    console.error('❌ [SQLite Backup] Error performing database backup:', err);
    return null;
  }
}

/**
 * Removes backup files older than retention limit (7 days)
 */
function cleanupOldBackups(backupsDir) {
  try {
    const files = fs.readdirSync(backupsDir);
    const now = Date.now();
    const maxAgeMs = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.startsWith('kos_backup_') && file.endsWith('.db')) {
        const filePath = path.join(backupsDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          console.log(`🧹 [SQLite Backup] Purged old backup file: ${file}`);
        }
      }
    }
  } catch (err) {
    console.error('[SQLite Backup] Error during old backups cleanup:', err);
  }
}

/**
 * Initializes daily automated backup schedule
 */
export function initSqliteBackupJob() {
  console.log('⏰ [SQLite Backup] Initializing daily automated database backup job...');

  // Run initial backup 10 seconds after server start
  setTimeout(() => {
    runSqliteBackupNow();
  }, 10000);

  // Repeat every 24 hours (86,400,000 ms)
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    runSqliteBackupNow();
  }, TWENTY_FOUR_HOURS);
}
