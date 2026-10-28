import { afterEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import app from '../service.ts';

// The database is in memory and shared by every test in this file, so each user gets its own email.
async function registerUser(): Promise<string> {
  const res = await request(app)
    .post('/api/auth')
    .send({ name: 'Pat', email: `pat-${crypto.randomUUID()}@test.com`, password: 'secret' })
    .expect(201);
  return res.body.token;
}

// Stands in for api.wikitree.com: each call returns the next queued clientLogin response.
function mockWikiTree(...responses: { clientLogin: Record<string, unknown> }[]) {
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  for (const body of responses) {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'wikidb_wtb__session=abc; path=/; secure',
        },
      }),
    );
  }
  return fetchMock;
}

// The latest request sent to WikiTree (jest.spyOn reuses one spy, so earlier calls stay recorded).
function lastRequest(fetchMock: ReturnType<typeof mockWikiTree>): RequestInit {
  return fetchMock.mock.lastCall![1]!;
}

function sentParams(fetchMock: ReturnType<typeof mockWikiTree>): URLSearchParams {
  return lastRequest(fetchMock).body as URLSearchParams;
}

async function connect(token: string) {
  mockWikiTree({ clientLogin: { result: 'Success', userid: 42, username: 'Smith-1' } });
  await request(app)
    .post('/api/wikitree/login')
    .set('Authorization', `Bearer ${token}`)
    .send({ authcode: 'code123' })
    .expect(200);
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/wikitree/login', () => {
  test('confirms the authcode with WikiTree and returns the member', async () => {
    const token = await registerUser();
    const fetchMock = mockWikiTree({ clientLogin: { result: 'Success', userid: 42, username: 'Smith-1' } });

    const res = await request(app)
      .post('/api/wikitree/login')
      .set('Authorization', `Bearer ${token}`)
      .send({ authcode: 'code123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: { userId: 42, userName: 'Smith-1' } });
    expect(sentParams(fetchMock).get('authcode')).toBe('code123');
  });

  test('rejects an authcode WikiTree does not accept', async () => {
    const token = await registerUser();
    mockWikiTree({ clientLogin: { result: 'Error' } });

    const res = await request(app)
      .post('/api/wikitree/login')
      .set('Authorization', `Bearer ${token}`)
      .send({ authcode: 'bogus' });

    expect(res.status).toBe(400);
  });

  test('requires an authcode', async () => {
    const token = await registerUser();

    const res = await request(app).post('/api/wikitree/login').set('Authorization', `Bearer ${token}`).send({});

    expect(res.status).toBe(400);
  });

  test('requires a signed-in user', async () => {
    const res = await request(app).post('/api/wikitree/login').send({ authcode: 'code123' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/wikitree/session', () => {
  test('returns null before connecting', async () => {
    const token = await registerUser();

    const res = await request(app).get('/api/wikitree/session').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  test('returns the member while WikiTree says they are signed in', async () => {
    const token = await registerUser();
    await connect(token);
    const fetchMock = mockWikiTree({ clientLogin: { result: 'ok' } });

    const res = await request(app).get('/api/wikitree/session').set('Authorization', `Bearer ${token}`);

    expect(res.body).toEqual({ user: { userId: 42, userName: 'Smith-1' } });
    expect(sentParams(fetchMock).get('checkLogin')).toBe('42');
    expect(lastRequest(fetchMock).headers).toEqual({ Cookie: 'wikidb_wtb__session=abc' });
  });

  test('forgets the member once WikiTree says they signed out', async () => {
    const token = await registerUser();
    await connect(token);
    mockWikiTree({ clientLogin: { result: 'error' } });

    const res = await request(app).get('/api/wikitree/session').set('Authorization', `Bearer ${token}`);

    expect(res.body).toEqual({ user: null });
  });
});

describe('DELETE /api/wikitree/session', () => {
  test('signs out of WikiTree and forgets the member', async () => {
    const token = await registerUser();
    await connect(token);
    const fetchMock = mockWikiTree({ clientLogin: { result: 'ok' } });

    const res = await request(app).delete('/api/wikitree/session').set('Authorization', `Bearer ${token}`);

    expect(res.body).toEqual({ user: null });
    expect(sentParams(fetchMock).get('doLogout')).toBe('1');
    const after = await request(app).get('/api/wikitree/session').set('Authorization', `Bearer ${token}`);
    expect(after.body).toEqual({ user: null });
  });
});
