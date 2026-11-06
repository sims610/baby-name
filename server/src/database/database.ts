import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type {
  BabyName,
  ContactMessageInput,
  FavoriteName,
  FavoritesVisibility,
  NameGender,
  NameInfo,
  Partner,
  PartnerMatches,
  User,
} from 'shared';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { db } from './db.ts';
import { nameInfo } from './nameInfo.ts';
import type { NameCandidate } from '../names.ts';
import type { WikiTreeSession } from '../wikitree.ts';

// ---- Accounts and sessions (persisted in MySQL, see db.ts) ----

interface UserRow extends RowDataPacket {
  id: string;
  name: string;
  email: string;
  password_hash: string;
}

// Sessions end after a week even if the browser keeps the token ("remember me").
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toPublicUser({ id, name, email }: { id: string; name: string; email: string }): User {
  return { id, name, email };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Only a hash of each session token is stored, so someone who reads the database
 * can't use what they find to log in. The client still holds the real token.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Runs `work` in a transaction: all of its changes happen, or none do. */
async function inTransaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Clears out sessions and reset links that expired while the server was stopped. Run at startup. */
export async function deleteExpiredRecords(): Promise<void> {
  const now = Date.now();
  await db.execute('DELETE FROM sessions WHERE expires_at < ?', [now]);
  await db.execute('DELETE FROM password_resets WHERE expires_at < ?', [now]);
}

async function findUserRowByEmail(email: string): Promise<UserRow | undefined> {
  const [rows] = await db.execute<UserRow[]>('SELECT id, name, email, password_hash FROM users WHERE email = ?', [
    normalizeEmail(email),
  ]);
  return rows[0];
}

export async function addUser(name: string, email: string, password: string): Promise<User | null> {
  const key = normalizeEmail(email);
  if (await findUserRowByEmail(key)) {
    return null;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user: User = { id: randomUUID(), name, email: key };
  // IGNORE covers two sign-ups with the same email racing past the check above:
  // the UNIQUE email column turns the second insert into a no-op.
  const [result] = await db.execute<ResultSetHeader>(
    'INSERT IGNORE INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    [user.id, user.name, user.email, passwordHash, Date.now()],
  );
  return result.affectedRows === 1 ? user : null;
}

export async function verifyUser(email: string, password: string): Promise<User | null> {
  const user = await findUserRowByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return null;
  }
  return toPublicUser(user);
}

/** Looks up an account by email (forgot password, and the demo seed). */
export async function getUserByEmail(email: string): Promise<User | null> {
  const user = await findUserRowByEmail(email);
  return user ? toPublicUser(user) : null;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await db.execute('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [
    hashToken(token),
    userId,
    Date.now() + SESSION_TTL_MS,
  ]);
  return token;
}

async function findUserById(userId: string): Promise<User | null> {
  const [rows] = await db.execute<(User & RowDataPacket)[]>('SELECT id, name, email FROM users WHERE id = ?', [userId]);
  return rows[0] ? toPublicUser(rows[0]) : null;
}

