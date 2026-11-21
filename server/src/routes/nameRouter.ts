import express from 'express';
import type { Request, Response } from 'express';
import {
  getRandomName,
  listNames,
  addFavorite,
  listFavorites,
  removeFavorite,
  getShortlist,
  setShortlist,
  getNameInfo,
  searchNames,
  getWikiTreeSession,
  getWikiTreeNames,
  setWikiTreeNames,
  wikiTreeNamesNeedRefresh,
  getPartnerWikiTreeNames,
  getPartner,
  getGedcomImport,
  addPassedName,
  clearPassedNames,
  swipedNames,
} from '../database/database.ts';
import type { NameGender, NameRoot } from 'shared';
import { fakeNameCandidates, fakePartnerNameCandidates, relationName, toNameCandidates } from '../names.ts';
import type { NameCandidate } from '../names.ts';
import { fetchWikiTreeAncestors, WikiTreeTreeNotReadyError } from '../wikitree.ts';
import { authenticateToken } from './authRouter.ts';
import { notifyPartnerOfMatch } from '../push.ts';

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
        'Generate a random name. Omit gender for either. source=wikitree uses your own tree (WikiTree ancestors, or an imported GEDCOM file) plus that of your linked partner; demo (the default) uses sample data, plus a sample partner tree once you link a partner.',
      example: `curl 'localhost:3000/api/name?gender=girl&source=wikitree' -H 'Authorization: Bearer abc123'`,
      response: { name: 'Hazel', gender: 'girl', origin: 'English', meaning: 'Hazel tree' },
    },
    {
      method: 'GET',
      path: '/api/name/list?gender=boy|girl&source=demo|wikitree&limit=1-100&seed=0-4294967295&offset=0',
      requiresAuth: true,
      description:
        'List every name once, in random order. Omit gender for both. source=wikitree uses your own tree (WikiTree ancestors, or an imported GEDCOM file) plus that of your linked partner; demo (the default) uses sample data, plus a sample partner tree once you link a partner. With limit, returns one page (a Discover round) plus how many names are left: for source=wikitree, names you already passed on or saved as favorites are left out, so the next page is just the next request. Sample data does not remember swipes, so for source=demo pass offset (how many names earlier pages showed) instead. seed keeps the order the same from page to page. total counts every name, swiped or not; remaining counts those from this page on.',
      example: `curl 'localhost:3000/api/name/list?gender=girl&source=wikitree&limit=25&seed=12345' -H 'Authorization: Bearer abc123'`,
      response: {
        names: [{ name: 'Hazel', gender: 'girl', origin: 'English', meaning: 'Hazel tree', tree: 'partner' }],
        remaining: 412,
        total: 530,
      },
    },
    {
      method: 'POST',
      path: '/api/name/passed',
      requiresAuth: true,
      description: 'Remember that you passed on a name in Discover, so paged lists leave it out',
      example: `curl -X POST localhost:3000/api/name/passed -H 'Content-Type: application/json' -H 'Authorization: Bearer abc123' -d '{"name":"Mildred"}'`,
      response: {},
    },
    {
      method: 'DELETE',
      path: '/api/name/passed',
      requiresAuth: true,
      description: 'Forget every name you passed on, so Discover shows them again (favorites stay left out)',
      example: `curl -X DELETE localhost:3000/api/name/passed -H 'Authorization: Bearer abc123'`,
      response: {},
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
    {
      method: 'DELETE',
      path: '/api/name/favorites/:name',
      requiresAuth: true,
      description: 'Remove a name from your favorites (and your shortlist)',
      example: `curl -X DELETE localhost:3000/api/name/favorites/Hazel -H 'Authorization: Bearer abc123'`,
      response: { favorites: [{ name: 'Oliver', gender: 'boy' }] },
    },
    {
      method: 'GET',
      path: '/api/name/shortlist',
      requiresAuth: true,
      description: 'Get your final picks: up to three favorites, best first',
      example: `curl localhost:3000/api/name/shortlist -H 'Authorization: Bearer abc123'`,
      response: { shortlist: ['Hazel', 'Oliver'] },
    },
    {
      method: 'PUT',
      path: '/api/name/shortlist',
      requiresAuth: true,
      description: 'Replace your final picks. Each must be a favorite; at most three.',
      example: `curl -X PUT localhost:3000/api/name/shortlist -H 'Content-Type: application/json' -H 'Authorization: Bearer abc123' -d '{"names":["Hazel","Oliver"]}'`,
      response: { shortlist: ['Hazel', 'Oliver'] },
    },
    {
      method: 'GET',
      path: '/api/name/info/:name',
      requiresAuth: true,
      description: "Get a name's origin and meaning",
      example: `curl localhost:3000/api/name/info/Hazel -H 'Authorization: Bearer abc123'`,
      response: { name: 'Hazel', origin: 'English', meaning: 'Hazel tree' },
    },
    {
      method: 'GET',
      path: '/api/name/roots/:name?source=demo|wikitree',
      requiresAuth: true,
      description: "The ancestors in your tree (and your linked partner's, with fromPartner: true) who had this first name, closest first",
      example: `curl 'localhost:3000/api/name/roots/Hazel?source=demo' -H 'Authorization: Bearer abc123'`,
      response: { roots: [{ fullName: 'Hazel Morgan', relation: 'great-grandmother', birthYear: 1903 }] },
    },
    {
      method: 'GET',
      path: '/api/name/search?q=',
      requiresAuth: true,
      description: "Search the sample names and the saved WikiTree names from your tree and your partner's by part of a name",
      example: `curl 'localhost:3000/api/name/search?q=ha' -H 'Authorization: Bearer abc123'`,
      response: { names: [{ name: 'Hazel', gender: 'girl', origin: 'English', meaning: 'Hazel tree' }] },
    },
  ] as EndpointDoc[],
});

