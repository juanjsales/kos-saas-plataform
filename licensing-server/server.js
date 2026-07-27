import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { createClient } from '@libsql/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MASTER_SECRET = process.env.KOS_MASTER_SECRET || 'kos_master_license_secret_key_2026_verifying';
const PANEL_PASSWORD = process.env.MASTER_PANEL_PASSWORD || 'kos_admin_2026';
const DEFAULT_DAYS = parseInt(process.env.DEFAULT_LICENSE_DAYS || '365');
const DEFAULT_GRACE = parseInt(process.env.DEFAULT_GRACE_DAYS || '7');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ─────────────────────────────────────────────
// DATABASE: Turso (cloud SQLite) or local SQLite fallback
// ─────────────────────────────────────────────
let db = null;

async function initDb() {
  try {
    if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
      // Turso cloud SQLite
      db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
      });
      console.log('📡 Conectado ao Turso (cloud SQLite)');
    } else {
      // Local SQLite fallback for development
      db = createClient({ url: 'file:licenses.db' });
      console.log('💾 Usando SQLite local (licenses.db) — configure TURSO_DATABASE_URL para produção');
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS licenses (
        hardware_id     TEXT PRIMARY KEY,
        client_name     TEXT NOT NULL,
        tenant_id       TEXT,
        token           TEXT NOT NULL,
        days_granted    INTEGER NOT NULL,
        grace_days      INTEGER DEFAULT 7,
        expires_at      TEXT NOT NULL,
        issued_at       TEXT NOT NULL,
        revoked         INTEGER DEFAULT 0
      )
    `);

    console.log('✅ Tabela de licenças pronta!');
  } catch (err) {
    console.error('❌ Erro ao inicializar banco de dados:', err.message);
  }
}

// ─────────────────────────────────────────────
// DB HELPERS
// ─────────────────────────────────────────────
async function getAllLicenses() {
  if (!db) return [];
  const result = await db.execute('SELECT * FROM licenses ORDER BY issued_at DESC');
  return result.rows.map(r => ({
    hardware_id: r.hardware_id,
    client_name: r.client_name,
    tenant_id: r.tenant_id,
    token: r.token,
    days_granted: r.days_granted,
    grace_days: r.grace_days,
    expires_at: r.expires_at,
    issued_at: r.issued_at,
    revoked: r.revoked === 1 || r.revoked === true
  }));
}

async function upsertLicense(data) {
  if (!db) return;
  await db.execute({
    sql: `INSERT INTO licenses (hardware_id, client_name, tenant_id, token, days_granted, grace_days, expires_at, issued_at, revoked)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(hardware_id) DO UPDATE SET
            client_name = excluded.client_name,
            tenant_id   = excluded.tenant_id,
            token       = excluded.token,
            days_granted = excluded.days_granted,
            grace_days  = excluded.grace_days,
            expires_at  = excluded.expires_at,
            issued_at   = excluded.issued_at,
            revoked     = excluded.revoked`,
    args: [
      data.hardware_id,
      data.client_name,
      data.tenant_id || null,
      data.token,
      data.days_granted,
      data.grace_days,
      data.expires_at,
      data.issued_at,
      data.revoked ? 1 : 0
    ]
  });
}

async function getLicense(hwId) {
  if (!db) return null;
  const result = await db.execute({
    sql: 'SELECT * FROM licenses WHERE hardware_id = ?',
    args: [hwId]
  });
  if (!result.rows.length) return null;
  const r = result.rows[0];
  return { ...r, revoked: r.revoked === 1 || r.revoked === true };
}

async function revokeLicense(hwId) {
  if (!db) return;
  await db.execute({
    sql: 'UPDATE licenses SET revoked = 1 WHERE hardware_id = ?',
    args: [hwId]
  });
}

// ─────────────────────────────────────────────
// MASTER PANEL (HTML UI embutida)
// ─────────────────────────────────────────────
app.get('/', async (req, res) => {
  const licenseList = await getAllLicenses();

  const rows = licenseList.map(l => {
    const expired = new Date(l.expires_at) < new Date();
    const statusColor = l.revoked ? '#ef4444' : expired ? '#f59e0b' : '#10b981';
    const statusLabel = l.revoked ? '🔴 Suspensa' : expired ? '🟡 Expirada' : '🟢 Ativa';
    return `
      <tr>
        <td><strong>${l.client_name}</strong></td>
        <td><code>${l.hardware_id}</code></td>
        <td style="color:${statusColor};font-weight:700">${statusLabel}</td>
        <td>${l.days_granted} dias</td>
        <td>${new Date(l.expires_at).toLocaleDateString('pt-BR')}</td>
        <td>${l.issued_at ? new Date(l.issued_at).toLocaleDateString('pt-BR') : '-'}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">
          <button onclick="revokeKey('${l.hardware_id}')" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.78rem">
            Suspender
          </button>
          <button onclick="copyToken('${l.token}')" style="background:#6366f1;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.78rem">
            Copiar Token
          </button>
        </td>
      </tr>`;
  }).join('');

  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KOS Master — Painel de Licenciamento</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;background:radial-gradient(circle at top,#1e1b4b,#0f172a 60%,#020617);color:#f8fafc;min-height:100vh;padding:32px 20px}
  h1{font-size:1.8rem;font-weight:800;background:linear-gradient(135deg,#6366f1,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
  .subtitle{color:#64748b;font-size:0.9rem;margin-bottom:28px}
  .card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;margin-bottom:20px;backdrop-filter:blur(12px)}
  label{display:block;font-size:0.8rem;font-weight:600;color:#94a3b8;margin-bottom:6px}
  input,select{width:100%;padding:10px 14px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:8px;font-size:0.9rem;outline:none;margin-bottom:12px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
  .btn{padding:12px 24px;border-radius:10px;border:none;font-weight:700;cursor:pointer;font-size:0.9rem;transition:all 0.2s}
  .btn-primary{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;box-shadow:0 4px 14px rgba(99,102,241,0.4)}
  .btn-primary:hover{transform:translateY(-1px)}
  table{width:100%;border-collapse:collapse;font-size:0.85rem}
  th{text-align:left;padding:10px 12px;color:#64748b;font-weight:600;font-size:0.78rem;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08)}
  td{padding:12px;border-bottom:1px solid rgba(255,255,255,0.06);vertical-align:middle}
  code{font-family:monospace;color:#38bdf8;font-size:0.8rem;background:rgba(56,189,248,0.1);padding:2px 6px;border-radius:4px}
  .badge{padding:4px 12px;border-radius:20px;font-size:0.78rem;font-weight:700;background:rgba(99,102,241,0.2);color:#818cf8;display:inline-block;margin-left:8px}
  #result{padding:14px;border-radius:10px;margin-top:12px;font-size:0.85rem;font-family:monospace;word-break:break-all;line-height:1.6}
  .success-box{background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#6ee7b7}
  .error-box{background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5}
  .stat{background:rgba(0,0,0,0.2);border-radius:12px;padding:16px;text-align:center}
  .stat-num{font-size:2rem;font-weight:800;color:#6366f1}
  .stat-label{font-size:0.78rem;color:#64748b;margin-top:4px}
</style>
</head>
<body>
<h1>✦ KOS Master — Licenciamento</h1>
<p class="subtitle">Painel exclusivo para emissão e gestão de licenças das lojas parceiras. Dados persistidos no Turso (cloud SQLite).</p>

<!-- Stats -->
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">
  <div class="stat">
    <div class="stat-num">${licenseList.length}</div>
    <div class="stat-label">Total de Licenças</div>
  </div>
  <div class="stat">
    <div class="stat-num" style="color:#10b981">${licenseList.filter(l => !l.revoked && new Date(l.expires_at) > new Date()).length}</div>
    <div class="stat-label">Ativas</div>
  </div>
  <div class="stat">
    <div class="stat-num" style="color:#ef4444">${licenseList.filter(l => l.revoked).length}</div>
    <div class="stat-label">Suspensas</div>
  </div>
</div>

<!-- Emitir Nova Licença -->
<div class="card">
  <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px">🔑 Emitir Nova Licença</h3>
  <div class="grid">
    <div>
      <label>Nome da Loja / Cliente</label>
      <input type="text" id="clientName" placeholder="Ex: Lan 3JR — Rua das Flores"/>
    </div>
    <div>
      <label>Hardware ID do Computador da Loja</label>
      <input type="text" id="hwId" placeholder="KOS-XXXX-XXXX-XXXX-XXXX"/>
    </div>
    <div>
      <label>Dias de Validade</label>
      <input type="number" id="days" value="${DEFAULT_DAYS}" min="1" max="3650"/>
    </div>
    <div>
      <label>Grace Period Offline (dias)</label>
      <input type="number" id="grace" value="${DEFAULT_GRACE}" min="0" max="30"/>
    </div>
  </div>
  <div style="margin-bottom:12px">
    <label>Senha Master</label>
    <input type="password" id="pwd" placeholder="Senha do Painel Master"/>
  </div>
  <button class="btn btn-primary" onclick="issueLicense()">⚡ Gerar Licença Assinada</button>
  <div id="result" style="display:none"></div>
</div>

<!-- Licenças Emitidas -->
<div class="card">
  <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px">
    📋 Licenças Emitidas <span class="badge">${licenseList.length} total</span>
  </h3>
  <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>Loja / Cliente</th><th>Hardware ID</th><th>Status</th>
          <th>Validade</th><th>Expira em</th><th>Emitida em</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:20px">Nenhuma licença emitida ainda.</td></tr>'}</tbody>
    </table>
  </div>
</div>

<script>
async function issueLicense() {
  const payload = {
    client_name: document.getElementById('clientName').value,
    hardware_id: document.getElementById('hwId').value,
    days_granted: parseInt(document.getElementById('days').value),
    grace_period_days: parseInt(document.getElementById('grace').value),
    password: document.getElementById('pwd').value
  };
  const resultEl = document.getElementById('result');
  resultEl.style.display = 'block';
  resultEl.className = '';
  resultEl.textContent = 'Gerando e salvando licença...';

  try {
    const res = await fetch('/api/master/issue-license', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    resultEl.className = 'success-box';
    resultEl.innerHTML = '<strong>✅ Licença emitida e salva no banco com sucesso!</strong><br><br>' +
      '<strong>Token JWT (copie e envie ao cliente):</strong><br>' + data.token +
      '<br><br><strong>Expira em:</strong> ' + new Date(data.expires_at).toLocaleDateString("pt-BR");

    setTimeout(() => location.reload(), 3000);
  } catch(err) {
    resultEl.className = 'error-box';
    resultEl.textContent = '❌ ' + err.message;
  }
}

async function revokeKey(hwId) {
  if (!confirm('Suspender a licença desta loja? O sistema dela entrará em período de tolerância offline.')) return;
  const pwd = prompt('Senha Master:');
  const res = await fetch('/api/master/revoke-license', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ hardware_id: hwId, password: pwd })
  });
  const data = await res.json();
  alert(data.message || data.error);
  location.reload();
}

function copyToken(token) {
  navigator.clipboard.writeText(token);
  alert('✅ Token copiado! Envie ao cliente para colar no campo de ativação do KOS.');
}
</script>
</body>
</html>`);
});

