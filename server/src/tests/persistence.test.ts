import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';

type Database = typeof import('../database/database.ts');
type Connection = typeof import('../database/db.ts');

let dir: string;
let dbPath: string;
// Every "server" opened during the tests, so each connection can be closed at the end.
const connections: Connection[] = [];

/** Loads the database module from scratch, the way a server restart would. */
function startServer(): Database {
  let database!: Database;
  jest.isolateModules(() => {
    // isolateModules needs a synchronous load, which only require() provides.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    database = require('../database/database.ts');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    connections.push(require('../database/db.ts'));
  });
  return database;
}

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'littleroots-db-'));
  dbPath = path.join(dir, 'test.db');
  process.env.DB_PATH = dbPath;
});

afterAll(() => {
  // Windows can't delete a database file that is still open.
  connections.forEach(({ db }) => db.close());
  delete process.env.DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe('persisted accounts and sessions', () => {
  test('an account and its session survive a restart', async () => {
    const first = startServer();
    const user = await first.addUser('Pat', 'Pat@Test.com', 'secret123');
    expect(user).not.toBeNull();
    const token = first.createSession(user!.id);

    const second = startServer();
    expect(await second.verifyUser('pat@test.com', 'secret123')).toEqual(user);
    expect(second.getUserByToken(token)).toEqual(user);
    expect(await second.addUser('Pat Again', 'pat@test.com', 'other')).toBeNull();
  });

  test('a logged-out session stays logged out after a restart', async () => {
    const first = startServer();
    const user = await first.addUser('Sam', 'sam@test.com', 'secret123');
    const token = first.createSession(user!.id);
    first.deleteSession(token);

    expect(startServer().getUserByToken(token)).toBeNull();
  });

  test('passwords and session tokens are never stored in plain text', async () => {
    const database = startServer();
    const user = await database.addUser('Lee', 'lee@test.com', 'secret123');
    const token = database.createSession(user!.id);

    const raw = new DatabaseSync(dbPath);
    const row = raw.prepare('SELECT password_hash FROM users WHERE id = ?').get(user!.id) as { password_hash: string };
    const sessions = raw.prepare('SELECT token_hash FROM sessions WHERE user_id = ?').all(user!.id) as {
      token_hash: string;
    }[];
    raw.close();

    expect(row.password_hash).not.toContain('secret123');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].token_hash).not.toBe(token);
  });
});