// First names are short; this keeps stored favorites from growing without bound.
const MAX_NAME_LENGTH = 50;

function isNameGender(value: unknown): value is NameGender {
  return value === 'boy' || value === 'girl';
}

/**
 * The names to pick from, per `?source=`: sample data for `demo` (the default, plus a
 * sample partner tree when the user has a partner), or
 * the user's own tree (WikiTree ancestors, or an imported GEDCOM file) plus a linked partner's. The user's own
 * names are saved and refetched now and then. Sends the error response and returns
 * null when the names can't be had.
 */
async function nameCandidates(req: Request, res: Response): Promise<NameCandidate[] | null> {
  const { source = 'demo' } = req.query;
  if (source === 'demo') {
    // With a linked partner, the sample partner tree is mixed in, like a real one would be.
    const partner = await getPartner(req.user!.id);
    return partner ? [...fakeNameCandidates(), ...fakePartnerNameCandidates()] : fakeNameCandidates();
  }
  if (source !== 'wikitree') {
    res.status(400).json({ message: 'source must be "demo" or "wikitree"' });
    return null;
  }
  const userId = req.user!.id;
  const session = await getWikiTreeSession(userId);
  if (!session) {
    // An imported GEDCOM file never changes, so its saved names are all there is.
    if (await getGedcomImport(userId)) {
      const [saved, partner] = await Promise.all([getWikiTreeNames(userId), getPartnerWikiTreeNames(userId)]);
      return [...(saved ?? []), ...partner];
    }
    // 403 rather than 401: a 401 would sign the user out of our app.
    res.status(403).json({
      message: 'Sign in to WikiTree or import a GEDCOM file to see names from your family tree.',
    });
    return null;
  }
  const [saved, partner] = await Promise.all([getWikiTreeNames(userId), getPartnerWikiTreeNames(userId)]);
  if (saved && !(await wikiTreeNamesNeedRefresh(userId))) {
    return [...saved, ...partner];
  }
  try {
    const candidates = toNameCandidates(await fetchWikiTreeAncestors(session));
    await setWikiTreeNames(userId, candidates);
    return [...candidates, ...partner];
  } catch (err) {
    // Older names beat an error page.
    if (saved) {
      console.error('WikiTree refresh failed, using saved names:', err);
      return [...saved, ...partner];
    }
    if (err instanceof WikiTreeTreeNotReadyError) {
      res.status(503).json({
        message:
          "WikiTree is still setting up your family tree. New profiles can take a while to appear, so please try again later or use Demo mode.",
      });
      return null;
    }
    console.error('WikiTree getPeople failed:', err);
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

/** A whole number from the query string within [min, max], undefined if absent, or null if invalid. */
function queryInteger(value: unknown, min: number, max: number): number | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

// The most names one page can hold; Discover's round size (ROUND_SIZE in NameSwiper.tsx) must fit.
const MAX_PAGE_SIZE = 100;
const MAX_SEED = 0xffffffff;

// list all names, or one page of them
nameRouter.get('/list', authenticateToken, async (req: Request, res: Response) => {
  const { gender, source = 'demo' } = req.query;
  if (gender !== undefined && !isNameGender(gender)) {
    res.status(400).json({ message: 'gender must be "boy" or "girl"' });
    return;
  }
  const limit = queryInteger(req.query.limit, 1, MAX_PAGE_SIZE);
  if (limit === null) {
    res.status(400).json({ message: `limit must be a whole number from 1 to ${MAX_PAGE_SIZE}` });
    return;
  }
  const seed = queryInteger(req.query.seed, 0, MAX_SEED);
  if (seed === null) {
    res.status(400).json({ message: `seed must be a whole number from 0 to ${MAX_SEED}` });
    return;
  }
  const offset = queryInteger(req.query.offset, 0, Number.MAX_SAFE_INTEGER);
  if (offset === null) {
    res.status(400).json({ message: 'offset must be a whole number from 0' });
    return;
  }
  const candidates = await nameCandidates(req, res);
  if (!candidates) {
    return;
  }
  const names = listNames(candidates, gender, { seed });
  if (limit === undefined) {
    res.json({ names });
    return;
  }
  // Swipes are only remembered for the user's own tree, never the sample data.
  const swiped = source === 'wikitree' ? await swipedNames(req.user!.id) : new Set<string>();
  const unswiped = names.filter((n) => !swiped.has(n.name.toLowerCase()));
  const start = offset ?? 0;
  res.json({
    names: unswiped.slice(start, start + limit),
    remaining: Math.max(unswiped.length - start, 0),
    total: names.length,
  });
});

// remember a name the user passed on
nameRouter.post('/passed', authenticateToken, async (req: Request, res: Response) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ message: 'name is required' });
    return;
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    res.status(400).json({ message: `name must be at most ${MAX_NAME_LENGTH} characters` });
    return;
  }
  await addPassedName(req.user!.id, name.trim());
  res.json({});
});