// ─────────────────────────────────────────────
// POST /api/master/issue-license
// ─────────────────────────────────────────────
app.post('/api/master/issue-license', async (req, res) => {
  const { client_name, hardware_id, days_granted, grace_period_days, password, tenant_id } = req.body;

  if (password !== PANEL_PASSWORD) {
    return res.status(401).json({ error: 'Senha Master incorreta. Acesso negado.' });
  }
  if (!hardware_id?.trim()) {
    return res.status(400).json({ error: 'Hardware ID é obrigatório.' });
  }

  const days = parseInt(days_granted) || DEFAULT_DAYS;
  const grace = parseInt(grace_period_days) || DEFAULT_GRACE;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  const hwId = hardware_id.trim().toUpperCase();

  const payload = {
    tenant_id: tenant_id || '00000000-0000-0000-0000-000000000001',
    hardware_id: hwId,
    expires_at: expiresAt.toISOString(),
    grace_period_days: grace,
    client_name: client_name || 'Cliente KOS'
  };

  const token = jwt.sign(payload, MASTER_SECRET);

  const record = {
    hardware_id: hwId,
    client_name: client_name || 'Cliente KOS',
    tenant_id: tenant_id || null,
    token,
    days_granted: days,
    grace_days: grace,
    expires_at: expiresAt.toISOString(),
    issued_at: new Date().toISOString(),
    revoked: false
  };

  await upsertLicense(record);
  console.log(`[KOS License] Licença emitida para "${client_name}" (HW: ${hwId}) — ${days} dias.`);

  return res.json({
    success: true,
    token,
    expires_at: expiresAt.toISOString(),
    days_granted: days,
    hardware_id: hwId,
    message: 'Licença emitida e salva com sucesso!'
  });
});

