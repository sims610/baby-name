import express from 'express';
import type { Request, Response } from 'express';
import type { FavoritesVisibility } from 'shared';
import { getVisibility, setVisibility } from '../database/database.ts';
import { authenticateToken } from './authRouter.ts';

interface EndpointDoc {
  method: string;
  path: string;
  requiresAuth: boolean;
  description: string;
  example: string;
  response: unknown;
}

const VISIBILITIES: FavoritesVisibility[] = ['private', 'partner', 'public'];

const settingsRouter = Object.assign(express.Router(), {
  docs: [
    {
      method: 'GET',
      path: '/api/settings',
      requiresAuth: true,
      description: 'Get your account settings',
      example: `curl localhost:3000/api/settings -H 'Authorization: Bearer abc123'`,
      response: { favoritesVisibility: 'partner' },
    },
    {
      method: 'PUT',
      path: '/api/settings',
      requiresAuth: true,
      description:
        'Choose who can see your favorites: private (only you), partner (your linked partner), or public. "private" hides them from Matches too.',
      example: `curl -X PUT localhost:3000/api/settings -H 'Content-Type: application/json' -H 'Authorization: Bearer abc123' -d '{"favoritesVisibility":"private"}'`,
      response: { favoritesVisibility: 'private' },
    },
  ] as EndpointDoc[],
});

settingsRouter.get('/', authenticateToken, (req: Request, res: Response) => {
  res.json({ favoritesVisibility: getVisibility(req.user!.id) });
});

settingsRouter.put('/', authenticateToken, (req: Request, res: Response) => {
  const { favoritesVisibility } = req.body ?? {};
  if (!VISIBILITIES.includes(favoritesVisibility)) {
    res.status(400).json({ message: `favoritesVisibility must be one of ${VISIBILITIES.join(', ')}` });
    return;
  }
  setVisibility(req.user!.id, favoritesVisibility);
  res.json({ favoritesVisibility });
});

export { settingsRouter };
