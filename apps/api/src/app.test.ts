import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

beforeAll(() => {
  process.env['JWT_ACCESS_SECRET'] ??= 'test-access-secret-value';
  process.env['JWT_REFRESH_SECRET'] ??= 'test-refresh-secret-value';
  process.env['DATABASE_URL'] ??= 'postgresql://localhost:5433/pursberry_test';
});

describe('api', () => {
  it('serves liveness without touching the database', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns a structured 404 for an unknown route', async () => {
    const res = await request(createApp()).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});
