import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MASTER_SECRET = process.env.KOS_MASTER_SECRET || 'kos_master_license_secret_key_2026_verifying';
const PANEL_PASSWORD = process.env.MASTER_PANEL_PASSWORD || 'kos_admin_2026';
const DEFAULT_DAYS = parseInt(process.env.DEFAULT_LICENSE_DAYS || '365');
const DEFAULT_GRACE = parseInt(process.env.DEFAULT_GRACE_DAYS || '7');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// In-memory license store (for production use a lightweight DB like Turso/SQLite or PlanetScale)
const licenses = new Map();

// ─────────────────────────────────────────────
// MASTER PANEL (HTML UI embutida)
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  const licenseList = Array.from(licenses.values());

  const rows = licenseList.map(l => {
    const expired = new Date(l.expires_at) < new Date();
    const statusColor = l.revoked ? '#ef4444' : expired ? '#f59e0b' : '#10b981';
    const statusLabel = l.revoked ? '🔴 Revogada' : expired ? '🟡 Expirada' : '🟢 Ativa';
    return `
      <tr>
        <td>${l.client_name}</td>
        <td><code>${l.hardware_id}</code></td>
        <td style="color:${statusColor};font-weight:700">${statusLabel}</td>
        <td>${l.days_granted} dias</td>
        <td>${new Date(l.expires_at).toLocaleDateString('pt-BR')}</td>
        <td>${l.issued_at ? new Date(l.issued_at).toLocaleDateString('pt-BR') : '-'}</td>
        <td>
          <button onclick="revokeKey('${l.hardware_id}')" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.78rem">
            Suspender
          </button>
          <button onclick="copyToken('${l.token}')" style="background:#6366f1;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.78rem;margin-left:4px">
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
  td{padding:12px;border-bottom:1px solid rgba(255,255,255,0.06)}
  code{font-family:monospace;color:#38bdf8;font-size:0.8rem;background:rgba(56,189,248,0.1);padding:2px 6px;border-radius:4px}
  .badge{padding:4px 12px;border-radius:20px;font-size:0.78rem;font-weight:700;background:rgba(99,102,241,0.2);color:#818cf8;display:inline-block;margin-left:8px}
  #result{padding:14px;border-radius:10px;margin-top:12px;font-size:0.85rem;font-family:monospace;word-break:break-all;line-height:1.6}
  .success-box{background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#6ee7b7}
  .error-box{background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5}
</style>
</head>
<body>
<h1>✦ KOS Master — Licenciamento</h1>
<p class="subtitle">Painel exclusivo do Dono Master para emissão e gestão de licenças das lojas parceiras.</p>

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
  <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px">📋 Licenças Emitidas <span class="badge">${licenseList.length} licenças</span></h3>
  <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>Loja / Cliente</th><th>Hardware ID</th><th>Status</th><th>Validade</th>
          <th>Expira em</th><th>Emitida em</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:20px">Nenhuma licença emitida ainda.</td></tr>'}</tbody>
    </table>
  </div>
</div>

<script>
async function issueLicense() {
  const clientName = document.getElementById('clientName').value;
  const hwId = document.getElementById('hwId').value;
  const days = parseInt(document.getElementById('days').value);
  const grace = parseInt(document.getElementById('grace').value);
  const pwd = document.getElementById('pwd').value;
  const resultEl = document.getElementById('result');

  resultEl.style.display = 'block';
  resultEl.className = '';
  resultEl.textContent = 'Gerando licença...';

  try {
    const res = await fetch('/api/master/issue-license', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ client_name: clientName, hardware_id: hwId, days_granted: days, grace_period_days: grace, password: pwd })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    resultEl.className = 'success-box';
    resultEl.innerHTML = '<strong>✅ Licença emitida com sucesso!</strong><br><br>' +
      '<strong>Token (copie e envie ao cliente):</strong><br>' +
      data.token + '<br><br>' +
      '<strong>Expira em:</strong> ' + new Date(data.expires_at).toLocaleDateString("pt-BR");

    setTimeout(() => location.reload(), 3000);
  } catch(err) {
    resultEl.className = 'error-box';
    resultEl.textContent = '❌ ' + err.message;
  }
}

async function revokeKey(hwId) {
  if (!confirm('Tem certeza que deseja SUSPENDER a licença desta loja?')) return;
  const pwd = prompt('Senha Master:');
  const res = await fetch('/api/master/revoke-license', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ hardware_id: hwId, password: pwd })
  });
  const data = await res.json();
  alert(data.message || data.error);
  location.reload();
}

function copyToken(token) {
  navigator.clipboard.writeText(token);
  alert('✅ Token copiado! Cole no KOS da loja do cliente.');
}
</script>
</body>
</html>`);
});