// ─────────────────────────────────────────────
// POST /api/master/verify-license
// ─────────────────────────────────────────────
app.post('/api/master/verify-license', async (req, res) => {
  const { token, hardware_id } = req.body;
  if (!token) return res.status(400).json({ valid: false, error: 'Token ausente.' });

  try {
    const payload = jwt.verify(token, MASTER_SECRET);
    const hwId = hardware_id?.trim().toUpperCase();

    if (hwId && payload.hardware_id !== '*' && payload.hardware_id !== hwId) {
      return res.json({ valid: false, reason: 'INVALID_HARDWARE_ID', message: 'Licença pertence a outro computador.' });
    }

    const stored = await getLicense(payload.hardware_id);
    if (stored?.revoked) {
      return res.json({ valid: false, reason: 'REVOKED', message: 'Licença suspensa pelo Administrador Master.' });
    }

    if (new Date(payload.expires_at) < new Date()) {
      return res.json({ valid: false, reason: 'EXPIRED', message: 'Licença expirada.' });
    }

    return res.json({
      valid: true,
      hardware_id: payload.hardware_id,
      expires_at: payload.expires_at,
      grace_period_days: payload.grace_period_days,
      tenant_id: payload.tenant_id,
      message: 'Licença válida e ativa.'
    });
  } catch {
    return res.json({ valid: false, reason: 'INVALID_TOKEN', message: 'Token inválido ou adulterado.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/master/revoke-license
// ─────────────────────────────────────────────
app.post('/api/master/revoke-license', async (req, res) => {
  const { hardware_id, password } = req.body;
  if (password !== PANEL_PASSWORD) return res.status(401).json({ error: 'Senha Master incorreta.' });

  const hwId = hardware_id?.trim().toUpperCase();
  const stored = await getLicense(hwId);
  if (!stored) return res.status(404).json({ error: 'Licença não encontrada.' });

  await revokeLicense(hwId);
  console.log(`[KOS License] Licença SUSPENSA: ${hwId}`);

  return res.json({ success: true, message: `Licença de "${stored.client_name}" suspensa com sucesso.` });
});

// ─────────────────────────────────────────────
// GET /api/master/licenses
// ─────────────────────────────────────────────
app.get('/api/master/licenses', async (req, res) => {
  const pwd = req.query.password || req.headers['x-master-password'];
  if (pwd !== PANEL_PASSWORD) return res.status(401).json({ error: 'Senha Master obrigatória.' });

  const list = await getAllLicenses();
  return res.json(list.map(l => ({
    client_name: l.client_name,
    hardware_id: l.hardware_id,
    expires_at: l.expires_at,
    days_granted: l.days_granted,
    issued_at: l.issued_at,
    revoked: l.revoked,
    status: l.revoked ? 'revoked' : new Date(l.expires_at) < new Date() ? 'expired' : 'active'
  })));
});

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'KOS Master License Server', db: db ? 'connected' : 'unavailable', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🔑 KOS Master License Server → http://localhost:${PORT}`);
    console.log(`📋 Painel Master → http://localhost:${PORT}`);
  });
});
