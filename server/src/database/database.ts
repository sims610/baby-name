import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { fakeAncestry } from './fakeData.ts';

export interface User {
  id: string;
  name: string;
  email: string;
}

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

export type NameGender = 'boy' | 'girl';

export interface FavoriteName {
  name: string;
  gender?: NameGender;
}

const favoritesByUser = new Map<string, FavoriteName[]>(); // user id -> favorites

export function getRandomName(gender?: NameGender): { name: string; gender: NameGender } | null {
  const wanted = gender === 'boy' ? 'Male' : gender === 'girl' ? 'Female' : undefined;
  // Skip the user themself (ascendancy number 1), as notes.md describes for FamilySearch.
  const matches = fakeAncestry.persons.filter(
    (p) => p.display.ascendancyNumber !== '1' && (!wanted || p.display.gender === wanted),
  );
  if (matches.length === 0) {
    return null;
  }
  const pick = matches[Math.floor(Math.random() * matches.length)];
  return {
    name: pick.display.name.split(' ')[0],
    gender: pick.display.gender === 'Male' ? 'boy' : 'girl',
  };
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
