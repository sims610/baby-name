import { afterAll, afterEach, beforeAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../service.ts';
import { flushPushes, setPushTransport, SubscriptionGoneError } from '../push.ts';
import type { PushPayload } from '../push.ts';
import { listPushSubscriptions } from '../database/database.ts';
import type { StoredPushSubscription } from '../database/database.ts';

// Pushes are captured here instead of being sent.
const sent: { subscription: StoredPushSubscription; payload: PushPayload }[] = [];
// Endpoints the fake push service says no longer exist.
const gone = new Set<string>();

beforeAll(() =>
  setPushTransport(async (subscription, payload) => {
    if (gone.has(subscription.endpoint)) {
      throw new SubscriptionGoneError('410 Gone');
    }
    sent.push({ subscription, payload });
  }),
);
afterAll(() => setPushTransport(null));
afterEach(() => {
  sent.length = 0;
  gone.clear();
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function registerUser(name: string): Promise<{ token: string; id: string }> {
  const email = `${name.toLowerCase()}-${crypto.randomUUID()}@test.com`;
  const res = await request(app).post('/api/auth').send({ name, email, password: 'secret' }).expect(201);
  return { token: res.body.token, id: res.body.user.id };
}

async function linkedPair() {
  const you = await registerUser('Pat');
  const partner = await registerUser('Sam');
  const { body } = await request(app).get('/api/partner').set(auth(partner.token)).expect(200);
  await request(app).post('/api/partner').set(auth(you.token)).send({ code: body.inviteCode }).expect(200);
  return { you, partner };
}

function fakeSubscription() {
  return {
    endpoint: `https://push.example.com/send/${crypto.randomUUID()}`,
    keys: { p256dh: 'BPublicKey', auth: 'authSecret' },
  };
}

async function subscribe(token: string, subscription = fakeSubscription()) {
  await request(app).post('/api/push/subscribe').set(auth(token)).send(subscription).expect(201);
  return subscription;
}

async function like(token: string, name: string) {
  await request(app).post('/api/name').set(auth(token)).send({ name, gender: 'girl' }).expect(201);
  await flushPushes();
}

describe('push subscriptions', () => {
  test('gives out the public key without signing in', async () => {
    const res = await request(app).get('/api/push/public-key');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('publicKey');
  });

  test('needs a sign-in to subscribe or unsubscribe', async () => {
    await request(app).post('/api/push/subscribe').send(fakeSubscription()).expect(401);
    await request(app).delete('/api/push/subscribe').send({ endpoint: 'https://push.example.com/x' }).expect(401);
  });

  test('rejects something that is not a push subscription', async () => {
    const { token } = await registerUser('Pat');

    for (const body of [{}, { endpoint: 'https://push.example.com/x' }, { ...fakeSubscription(), endpoint: 'http://insecure' }]) {
      await request(app).post('/api/push/subscribe').set(auth(token)).send(body).expect(400);
    }
  });

  test('saves a subscription and forgets it again', async () => {
    const { token, id } = await registerUser('Pat');
    const subscription = await subscribe(token);

    expect(await listPushSubscriptions(id)).toEqual([subscription]);

    await request(app).delete('/api/push/subscribe').set(auth(token)).send({ endpoint: subscription.endpoint }).expect(200);
    expect(await listPushSubscriptions(id)).toEqual([]);
  });

  test('moves a browser to whoever subscribed it last', async () => {
    const first = await registerUser('Pat');
    const second = await registerUser('Sam');
    const subscription = await subscribe(first.token);

    await subscribe(second.token, subscription);

    expect(await listPushSubscriptions(first.id)).toEqual([]);
    expect(await listPushSubscriptions(second.id)).toEqual([subscription]);
  });

  test("can't unsubscribe someone else's browser", async () => {
    const owner = await registerUser('Pat');
    const other = await registerUser('Sam');
    const subscription = await subscribe(owner.token);

    await request(app).delete('/api/push/subscribe').set(auth(other.token)).send({ endpoint: subscription.endpoint }).expect(200);

    expect(await listPushSubscriptions(owner.id)).toEqual([subscription]);
  });
});

describe('match notifications', () => {
  test('tells you when your partner likes a name you already liked', async () => {
    const { you, partner } = await linkedPair();
    const subscription = await subscribe(you.token);
    await like(you.token, 'Olivia');
    expect(sent).toEqual([]);

    await like(partner.token, 'olivia');

    expect(sent).toEqual([
      {
        subscription,
        payload: { title: "It's a match! 💚", body: 'Sam also loves olivia.', url: '/matches', tag: 'match-olivia' },
      },
    ]);
  });

  test('sends to every browser you subscribed', async () => {
    const { you, partner } = await linkedPair();
    await subscribe(you.token);
    await subscribe(you.token);
    await like(you.token, 'Ava');

    await like(partner.token, 'Ava');

    expect(sent).toHaveLength(2);
  });

  test('stays quiet for names that are not a match, or without a partner', async () => {
    const { you, partner } = await linkedPair();
    await subscribe(you.token);
    await like(you.token, 'Mia');
    await like(partner.token, 'Luna');

    const loner = await registerUser('Lee');
    await subscribe(loner.token);
    await like(loner.token, 'Mia');

    expect(sent).toEqual([]);
  });

  test("doesn't reveal a partner's likes when their favorites are private", async () => {
    const { you, partner } = await linkedPair();
    await subscribe(you.token);
    await like(you.token, 'Ella');
    await request(app).put('/api/settings').set(auth(partner.token)).send({ favoritesVisibility: 'private' }).expect(200);

    await like(partner.token, 'Ella');

    expect(sent).toEqual([]);
  });

  test('forgets a browser that the push service says is gone', async () => {
    const { you, partner } = await linkedPair();
    const stale = await subscribe(you.token);
    const fresh = await subscribe(you.token);
    gone.add(stale.endpoint);
    await like(you.token, 'Nora');

    await like(partner.token, 'Nora');

    expect(sent.map((push) => push.subscription)).toEqual([fresh]);
    expect(await listPushSubscriptions(you.id)).toEqual([fresh]);
  });
});
