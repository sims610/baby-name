// Push notifications to the user's devices, sent with Web Push (VAPID).
//
// Configure with environment variables (generate a pair with `npx web-push generate-vapid-keys`):
//   VAPID_PUBLIC_KEY   given to browsers when they subscribe (GET /api/push/public-key)
//   VAPID_PRIVATE_KEY  signs each push; keep it secret
//   VAPID_SUBJECT      how a push service can reach us, e.g. "mailto:hello@little-roots.app"
// Without the keys, notifications are printed to the console instead.

import { deletePushSubscription, findPartnerToNotify, listPushSubscriptions } from './database/database.ts';
import type { StoredPushSubscription } from './database/database.ts';

/** What the service worker shows (see client/public/sw.js). */
export interface PushPayload {
  title: string;
  body: string;
  /** Page to open when the notification is clicked. */
  url: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag: string;
}

/** Thrown by a transport when the push service says the subscription no longer exists. */
export class SubscriptionGoneError extends Error {}

/** Something that delivers a push to one browser. Swappable so tests can capture pushes. */
export type PushTransport = (subscription: StoredPushSubscription, payload: PushPayload) => Promise<void>;

const DEFAULT_SUBJECT = 'mailto:hello@little-roots.app';

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

const webPushTransport: PushTransport = async (subscription, payload) => {
  // web-push is ESM-only; loaded here so nothing else (like the Jest tests) has to load it.
  const { sendNotification, WebPushError } = await import('web-push');
  try {
    await sendNotification(subscription, JSON.stringify(payload), {
      TTL: 24 * 60 * 60,
      urgency: 'high',
      vapidDetails: {
        subject: process.env.VAPID_SUBJECT ?? DEFAULT_SUBJECT,
        publicKey: process.env.VAPID_PUBLIC_KEY!,
        privateKey: process.env.VAPID_PRIVATE_KEY!,
      },
    });
  } catch (error) {
    // 404/410: the user turned notifications off or the browser dropped the subscription.
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      throw new SubscriptionGoneError(error.message);
    }
    throw error;
  }
};

const consoleTransport: PushTransport = async (subscription, payload) => {
  console.log(`[push] VAPID keys are not set, so this push was not sent: ${payload.title}: ${payload.body}`);
};

let transport: PushTransport | null = null;

/** For tests: replace how pushes are delivered. Pass null to go back to the default. */
export function setPushTransport(next: PushTransport | null): void {
  transport = next;
}

function deliver(): PushTransport {
  return transport ?? (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? webPushTransport : consoleTransport);
}

/** Sends the payload to every browser the user subscribed. Never throws. */
export async function notifyUser(userId: string, payload: PushPayload): Promise<void> {
  const subscriptions = await listPushSubscriptions(userId);
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await deliver()(subscription, payload);
      } catch (error) {
        if (error instanceof SubscriptionGoneError) {
          await deletePushSubscription(subscription.endpoint);
        } else {
          console.error('[push] could not send a notification', error);
        }
      }
    }),
  );
}

export function matchPayload(partnerName: string, name: string): PushPayload {
  return {
    title: "It's a match! 💚",
    body: `${partnerName} also loves ${name}.`,
    url: '/matches',
    tag: `match-${name.toLowerCase()}`,
  };
}

// Pushes still being sent, so tests can wait for them (see flushPushes).
const pending = new Set<Promise<void>>();

/**
 * The user just liked `name`. If their partner had already liked it, tell the partner.
 * Runs in the background, so saving the favorite doesn't wait on push services.
 */
export function notifyPartnerOfMatch(user: { id: string; name: string }, name: string): void {
  const work = (async () => {
    const partnerId = await findPartnerToNotify(user.id, name);
    if (partnerId) {
      await notifyUser(partnerId, matchPayload(user.name, name));
    }
  })()
    .catch((error: unknown) => console.error('[push] match notification failed', error))
    .finally(() => pending.delete(work));
  pending.add(work);
}

/** For tests: waits until every background push has been handled. */
export async function flushPushes(): Promise<void> {
  while (pending.size > 0) {
    await Promise.all(pending);
  }
}
