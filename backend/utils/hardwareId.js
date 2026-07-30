import os from 'os';
import crypto from 'crypto';

/**
 * Generates a unique, deterministic Hardware ID fingerprint for the host computer.
 * Combines CPU model, architecture, hostname, total memory, and network interfaces.
 */
export function getHardwareId() {
  try {
    const cpus = os.cpus().map(c => c.model).join(',');
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    const totalmem = os.totalmem();

    const netInterfaces = os.networkInterfaces();
    const macs = [];
    for (const name of Object.keys(netInterfaces)) {
      for (const net of netInterfaces[name]) {
        if (net.mac && net.mac !== '00:00:00:00:00:00' && !net.internal) {
          macs.push(net.mac);
        }
      }
    }

    const rawFingerprint = `KOS_HWID_${platform}_${arch}_${hostname}_${cpus}_${totalmem}_${macs.sort().join(',')}`;
    const hash = crypto.createHash('sha256').update(rawFingerprint).digest('hex').toUpperCase();

    // Format as KOS-XXXX-XXXX-XXXX-XXXX
    return `KOS-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
  } catch (err) {
    console.error('Error generating hardware ID:', err);
    return 'KOS-HWID-LOCAL-SERVER-0001';
  }
}

export default getHardwareId;
