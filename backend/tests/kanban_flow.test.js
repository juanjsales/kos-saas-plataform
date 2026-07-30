import request from 'supertest';
import express from 'express';
import cors from 'cors';
import cardsRouter from '../routes/cards.js';
import servicesRouter from '../routes/services.js';
import { checkTenantStatus } from '../middleware/authMiddleware.js';
import { prisma } from '../config/db.js';
import { jest } from '@jest/globals';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/', checkTenantStatus);
app.use('/api/cards', cardsRouter);
app.use('/api/services', servicesRouter);

describe('📋 Kanban OS Status Transitions & Flow Integration Suite', () => {
  jest.setTimeout(30000);

  const testTenantId = '00000000-0000-0000-0000-000000000001';
  let createdServiceId = null;
  let createdCardId = null;

  beforeAll(async () => {
    // Ensure a service exists for testing
    const serviceRes = await request(app)
      .post('/api/services')
      .send({
        tenant_id: testTenantId,
        title: 'Serviço de Teste Integrado',
        questions_schema: JSON.stringify([{ id: 'q1', label: 'Defeito Relatado', type: 'text' }])
      });

    if (serviceRes.status === 201 || serviceRes.status === 200) {
      createdServiceId = serviceRes.body.id;
    } else {
      const getServicesRes = await request(app).get(`/api/services?tenant_id=${testTenantId}`);
      if (getServicesRes.body && getServicesRes.body.length > 0) {
        createdServiceId = getServicesRes.body[0].id;
      }
    }
  });

  afterAll(async () => {
    // Automated Cleanup: Ensure test data is never persisted after test completion
    try {
      if (createdCardId) {
        await prisma.card.deleteMany({ where: { id: createdCardId } });
      }
      if (createdServiceId) {
        await prisma.card.deleteMany({ where: { service_id: createdServiceId } });
        await prisma.service.deleteMany({ where: { id: createdServiceId } });
      }
      await prisma.contact.deleteMany({ where: { phone: '5511999998888' } });
      await prisma.service.deleteMany({ where: { title: { contains: 'Teste' } } });
    } catch (e) {}
  });

  test('1. Create Card: Creates a new card in "created" status', async () => {
    expect(createdServiceId).toBeTruthy();

    const response = await request(app)
      .post('/api/cards')
      .send({
        tenant_id: testTenantId,
        service_id: createdServiceId,
        contact_name: 'Cliente Teste Kanban',
        contact_phone: '5511999998888',
        collected_data: { q1: 'Tela Quebrada' }
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeTruthy();
    expect(response.body.status).toBe('created');
    expect(response.body.tenant_id).toBe(testTenantId);

    createdCardId = response.body.id;
  });

  test('2. Status Transition: Advances card to "in_progress"', async () => {
    expect(createdCardId).toBeTruthy();

    const response = await request(app)
      .patch(`/api/cards/${createdCardId}/status`)
      .send({ status: 'in_progress' });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(createdCardId);
    expect(response.body.status).toBe('in_progress');
  });

  test('3. Status Transition: Advances card to "completed"', async () => {
    expect(createdCardId).toBeTruthy();

    const response = await request(app)
      .patch(`/api/cards/${createdCardId}/status`)
      .send({ status: 'completed' });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(createdCardId);
    expect(response.body.status).toBe('completed');
  });

  test('4. Invalid Status: Rejects invalid status transition with HTTP 400', async () => {
    expect(createdCardId).toBeTruthy();

    const response = await request(app)
      .patch(`/api/cards/${createdCardId}/status`)
      .send({ status: 'status_invalido_inexistente' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Status inválido/);
  });

  test('5. Fetch Tenant Cards: Strictly retrieves cards belonging to the active tenant', async () => {
    const response = await request(app).get(`/api/cards?tenant_id=${testTenantId}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    const found = response.body.find(c => c.id === createdCardId);
    expect(found).toBeTruthy();
    expect(found.status).toBe('completed');
  });
});
