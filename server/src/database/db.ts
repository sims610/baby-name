import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Persistent storage for accounts and sessions, using Node's built-in SQLite.
//
// The database is a single file, `server/data/littleroots.db` by default (the
// server runs from the `server` folder). Set DB_PATH to use another file, or
// ":memory:" for a throwaway database. Tests always get a fresh in-memory one,
// so they never touch real data.
const DB_PATH =
  process.env.DB_PATH ??
  (process.env.NODE_ENV === 'test' ? ':memory:' : path.resolve(process.cwd(), 'data', 'littleroots.db'));

if (DB_PATH !== ':memory:') {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

// WAL lets reads continue while a write is in progress; foreign keys make
// deleting a user also delete their sessions.
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);

  -- One-time "forgot password" links. Like sessions, only a hash of the token is kept.
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS password_resets_user_id ON password_resets(user_id);
`);
