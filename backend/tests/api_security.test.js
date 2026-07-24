import request from 'supertest';
import express from 'express';
import cors from 'cors';
import servicesRouter from '../routes/services.js';
import cardsRouter from '../routes/cards.js';
import { apiRateLimiter, authRateLimiter } from '../middleware/rateLimiter.js';
import { checkTenantStatus } from '../middleware/authMiddleware.js';

import { jest } from '@jest/globals';

// Construct isolated Test Express Server
const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/', apiRateLimiter);
app.use('/api/admin/', authRateLimiter);
app.use('/api/', checkTenantStatus);

app.use('/api/services', servicesRouter);
app.use('/api/cards', cardsRouter);

app.get('/api/admin/test-rate-limit', authRateLimiter, (req, res) => {
  res.json({ ok: true });
});

describe('🛡️ Backend Security, Multi-Tenant Isolation & Rate Limiting Suite', () => {
  jest.setTimeout(30000);

  test('1. Rate Limiting: Blocks repeated requests with HTTP 429', async () => {
    // Make 5 initial requests (allowed limit for auth rate limiter is 5)
    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/admin/test-rate-limit');
    }

    // 6th request should be blocked with 429 Too Many Requests
    const response = await request(app).get('/api/admin/test-rate-limit');
    expect(response.status).toBe(429);
    expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  test('2. Multi-Tenant Data Isolation: Isolates data by tenant_id', async () => {
    const tenantA = '00000000-0000-0000-0000-000000000001';
    const resA = await request(app).get(`/api/cards?tenant_id=${tenantA}`);
    expect(resA.status).toBe(200);
    expect(Array.isArray(resA.body)).toBe(true);

    if (resA.body.length > 0) {
      resA.body.forEach((card) => {
        expect(card.tenant_id).toBe(tenantA);
      });
    }

    // Explicit test for services isolation
    const tenantRandom = '11111111-1111-1111-1111-111111111111';
    const resServices = await request(app).get(`/api/services?tenant_id=${tenantRandom}`);
    expect(resServices.status).toBe(200);
    expect(Array.isArray(resServices.body)).toBe(true);
    // Must strictly return 0 items for unknown/empty tenant, never leak other tenants' services
    expect(resServices.body.length).toBe(0);
  });

  test('3. Extreme String & Payload Sanitization: Handles 5,000 char strings with special chars safely', async () => {
    const extremePayload = '<script>alert("XSS")</script>' + 'A'.repeat(5000) + '\'; DROP TABLE cards; --';

    const res = await request(app)
      .post('/api/services')
      .send({
        tenant_id: '00000000-0000-0000-0000-000000000001',
        title: extremePayload,
        description: 'Test payload'
      });

    // Should handle request safely without 500 unhandled server crashes
    expect([200, 201, 400]).toContain(res.status);
  });
});
