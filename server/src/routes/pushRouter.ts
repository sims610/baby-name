import express from 'express';
import type { Request, Response } from 'express';
import { deletePushSubscription, savePushSubscription } from '../database/database.ts';
import type { StoredPushSubscription } from '../database/database.ts';
import { vapidPublicKey } from '../push.ts';
import { authenticateToken } from './authRouter.ts';

interface EndpointDoc {
  method: string;
  path: string;
  requiresAuth: boolean;
  description: string;
  example: string;
  response: unknown;
}

const MAX_ENDPOINT_LENGTH = 1000;
const MAX_KEY_LENGTH = 255;

function isShortString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/** The JSON a browser's PushSubscription.toJSON() gives, checked before it's saved. */
function parseSubscription(body: unknown): StoredPushSubscription | null {
  const { endpoint, keys } = (body ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (!isShortString(endpoint, MAX_ENDPOINT_LENGTH) || !/^https:\/\//.test(endpoint)) {
    return null;
  }
  if (!isShortString(keys?.p256dh, MAX_KEY_LENGTH) || !isShortString(keys?.auth, MAX_KEY_LENGTH)) {
    return null;
  }
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

const pushRouter = Object.assign(express.Router(), {
  docs: [
    {
      method: 'GET',
      path: '/api/push/public-key',
      requiresAuth: false,
      description: 'The VAPID public key browsers need to subscribe to push notifications (null if push is off)',
      example: `curl localhost:3000/api/push/public-key`,
      response: { publicKey: 'BEl6...' },
    },
    {
      method: 'POST',
      path: '/api/push/subscribe',
      requiresAuth: true,
      description: "Turn on notifications in this browser (for when your partner likes one of your names). Send the browser's PushSubscription JSON.",
      example: `curl -X POST localhost:3000/api/push/subscribe -H 'Content-Type: application/json' -H 'Authorization: Bearer abc123' -d '{"endpoint":"https://...","keys":{"p256dh":"...","auth":"..."}}'`,
      response: { subscribed: true },
    },
    {
      method: 'DELETE',
      path: '/api/push/subscribe',
      requiresAuth: true,
      description: 'Turn off notifications in this browser',
      example: `curl -X DELETE localhost:3000/api/push/subscribe -H 'Content-Type: application/json' -H 'Authorization: Bearer abc123' -d '{"endpoint":"https://..."}'`,
      response: { subscribed: false },
    },
  ] as EndpointDoc[],
});

pushRouter.get('/public-key', (req: Request, res: Response) => {
  res.json({ publicKey: vapidPublicKey() });
});

pushRouter.post('/subscribe', authenticateToken, async (req: Request, res: Response) => {
  const subscription = parseSubscription(req.body);
  if (!subscription) {
    res.status(400).json({ message: 'a push subscription with endpoint and keys is required' });
    return;
  }
  await savePushSubscription(req.user!.id, subscription);
  res.status(201).json({ subscribed: true });
});

pushRouter.delete('/subscribe', authenticateToken, async (req: Request, res: Response) => {
  const { endpoint } = req.body ?? {};
  if (!isShortString(endpoint, MAX_ENDPOINT_LENGTH)) {
    res.status(400).json({ message: 'endpoint is required' });
    return;
  }
  await deletePushSubscription(endpoint, req.user!.id);
  res.json({ subscribed: false });
});

export { pushRouter };
