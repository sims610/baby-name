import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import app from '../service.ts';
import { setEmailTransport } from '../email.ts';
import type { Email } from '../email.ts';
import { PASSWORD_RESET_TTL_MS } from '../database/database.ts';

// Emails are captured here instead of being sent.
const outbox: Email[] = [];

beforeAll(() => setEmailTransport(async (email) => void outbox.push(email)));
afterAll(() => setEmailTransport(null));
afterEach(() => {
  outbox.length = 0;
  jest.restoreAllMocks();
});

const STRONG_PASSWORD = 'NewPassword1';

async function registerUser() {
  const user = { name: 'Pat', email: `pat-${crypto.randomUUID()}@test.com`, password: 'OldPassword1' };
  const res = await request(app).post('/api/auth').send(user).expect(201);
  return { ...user, token: res.body.token as string };
}

/** Requests a reset link and pulls the token out of the email that was "sent". */
async function requestResetToken(email: string): Promise<string> {
  await request(app).post('/api/auth/forgot-password').send({ email }).expect(202);
  const sent = outbox.at(-1)!;
  const token = /token=([0-9a-f]+)/.exec(sent.text)?.[1];
  expect(token).toBeDefined();
  return token!;
}

function login(email: string, password: string) {
  return request(app).put('/api/auth').send({ email, password });
}

describe('POST /api/auth/forgot-password', () => {
  test('emails a reset link to an existing account', async () => {
    const user = await registerUser();

    const res = await request(app).post('/api/auth/forgot-password').send({ email: user.email.toUpperCase() });

    expect(res.status).toBe(202);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(user.email);
    expect(outbox[0].subject).toMatch(/reset/i);
    expect(outbox[0].text).toMatch(/\/reset-password\?token=[0-9a-f]{64}/);
  });

  test('answers the same way for an unknown email, without sending anything', async () => {
    const known = await registerUser();
    const knownRes = await request(app).post('/api/auth/forgot-password').send({ email: known.email });
    outbox.length = 0;

    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.com' });

    expect(res.status).toBe(knownRes.status);
    expect(res.body).toEqual(knownRes.body);
    expect(outbox).toHaveLength(0);
  });

  test('stops emailing the same address after 3 requests', async () => {
    const user = await registerUser();

    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/forgot-password').send({ email: user.email }).expect(202);
    }

    expect(outbox).toHaveLength(3);
  });

  test('requires an email', async () => {
    await request(app).post('/api/auth/forgot-password').send({}).expect(400);
  });
});

describe('POST /api/auth/reset-password', () => {
  test('sets the new password and signs the account out everywhere', async () => {
    const user = await registerUser();
    const token = await requestResetToken(user.email);

    const res = await request(app).post('/api/auth/reset-password').send({ token, password: STRONG_PASSWORD });

    expect(res.status).toBe(200);
    expect((await login(user.email, user.password)).status).toBe(401);
    expect((await login(user.email, STRONG_PASSWORD)).status).toBe(200);
    // The session from before the reset no longer works.
    await request(app).delete('/api/auth').set('Authorization', `Bearer ${user.token}`).expect(401);
  });

  test('a link only works once', async () => {
    const user = await registerUser();
    const token = await requestResetToken(user.email);
    await request(app).post('/api/auth/reset-password').send({ token, password: STRONG_PASSWORD }).expect(200);

    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'AnotherPass2' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or has expired/);
  });

  test('a link stops working after it expires', async () => {
    const user = await registerUser();
    const token = await requestResetToken(user.email);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + PASSWORD_RESET_TTL_MS + 1000);

    await request(app).post('/api/auth/reset-password').send({ token, password: STRONG_PASSWORD }).expect(400);
  });

  test('requesting a new link cancels the earlier one', async () => {
    const user = await registerUser();
    const first = await requestResetToken(user.email);
    const second = await requestResetToken(user.email);

    await request(app).post('/api/auth/reset-password').send({ token: first, password: STRONG_PASSWORD }).expect(400);
    await request(app).post('/api/auth/reset-password').send({ token: second, password: STRONG_PASSWORD }).expect(200);
  });

  test('rejects a weak password without using up the link', async () => {
    const user = await registerUser();
    const token = await requestResetToken(user.email);

    const weak = await request(app).post('/api/auth/reset-password').send({ token, password: 'password' });
    expect(weak.status).toBe(400);
    expect(weak.body.message).toMatch(/uppercase/);

    await request(app).post('/api/auth/reset-password').send({ token, password: STRONG_PASSWORD }).expect(200);
  });

  test('rejects an unknown token', async () => {
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token', password: STRONG_PASSWORD })
      .expect(400);
  });
});

