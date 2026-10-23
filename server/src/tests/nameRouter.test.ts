import { describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../service.ts';
import { fakeAncestry } from '../database/fakeData.ts';
import { nameInfo } from '../database/nameInfo.ts';

// Names the endpoint can return: first names of the ancestors, skipping the user themself (ascendancy number 1).
const ancestors = fakeAncestry.persons.filter((p) => p.display.ascendancyNumber !== '1');
const firstName = (fullName: string) => fullName.split(' ')[0];
const boyNames = ancestors.filter((p) => p.display.gender === 'Male').map((p) => firstName(p.display.name));
const girlNames = ancestors.filter((p) => p.display.gender === 'Female').map((p) => firstName(p.display.name));

// The name is random, so each test asks several times instead of trusting a single pick.
const TRIES = 20;

// The database is in memory and shared by every test in this file, so each user gets its own email.
async function registerUser(): Promise<string> {
  const res = await request(app)
    .post('/api/auth')
    .send({ name: 'Pat', email: `pat-${crypto.randomUUID()}@test.com`, password: 'secret' })
    .expect(201);
  return res.body.token;
}

describe('GET /api/name (generate a name)', () => {
  test('returns a boy name when gender=boy', async () => {
    const token = await registerUser();

    for (let i = 0; i < TRIES; i++) {
      const res = await request(app).get('/api/name?gender=boy').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.gender).toBe('boy');
      expect(boyNames).toContain(res.body.name);
    }
  });

  test('returns a girl name when gender=girl', async () => {
    const token = await registerUser();

    for (let i = 0; i < TRIES; i++) {
      const res = await request(app).get('/api/name?gender=girl').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.gender).toBe('girl');
      expect(girlNames).toContain(res.body.name);
    }
  });

  test('includes the origin and meaning of the name', async () => {
    const token = await registerUser();

    const res = await request(app).get('/api/name').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      name: res.body.name,
      gender: res.body.gender,
      ...nameInfo[res.body.name],
    });
  });
});

describe('GET /api/name/list (list names)', () => {
  test('returns every girl name once when gender=girl', async () => {
    const token = await registerUser();

    const res = await request(app).get('/api/name/list?gender=girl').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.names.map((n: { name: string }) => n.name).sort()).toEqual([...new Set(girlNames)].sort());
    for (const n of res.body.names) {
      expect(n).toEqual({ name: n.name, gender: 'girl', ...nameInfo[n.name] });
    }
  });

  test('returns boys and girls when gender is omitted', async () => {
    const token = await registerUser();

    const res = await request(app).get('/api/name/list').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.names).toHaveLength(new Set([...boyNames, ...girlNames]).size);
  });

  test('rejects an unknown gender', async () => {
    const token = await registerUser();

    const res = await request(app).get('/api/name/list?gender=other').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('POST /api/name (save a favorite)', () => {
  test('saves the name to the user\'s favorites', async () => {
    const token = await registerUser();

    const res = await request(app)
      .post('/api/name')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hazel', gender: 'girl' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ favorites: [{ name: 'Hazel', gender: 'girl' }] });

    // Confirm it was stored, not just echoed back.
    const list = await request(app).get('/api/name/favorites').set('Authorization', `Bearer ${token}`);
    expect(list.body).toEqual({ favorites: [{ name: 'Hazel', gender: 'girl' }] });
  });

  test('rejects a name that is already in the user\'s favorites', async () => {
    const token = await registerUser();
    await request(app)
      .post('/api/name')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hazel', gender: 'girl' })
      .expect(201);

    const res = await request(app)
      .post('/api/name')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hazel', gender: 'girl' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'name already in favorites' });

    // The duplicate must not have been added.
    const list = await request(app).get('/api/name/favorites').set('Authorization', `Bearer ${token}`);
    expect(list.body).toEqual({ favorites: [{ name: 'Hazel', gender: 'girl' }] });
  });
});

describe('GET /api/name/favorites (list favorites)', () => {
  test('returns only the signed-in user\'s favorites', async () => {
    const alice = await registerUser();
    const bob = await registerUser();
    const save = (token: string, favorite: { name: string; gender: string }) =>
      request(app).post('/api/name').set('Authorization', `Bearer ${token}`).send(favorite).expect(201);

    await save(alice, { name: 'Hazel', gender: 'girl' });
    await save(bob, { name: 'Clara', gender: 'girl' });
    await save(alice, { name: 'Oliver', gender: 'boy' });

    const aliceList = await request(app).get('/api/name/favorites').set('Authorization', `Bearer ${alice}`);
    const bobList = await request(app).get('/api/name/favorites').set('Authorization', `Bearer ${bob}`);

    expect(aliceList.status).toBe(200);
    expect(aliceList.body).toEqual({
      favorites: [
        { name: 'Hazel', gender: 'girl' },
        { name: 'Oliver', gender: 'boy' },
      ],
    });
    expect(bobList.status).toBe(200);
    expect(bobList.body).toEqual({ favorites: [{ name: 'Clara', gender: 'girl' }] });
  });
});
