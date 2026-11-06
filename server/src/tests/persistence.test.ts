import { afterAll, describe, expect, jest, test } from '@jest/globals';
import type { RowDataPacket } from 'mysql2/promise';
import { db } from '../database/db.ts';

type Database = typeof import('../database/database.ts');
type Connection = typeof import('../database/db.ts');

// Every "server" started during the tests, so each connection pool can be closed at the end.
const connections: Connection[] = [];

/** Loads the database modules from scratch, with a new connection pool, the way a server restart would. */
async function startServer(): Promise<Database> {
  let database!: Database;
  let connection!: Connection;
  jest.isolateModules(() => {
    // isolateModules needs a synchronous load, which only require() provides.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    database = require('../database/database.ts');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    connection = require('../database/db.ts');
  });
  connections.push(connection);
  await connection.initDatabase();
  return database;
}

afterAll(async () => {
  await Promise.all(connections.map((connection) => connection.closeDatabase()));
});

describe('persisted accounts and sessions', () => {
  test('an account and its session survive a restart', async () => {
    const first = await startServer();
    const user = await first.addUser('Pat', 'Pat@Test.com', 'secret123');
    expect(user).not.toBeNull();
    const token = await first.createSession(user!.id);

    const second = await startServer();
    expect(await second.verifyUser('pat@test.com', 'secret123')).toEqual(user);
    expect(await second.getUserByToken(token)).toEqual(user);
    expect(await second.addUser('Pat Again', 'pat@test.com', 'other')).toBeNull();
  });

  test('a logged-out session stays logged out after a restart', async () => {
    const first = await startServer();
    const user = await first.addUser('Sam', 'sam@test.com', 'secret123');
    const token = await first.createSession(user!.id);
    await first.deleteSession(token);

    expect(await (await startServer()).getUserByToken(token)).toBeNull();
  });

  test('passwords and session tokens are never stored in plain text', async () => {
    const database = await startServer();
    const user = await database.addUser('Lee', 'lee@test.com', 'secret123');
    const token = await database.createSession(user!.id);

    const [users] = await db.execute<RowDataPacket[]>('SELECT password_hash FROM users WHERE id = ?', [user!.id]);
    const [sessions] = await db.execute<RowDataPacket[]>('SELECT token_hash FROM sessions WHERE user_id = ?', [
      user!.id,
    ]);

    expect(users[0].password_hash).not.toContain('secret123');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].token_hash).not.toBe(token);
  });

  test('two sign-ups with the same email at once create one account', async () => {
    const database = await startServer();
    const results = await Promise.all([
      database.addUser('Kim', 'kim@test.com', 'secret123'),
      database.addUser('Kim', 'KIM@test.com', 'secret123'),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  test('favorites, top picks, partners, settings, WikiTree and contact messages survive a restart', async () => {
    const first = await startServer();
    const you = await first.addUser('Rae', 'rae@test.com', 'secret123');
    const partner = await first.addUser('Max', 'max@test.com', 'secret123');
    await first.addFavorite(you!.id, { name: 'Hazel', gender: 'girl' });
    await first.addFavorite(you!.id, { name: 'Ezra' });
    await first.addFavorite(partner!.id, { name: 'hazel', gender: 'girl' });
    expect(await first.setShortlist(you!.id, ['ezra', 'Hazel'])).toEqual(['Ezra', 'Hazel']);
    await first.linkPartner(you!.id, await first.getInviteCode(partner!.id));
    await first.setVisibility(you!.id, 'private');
    await first.setWikiTreeSession(you!.id, { userId: 42, userName: 'Rae-1', cookies: 'session=abc' });
    await first.setWikiTreeNames(you!.id, [{ name: 'Ada', gender: 'girl' }]);
    await first.addContactMessage({ name: 'Rae', email: 'rae@test.com', message: 'Hello' }, you!.id);

    const second = await startServer();
    expect(await second.listFavorites(you!.id)).toEqual([{ name: 'Hazel', gender: 'girl' }, { name: 'Ezra' }]);
    expect(await second.getShortlist(you!.id)).toEqual(['Ezra', 'Hazel']);
    expect(await second.getPartner(you!.id)).toEqual({ name: 'Max', email: 'max@test.com' });
    expect(await second.getPartner(partner!.id)).toEqual({ name: 'Rae', email: 'rae@test.com' });
    expect(await second.getVisibility(you!.id)).toBe('private');
    expect(await second.getWikiTreeSession(you!.id)).toEqual({ userId: 42, userName: 'Rae-1', cookies: 'session=abc' });
    expect(await second.getWikiTreeNames(you!.id)).toEqual([{ name: 'Ada', gender: 'girl' }]);
    expect(await second.listContactMessages()).toEqual([
      expect.objectContaining({ name: 'Rae', email: 'rae@test.com', message: 'Hello', userId: you!.id }),
    ]);

    // Your favorites are private, so your partner sees no matches.
    expect(await second.comparePartnerFavorites(partner!.id)).toMatchObject({ shared: false, matches: [] });
    // Removing a favorite also frees its top-pick spot.
    await second.removeFavorite(you!.id, 'EZRA');
    expect(await second.getShortlist(you!.id)).toEqual(['Hazel']);
  });

  test('an invite code links only one partner, even when used twice at the same time', async () => {
    const database = await startServer();
    const owner = await database.addUser('Ola', 'ola@test.com', 'secret123');
    const a = await database.addUser('Ana', 'ana@test.com', 'secret123');
    const b = await database.addUser('Ben', 'ben@test.com', 'secret123');
    const code = await database.getInviteCode(owner!.id);

    const results = await Promise.all([database.linkPartner(a!.id, code), database.linkPartner(b!.id, code)]);

    expect(results.filter((r) => 'partner' in r)).toHaveLength(1);
  });

  test('a reset link works only once, even when used twice at the same time', async () => {
    const database = await startServer();
    const user = await database.addUser('Ash', 'ash@test.com', 'secret123');
    const token = await database.createPasswordResetToken(user!.id);

    const results = await Promise.all([
      database.consumePasswordResetToken(token),
      database.consumePasswordResetToken(token),
    ]);

    expect(results.filter(Boolean)).toEqual([user!.id]);
  });
});
