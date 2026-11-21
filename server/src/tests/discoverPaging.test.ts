import { describe, expect, test } from '@jest/globals';
import request from 'supertest';
import type { BabyName } from 'shared';
import app from '../service.ts';

// Discover's rounds: GET /api/name/list with limit and seed, and the passes that later pages skip.

const GIRLS = ['Hazel', 'Iris', 'Mabel', 'Opal', 'Ruth'];
const BOYS = ['Walter', 'George', 'Otis', 'Silas', 'Amos'];
const ALL = [...GIRLS, ...BOYS];

// The database is shared by every test in this file, so each user gets its own email.
async function registerUser(): Promise<string> {
  const email = `pat-${crypto.randomUUID()}@test.com`;
  const res = await request(app).post('/api/auth').send({ name: 'Pat', email, password: 'secret' }).expect(201);
  return res.body.token;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A user whose own tree (imported from a GEDCOM file) has the ten names above. */
async function userWithTree(): Promise<string> {
  const token = await registerUser();
  const ancestors = [
    ...GIRLS.map((firstName) => ({ firstName, gender: 'Female', degrees: 1 })),
    ...BOYS.map((firstName) => ({ firstName, gender: 'Male', degrees: 2 })),
  ];
  await request(app).post('/api/gedcom').set(auth(token)).send({ fileName: 'family.ged', ancestors }).expect(200);
  return token;
}

async function page(token: string, query: string): Promise<{ names: BabyName[]; remaining: number; total: number }> {
  const res = await request(app).get(`/api/name/list?source=wikitree&${query}`).set(auth(token)).expect(200);
  return res.body;
}

const namesOf = (names: BabyName[]) => names.map((n) => n.name);

function pass(token: string, name: string) {
  return request(app).post('/api/name/passed').set(auth(token)).send({ name });
}

describe('GET /api/name/list with limit and seed', () => {
  test('returns one page and how many names are left', async () => {
    const token = await userWithTree();

    const res = await page(token, 'limit=4&seed=1');

    expect(res.names).toHaveLength(4);
    expect(res.remaining).toBe(10);
    expect(res.total).toBe(10);
    expect(ALL).toEqual(expect.arrayContaining(namesOf(res.names)));
  });

  test('keeps the same order for the same seed', async () => {
    const token = await userWithTree();

    const first = await page(token, 'limit=10&seed=42');
    const again = await page(token, 'limit=10&seed=42');

    expect(namesOf(again.names)).toEqual(namesOf(first.names));
  });

  test('uses a different order for a different seed', async () => {
    const token = await userWithTree();
    const orders = new Set<string>();

    for (const seed of [1, 2, 3, 4, 5]) {
      orders.add(namesOf((await page(token, `limit=10&seed=${seed}`)).names).join());
    }

    expect(orders.size).toBeGreaterThan(1);
  });

  test('filters by gender', async () => {
    const token = await userWithTree();

    const res = await page(token, 'gender=boy&limit=10&seed=1');

    expect(namesOf(res.names).sort()).toEqual([...BOYS].sort());
    expect(res.remaining).toBe(5);
  });

  test('leaves out passed names and favorites, so the next page follows on', async () => {
    const token = await userWithTree();
    const fullOrder = namesOf((await page(token, 'limit=10&seed=7')).names);
    const round1 = await page(token, 'limit=4&seed=7');
    const [liked, ...passed] = namesOf(round1.names);
    await request(app).post('/api/name').set(auth(token)).send({ name: liked }).expect(201);
    for (const name of passed) await pass(token, name).expect(200);

    const round2 = await page(token, 'limit=4&seed=7');

    expect(round2.remaining).toBe(6);
    expect(round2.total).toBe(10);
    expect(namesOf(round1.names)).toEqual(fullOrder.slice(0, 4));
    // Same seed: round 2 is what came after round 1 in the full order.
    expect(namesOf(round2.names)).toEqual(fullOrder.slice(4, 8));
  });

  test('matches swipes whatever the case', async () => {
    const token = await userWithTree();

    await pass(token, 'hazel').expect(200);

    expect(namesOf((await page(token, 'limit=10&seed=1')).names)).not.toContain('Hazel');
  });

  test('is empty once every name has been swiped', async () => {
    const token = await userWithTree();
    for (const name of ALL) await pass(token, name).expect(200);

    expect(await page(token, 'limit=10&seed=1')).toEqual({ names: [], remaining: 0, total: 10 });
  });

  test('pages the sample data without remembering swipes', async () => {
    const token = await registerUser();
    const first = await request(app).get('/api/name/list?source=demo&limit=3&seed=1').set(auth(token)).expect(200);
    await pass(token, first.body.names[0].name).expect(200);

    const again = await request(app).get('/api/name/list?source=demo&limit=3&seed=1').set(auth(token)).expect(200);

    expect(first.body.names).toHaveLength(3);
    expect(again.body).toEqual(first.body);
  });

  test('pages the sample data with offset', async () => {
    const token = await registerUser();
    const list = (offset: number) =>
      request(app).get(`/api/name/list?source=demo&limit=3&seed=9&offset=${offset}`).set(auth(token)).expect(200);

    const [first, second, all] = await Promise.all([
      list(0),
      list(3),
      request(app).get('/api/name/list?source=demo&limit=100&seed=9').set(auth(token)).expect(200),
    ]);

    expect(namesOf(second.body.names)).toEqual(namesOf(all.body.names).slice(3, 6));
    expect(second.body.remaining).toBe(first.body.remaining - 3);
    expect(second.body.total).toBe(all.body.total);
  });

  test('is empty past the end', async () => {
    const token = await userWithTree();

    expect(await page(token, 'limit=10&seed=1&offset=50')).toEqual({ names: [], remaining: 0, total: 10 });
  });

  test('returns the whole list, without remaining, when there is no limit', async () => {
    const token = await userWithTree();
    await pass(token, 'Hazel').expect(200);

    const res = await request(app).get('/api/name/list?source=wikitree').set(auth(token)).expect(200);

    expect(Object.keys(res.body)).toEqual(['names']);
    expect(namesOf(res.body.names).sort()).toEqual([...ALL].sort());
  });

  test.each(['limit=0', 'limit=101', 'limit=abc', 'limit=2.5', 'limit=10&seed=-1', 'limit=10&seed=4294967296', 'limit=10&seed=x', 'limit=10&offset=-1'])(
    'rejects %s',
    async (query) => {
      const token = await userWithTree();

      const res = await request(app).get(`/api/name/list?source=wikitree&${query}`).set(auth(token));

      expect(res.status).toBe(400);
    },
  );
});

describe('POST /api/name/passed', () => {
  test('can pass on the same name twice', async () => {
    const token = await userWithTree();

    await pass(token, 'Hazel').expect(200);
    await pass(token, 'Hazel').expect(200);

    expect((await page(token, 'limit=10&seed=1')).remaining).toBe(9);
  });

  test.each([
    ['no name', {}],
    ['a blank name', { name: '  ' }],
    ['a name that is too long', { name: 'H'.repeat(51) }],
  ])('rejects %s', async (_, body) => {
    const token = await registerUser();

    await request(app).post('/api/name/passed').set(auth(token)).send(body).expect(400);
  });

  test('requires a signed-in user', async () => {
    await request(app).post('/api/name/passed').send({ name: 'Hazel' }).expect(401);
  });
});

describe('DELETE /api/name/passed', () => {
  test('brings passed names back, but not favorites', async () => {
    const token = await userWithTree();
    await pass(token, 'Hazel').expect(200);
    await request(app).post('/api/name').set(auth(token)).send({ name: 'Iris' }).expect(201);

    await request(app).delete('/api/name/passed').set(auth(token)).expect(200);

    const names = namesOf((await page(token, 'limit=10&seed=1')).names);
    expect(names).toContain('Hazel');
    expect(names).not.toContain('Iris');
  });
});
