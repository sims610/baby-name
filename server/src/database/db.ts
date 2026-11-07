import mysql from 'mysql2/promise';
import type { Pool, PoolOptions } from 'mysql2/promise';

// Persistent storage for everything the app saves, in MySQL.
//
// Locally, MySQL runs in Docker (`docker compose up -d` from the repo root) and
// DATABASE_URL in server/.env points at it. On AWS it points at the RDS instance;
// set DATABASE_SSL=true there so the connection is encrypted.
//
// Tests never touch the app's data: each Jest worker gets its own database
// (littleroots_test_1, littleroots_test_2, ...) on TEST_DATABASE_URL's server.

// Matches compose.yaml, so a fresh clone works without a .env file.
const LOCAL_SERVER_URL = 'mysql://littleroots:devpass@localhost:3306';
const isTest = process.env.NODE_ENV === 'test';

function connectionOptions(): PoolOptions {
  if (isTest) {
    const url = new URL(process.env.TEST_DATABASE_URL ?? LOCAL_SERVER_URL);
    url.pathname = `/littleroots_test_${process.env.JEST_WORKER_ID ?? '1'}`;
    return { uri: url.toString() };
  }
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is not set');
    }
    return { uri: `${LOCAL_SERVER_URL}/littleroots` };
  }
  // RDS certificates aren't in Node's default trust list; mysql2 includes them in this profile.
  return { uri, ...(process.env.DATABASE_SSL === 'true' ? { ssl: 'Amazon RDS' } : {}) };
}

const options = connectionOptions();

export const db: Pool = mysql.createPool({ ...options, connectionLimit: 10 });

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id            CHAR(36)     NOT NULL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(254) COLLATE utf8mb4_bin NOT NULL UNIQUE, -- stored lowercased; binary so accents stay distinct
    password_hash VARCHAR(255) NOT NULL,
    created_at    BIGINT       NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // Only a SHA-256 hash of each token is kept. Deleting a user deletes their sessions.
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id    CHAR(36) NOT NULL,
    expires_at BIGINT   NOT NULL,
    INDEX sessions_user_id (user_id),
    INDEX sessions_expires_at (expires_at),
    CONSTRAINT sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // One-time "forgot password" links. Like sessions, only a hash of the token is kept.
  `CREATE TABLE IF NOT EXISTS password_resets (
    token_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id    CHAR(36) NOT NULL,
    expires_at BIGINT   NOT NULL,
    INDEX password_resets_user_id (user_id),
    CONSTRAINT password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // Saved names, oldest first (by id). The name is unique per user ignoring case
  // (as_ci: "zoe" and "Zoe" are the same, "Zoë" is not). shortlist_rank is 1-3 for
  // the user's top picks and NULL otherwise, so removing a favorite also frees its spot.
  `CREATE TABLE IF NOT EXISTS favorites (
    id             BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id        CHAR(36)     NOT NULL,
    name           VARCHAR(50)  COLLATE utf8mb4_0900_as_ci NOT NULL,
    gender         ENUM('boy', 'girl') NULL,
    shortlist_rank TINYINT      NULL,
    UNIQUE KEY favorites_user_name (user_id, name),
    UNIQUE KEY favorites_user_rank (user_id, shortlist_rank),
    CONSTRAINT favorites_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // One row per side of a link, so each user finds their partner by primary key.
  // The UNIQUE partner_id means nobody can be linked to two people.
  `CREATE TABLE IF NOT EXISTS partners (
    user_id    CHAR(36) NOT NULL PRIMARY KEY,
    partner_id CHAR(36) NOT NULL UNIQUE,
    CONSTRAINT partners_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT partners_partner FOREIGN KEY (partner_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // The code a user shares so their partner can link to them. Deleted once used.
  `CREATE TABLE IF NOT EXISTS invite_codes (
    code    CHAR(6)  COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL UNIQUE,
    CONSTRAINT invite_codes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // Per-user settings. No row means the defaults.
  `CREATE TABLE IF NOT EXISTS user_settings (
    user_id              CHAR(36) NOT NULL PRIMARY KEY,
    favorites_visibility ENUM('private', 'partner', 'public') NOT NULL DEFAULT 'partner',
    CONSTRAINT user_settings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // The user's WikiTree sign-in (the cookies are a credential: server-side only)
  // and the names last pulled from their tree, cached for an hour.
  `CREATE TABLE IF NOT EXISTS wikitree_sessions (
    user_id           CHAR(36)     NOT NULL PRIMARY KEY,
    wikitree_user_id  INT          NOT NULL,
    wikitree_username VARCHAR(255) NOT NULL,
    cookies           TEXT         NOT NULL,
    names             JSON         NULL,
    names_fetched_at  BIGINT       NULL,
    CONSTRAINT wikitree_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,

  // Messages from the Contact form. Kept if the sender's account is deleted.
  `CREATE TABLE IF NOT EXISTS contact_messages (
    id          CHAR(36)      NOT NULL PRIMARY KEY,
    user_id     CHAR(36)      NULL,
    name        VARCHAR(100)  NOT NULL,
    email       VARCHAR(254)  NOT NULL,
    phone       VARCHAR(30)   NULL,
    message     VARCHAR(5000) NOT NULL,
    received_at BIGINT        NOT NULL,
    INDEX contact_messages_received_at (received_at),
    CONSTRAINT contact_messages_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
];

/**
 * Creates the database and its tables if they don't exist yet, so a first run on
 * an empty server works. Call once before serving requests.
 */
export async function initDatabase(): Promise<void> {
  const url = new URL(options.uri!);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database) {
    throw new Error('The database URL must end with a database name, like .../littleroots');
  }
  // Connect without choosing a database, since it may not exist yet.
  url.pathname = '/';
  const admin = await mysql.createConnection({ ...options, uri: url.toString() });
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS ${admin.escapeId(database)}`);
  } finally {
    await admin.end();
  }
  for (const statement of SCHEMA) {
    await db.query(statement);
  }
}

/** Empties every table. Tests only: refuses to run against the app's database. */
export async function resetDatabase(): Promise<void> {
  if (!isTest) {
    throw new Error('resetDatabase is only for tests');
  }
  // Deleting users cascades to every table that belongs to a user.
  await db.query('DELETE FROM contact_messages');
  await db.query('DELETE FROM users');
}

/** Closes the connection pool (tests, and graceful shutdown). */
export async function closeDatabase(): Promise<void> {
  await db.end();
}
