import { afterEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import type { BabyName, GedcomAncestor } from 'shared';
import app from '../service.ts';

// The database is shared by every test in this file, so each user gets its own email.
async function registerUser(name = 'Pat'): Promise<string> {
  const email = `${name.toLowerCase()}-${crypto.randomUUID()}@test.com`;
  const res = await request(app).post('/api/auth').send({ name, email, password: 'secret' }).expect(201);
  return res.body.token;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const ancestors: GedcomAncestor[] = [
  { firstName: 'Hazel', lastName: 'Smith', gender: 'Female', birthDate: '1902', degrees: 2 },
  { firstName: 'Walter James', lastName: 'Smith', gender: 'Male', degrees: 2 },
  { firstName: 'Unknown', gender: 'Female', degrees: 3 },
];

function importTree(token: string, body: object = { fileName: 'family.ged', ancestors }) {
  return request(app).post('/api/gedcom').set(auth(token)).send(body);
}

async function listNames(token: string): Promise<BabyName[]> {
  const res = await request(app).get('/api/name/list?source=wikitree').set(auth(token)).expect(200);
  return res.body.names;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/gedcom', () => {
  test('saves the usable first names as the family tree', async () => {
    const token = await registerUser();

    const res = await importTree(token).expect(200);

    expect(res.body.import).toEqual({ fileName: 'family.ged', nameCount: 2, importedAt: expect.any(Number) });
    const names = await listNames(token);
    expect(names.map((n) => n.name).sort()).toEqual(['Hazel', 'Walter']);
  });

  test('gives the ancestor behind each name', async () => {
    const token = await registerUser();
    await importTree(token).expect(200);

    const res = await request(app).get('/api/name/roots/Hazel?source=wikitree').set(auth(token)).expect(200);

    expect(res.body.roots).toEqual([{ fullName: 'Hazel Smith', relation: 'grandmother', birthYear: 1902 }]);
  });

  test('replaces an earlier import', async () => {
    const token = await registerUser();
    await importTree(token).expect(200);

    await importTree(token, { fileName: 'other.ged', ancestors: [{ firstName: 'Iris', gender: 'Female', degrees: 1 }] }).expect(
      200,
    );

    expect((await listNames(token)).map((n) => n.name)).toEqual(['Iris']);
    const res = await request(app).get('/api/gedcom').set(auth(token)).expect(200);
    expect(res.body.import.fileName).toBe('other.ged');
  });

  test('replaces a WikiTree sign-in', async () => {
    const token = await registerUser();
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({ clientLogin: { result: 'Success', userid: 42, username: 'Smith-1' } }),
    );
    await request(app).post('/api/wikitree/login').set(auth(token)).send({ authcode: 'code123' }).expect(200);

    await importTree(token).expect(200);

    const session = await request(app).get('/api/wikitree/session').set(auth(token)).expect(200);
    expect(session.body).toEqual({ user: null });
    expect((await listNames(token)).length).toBe(2);
  });

  test('is replaced by a WikiTree sign-in', async () => {
    const token = await registerUser();
    await importTree(token).expect(200);
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({ clientLogin: { result: 'Success', userid: 42, username: 'Smith-1' } }),
    );

    await request(app).post('/api/wikitree/login').set(auth(token)).send({ authcode: 'code123' }).expect(200);

    const res = await request(app).get('/api/gedcom').set(auth(token)).expect(200);
    expect(res.body).toEqual({ import: null });
  });

  test('accepts a tree larger than the usual 10kb body limit', async () => {
    const token = await registerUser();
    const big = Array.from({ length: 2000 }, (_, i) => ({
      firstName: i % 2 ? 'Hazel' : 'Walter',
      lastName: 'Smithington-Whitaker',
      gender: i % 2 ? 'Female' : 'Male',
      birthDate: '1850',
      degrees: 1 + (i % 10),
    }));

    const res = await importTree(token, { fileName: 'big.ged', ancestors: big }).expect(200);

    expect(res.body.import.nameCount).toBe(2);
  });

  test.each([
    ['no file name', { ancestors }],
    ['a blank file name', { fileName: '  ', ancestors }],
    ['no ancestors', { fileName: 'family.ged' }],
    ['a generation of 0', { fileName: 'f.ged', ancestors: [{ firstName: 'Hazel', gender: 'Female', degrees: 0 }] }],
    ['a generation past 10', { fileName: 'f.ged', ancestors: [{ firstName: 'Hazel', gender: 'Female', degrees: 11 }] }],
    ['an unknown gender', { fileName: 'f.ged', ancestors: [{ firstName: 'Hazel', gender: 'X', degrees: 1 }] }],
    ['a name that is too long', { fileName: 'f.ged', ancestors: [{ firstName: 'H'.repeat(101), degrees: 1 }] }],
    ['too many ancestors', { fileName: 'f.ged', ancestors: Array.from({ length: 3001 }, () => ({ degrees: 1 })) }],
    ['no usable names', { fileName: 'f.ged', ancestors: [{ firstName: 'Unknown', gender: 'Female', degrees: 1 }] }],
  ])('rejects %s', async (_, body) => {
    const token = await registerUser();

    const res = await importTree(token, body);

    expect(res.status).toBe(400);
    const imported = await request(app).get('/api/gedcom').set(auth(token)).expect(200);
    expect(imported.body).toEqual({ import: null });
  });

  test('requires a signed-in user', async () => {
    await request(app).post('/api/gedcom').send({ fileName: 'family.ged', ancestors }).expect(401);
  });
});

describe('GET /api/gedcom', () => {
  test('is null before an import', async () => {
    const token = await registerUser();

    const res = await request(app).get('/api/gedcom').set(auth(token)).expect(200);

    expect(res.body).toEqual({ import: null });
  });
});

describe('DELETE /api/gedcom', () => {
  test('removes the import and its names', async () => {
    const token = await registerUser();
    await importTree(token).expect(200);

    await request(app).delete('/api/gedcom').set(auth(token)).expect(200, { import: null });

    expect((await request(app).get('/api/gedcom').set(auth(token))).body).toEqual({ import: null });
    await request(app).get('/api/name/list?source=wikitree').set(auth(token)).expect(403);
  });
});

describe('with a linked partner', () => {
  test("mixes the partner's imported names in, marked as theirs", async () => {
    const you = await registerUser('Pat');
    const partner = await registerUser('Sam');
    const invite = await request(app).get('/api/partner').set(auth(partner)).expect(200);
    await request(app).post('/api/partner').set(auth(you)).send({ code: invite.body.inviteCode }).expect(200);
    await importTree(partner, {
      fileName: 'sam.ged',
      ancestors: [{ firstName: 'Iris', gender: 'Female', degrees: 1 }],
    }).expect(200);
    await importTree(you).expect(200);

    const names = await listNames(you);

    expect(names.find((n) => n.name === 'Iris')?.tree).toBe('partner');
    expect(names.find((n) => n.name === 'Hazel')?.tree).toBeUndefined();
  });
});