export async function getUserByToken(token: string): Promise<User | null> {
  const tokenHash = hashToken(token);
  const [rows] = await db.execute<(User & { expires_at: number } & RowDataPacket)[]>(
    `SELECT users.id, users.name, users.email, sessions.expires_at
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  if (Number(row.expires_at) < Date.now()) {
    await db.execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    return null;
  }
  return toPublicUser(row);
}

export async function deleteSession(token: string): Promise<void> {
  await db.execute('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
}

// ---- Passwords ----

/** How long a "forgot password" link works. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Checks a signed-in user's current password (for changing it). */
export async function verifyPasswordById(userId: string, password: string): Promise<boolean> {
  const [rows] = await db.execute<({ password_hash: string } & RowDataPacket)[]>(
    'SELECT password_hash FROM users WHERE id = ?',
    [userId],
  );
  return rows[0] ? bcrypt.compare(password, rows[0].password_hash) : false;
}

/**
 * Sets a new password and signs the account out everywhere, except the session in
 * `keepToken` (the device that made the change, if it was signed in).
 */
export async function setPassword(userId: string, password: string, keepToken?: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 10);
  await inTransaction(async (connection) => {
    await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    if (keepToken) {
      await connection.execute('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [
        userId,
        hashToken(keepToken),
      ]);
    } else {
      await connection.execute('DELETE FROM sessions WHERE user_id = ?', [userId]);
    }
    // Any outstanding reset links are for the old password; they shouldn't still work.
    await connection.execute('DELETE FROM password_resets WHERE user_id = ?', [userId]);
  });
}

/** Creates a one-time reset token. Any earlier link for the same account stops working. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await inTransaction(async (connection) => {
    await connection.execute('DELETE FROM password_resets WHERE user_id = ?', [userId]);
    await connection.execute('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [
      hashToken(token),
      userId,
      Date.now() + PASSWORD_RESET_TTL_MS,
    ]);
  });
  return token;
}

/**
 * Whether a reset token can still be used: it exists (not used or replaced by a
 * newer link) and hasn't expired. Unlike consumePasswordResetToken, it leaves the
 * token in place, so the reset page can check the link when it opens.
 */
export async function isPasswordResetTokenValid(token: string): Promise<boolean> {
  const [rows] = await db.execute<({ expires_at: number } & RowDataPacket)[]>(
    'SELECT expires_at FROM password_resets WHERE token_hash = ?',
    [hashToken(token)],
  );
  return rows[0] !== undefined && Number(rows[0].expires_at) >= Date.now();
}

/**
 * Uses up a reset token: returns its user id if it was valid and unexpired.
 * The token is deleted either way, so a link can never be used twice. The row is
 * locked while it is read and deleted, so two requests can't both use it.
 */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const row = await inTransaction(async (connection) => {
    const [rows] = await connection.execute<({ user_id: string; expires_at: number } & RowDataPacket)[]>(
      'SELECT user_id, expires_at FROM password_resets WHERE token_hash = ? FOR UPDATE',
      [tokenHash],
    );
    await connection.execute('DELETE FROM password_resets WHERE token_hash = ?', [tokenHash]);
    return rows[0];
  });
  if (!row || Number(row.expires_at) < Date.now()) {
    return null;
  }
  return row.user_id;
}

function toBabyName({ name, gender }: NameCandidate): BabyName {
  const info = nameInfo[name] ?? { origin: 'Unknown', meaning: 'Unknown' };
  return { name, gender, ...info };
}

function candidatesMatching(candidates: NameCandidate[], gender?: NameGender): NameCandidate[] {
  return gender ? candidates.filter((c) => c.gender === gender) : candidates;
}

export function getRandomName(candidates: NameCandidate[], gender?: NameGender): BabyName | null {
  const matches = candidatesMatching(candidates, gender);
  if (matches.length === 0) {
    return null;
  }
  return toBabyName(matches[Math.floor(Math.random() * matches.length)]);
}

/** Every matching name once, in random order, with duplicate first names removed. */
export function listNames(candidates: NameCandidate[], gender?: NameGender): BabyName[] {
  const seen = new Set<string>();
  const names = candidatesMatching(candidates, gender)
    .map(toBabyName)
    .filter((n) => !seen.has(n.name) && seen.add(n.name));
  // Fisher-Yates shuffle so each visit to Discover starts somewhere different.
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names;
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** MySQL's error for a row that breaks a PRIMARY KEY or UNIQUE rule. */
function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'ER_DUP_ENTRY';
}

/** Two transactions waited on each other and MySQL cancelled one; trying again usually works. */
function isDeadlock(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'ER_LOCK_DEADLOCK';
}

// ---- Favorites and the shortlist ----

interface FavoriteRow extends RowDataPacket {
  name: string;
  gender: NameGender | null;
}

function toFavorite({ name, gender }: FavoriteRow): FavoriteName {
  return gender ? { name, gender } : { name };
}

/** Saves a favorite. Returns all favorites, or null if the name was already saved (ignoring case). */
export async function addFavorite(userId: string, favorite: FavoriteName): Promise<FavoriteName[] | null> {
  try {
    await db.execute('INSERT INTO favorites (user_id, name, gender) VALUES (?, ?, ?)', [
      userId,
      favorite.name,
      favorite.gender ?? null,
    ]);
  } catch (error) {
    if (isDuplicateKey(error)) {
      return null;
    }
    throw error;
  }
  return listFavorites(userId);
}

/** The user's favorites, oldest first. */
export async function listFavorites(userId: string): Promise<FavoriteName[]> {
  const [rows] = await db.execute<FavoriteRow[]>('SELECT name, gender FROM favorites WHERE user_id = ? ORDER BY id', [
    userId,
  ]);
  return rows.map(toFavorite);
}

/** Removes a favorite (and its shortlist spot). Returns the remaining favorites, or null if it wasn't saved. */
export async function removeFavorite(userId: string, name: string): Promise<FavoriteName[] | null> {
  const [result] = await db.execute<ResultSetHeader>('DELETE FROM favorites WHERE user_id = ? AND name = ?', [
    userId,
    name,
  ]);
  return result.affectedRows === 0 ? null : listFavorites(userId);
}

// The user's final picks: up to three favorites, best first.
export const SHORTLIST_SIZE = 3;

export async function getShortlist(userId: string): Promise<string[]> {
  const [rows] = await db.execute<FavoriteRow[]>(
    'SELECT name FROM favorites WHERE user_id = ? AND shortlist_rank IS NOT NULL ORDER BY shortlist_rank',
    [userId],
  );
  return rows.map((row) => row.name);
}

/**
 * Replaces the shortlist. Names must be distinct favorites, at most SHORTLIST_SIZE.
 * Returns the saved list (with each favorite's spelling), or an error message.
 */
export async function setShortlist(userId: string, names: string[]): Promise<string[] | { error: string }> {
  if (names.length > SHORTLIST_SIZE) {
    return { error: `pick at most ${SHORTLIST_SIZE} names` };
  }
  return inTransaction(async (connection) => {
    // Locks the user's favorites so a favorite can't be removed while it is being picked.
    const [favorites] = await connection.execute<FavoriteRow[]>(
      'SELECT name, gender FROM favorites WHERE user_id = ? ORDER BY id FOR UPDATE',
      [userId],
    );
    const picks: string[] = [];
    for (const name of names) {
      const favorite = favorites.find((f) => sameName(f.name, name));
      if (!favorite) {
        return { error: `${name} is not in your favorites` };
      }
      if (picks.some((p) => sameName(p, name))) {
        return { error: `${name} is listed twice` };
      }
      picks.push(favorite.name);
    }
    await connection.execute('UPDATE favorites SET shortlist_rank = NULL WHERE user_id = ?', [userId]);
    for (const [index, name] of picks.entries()) {
      await connection.execute('UPDATE favorites SET shortlist_rank = ? WHERE user_id = ? AND name = ?', [
        index + 1,
        userId,
        name,
      ]);
    }
    return picks;
  });
}

// ---- Partners ----

// No 0/O or 1/I, so codes are easy to read aloud and type.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_LENGTH = 6;

function newInviteCode(): string {
  return Array.from(randomBytes(INVITE_LENGTH), (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('');
}

/** The code a user shares so their partner can link to them. Made on first use. */
export async function getInviteCode(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const [rows] = await db.execute<({ code: string } & RowDataPacket)[]>(
      'SELECT code FROM invite_codes WHERE user_id = ?',
      [userId],
    );
    if (rows[0]) {
      return rows[0].code;
    }
    // IGNORE: if the code is already someone else's, or another request just made
    // this user's code, nothing is inserted and the next pass looks again.
    await db.execute('INSERT IGNORE INTO invite_codes (code, user_id) VALUES (?, ?)', [newInviteCode(), userId]);
  }
  throw new Error(`Could not create an invite code for user ${userId}`);
}

function toPartner(user: { name: string; email: string }): Partner {
  return { name: user.name, email: user.email };
}

async function findPartnerId(userId: string): Promise<string | null> {
  const [rows] = await db.execute<({ partner_id: string } & RowDataPacket)[]>(
    'SELECT partner_id FROM partners WHERE user_id = ?',
    [userId],
  );
  return rows[0]?.partner_id ?? null;
}

export async function getPartner(userId: string): Promise<Partner | null> {
  const [rows] = await db.execute<({ name: string; email: string } & RowDataPacket)[]>(
    `SELECT users.name, users.email
     FROM partners JOIN users ON users.id = partners.partner_id
     WHERE partners.user_id = ?`,
    [userId],
  );
  return rows[0] ? toPartner(rows[0]) : null;
}

const LINK_CONFLICT = { error: 'One of you was just linked with someone else. Please refresh and try again.', status: 409 } as const;

/** Links two accounts using the partner's invite code. */
export async function linkPartner(
  userId: string,
  code: string,
): Promise<{ partner: Partner } | { error: string; status: 400 | 409 }> {
  const normalized = code.trim().toUpperCase();
  try {
    return await inTransaction(async (connection) => {
      // Locks the code, so two people can't use it at once.
      const [codes] = await connection.execute<({ user_id: string } & RowDataPacket)[]>(
        'SELECT user_id FROM invite_codes WHERE code = ? FOR UPDATE',
        [normalized],
      );
      const partnerId = codes[0]?.user_id;
      const partner = partnerId ? await findUserById(partnerId) : null;
      if (!partnerId || !partner) {
        return { error: 'That invite code is not valid', status: 400 } as const;
      }
      if (partnerId === userId) {
        return { error: "That's your own invite code", status: 400 } as const;
      }
      const [linked] = await connection.execute<({ user_id: string } & RowDataPacket)[]>(
        'SELECT user_id FROM partners WHERE user_id IN (?, ?) FOR UPDATE',
        [userId, partnerId],
      );
      if (linked.some((row) => row.user_id === userId)) {
        return { error: 'You are already linked with a partner', status: 409 } as const;
      }
      if (linked.some((row) => row.user_id === partnerId)) {
        return { error: 'That person is already linked with someone else', status: 409 } as const;
      }
      await connection.execute('INSERT INTO partners (user_id, partner_id) VALUES (?, ?), (?, ?)', [
        userId,
        partnerId,
        partnerId,
        userId,
      ]);
      // A used code can't be reused by a third person later.
      await connection.execute('DELETE FROM invite_codes WHERE code = ?', [normalized]);
      return { partner: toPartner(partner) };
    });
  } catch (error) {
    // Someone else linked with one of these two accounts at the same moment.
    if (isDuplicateKey(error) || isDeadlock(error)) {
      return LINK_CONFLICT;
    }
    throw error;
  }
}

/** Unlinks the user and their partner. Returns false if they had no partner. */
export async function unlinkPartner(userId: string): Promise<boolean> {
  return inTransaction(async (connection) => {
    const [rows] = await connection.execute<({ partner_id: string } & RowDataPacket)[]>(
      'SELECT partner_id FROM partners WHERE user_id = ? FOR UPDATE',
      [userId],
    );
    const partnerId = rows[0]?.partner_id;
    if (!partnerId) {
      return false;
    }
    await connection.execute('DELETE FROM partners WHERE user_id IN (?, ?)', [userId, partnerId]);
    return true;
  });
}

export async function getVisibility(userId: string): Promise<FavoritesVisibility> {
  const [rows] = await db.execute<({ favorites_visibility: FavoritesVisibility } & RowDataPacket)[]>(
    'SELECT favorites_visibility FROM user_settings WHERE user_id = ?',
    [userId],
  );
  return rows[0]?.favorites_visibility ?? 'partner';
}

export async function setVisibility(userId: string, visibility: FavoritesVisibility): Promise<void> {
  await db.execute(
    `INSERT INTO user_settings (user_id, favorites_visibility) VALUES (?, ?) AS new
     ON DUPLICATE KEY UPDATE favorites_visibility = new.favorites_visibility`,
    [userId, visibility],
  );
}

/** The user's favorites compared with their partner's, or null without a partner. */
export async function comparePartnerFavorites(userId: string): Promise<PartnerMatches | null> {
  const partnerId = await findPartnerId(userId);
  const partner = partnerId ? await findUserById(partnerId) : null;
  if (!partnerId || !partner) {
    return null;
  }
  if ((await getVisibility(partnerId)) === 'private') {
    return { partner: toPartner(partner), shared: false, matches: [], onlyYou: [], onlyPartner: [] };
  }
  const [yours, theirs] = await Promise.all([listFavorites(userId), listFavorites(partnerId)]);
  const inTheirs = (f: FavoriteName) => theirs.some((t) => sameName(t.name, f.name));
  const inYours = (f: FavoriteName) => yours.some((y) => sameName(y.name, f.name));
  return {
    partner: toPartner(partner),
    shared: true,
    matches: yours.filter(inTheirs),
    onlyYou: yours.filter((f) => !inTheirs(f)),
    onlyPartner: theirs.filter((f) => !inYours(f)),
  };
}

/** Origin and meaning of a first name, or null if we don't know it yet. */
export function getNameInfo(name: string): NameInfo | null {
  const key = Object.keys(nameInfo).find((n) => sameName(n, name));
  return key ? { name: key, ...nameInfo[key] } : null;
}

const SEARCH_LIMIT = 30;

/** Names containing `query`, those starting with it first, then alphabetical. */
export function searchNames(candidates: NameCandidate[], query: string): BabyName[] {
  const q = query.trim().toLowerCase();
  const seen = new Set<string>();
  return candidates
    .filter((c) => c.name.toLowerCase().includes(q) && !seen.has(c.name) && seen.add(c.name))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q);
      const bStarts = b.name.toLowerCase().startsWith(q);
      return aStarts === bStarts ? a.name.localeCompare(b.name) : aStarts ? -1 : 1;
    })
    .slice(0, SEARCH_LIMIT)
    .map(toBabyName);
}

// ---- WikiTree ----

interface WikiTreeRow extends RowDataPacket {
  wikitree_user_id: number;
  wikitree_username: string;
  cookies: string;
  names: NameCandidate[] | string | null;
  names_fetched_at: number | null;
}

// Names pulled from each user's WikiTree tree, so Discover doesn't refetch the batch every visit.
const WIKITREE_NAMES_TTL_MS = 60 * 60 * 1000;

/** Saves the user's WikiTree sign-in, replacing any earlier one and its cached names. */
export async function setWikiTreeSession(userId: string, session: WikiTreeSession): Promise<void> {
  await db.execute(
    `INSERT INTO wikitree_sessions (user_id, wikitree_user_id, wikitree_username, cookies) VALUES (?, ?, ?, ?) AS new
     ON DUPLICATE KEY UPDATE
       wikitree_user_id = new.wikitree_user_id,
       wikitree_username = new.wikitree_username,
       cookies = new.cookies,
       names = NULL,
       names_fetched_at = NULL`,
    [userId, session.userId, session.userName, session.cookies],
  );
}

export async function getWikiTreeSession(userId: string): Promise<WikiTreeSession | null> {
  const [rows] = await db.execute<WikiTreeRow[]>(
    'SELECT wikitree_user_id, wikitree_username, cookies FROM wikitree_sessions WHERE user_id = ?',
    [userId],
  );
  const row = rows[0];
  return row ? { userId: row.wikitree_user_id, userName: row.wikitree_username, cookies: row.cookies } : null;
}

/** Forgets the user's WikiTree sign-in and its cached names. */
export async function deleteWikiTreeSession(userId: string): Promise<void> {
  await db.execute('DELETE FROM wikitree_sessions WHERE user_id = ?', [userId]);
}

/** The user's cached WikiTree names, or null if none were fetched in the last hour. */
export async function getWikiTreeNames(userId: string): Promise<NameCandidate[] | null> {
  const [rows] = await db.execute<WikiTreeRow[]>(
    'SELECT names, names_fetched_at FROM wikitree_sessions WHERE user_id = ?',
    [userId],
  );
  const row = rows[0];
  if (!row?.names || row.names_fetched_at === null || Date.now() - Number(row.names_fetched_at) > WIKITREE_NAMES_TTL_MS) {
    return null;
  }
  return typeof row.names === 'string' ? (JSON.parse(row.names) as NameCandidate[]) : row.names;
}

/** Caches the names pulled from the user's tree. Needs a saved WikiTree sign-in. */
export async function setWikiTreeNames(userId: string, candidates: NameCandidate[]): Promise<void> {
  await db.execute('UPDATE wikitree_sessions SET names = ?, names_fetched_at = ? WHERE user_id = ?', [
    JSON.stringify(candidates),
    Date.now(),
    userId,
  ]);
}

// ---- Contact messages ----

interface StoredContactMessage extends ContactMessageInput {
  id: string;
  userId?: string; // set when the sender was signed in
  receivedAt: string;
}

interface ContactMessageRow extends RowDataPacket {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  received_at: number;
}

export async function addContactMessage(input: ContactMessageInput, userId?: string): Promise<StoredContactMessage> {
  const receivedAt = Date.now();
  const stored: StoredContactMessage = {
    ...input,
    id: randomUUID(),
    ...(userId ? { userId } : {}),
    receivedAt: new Date(receivedAt).toISOString(),
  };
  await db.execute(
    'INSERT INTO contact_messages (id, user_id, name, email, phone, message, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [stored.id, userId ?? null, input.name, input.email, input.phone ?? null, input.message, receivedAt],
  );
  return stored;
}

/** Every contact message, oldest first. */
export async function listContactMessages(): Promise<StoredContactMessage[]> {
  const [rows] = await db.execute<ContactMessageRow[]>(
    'SELECT id, user_id, name, email, phone, message, received_at FROM contact_messages ORDER BY received_at, id',
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    ...(row.phone ? { phone: row.phone } : {}),
    message: row.message,
    ...(row.user_id ? { userId: row.user_id } : {}),
    receivedAt: new Date(Number(row.received_at)).toISOString(),
  }));
}
