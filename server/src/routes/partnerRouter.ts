import express from 'express';
import type { Request, Response } from 'express';
import { comparePartnerFavorites, getInviteCode, getPartner, linkPartner, unlinkPartner } from '../database/database.ts';
import { authenticateToken } from './authRouter.ts';

interface EndpointDoc {
  method: string;
  path: string;
  requiresAuth: boolean;
  description: string;
  example: string;
  response: unknown;
}

const partnerRouter = Object.assign(express.Router(), {
  docs: [
    {
      method: 'GET',
      path: '/api/partner',
      requiresAuth: true,
      description: 'Get your linked partner (or null) and the invite code to share with them',
      example: `curl localhost:3000/api/partner -H 'Authorization: Bearer abc123'`,
      response: { partner: { name: 'Daniel', email: 'test2@gmail.com' }, inviteCode: 'K7MPQ2' },
    },
    {
      method: 'POST',
      path: '/api/partner',
      requiresAuth: true,
      description: "Link with your partner using their invite code",
      example: `curl -X POST localhost:3000/api/partner -H 'Content-Type: application/json' -H 'Authorization: Bearer abc123' -d '{"code":"K7MPQ2"}'`,
      response: { partner: { name: 'Daniel', email: 'test2@gmail.com' } },
    },
    {
      method: 'DELETE',
      path: '/api/partner',
      requiresAuth: true,
      description: 'Unlink from your partner',
      example: `curl -X DELETE localhost:3000/api/partner -H 'Authorization: Bearer abc123'`,
      response: { partner: null },
    },
    {
      method: 'GET',
      path: '/api/partner/matches',
      requiresAuth: true,
      description: "Compare your favorites with your partner's: names you both like, and names only one of you likes",
      example: `curl localhost:3000/api/partner/matches -H 'Authorization: Bearer abc123'`,
      response: {
        partner: { name: 'Daniel', email: 'test2@gmail.com' },
        shared: true,
        matches: [{ name: 'Hazel', gender: 'girl' }],
        onlyYou: [{ name: 'Oliver', gender: 'boy' }],
        onlyPartner: [{ name: 'Rose', gender: 'girl' }],
      },
    },
  ] as EndpointDoc[],
});

// get partner and invite code
partnerRouter.get('/', authenticateToken, (req: Request, res: Response) => {
  const userId = req.user!.id;
  res.json({ partner: getPartner(userId), inviteCode: getInviteCode(userId) });
});

// link with a partner
partnerRouter.post('/', authenticateToken, (req: Request, res: Response) => {
  const { code } = req.body ?? {};
  if (typeof code !== 'string' || code.trim().length === 0 || code.length > 20) {
    res.status(400).json({ message: 'code is required' });
    return;
  }
  const result = linkPartner(req.user!.id, code);
  if ('error' in result) {
    res.status(result.status).json({ message: result.error });
    return;
  }
  res.json(result);
});

// unlink
partnerRouter.delete('/', authenticateToken, (req: Request, res: Response) => {
  unlinkPartner(req.user!.id);
  res.json({ partner: null });
});

// compare favorites
partnerRouter.get('/matches', authenticateToken, (req: Request, res: Response) => {
  const result = comparePartnerFavorites(req.user!.id);
  if (!result) {
    res.status(404).json({ message: 'Link with a partner to see your matches' });
    return;
  }
  res.json(result);
});

export { partnerRouter };
