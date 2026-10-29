import { randomBytes, randomUUID } from 'node:crypto';
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
import { nameInfo } from './nameInfo.ts';
import type { NameCandidate } from '../names.ts';
import type { WikiTreeSession } from '../wikitree.ts';

interface StoredUser extends User {
  passwordHash: string;
}

// In-memory storage. Everything is lost when the server restarts.
const usersByEmail = new Map<string, StoredUser>();
// Sessions end after a week even if the browser keeps the token ("remember me").
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map<string, { userId: string; expiresAt: number }>(); // token -> session

function toPublicUser({ id, name, email }: StoredUser): User {
  return { id, name, email };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function addUser(name: string, email: string, password: string): Promise<User | null> {
  const key = normalizeEmail(email);
  if (usersByEmail.has(key)) {
    return null;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user: StoredUser = { id: randomUUID(), name, email: key, passwordHash };
  usersByEmail.set(key, user);
  return toPublicUser(user);
}

export async function verifyUser(email: string, password: string): Promise<User | null> {
  const user = usersByEmail.get(normalizeEmail(email));
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return null;
  }
  return toPublicUser(user);
}

export function createSession(userId: string): string {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function findUserById(userId: string): StoredUser | null {
  for (const user of usersByEmail.values()) {
    if (user.id === userId) {
      return user;
    }
  }
  return null;
}

export function getUserByToken(token: string): User | null {
  const session = sessions.get(token);
  if (!session) {
    return null;
  }
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  const user = findUserById(session.userId);
  return user ? toPublicUser(user) : null;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

const favoritesByUser = new Map<string, FavoriteName[]>(); // user id -> favorites

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

export function addFavorite(userId: string, favorite: FavoriteName): FavoriteName[] | null {
  const favorites = favoritesByUser.get(userId) ?? [];
  if (favorites.some((f) => sameName(f.name, favorite.name))) {
    return null;
  }
  favorites.push(favorite);
  favoritesByUser.set(userId, favorites);
  return favorites;
}

export function listFavorites(userId: string): FavoriteName[] {
  return favoritesByUser.get(userId) ?? [];
}

/** Removes a favorite (and its shortlist spot). Returns the remaining favorites, or null if it wasn't saved. */
export function removeFavorite(userId: string, name: string): FavoriteName[] | null {
  const favorites = listFavorites(userId);
  const remaining = favorites.filter((f) => !sameName(f.name, name));
  if (remaining.length === favorites.length) {
    return null;
  }
  favoritesByUser.set(userId, remaining);
  shortlistByUser.set(
    userId,
    getShortlist(userId).filter((n) => !sameName(n, name)),
  );
  return remaining;
}

// ---- Partners ----

const partnerByUser = new Map<string, string>(); // user id -> partner's user id
const inviteCodeByUser = new Map<string, string>(); // user id -> invite code
const userByInviteCode = new Map<string, string>(); // invite code -> user id

// No 0/O or 1/I, so codes are easy to read aloud and type.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_LENGTH = 6;

function newInviteCode(): string {
  let code: string;
  do {
    code = Array.from(randomBytes(INVITE_LENGTH), (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('');
  } while (userByInviteCode.has(code));
  return code;
}

/** The code a user shares so their partner can link to them. Made on first use. */
export function getInviteCode(userId: string): string {
  let code = inviteCodeByUser.get(userId);
  if (!code) {
    code = newInviteCode();
    inviteCodeByUser.set(userId, code);
    userByInviteCode.set(code, userId);
  }
  return code;
}

function toPartner(user: StoredUser): Partner {
  return { name: user.name, email: user.email };
}

export function getPartner(userId: string): Partner | null {
  const partnerId = partnerByUser.get(userId);
  const partner = partnerId ? findUserById(partnerId) : null;
  return partner ? toPartner(partner) : null;
}

/** Links two accounts using the partner's invite code. */
export function linkPartner(
  userId: string,
  code: string,
): { partner: Partner } | { error: string; status: 400 | 409 } {
  const partnerId = userByInviteCode.get(code.trim().toUpperCase());
  const partner = partnerId ? findUserById(partnerId) : null;
  if (!partnerId || !partner) {
    return { error: 'That invite code is not valid', status: 400 };
  }
  if (partnerId === userId) {
    return { error: "That's your own invite code", status: 400 };
  }
  if (partnerByUser.has(userId)) {
    return { error: 'You are already linked with a partner', status: 409 };
  }
  if (partnerByUser.has(partnerId)) {
    return { error: 'That person is already linked with someone else', status: 409 };
  }
  partnerByUser.set(userId, partnerId);
  partnerByUser.set(partnerId, userId);
  // A used code can't be reused by a third person later.
  userByInviteCode.delete(code.trim().toUpperCase());
  inviteCodeByUser.delete(partnerId);
  return { partner: toPartner(partner) };
}

/** Unlinks the user and their partner. Returns false if they had no partner. */
export function unlinkPartner(userId: string): boolean {
  const partnerId = partnerByUser.get(userId);
  if (!partnerId) {
    return false;
  }
  partnerByUser.delete(userId);
  partnerByUser.delete(partnerId);
  return true;
}

const visibilityByUser = new Map<string, FavoritesVisibility>(); // user id -> who sees favorites

export function getVisibility(userId: string): FavoritesVisibility {
  return visibilityByUser.get(userId) ?? 'partner';
}

export function setVisibility(userId: string, visibility: FavoritesVisibility): void {
  visibilityByUser.set(userId, visibility);
}

/** The user's favorites compared with their partner's, or null without a partner. */
export function comparePartnerFavorites(userId: string): PartnerMatches | null {
  const partnerId = partnerByUser.get(userId);
  const partner = partnerId ? findUserById(partnerId) : null;
  if (!partnerId || !partner) {
    return null;
  }
  if (getVisibility(partnerId) === 'private') {
    return { partner: toPartner(partner), shared: false, matches: [], onlyYou: [], onlyPartner: [] };
  }
  const yours = listFavorites(userId);
  const theirs = listFavorites(partnerId);
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

// The user's final picks: up to three favorites, best first.
export const SHORTLIST_SIZE = 3;
const shortlistByUser = new Map<string, string[]>(); // user id -> favorite names

export function getShortlist(userId: string): string[] {
  return shortlistByUser.get(userId) ?? [];
}

/**
 * Replaces the shortlist. Names must be distinct favorites, at most SHORTLIST_SIZE.
 * Returns the saved list (with each favorite's spelling), or an error message.
 */
export function setShortlist(userId: string, names: string[]): string[] | { error: string } {
  if (names.length > SHORTLIST_SIZE) {
    return { error: `pick at most ${SHORTLIST_SIZE} names` };
  }
  const favorites = listFavorites(userId);
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
  shortlistByUser.set(userId, picks);
  return picks;
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

const wikiTreeSessionsByUser = new Map<string, WikiTreeSession>(); // user id -> WikiTree session

// Names pulled from each user's WikiTree tree, so Discover doesn't refetch the batch every visit.
const WIKITREE_NAMES_TTL_MS = 60 * 60 * 1000;
const wikiTreeNamesByUser = new Map<string, { fetchedAt: number; candidates: NameCandidate[] }>(); // user id -> names

export function setWikiTreeSession(userId: string, session: WikiTreeSession): void {
  wikiTreeSessionsByUser.set(userId, session);
  wikiTreeNamesByUser.delete(userId);
}

export function getWikiTreeSession(userId: string): WikiTreeSession | null {
  return wikiTreeSessionsByUser.get(userId) ?? null;
}

export function deleteWikiTreeSession(userId: string): void {
  wikiTreeSessionsByUser.delete(userId);
  wikiTreeNamesByUser.delete(userId);
}

/** The user's cached WikiTree names, or null if none were fetched in the last hour. */
export function getWikiTreeNames(userId: string): NameCandidate[] | null {
  const cached = wikiTreeNamesByUser.get(userId);
  if (!cached || Date.now() - cached.fetchedAt > WIKITREE_NAMES_TTL_MS) {
    return null;
  }
  return cached.candidates;
}

export function setWikiTreeNames(userId: string, candidates: NameCandidate[]): void {
  wikiTreeNamesByUser.set(userId, { fetchedAt: Date.now(), candidates });
}

interface StoredContactMessage extends ContactMessageInput {
  id: string;
  userId?: string; // set when the sender was signed in
  receivedAt: string;
}

const contactMessages: StoredContactMessage[] = [];

export function addContactMessage(input: ContactMessageInput, userId?: string): StoredContactMessage {
  const stored: StoredContactMessage = {
    ...input,
    id: randomUUID(),
    ...(userId ? { userId } : {}),
    receivedAt: new Date().toISOString(),
  };
  contactMessages.push(stored);
  return stored;
}

export function listContactMessages(): StoredContactMessage[] {
  return contactMessages;
}
