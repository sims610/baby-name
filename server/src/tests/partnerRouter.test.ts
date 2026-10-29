import { describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../service.ts';

// The database is in memory and shared by every test in this file, so each user gets its own email.
async function registerUser(name = 'Pat'): Promise<{ token: string; email: string }> {
  const email = `${name.toLowerCase()}-${crypto.randomUUID()}@test.com`;
  const res = await request(app).post('/api/auth').send({ name, email, password: 'secret' }).expect(201);
  return { token: res.body.token, email };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function inviteCode(token: string): Promise<string> {
  const res = await request(app).get('/api/partner').set(auth(token)).expect(200);
  return res.body.inviteCode;
}

async function linkedPair() {
  const you = await registerUser('Pat');
  const partner = await registerUser('Sam');
  await request(app)
    .post('/api/partner')
    .set(auth(you.token))
    .send({ code: await inviteCode(partner.token) })
    .expect(200);
  return { you, partner };
}

async function like(token: string, ...names: string[]) {
  for (const name of names) {
    await request(app).post('/api/name').set(auth(token)).send({ name, gender: 'girl' }).expect(201);
  }
}

describe('partner linking', () => {
  test('starts unlinked with a readable invite code', async () => {
    const { token } = await registerUser();

    const res = await request(app).get('/api/partner').set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.partner).toBeNull();
    expect(res.body.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  test("links both accounts with the partner's code, ignoring case", async () => {
    const you = await registerUser('Pat');
    const partner = await registerUser('Sam');
    const code = await inviteCode(partner.token);

    const res = await request(app).post('/api/partner').set(auth(you.token)).send({ code: code.toLowerCase() });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ partner: { name: 'Sam', email: partner.email } });
    const theirs = await request(app).get('/api/partner').set(auth(partner.token));
    expect(theirs.body.partner).toEqual({ name: 'Pat', email: you.email });
  });

  test('rejects a bad code, your own code, and a second partner', async () => {
    const { you } = await linkedPair();
    const loner = await registerUser('Lee');
    const post = (token: string, code: string) => request(app).post('/api/partner').set(auth(token)).send({ code });

    expect((await post(loner.token, 'NOPE00')).status).toBe(400);
    expect((await post(loner.token, await inviteCode(loner.token))).status).toBe(400);
    expect((await post(you.token, await inviteCode(loner.token))).status).toBe(409);
  });

  test('a used code stops working', async () => {
    const you = await registerUser('Pat');
    const partner = await registerUser('Sam');
    const code = await inviteCode(partner.token);
    await request(app).post('/api/partner').set(auth(you.token)).send({ code }).expect(200);
    await request(app).delete('/api/partner').set(auth(you.token)).expect(200);
    const stranger = await registerUser('Lee');

    const res = await request(app).post('/api/partner').set(auth(stranger.token)).send({ code });

    expect(res.status).toBe(400);
  });

  test('unlinking frees both accounts', async () => {
    const { you, partner } = await linkedPair();

    const res = await request(app).delete('/api/partner').set(auth(you.token));

    expect(res.body).toEqual({ partner: null });
    const theirs = await request(app).get('/api/partner').set(auth(partner.token));
    expect(theirs.body.partner).toBeNull();
  });
});

describe('GET /api/partner/matches', () => {
  test('splits favorites into shared and one-sided', async () => {
    const { you, partner } = await linkedPair();
    await like(you.token, 'Hazel', 'Clara');
    await like(partner.token, 'hazel', 'Rose');

    const res = await request(app).get('/api/partner/matches').set(auth(you.token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      partner: { name: 'Sam', email: partner.email },
      shared: true,
      matches: [{ name: 'Hazel', gender: 'girl' }],
      onlyYou: [{ name: 'Clara', gender: 'girl' }],
      onlyPartner: [{ name: 'Rose', gender: 'girl' }],
    });
  });

  test("hides the partner's names when they keep favorites private", async () => {
    const { you, partner } = await linkedPair();
    await like(partner.token, 'Rose');
    await request(app).put('/api/settings').set(auth(partner.token)).send({ favoritesVisibility: 'private' }).expect(200);

    const res = await request(app).get('/api/partner/matches').set(auth(you.token));

    expect(res.body.shared).toBe(false);
    expect(res.body.onlyPartner).toEqual([]);
  });

  test('is 404 without a partner', async () => {
    const { token } = await registerUser();

    expect((await request(app).get('/api/partner/matches').set(auth(token))).status).toBe(404);
  });
});

describe('/api/settings', () => {
  test('defaults to sharing with your partner and saves a new choice', async () => {
    const { token } = await registerUser();

    expect((await request(app).get('/api/settings').set(auth(token))).body).toEqual({ favoritesVisibility: 'partner' });
    await request(app).put('/api/settings').set(auth(token)).send({ favoritesVisibility: 'public' }).expect(200);
    expect((await request(app).get('/api/settings').set(auth(token))).body).toEqual({ favoritesVisibility: 'public' });
  });

  test('rejects an unknown visibility', async () => {
    const { token } = await registerUser();

    const res = await request(app).put('/api/settings').set(auth(token)).send({ favoritesVisibility: 'everyone' });

    expect(res.status).toBe(400);
  });
});
