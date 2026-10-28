import express from 'express';
import type { Request, Response } from 'express';
import type { WikiTreeUser } from 'shared';
import { deleteWikiTreeSession, getWikiTreeSession, setWikiTreeSession } from '../database/database.ts';
import { checkWikiTreeLogin, confirmWikiTreeLogin, logoutWikiTree } from '../wikitree.ts';
import type { WikiTreeSession } from '../wikitree.ts';
import { authenticateToken } from './authRouter.ts';

interface EndpointDoc {
  method: string;
  path: string;
  requiresAuth: boolean;
  description: string;
  example: string;
  response: unknown;
}

const wikitreeRouter = Object.assign(express.Router(), {
  docs: [
    {
      method: 'POST',
      path: '/api/wikitree/login',
      requiresAuth: true,
      description: 'Confirm the authcode WikiTree sent back after sign-in and connect that WikiTree member',
      example: `curl -X POST localhost:3000/api/wikitree/login -H 'Content-Type: application/json' -H 'Authorization: Bearer abc123' -d '{"authcode":"xyz"}'`,
      response: { user: { userId: 12345, userName: 'Smith-1' } },
    },
    {
      method: 'GET',
      path: '/api/wikitree/session',
      requiresAuth: true,
      description: 'Get the connected WikiTree member, or null if not signed in to WikiTree',
      example: `curl localhost:3000/api/wikitree/session -H 'Authorization: Bearer abc123'`,
      response: { user: { userId: 12345, userName: 'Smith-1' } },
    },
    {
      method: 'DELETE',
      path: '/api/wikitree/session',
      requiresAuth: true,
      description: 'Sign out of WikiTree',
      example: `curl -X DELETE localhost:3000/api/wikitree/session -H 'Authorization: Bearer abc123'`,
      response: { user: null },
    },
  ] as EndpointDoc[],
});

// 502 rather than 401 when WikiTree fails: a 401 would sign the user out of our app.
const WIKITREE_UNAVAILABLE = 'WikiTree could not be reached. Please try again.';

function toUser({ userId, userName }: WikiTreeSession): WikiTreeUser {
  return { userId, userName };
}

// connect a WikiTree member
wikitreeRouter.post('/login', authenticateToken, async (req: Request, res: Response) => {
  const { authcode } = req.body ?? {};
  if (typeof authcode !== 'string' || authcode.trim().length === 0) {
    res.status(400).json({ message: 'authcode is required' });
    return;
  }
  let session: WikiTreeSession | null;
  try {
    session = await confirmWikiTreeLogin(authcode.trim());
  } catch {
    res.status(502).json({ message: WIKITREE_UNAVAILABLE });
    return;
  }
  if (!session) {
    res.status(400).json({ message: "WikiTree sign-in didn't complete. Please try again." });
    return;
  }
  setWikiTreeSession(req.user!.id, session);
  res.json({ user: toUser(session) });
});

// get the connected WikiTree member
wikitreeRouter.get('/session', authenticateToken, async (req: Request, res: Response) => {
  const session = getWikiTreeSession(req.user!.id);
  if (!session) {
    res.json({ user: null });
    return;
  }
  // Without cookies there is nothing to re-check; the confirmed authcode is all we have.
  if (session.cookies) {
    let signedIn: boolean;
    try {
      signedIn = await checkWikiTreeLogin(session);
    } catch {
      res.status(502).json({ message: WIKITREE_UNAVAILABLE });
      return;
    }
    if (!signedIn) {
      deleteWikiTreeSession(req.user!.id);
      res.json({ user: null });
      return;
    }
  }
  res.json({ user: toUser(session) });
});

// sign out of WikiTree
wikitreeRouter.delete('/session', authenticateToken, async (req: Request, res: Response) => {
  const session = getWikiTreeSession(req.user!.id);
  deleteWikiTreeSession(req.user!.id);
  if (session?.cookies) {
    // Best effort: our copy of the session is already gone either way.
    await logoutWikiTree(session).catch(() => undefined);
  }
  res.json({ user: null });
});

export { wikitreeRouter };