// forget every pass ("Start over")
nameRouter.delete('/passed', authenticateToken, async (req: Request, res: Response) => {
  await clearPassedNames(req.user!.id);
  res.json({});
});

// save name as favorite
nameRouter.post('/', authenticateToken, async (req: Request, res: Response) => {
  const { name, gender } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ message: 'name is required' });
    return;
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    res.status(400).json({ message: `name must be at most ${MAX_NAME_LENGTH} characters` });
    return;
  }
  if (gender !== undefined && !isNameGender(gender)) {
    res.status(400).json({ message: 'gender must be "boy" or "girl"' });
    return;
  }
  const favorites = await addFavorite(req.user!.id, gender ? { name: name.trim(), gender } : { name: name.trim() });
  if (!favorites) {
    res.status(409).json({ message: 'name already in favorites' });
    return;
  }
  // If the partner liked this name too, it's a new match: let them know.
  notifyPartnerOfMatch(req.user!, name.trim());
  res.status(201).json({ favorites });
});

// get list of favorites
nameRouter.get('/favorites', authenticateToken, async (req: Request, res: Response) => {
  const favorites = await listFavorites(req.user!.id);
  res.json({ favorites });
});

// remove a favorite
nameRouter.delete('/favorites/:name', authenticateToken, async (req: Request, res: Response) => {
  const favorites = await removeFavorite(req.user!.id, String(req.params.name));
  if (!favorites) {
    res.status(404).json({ message: 'name is not in favorites' });
    return;
  }
  res.json({ favorites });
});

// get the shortlist
nameRouter.get('/shortlist', authenticateToken, async (req: Request, res: Response) => {
  res.json({ shortlist: await getShortlist(req.user!.id) });
});

// replace the shortlist
nameRouter.put('/shortlist', authenticateToken, async (req: Request, res: Response) => {
  const { names } = req.body ?? {};
  if (!Array.isArray(names) || !names.every((n) => typeof n === 'string')) {
    res.status(400).json({ message: 'names must be a list of names' });
    return;
  }
  const result = await setShortlist(req.user!.id, names);
  if ('error' in result) {
    res.status(400).json({ message: result.error });
    return;
  }
  res.json({ shortlist: result });
});

// origin and meaning of a name
nameRouter.get('/info/:name', authenticateToken, (req: Request, res: Response) => {
  const info = getNameInfo(String(req.params.name));
  if (!info) {
    res.status(404).json({ message: "We don't know this name's story yet" });
    return;
  }
  res.json(info);
});

// ancestors who had this name
nameRouter.get('/roots/:name', authenticateToken, async (req: Request, res: Response) => {
  const candidates = await nameCandidates(req, res);
  if (!candidates) {
    return;
  }
  const name = String(req.params.name).toLowerCase();
  const roots: NameRoot[] = candidates
    .filter((c) => c.name.toLowerCase() === name && c.generation)
    .sort((a, b) => a.generation! - b.generation!)
    .map((c) => ({
      fullName: c.fullName ?? c.name,
      relation: relationName(c.generation!, c.gender),
      ...(c.birthYear ? { birthYear: c.birthYear } : {}),
      ...(c.fromPartner ? { fromPartner: true } : {}),
    }));
  res.json({ roots });
});

// search names
nameRouter.get('/search', authenticateToken, async (req: Request, res: Response) => {
  const { q } = req.query;
  if (typeof q !== 'string' || q.trim().length === 0 || q.length > MAX_NAME_LENGTH) {
    res.status(400).json({ message: 'q is required' });
    return;
  }
  // Sample names plus the saved WikiTree names from the user's tree and their partner's.
  const userId = req.user!.id;
  const [yours, partner] = await Promise.all([getWikiTreeNames(userId), getPartnerWikiTreeNames(userId)]);
  const trees = [...(yours ?? []), ...partner];
  res.json({ names: searchNames([...fakeNameCandidates(), ...trees], q, trees) });
});

export { nameRouter };
