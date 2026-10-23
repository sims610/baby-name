import { describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../service.ts';
import { listContactMessages } from '../database/database.ts';

// The database is in memory and shared by every test in this file, so each message gets its own email
// and tests look up the message they sent rather than counting the whole list.
function uniqueEmail(): string {
  return `pat-${crypto.randomUUID()}@test.com`;
}

function findMessage(email: string) {
  return listContactMessages().filter((m) => m.email === email);
}

describe('POST /api/contact (send a contact message)', () => {
  test('stores the message without requiring sign-in', async () => {
    const email = uniqueEmail();

    const res = await request(app)
      .post('/api/contact')
      .send({ name: '  Pat  ', email, phone: '123-456-7890', message: 'Love the app!' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'message received' });

    const stored = findMessage(email);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: 'Pat', email, phone: '123-456-7890', message: 'Love the app!' });
    expect(stored[0].userId).toBeUndefined();
  });

  test('treats a blank phone as no phone', async () => {
    const email = uniqueEmail();

    await request(app).post('/api/contact').send({ name: 'Pat', email, phone: '', message: 'Hi' }).expect(201);

    expect(findMessage(email)[0]).not.toHaveProperty('phone');
  });

  test('records who sent it when the sender is signed in', async () => {
    const auth = await request(app)
      .post('/api/auth')
      .send({ name: 'Pat', email: uniqueEmail(), password: 'secret' })
      .expect(201);
    const email = uniqueEmail();

    await request(app)
      .post('/api/contact')
      .set('Authorization', `Bearer ${auth.body.token}`)
      .send({ name: 'Pat', email, message: 'Hi' })
      .expect(201);

    expect(findMessage(email)[0].userId).toBe(auth.body.user.id);
  });

  test.each([
    ['name is missing', { email: 'pat@test.com', message: 'Hi' }],
    ['name is blank', { name: '   ', email: 'pat@test.com', message: 'Hi' }],
    ['email is invalid', { name: 'Pat', email: 'not-an-email', message: 'Hi' }],
    ['message is missing', { name: 'Pat', email: 'pat@test.com' }],
    ['message is too long', { name: 'Pat', email: 'pat@test.com', message: 'x'.repeat(5001) }],
    ['phone is not a string', { name: 'Pat', email: 'pat@test.com', phone: 123, message: 'Hi' }],
  ])('rejects the message when %s', async (_case, body) => {
    const before = listContactMessages().length;

    const res = await request(app).post('/api/contact').send(body);

    expect(res.status).toBe(400);
    expect(typeof res.body.message).toBe('string');
    expect(listContactMessages()).toHaveLength(before);
  });
});
