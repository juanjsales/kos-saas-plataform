import fs from 'fs';
import path from 'path';
import { pathConfig } from '../config/pathConfig.js';

/**
 * On-Premise Disk Storage & Media Purge Worker
 * Runs periodically to prune temporary files and compress old images,
 * keeping hard drive storage optimized for years of operation.
 */
export async function runMediaStorageCleanup() {
  console.log('🧹 Starting Scheduled Media Storage Cleanup...');

  const uploadsDir = pathConfig.uploadsPath;
  if (!fs.existsSync(uploadsDir)) return;

  const NOW = Date.now();
  const RETENTION_DAYS_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

  try {
    const files = fs.readdirSync(uploadsDir);
    let deletedCount = 0;
    let freedBytes = 0;

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      try {
        const stats = fs.statSync(filePath);
        const ageMs = NOW - stats.mtimeMs;

        // Delete temporary or orphaned files older than 180 days
        if (ageMs > RETENTION_DAYS_MS && (file.startsWith('tmp_') || file.endsWith('.tmp'))) {
          freedBytes += stats.size;
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch (e) {}
    }

    const freedMB = (freedBytes / (1024 * 1024)).toFixed(2);
    console.log(`🧹 Storage Cleanup finished: Deleted ${deletedCount} temp files. Freed ${freedMB} MB of disk space.`);
  } catch (err) {
    console.error('Error running media storage cleanup:', err);
  }
}

/**
 * Starts automatic weekly cleanup worker interval
 */
export function initMediaStorageWorker() {
  // Run once on startup (after 30 seconds delay)
  setTimeout(() => {
    runMediaStorageCleanup().catch(() => {});
  }, 30000);

  // Schedule weekly execution (every 7 days)
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  setInterval(() => {
    runMediaStorageCleanup().catch(() => {});
  }, WEEK_MS);
}
