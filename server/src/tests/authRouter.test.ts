import { describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../service.ts';

// The database is shared by every test in this file, so each test uses its own email.
function newUser() {
  return {
    name: 'Pat',
    email: `pat-${crypto.randomUUID()}@test.com`,
    password: 'secret',
  };
}

describe('POST /api/auth (register)', () => {
  test('creates the user and returns a session token', async () => {
    const user = newUser();

    const res = await request(app).post('/api/auth').send(user);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: { id: expect.any(String), name: user.name, email: user.email },
      token: expect.any(String),
    });
  });

  test('rejects an email that is already registered', async () => {
    const user = newUser();
    await request(app).post('/api/auth').send(user).expect(201);

    const res = await request(app).post('/api/auth').send(user);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'email already registered' });
  });
});

describe('PUT /api/auth (login)', () => {
  test('returns the registered user and a new session token', async () => {
    const user = newUser();
    const registered = await request(app).post('/api/auth').send(user).expect(201);

    const res = await request(app).put('/api/auth').send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: registered.body.user,
      token: expect.any(String),
    });
    expect(res.body.token).not.toBe(registered.body.token);
  });
});
