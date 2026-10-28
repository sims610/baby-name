import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { BabyName, ContactMessageInput, FavoriteName, NameGender, User } from 'shared';
import { fakeAncestry } from './fakeData.ts';
import type { AncestorPerson } from './fakeData.ts';
import { nameInfo } from './nameInfo.ts';
import type { WikiTreeSession } from '../wikitree.ts';

interface StoredUser extends User {
  passwordHash: string;
}

// In-memory storage. Everything is lost when the server restarts.
const usersByEmail = new Map<string, StoredUser>();
const sessions = new Map<string, string>(); // token -> user id

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
  sessions.set(token, userId);
  return token;
}

export function getUserByToken(token: string): User | null {
  const userId = sessions.get(token);
  if (!userId) {
    return null;
  }
  for (const user of usersByEmail.values()) {
    if (user.id === userId) {
      return toPublicUser(user);
    }
  }
  return null;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

const favoritesByUser = new Map<string, FavoriteName[]>(); // user id -> favorites

function toBabyName(person: AncestorPerson): BabyName {
  const name = person.display.name.split(' ')[0];
  const info = nameInfo[name] ?? { origin: 'Unknown', meaning: 'Unknown' };
  return {
    name,
    gender: person.display.gender === 'Male' ? 'boy' : 'girl',
    ...info,
  };
}

function ancestorsMatching(gender?: NameGender): AncestorPerson[] {
  const wanted = gender === 'boy' ? 'Male' : gender === 'girl' ? 'Female' : undefined;
  // Skip the user themself (ascendancy number 1), as notes.md describes for FamilySearch.
  return fakeAncestry.persons.filter(
    (p) => p.display.ascendancyNumber !== '1' && (!wanted || p.display.gender === wanted),
  );
}

export function getRandomName(gender?: NameGender): BabyName | null {
  const matches = ancestorsMatching(gender);
  if (matches.length === 0) {
    return null;
  }
  return toBabyName(matches[Math.floor(Math.random() * matches.length)]);
}

/** Every matching name once, in random order, with duplicate first names removed. */
export function listNames(gender?: NameGender): BabyName[] {
  const seen = new Set<string>();
  const names = ancestorsMatching(gender)
    .map(toBabyName)
    .filter((n) => !seen.has(n.name) && seen.add(n.name));
  // Fisher-Yates shuffle so each visit to Discover starts somewhere different.
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names;
}

export function addFavorite(userId: string, favorite: FavoriteName): FavoriteName[] | null {
  const favorites = favoritesByUser.get(userId) ?? [];
  const key = favorite.name.toLowerCase();
  if (favorites.some((f) => f.name.toLowerCase() === key)) {
    return null;
  }
  favorites.push(favorite);
  favoritesByUser.set(userId, favorites);
  return favorites;
}

export function listFavorites(userId: string): FavoriteName[] {
  return favoritesByUser.get(userId) ?? [];
}

const wikiTreeSessionsByUser = new Map<string, WikiTreeSession>(); // user id -> WikiTree session

export function setWikiTreeSession(userId: string, session: WikiTreeSession): void {
  wikiTreeSessionsByUser.set(userId, session);
}

export function getWikiTreeSession(userId: string): WikiTreeSession | null {
  return wikiTreeSessionsByUser.get(userId) ?? null;
}

export function deleteWikiTreeSession(userId: string): void {
  wikiTreeSessionsByUser.delete(userId);
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
