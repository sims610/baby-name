import { afterAll, beforeAll } from '@jest/globals';
import { closeDatabase, initDatabase, resetDatabase } from '../database/db.ts';

// Runs around every test file (see "setupFilesAfterEnv" in package.json).
// Each Jest worker has its own MySQL database, emptied before each file, so files
// can run in parallel and a file never sees another file's users.
// Needs MySQL running: `docker compose up -d` from the repo root.
beforeAll(async () => {
  await initDatabase();
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});