describe('POST /api/auth/reset-password/verify', () => {
  function verify(token: string) {
    return request(app).post('/api/auth/reset-password/verify').send({ token });
  }

  test('accepts a fresh link without using it up', async () => {
    const user = await registerUser();
    const token = await requestResetToken(user.email);

    await verify(token).expect(200, { valid: true });
    await verify(token).expect(200, { valid: true });
    await request(app).post('/api/auth/reset-password').send({ token, password: STRONG_PASSWORD }).expect(200);
  });

  test('rejects a link that was already used', async () => {
    const user = await registerUser();
    const token = await requestResetToken(user.email);
    await request(app).post('/api/auth/reset-password').send({ token, password: STRONG_PASSWORD }).expect(200);

    const res = await verify(token);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid_reset_link');
  });

  test('rejects a link replaced by a newer one, or one that has expired', async () => {
    const user = await registerUser();
    const replaced = await requestResetToken(user.email);
    const latest = await requestResetToken(user.email);

    await verify(replaced).expect(400);
    await verify(latest).expect(200);

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + PASSWORD_RESET_TTL_MS + 1000);
    await verify(latest).expect(400);
  });

  test('rejects a missing or made-up token', async () => {
    await request(app).post('/api/auth/reset-password/verify').send({}).expect(400);
    await verify('not-a-real-token').expect(400);
  });
});

describe('PUT /api/auth/password (change password)', () => {
  function changePassword(token: string, body: object) {
    return request(app).put('/api/auth/password').set('Authorization', `Bearer ${token}`).send(body);
  }

  test('changes the password, keeps this session and signs out the others', async () => {
    const user = await registerUser();
    const otherDevice = (await login(user.email, user.password).expect(200)).body.token as string;

    const res = await changePassword(user.token, { currentPassword: user.password, newPassword: STRONG_PASSWORD });

    expect(res.status).toBe(200);
    expect((await login(user.email, STRONG_PASSWORD)).status).toBe(200);
    expect((await login(user.email, user.password)).status).toBe(401);
    await request(app).delete('/api/auth').set('Authorization', `Bearer ${otherDevice}`).expect(401);
    await request(app).delete('/api/auth').set('Authorization', `Bearer ${user.token}`).expect(200);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: user.email, subject: expect.stringMatching(/changed/i) });
  });

  test('requires the correct current password', async () => {
    const user = await registerUser();

    const res = await changePassword(user.token, { currentPassword: 'WrongPass1', newPassword: STRONG_PASSWORD });

    expect(res.status).toBe(403);
    expect((await login(user.email, user.password)).status).toBe(200);
  });

  test('rejects a weak password or the same password again', async () => {
    const user = await registerUser();

    await changePassword(user.token, { currentPassword: user.password, newPassword: 'short' }).expect(400);
    await changePassword(user.token, { currentPassword: user.password, newPassword: user.password }).expect(400);
  });

  test('requires being signed in', async () => {
    await request(app)
      .put('/api/auth/password')
      .send({ currentPassword: 'OldPassword1', newPassword: STRONG_PASSWORD })
      .expect(401);
  });
});
