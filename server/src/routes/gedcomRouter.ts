import express from 'express';
import type { Request, Response } from 'express';
import type { GedcomAncestor } from 'shared';
import { deleteGedcomImport, getGedcomImport, setGedcomImport } from '../database/database.ts';
import { toNameCandidates } from '../names.ts';
import { authenticateToken } from './authRouter.ts';

interface EndpointDoc {
  method: string;
  path: string;
  requiresAuth: boolean;
  description: string;
  example: string;
  response: unknown;
}

const gedcomRouter = Object.assign(express.Router(), {
  docs: [
    {
      method: 'POST',
      path: '/api/gedcom',
      requiresAuth: true,
      description:
        "Use ancestors read from a GEDCOM file as your family tree, instead of WikiTree. The browser parses the file and sends only the ancestors (generation 1 is a parent). Replaces a WikiTree sign-in or an earlier import.",
      example: `curl -X POST localhost:3000/api/gedcom -H 'Content-Type: application/json' -H 'Authorization: Bearer abc123' -d '{"fileName":"family.ged","ancestors":[{"firstName":"Hazel","lastName":"Smith","gender":"Female","birthDate":"1902","degrees":2}]}'`,
      response: { import: { fileName: 'family.ged', nameCount: 1, importedAt: 1767225600000 } },
    },
    {
      method: 'GET',
      path: '/api/gedcom',
      requiresAuth: true,
      description: 'Get the imported GEDCOM family tree, or null if there is none',
      example: `curl localhost:3000/api/gedcom -H 'Authorization: Bearer abc123'`,
      response: { import: { fileName: 'family.ged', nameCount: 1, importedAt: 1767225600000 } },
    },
    {
      method: 'DELETE',
      path: '/api/gedcom',
      requiresAuth: true,
      description: 'Remove the imported family tree and its names',
      example: `curl -X DELETE localhost:3000/api/gedcom -H 'Authorization: Bearer abc123'`,
      response: { import: null },
    },
  ] as EndpointDoc[],
});

/** Bodies for this router may be up to this size (see service.ts); others stay at 10kb. */
export const GEDCOM_BODY_LIMIT = '1mb';
// Matches MAX_ANCESTORS and MAX_GENERATIONS in client/src/gedcom/parseGedcom.ts.
const MAX_ANCESTORS = 3000;
const MAX_GENERATIONS = 10;
const MAX_FIELD_LENGTH = 100;
const MAX_FILE_NAME_LENGTH = 255;

function isOptionalText(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= MAX_FIELD_LENGTH);
}

function isAncestor(value: unknown): value is GedcomAncestor {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    Number.isInteger(a.degrees) &&
    (a.degrees as number) >= 1 &&
    (a.degrees as number) <= MAX_GENERATIONS &&
    isOptionalText(a.firstName) &&
    isOptionalText(a.lastName) &&
    isOptionalText(a.birthDate) &&
    (a.gender === undefined || a.gender === 'Male' || a.gender === 'Female')
  );
}

// import a tree
gedcomRouter.post('/', authenticateToken, async (req: Request, res: Response) => {
  const { fileName, ancestors } = req.body ?? {};
  if (typeof fileName !== 'string' || fileName.trim().length === 0 || fileName.length > MAX_FILE_NAME_LENGTH) {
    res.status(400).json({ message: 'fileName is required' });
    return;
  }
  if (!Array.isArray(ancestors) || ancestors.length > MAX_ANCESTORS || !ancestors.every(isAncestor)) {
    res.status(400).json({ message: `ancestors must be a list of at most ${MAX_ANCESTORS} ancestors` });
    return;
  }
  const candidates = toNameCandidates(ancestors);
  if (candidates.length === 0) {
    res.status(400).json({
      message: "We couldn't find any ancestor first names in that file. Check that you picked yourself, and that your parents are in the tree.",
    });
    return;
  }
  const info = await setGedcomImport(req.user!.id, fileName.trim(), candidates);
  res.json({ import: info });
});

// get the imported tree
gedcomRouter.get('/', authenticateToken, async (req: Request, res: Response) => {
  res.json({ import: await getGedcomImport(req.user!.id) });
});

// remove the imported tree
gedcomRouter.delete('/', authenticateToken, async (req: Request, res: Response) => {
  await deleteGedcomImport(req.user!.id);
  res.json({ import: null });
});

export { gedcomRouter };
