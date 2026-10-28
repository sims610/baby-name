import express from 'express';
import type { Request, Response } from 'express';
import {
  getRandomName,
  listNames,
  addFavorite,
  listFavorites,
  getWikiTreeSession,
  getWikiTreeNames,
  setWikiTreeNames,
} from '../database/database.ts';
import type { NameGender } from 'shared';
import { fakeNameCandidates, toNameCandidates } from '../names.ts';
import type { NameCandidate } from '../names.ts';
import { fetchWikiTreeAncestors } from '../wikitree.ts';
import { authenticateToken } from './authRouter.ts';

interface EndpointDoc {
  method: string;
  path: string;
  requiresAuth: boolean;
  description: string;
  example: string;
  response: unknown;
}

const nameRouter = Object.assign(express.Router(), {
  docs: [
    {
      method: 'GET',
      path: '/api/name?gender=boy|girl&source=demo|wikitree',
      requiresAuth: true,
      description:
        'Generate a random name. Omit gender for either. source=wikitree uses your WikiTree ancestors (sign in first); demo (the default) uses sample data.',
      example: `curl 'localhost:3000/api/name?gender=girl&source=wikitree' -H 'Authorization: Bearer abc123'`,
      response: { name: 'Hazel', gender: 'girl', origin: 'English', meaning: 'Hazel tree' },
    },
    {
      method: 'GET',
      path: '/api/name/list?gender=boy|girl&source=demo|wikitree',
      requiresAuth: true,
      description:
        'List every name once, in random order. Omit gender for both. source=wikitree uses your WikiTree ancestors (sign in first); demo (the default) uses sample data.',
      example: `curl 'localhost:3000/api/name/list?gender=girl&source=wikitree' -H 'Authorization: Bearer abc123'`,
      response: { names: [{ name: 'Hazel', gender: 'girl', origin: 'English', meaning: 'Hazel tree' }] },
    },
    {
      method: 'POST',
      path: '/api/name',
      requiresAuth: true,
      description: 'Save a name as a favorite',
      example: `curl -X POST localhost:3000/api/name -H 'Content-Type: application/json' -H 'Authorization: Bearer abc123' -d '{"name":"Hazel", "gender":"girl"}'`,
      response: { favorites: [{ name: 'Hazel', gender: 'girl' }] },
    },
    {
      method: 'GET',
      path: '/api/name/favorites',
      requiresAuth: true,
      description: 'Get all of your saved favorite names',
      example: `curl localhost:3000/api/name/favorites -H 'Authorization: Bearer abc123'`,
      response: { favorites: [{ name: 'Hazel', gender: 'girl' }, { name: 'Oliver', gender: 'boy' }] },
    },
  ] as EndpointDoc[],
});

function isNameGender(value: unknown): value is NameGender {
  return value === 'boy' || value === 'girl';
}

/**
 * The names to pick from, per `?source=`: sample data for `demo` (the default), or
 * the signed-in user's WikiTree ancestors, fetched once and cached. Sends the error
 * response and returns null when the names can't be had.
 */
async function nameCandidates(req: Request, res: Response): Promise<NameCandidate[] | null> {
  const { source = 'demo' } = req.query;
  if (source === 'demo') {
    return fakeNameCandidates();
  }
  if (source !== 'wikitree') {
    res.status(400).json({ message: 'source must be "demo" or "wikitree"' });
    return null;
  }
  const userId = req.user!.id;
  const session = getWikiTreeSession(userId);
  // 403 rather than 401: a 401 would sign the user out of our app.
  if (!session) {
    res.status(403).json({ message: 'Sign in to WikiTree to see names from your family tree.' });
    return null;
  }
  const cached = getWikiTreeNames(userId);
  if (cached) {
    return cached;
  }
  try {
    const candidates = toNameCandidates(await fetchWikiTreeAncestors(session));
    setWikiTreeNames(userId, candidates);
    return candidates;
  } catch {
    res.status(502).json({ message: 'WikiTree could not be reached. Please try again.' });
    return null;
  }
}

// generate name
nameRouter.get('/', authenticateToken, async (req: Request, res: Response) => {
  const { gender } = req.query;
  if (gender !== undefined && !isNameGender(gender)) {
    res.status(400).json({ message: 'gender must be "boy" or "girl"' });
    return;
  }
  const candidates = await nameCandidates(req, res);
  if (!candidates) {
    return;
  }
  const result = getRandomName(candidates, gender);
  if (!result) {
    res.status(404).json({ message: 'no names found' });
    return;
  }
  res.json(result);
});

// list all names
nameRouter.get('/list', authenticateToken, async (req: Request, res: Response) => {
  const { gender } = req.query;
  if (gender !== undefined && !isNameGender(gender)) {
    res.status(400).json({ message: 'gender must be "boy" or "girl"' });
    return;
  }
  const candidates = await nameCandidates(req, res);
  if (!candidates) {
    return;
  }
  res.json({ names: listNames(candidates, gender) });
});

// save name as favorite
nameRouter.post('/', authenticateToken, (req: Request, res: Response) => {
  const { name, gender } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ message: 'name is required' });
    return;
  }
  if (gender !== undefined && !isNameGender(gender)) {
    res.status(400).json({ message: 'gender must be "boy" or "girl"' });
    return;
  }
  const favorites = addFavorite(req.user!.id, gender ? { name: name.trim(), gender } : { name: name.trim() });
  if (!favorites) {
    res.status(409).json({ message: 'name already in favorites' });
    return;
  }
  res.status(201).json({ favorites });
});

// get list of favorites
nameRouter.get('/favorites', authenticateToken, (req: Request, res: Response) => {
  const favorites = listFavorites(req.user!.id);
  res.json({ favorites });
});

export { nameRouter };
