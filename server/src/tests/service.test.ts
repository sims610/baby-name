import { describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../service.ts';

describe('security basics', () => {
  test('sends protective headers and hides the framework', async () => {
    const res = await request(app).get('/');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('allows the client origin but not other sites', async () => {
    const allowed = await request(app).get('/').set('Origin', 'http://localhost:5173');
    const other = await request(app).get('/').set('Origin', 'https://evil.example');

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('does not leak stack traces on bad JSON', async () => {
    const res = await request(app).post('/api/auth').set('Content-Type', 'application/json').send('{bad json');

    expect(res.status).toBe(400);
    expect(res.body.stack).toBeUndefined();
  });

  test('rejects oversized bodies', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ name: 'Pat', email: 'pat@test.com', message: 'x'.repeat(20_000) });

    expect(res.status).toBe(413);
  });

  test('locks out repeated failed logins', async () => {
    const email = `pat-${crypto.randomUUID()}@test.com`;
    await request(app).post('/api/auth').send({ name: 'Pat', email, password: 'secret' }).expect(201);

    for (let i = 0; i < 10; i++) {
      await request(app).put('/api/auth').send({ email, password: 'wrong' }).expect(401);
    }
    const res = await request(app).put('/api/auth').send({ email, password: 'secret' });

    expect(res.status).toBe(429);
  });
});
