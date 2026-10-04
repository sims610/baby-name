import express from 'express';
import type { Request, Response } from 'express';
import { getRandomName, addFavorite } from '../database/database.ts';
import type { NameGender } from '../database/database.ts';
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
      path: '/api/name?gender=boy|girl',
      requiresAuth: true,
      description: 'Generate a random name. Omit gender for either.',
      example: `curl localhost:3000/api/name?gender=girl -H 'Authorization: Bearer abc123'`,
      response: { name: 'Hazel', gender: 'girl' },
    },
    {
      method: 'POST',
      path: '/api/name',
      requiresAuth: true,
      description: 'Save a name as a favorite',
      example: `curl -X POST localhost:3000/api/name -H 'Content-Type: application/json' -H 'Authorization: Bearer abc123' -d '{"name":"Hazel", "gender":"girl"}'`,
      response: { favorites: [{ name: 'Hazel', gender: 'girl' }] },
    },
  ] as EndpointDoc[],
});

function isNameGender(value: unknown): value is NameGender {
  return value === 'boy' || value === 'girl';
}

// generate name
nameRouter.get('/', authenticateToken, (req: Request, res: Response) => {
  const { gender } = req.query;
  if (gender !== undefined && !isNameGender(gender)) {
    res.status(400).json({ message: 'gender must be "boy" or "girl"' });
    return;
  }
  const result = getRandomName(gender);
  if (!result) {
    res.status(404).json({ message: 'no names found' });
    return;
  }
  res.json(result);
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

export { nameRouter };
