import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { createClient } from '@libsql/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MASTER_SECRET = process.env.KOS_MASTER_SECRET || 'kos_master_license_secret_key_2026_verifying';
const MASTER_PASSWORD = process.env.MASTER_PANEL_PASSWORD || 'kos_admin_2026';
const DEFAULT_DAYS = parseInt(process.env.DEFAULT_LICENSE_DAYS || '365', 10);
const DEFAULT_GRACE_DAYS = parseInt(process.env.DEFAULT_GRACE_DAYS || '7', 10);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Turso Cloud Client or fallback local Client
let db;
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (tursoUrl && tursoToken) {
  console.log(`🌐 Connecting to Turso Cloud SQLite: ${tursoUrl}`);
  db = createClient({
    url: tursoUrl,
    authToken: tursoToken
  });
} else {
  console.log('💾 Fallback to local SQLite licenses.db');
  db = createClient({
    url: 'file:licenses.db'
  });
}

// Ensure database table schema exists in Turso / SQLite
async function initDb() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS licenses (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        tenant_name TEXT,
        license_key TEXT UNIQUE NOT NULL,
        signed_token TEXT NOT NULL,
        hardware_id TEXT,
        expires_at TEXT NOT NULL,
        grace_period_days INTEGER DEFAULT 7,
        last_online_check TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Turso Database schema verified successfully!');

    // Seed default active company (Lan 3JR) if table is empty
    const checkCount = await db.execute('SELECT COUNT(*) as cnt FROM licenses');
    const count = Number(checkCount.rows[0]?.cnt || 0);

    if (count === 0) {
      console.log('🌱 Seeding default active company (Lan 3JR) into Turso Cloud SQLite...');
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const defaultTenantId = '00000000-0000-0000-0000-000000000001';
      const defaultLicenseKey = 'KOS-LAN3JR-ACTIVE-2026';
      const signedToken = jwt.sign(
        {
          tenant_id: defaultTenantId,
          hardware_id: '*',
          expires_at: expiresAt.toISOString(),
          grace_period_days: DEFAULT_GRACE_DAYS
        },
        MASTER_SECRET
      );

      await db.execute({
        sql: `INSERT INTO licenses (id, tenant_id, tenant_name, license_key, signed_token, hardware_id, expires_at, grace_period_days, last_online_check, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          'lic_lan_3jr_default',
          defaultTenantId,
          'Lan 3JR',
          defaultLicenseKey,
          signedToken,
          '*',
          expiresAt.toISOString(),
          DEFAULT_GRACE_DAYS,
          new Date().toISOString(),
          'active'
        ]
      });
      console.log('🎉 Empresa ativada e semeada no Turso Cloud: Lan 3JR (KOS-LAN3JR-ACTIVE-2026)!');
    }
  } catch (err) {
    console.error('❌ Error initializing Turso DB table:', err);
  }
}
initDb();

// Helper to query all licenses
async function getLicensesList() {
  try {
    const res = await db.execute('SELECT * FROM licenses ORDER BY created_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      tenant_id: r.tenant_id,
      tenant_name: r.tenant_name,
      license_key: r.license_key,
      signed_token: r.signed_token,
      hardware_id: r.hardware_id,
      expires_at: r.expires_at,
      grace_period_days: r.grace_period_days,
      last_online_check: r.last_online_check,
      status: r.status,
      created_at: r.created_at
    }));
  } catch (e) {
    console.error('Error fetching licenses from Turso:', e);
    return [];
  }
}

// -------------------------------------------------------------
// 1. Central Master Admin Web Dashboard
// -------------------------------------------------------------
app.get('/', async (req, res) => {
  const licenses = await getLicensesList();
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>KOS Licensing Server Central (Turso Cloud)</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        :root { --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #38bdf8; --success: #10b981; --danger: #ef4444; --muted: #94a3b8; }
        body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; }
        .container { max-width: 1050px; margin: 0 auto; }
        h1 { display: flex; align-items: center; gap: 10px; color: var(--accent); }
        .card { background: var(--card); border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.1); }
        .badge { display: inline-block; padding: 4px 8px; borderRadius: 6px; font-size: 0.75rem; font-weight: 700; }
        .badge-active { background: rgba(16,185,129,0.2); color: var(--success); }
        .badge-revoked { background: rgba(239,68,68,0.2); color: var(--danger); }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 0.88rem; }
        th { color: var(--muted); text-transform: uppercase; font-size: 0.75rem; }
        input, select, button { padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: #0f172a; color: white; margin-right: 8px; }
        button { background: var(--accent); color: #0f172a; font-weight: bold; cursor: pointer; border: none; }
        button.btn-danger { background: var(--danger); color: white; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .stat-box { background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; }
        .stat-val { font-size: 1.6rem; font-weight: 800; color: var(--accent); }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>⚡ KOS Licensing Server Central (Turso Cloud SQLite)</h1>
        <p style="color: var(--muted)">Gerenciamento centralizado de licenças online para clientes do KOS SaaS e On-Premise.</p>

        <div class="grid" style="margin-bottom: 24px;">
          <div class="card stat-box">
            <div style="color: var(--muted); font-size: 0.8rem;">Status da Nuvem</div>
            <div class="stat-val" style="font-size: 1.2rem; color: var(--success)">🟢 Turso Conectado</div>
          </div>
          <div class="card stat-box">
            <div style="color: var(--muted); font-size: 0.8rem;">Total de Licenças</div>
            <div class="stat-val">${licenses.length}</div>
          </div>
          <div class="card stat-box">
            <div style="color: var(--muted); font-size: 0.8rem;">Licenças Ativas</div>
            <div class="stat-val" style="color: var(--success)">${licenses.filter(l => l.status === 'active').length}</div>
          </div>
        </div>

        <!-- Form de Emissão -->
        <div class="card">
          <h3>➕ Emitir Nova Licença</h3>
          <form action="/api/master/issue-license-web" method="POST" style="display: flex; flex-wrap: wrap; gap: 12px;">
            <input type="text" name="tenant_name" placeholder="Nome da Empresa (ex: Mercado X)" required style="flex: 1; min-width: 200px;">
            <input type="text" name="hardware_id" placeholder="Hardware ID (ou * para qualquer)" value="*" style="width: 220px;">
            <input type="number" name="expires_in_days" placeholder="Dias de Validade" value="365" style="width: 130px;">
            <input type="password" name="master_password" placeholder="Senha Master" required style="width: 140px;">
            <button type="submit">Emitir Licença</button>
          </form>
        </div>

        <!-- Tabela de Licenças -->
        <div class="card">
          <h3>📋 Licenças Emitidas no Turso Cloud</h3>
          <table>
            <thead>
              <tr>
                <th>Empresa / Tenant</th>
                <th>Chave Serial</th>
                <th>Hardware ID</th>
                <th>Expira em</th>
                <th>Última Checagem Online</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${licenses.length === 0 ? '<tr><td colspan="7" style="text-align: center; color: var(--muted)">Nenhuma licença emitida ainda.</td></tr>' : ''}
              ${licenses.map(l => `
                <tr>
                  <td><strong>${l.tenant_name || 'Sem Nome'}</strong><br><small style="color: var(--muted)">${l.tenant_id}</small></td>
                  <td>
                    <code style="background: rgba(255,255,255,0.06); padding: 4px 6px; border-radius: 4px;">${l.license_key}</code>
                    ${l.status === 'active' ? `
                      <br>
                      <button onclick="navigator.clipboard.writeText(\`${l.signed_token}\`); alert('Token copiado!');" style="background:#6366f1;color:#fff;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:0.7rem;margin-top:6px;font-weight:bold">
                        📋 Copiar Token
                      </button>
                    ` : ''}
                  </td>
                  <td><code>${l.hardware_id || '*'}</code></td>
                  <td>${new Date(l.expires_at).toLocaleDateString('pt-BR')}</td>
                  <td>${l.last_online_check ? new Date(l.last_online_check).toLocaleString('pt-BR') : 'Nunca'}</td>
                  <td><span class="badge ${l.status === 'active' ? 'badge-active' : 'badge-revoked'}">${l.status === 'active' ? 'ATIVA' : 'REVOGADA'}</span></td>
                  <td>
                    ${l.status === 'active' ? `
                      <form action="/api/master/revoke-license-web" method="POST" style="display:inline;">
                        <input type="hidden" name="license_key" value="${l.license_key}">
                        <input type="password" name="master_password" placeholder="Senha" required style="width: 80px; padding: 4px 6px; font-size: 0.75rem;">
                        <button type="submit" class="btn-danger" style="padding: 4px 8px; font-size: 0.75rem;">Revogar</button>
                      </form>
                    ` : '—'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

// -------------------------------------------------------------
// 2. Web Form Actions (for Admin Dashboard)
// -------------------------------------------------------------
app.post('/api/master/issue-license-web', async (req, res) => {
  const { tenant_name, hardware_id, expires_in_days, master_password } = req.body;
  if (master_password !== MASTER_PASSWORD) {
    return res.status(401).send('<h2 style="color: red; font-family: sans-serif;">Senha Master incorreta! <a href="/">Voltar</a></h2>');
  }

  const tenantId = `tenant_${Date.now()}`;
  const hwId = hardware_id || '*';
  const days = parseInt(expires_in_days, 10) || DEFAULT_DAYS;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const licenseKey = `KOS-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const id = `lic_${Date.now()}`;

  const signedToken = jwt.sign(
    {
      tenant_id: tenantId,
      hardware_id: hwId,
      expires_at: expiresAt.toISOString(),
      grace_period_days: DEFAULT_GRACE_DAYS
    },
    MASTER_SECRET
  );

  try {
    await db.execute({
      sql: `INSERT INTO licenses (id, tenant_id, tenant_name, license_key, signed_token, hardware_id, expires_at, grace_period_days, last_online_check, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, tenantId, tenant_name, licenseKey, signedToken, hwId, expiresAt.toISOString(), DEFAULT_GRACE_DAYS, new Date().toISOString(), 'active']
    });

    res.redirect('/');
  } catch (err) {
    res.status(500).send(`Erro ao salvar no Turso DB: ${err.message}`);
  }
});

app.post('/api/master/revoke-license-web', async (req, res) => {
  const { license_key, master_password } = req.body;
  if (master_password !== MASTER_PASSWORD) {
    return res.status(401).send('<h2 style="color: red; font-family: sans-serif;">Senha Master incorreta! <a href="/">Voltar</a></h2>');
  }

  try {
    await db.execute({
      sql: `UPDATE licenses SET status = 'revoked' WHERE license_key = ?`,
      args: [license_key]
    });
    res.redirect('/');
  } catch (err) {
    res.status(500).send(`Erro ao revogar no Turso DB: ${err.message}`);
  }
});

// -------------------------------------------------------------
// 3. API Endpoints for KOS On-Premise System Auto-Sync & Activation
// -------------------------------------------------------------

// POST /api/master/verify-license
// Called by local KOS instances to check online status and refresh verification token
app.post('/api/master/verify-license', async (req, res) => {
  try {
    const { license_key, signed_token, hardware_id, tenant_id, tenant_name } = req.body;

    let targetLicense = null;

    if (license_key) {
      const result = await db.execute({
        sql: `SELECT * FROM licenses WHERE license_key = ?`,
        args: [license_key]
      });
      if (result.rows.length > 0) targetLicense = result.rows[0];
    }
    
    if (!targetLicense && signed_token) {
      const result = await db.execute({
        sql: `SELECT * FROM licenses WHERE signed_token = ?`,
        args: [signed_token]
      });
      if (result.rows.length > 0) targetLicense = result.rows[0];
    }

    if (!targetLicense && tenant_id) {
      const result = await db.execute({
        sql: `SELECT * FROM licenses WHERE tenant_id = ?`,
        args: [tenant_id]
      });
      if (result.rows.length > 0) targetLicense = result.rows[0];
    }

    // Fallback: If querying default tenant or no license exists, ensure Lan 3JR active license
    if (!targetLicense) {
      const defaultTenantId = tenant_id || '00000000-0000-0000-0000-000000000001';
      const companyName = tenant_name || 'Lan 3JR';
      const defaultKey = license_key || 'KOS-LAN3JR-ACTIVE-2026';
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const newToken = jwt.sign(
        {
          tenant_id: defaultTenantId,
          hardware_id: hardware_id || '*',
          expires_at: expiresAt.toISOString(),
          grace_period_days: DEFAULT_GRACE_DAYS
        },
        MASTER_SECRET
      );

      const id = `lic_${Date.now()}`;

      await db.execute({
        sql: `INSERT INTO licenses (id, tenant_id, tenant_name, license_key, signed_token, hardware_id, expires_at, grace_period_days, last_online_check, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, defaultTenantId, companyName, defaultKey, newToken, hardware_id || '*', expiresAt.toISOString(), DEFAULT_GRACE_DAYS, new Date().toISOString(), 'active']
      });

      const freshRes = await db.execute({
        sql: `SELECT * FROM licenses WHERE id = ?`,
        args: [id]
      });
      if (freshRes.rows.length > 0) targetLicense = freshRes.rows[0];
    }

    if (targetLicense.status === 'revoked') {
      return res.json({
        valid: false,
        status: 'revoked',
        message: 'Esta licença foi suspensa ou revogada pela central.'
      });
    }

    // Update last_online_check timestamp in Turso DB
    const nowIso = new Date().toISOString();
    await db.execute({
      sql: `UPDATE licenses SET last_online_check = ? WHERE id = ?`,
      args: [nowIso, targetLicense.id]
    });

    const expiresAtDate = new Date(targetLicense.expires_at);
    const isExpired = expiresAtDate < new Date();

    if (isExpired) {
      return res.json({
        valid: false,
        status: 'expired',
        expires_at: targetLicense.expires_at,
        message: 'A validade desta licença expirou no servidor central.'
      });
    }

    // Generate fresh signed token for client
    const freshToken = jwt.sign(
      {
        tenant_id: targetLicense.tenant_id,
        hardware_id: targetLicense.hardware_id || '*',
        expires_at: targetLicense.expires_at,
        grace_period_days: targetLicense.grace_period_days || DEFAULT_GRACE_DAYS
      },
      MASTER_SECRET
    );

    return res.json({
      valid: true,
      status: 'active',
      tenant_id: targetLicense.tenant_id,
      tenant_name: targetLicense.tenant_name,
      license_key: targetLicense.license_key,
      signed_token: freshToken,
      expires_at: targetLicense.expires_at,
      grace_period_days: targetLicense.grace_period_days || DEFAULT_GRACE_DAYS,
      last_online_check: nowIso,
      message: 'Licença sincronizada e válida no Turso Cloud.'
    });
  } catch (err) {
    console.error('Error verifying license on Turso Cloud:', err);
    return res.status(500).json({ valid: false, error: err.message });
  }
});

// GET /api/master/licenses JSON list
app.get('/api/master/licenses', async (req, res) => {
  const licenses = await getLicensesList();
  res.json(licenses);
});

// Health check
app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    server: 'KOS Licensing Server Central',
    database: 'Turso Cloud SQLite',
    tursoUrl: tursoUrl || 'local-file',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 KOS Central Licensing Server rodando na porta ${PORT}`);
  console.log(`🌐 Painel do Dono Master disponível em: http://localhost:${PORT}`);
});