// ─────────────────────────────────────────────
// POST /api/master/issue-license
// ─────────────────────────────────────────────
app.post('/api/master/issue-license', (req, res) => {
  const { client_name, hardware_id, days_granted, grace_period_days, password, tenant_id } = req.body;

  if (password !== PANEL_PASSWORD) {
    return res.status(401).json({ error: 'Senha Master incorreta. Acesso negado.' });
  }

  if (!hardware_id || !hardware_id.trim()) {
    return res.status(400).json({ error: 'Hardware ID é obrigatório.' });
  }

  const days = parseInt(days_granted) || DEFAULT_DAYS;
  const grace = parseInt(grace_period_days) || DEFAULT_GRACE;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const payload = {
    tenant_id: tenant_id || '00000000-0000-0000-0000-000000000001',
    hardware_id: hardware_id.trim().toUpperCase(),
    expires_at: expiresAt.toISOString(),
    grace_period_days: grace,
    client_name: client_name || 'Cliente KOS'
  };

  const token = jwt.sign(payload, MASTER_SECRET);

  const licenseRecord = {
    ...payload,
    token,
    days_granted: days,
    issued_at: new Date().toISOString(),
    revoked: false
  };

  licenses.set(hardware_id.trim().toUpperCase(), licenseRecord);

  console.log(`[KOS License] Licença emitida para "${client_name}" (HW: ${hardware_id}) — válida por ${days} dias.`);

  return res.json({
    success: true,
    token,
    expires_at: expiresAt.toISOString(),
    days_granted: days,
    hardware_id: hardware_id.trim().toUpperCase(),
    message: 'Licença emitida com sucesso. Copie o token e envie ao cliente.'
  });
});

// ─────────────────────────────────────────────
// POST /api/master/verify-license
// (Chamado pelo KOS Local para revalidar online)
// ─────────────────────────────────────────────
app.post('/api/master/verify-license', (req, res) => {
  const { token, hardware_id } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token ausente.' });
  }

  try {
    const payload = jwt.verify(token, MASTER_SECRET);
    const hwId = hardware_id?.trim().toUpperCase();

    // Check hardware ID match
    if (hwId && payload.hardware_id !== '*' && payload.hardware_id !== hwId) {
      return res.json({ valid: false, reason: 'INVALID_HARDWARE_ID', message: 'Licença pertence a outro computador.' });
    }

    // Check revocation
    const stored = licenses.get(payload.hardware_id);
    if (stored?.revoked) {
      return res.json({ valid: false, reason: 'REVOKED', message: 'Licença suspensa pelo Administrador Master.' });
    }

    // Check expiration
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
  } catch (err) {
    return res.json({ valid: false, reason: 'INVALID_TOKEN', message: 'Token de licença inválido ou adulterado.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/master/revoke-license
// ─────────────────────────────────────────────
app.post('/api/master/revoke-license', (req, res) => {
  const { hardware_id, password } = req.body;

  if (password !== PANEL_PASSWORD) {
    return res.status(401).json({ error: 'Senha Master incorreta.' });
  }

  const hwId = hardware_id?.trim().toUpperCase();
  const stored = licenses.get(hwId);

  if (!stored) {
    return res.status(404).json({ error: 'Licença não encontrada para este Hardware ID.' });
  }

  licenses.set(hwId, { ...stored, revoked: true });
  console.log(`[KOS License] Licença SUSPENSA para HW: ${hwId}`);

  return res.json({ success: true, message: `Licença de "${stored.client_name}" suspensa com sucesso.` });
});

// ─────────────────────────────────────────────
// GET /api/master/licenses
// ─────────────────────────────────────────────
app.get('/api/master/licenses', (req, res) => {
  const pwd = req.query.password || req.headers['x-master-password'];
  if (pwd !== PANEL_PASSWORD) {
    return res.status(401).json({ error: 'Senha Master obrigatória.' });
  }
  return res.json(Array.from(licenses.values()).map(l => ({
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
  res.json({ status: 'ok', service: 'KOS Master License Server', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🔑 KOS Master License Server rodando em http://localhost:${PORT}`);
  console.log(`📋 Painel Master disponível em: http://localhost:${PORT}`);
  console.log(`🛡️  Chave de Assinatura: ${MASTER_SECRET.slice(0, 20)}...`);
});
