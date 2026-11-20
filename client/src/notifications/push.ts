// Web Push in the browser: asks permission, subscribes this device through the service
// worker (public/sw.js), and tells the API where to send match notifications.
//
// Notifications are only offered in the installed app (added to the Home Screen or
// installed from the browser), never in an ordinary browser tab. They're on by default
// there: the app asks at natural moments (linking a partner, copying an invite code),
// and once the device has allowed notifications it subscribes again by itself at every
// sign-in, unless the user switched them off on the dashboard.

import { apiRequest } from "@/api/client";
import type { RequestOptions } from "@/api/client";

/** Calls the API as the signed-in user (AuthContext's authRequest). */
type AuthRequest = <T>(path: string, options?: Omit<RequestOptions, "token">) => Promise<T>;

export type PushState =
  /** Running in a browser tab: notifications are only offered in the installed app. */
  | "needsInstall"
  /** This device can't do push, or the service worker isn't running (e.g. in development). */
  | "unsupported"
  /** The user blocked notifications; only the device's settings can undo that. */
  | "denied"
  /** Never asked on this device: a click can show the permission prompt. */
  | "prompt"
  /** Allowed, but switched off on the dashboard. */
  | "off"
  | "subscribed";

export function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function canPush(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** The service worker, if one is running. Never waits: in development there is none. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

// Remembers "I switched notifications off" on this device. Deliberately outside the
// "littleroots." prefix, so signing out (which clears those keys) doesn't undo the choice.
const OPTED_OUT_KEY = "littleroots-push-off";

function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPTED_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

function setOptedOut(off: boolean): void {
  try {
    if (off) localStorage.setItem(OPTED_OUT_KEY, "1");
    else localStorage.removeItem(OPTED_OUT_KEY);
  } catch {
    // Blocked storage: the choice just isn't remembered on this device.
  }
}

export async function getPushState(): Promise<PushState> {
  if (!isInstalled()) return "needsInstall";
  if (!canPush()) return "unsupported";
  const reg = await registration();
  if (!reg) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "default") return "prompt";
  return (await reg.pushManager.getSubscription()) ? "subscribed" : "off";
}

/** VAPID keys are URL-safe base64; the Push API wants the raw bytes. */
function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Subscribes this device (permission already granted) and registers it for the signed-in user. */
async function subscribe(token: string): Promise<void> {
  const reg = await registration();
  if (!reg) return;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(await publicKey()),
    }));
  // Sent even if the device was already subscribed: it may have belonged to someone else.
  await apiRequest("/push/subscribe", { method: "POST", body: subscription.toJSON(), token });
}

async function publicKey(): Promise<string> {
  const { publicKey } = await apiRequest<{ publicKey: string | null }>("/push/public-key");
  if (!publicKey) throw new Error("Notifications aren't set up on the server yet.");
  return publicKey;
}

/**
 * Turns match notifications on. Call it straight from a click handler: the permission
 * prompt is requested before anything else is awaited, because browsers (Safari above
 * all) only show it during the click. Returns the resulting state.
 */
export async function enablePush(token: string): Promise<PushState> {
  if (!isInstalled()) return "needsInstall";
  if (!canPush()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "prompt";
  setOptedOut(false);
  await subscribe(token);
  return "subscribed";
}

/**
 * Asks for notifications at a natural moment (a click that's about the partner), but
 * only if this device has never been asked. Call it straight from the click handler.
 */
export function offerPush(token: string | null): void {
  if (!token || !isInstalled() || !canPush() || Notification.permission !== "default" || isOptedOut()) return;
  enablePush(token).catch((err: unknown) => console.error("Couldn't turn on notifications:", err));
}

/**
 * At sign-in: if this device already allowed notifications, subscribe it for this user
 * without asking again. Does nothing in a browser tab or after the user switched them off.
 */
export async function resumePush(token: string): Promise<void> {
  if (!isInstalled() || !canPush() || Notification.permission !== "granted" || isOptedOut()) return;
  await subscribe(token);
}

/** The dashboard switch: turns notifications off on this device and remembers that. */
export async function disablePush(authRequest: AuthRequest): Promise<void> {
  setOptedOut(true);
  const subscription = await (await registration())?.pushManager.getSubscription();
  if (!subscription) return;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  await authRequest("/push/subscribe", { method: "DELETE", body: { endpoint } });
}

/**
 * On a sign-out the user chose: stop this device getting the signed-out user's
 * notifications. They come back at the next sign-in (see resumePush). Best effort,
 * and takes the token directly because the session is already cleared.
 */
export async function forgetPushOnSignOut(token: string): Promise<void> {
  const subscription = await (await registration())?.pushManager.getSubscription();
  if (!subscription) return;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  await apiRequest("/push/subscribe", { method: "DELETE", body: { endpoint }, token });
}

// The Matches page asks once, for a partner who was never asked (they shared their code
// without copying it, so they never clicked anything); this remembers "not now".
const NUDGE_DISMISSED_KEY = "littleroots.pushNudgeDismissed";

export function isNudgeDismissed(): boolean {
  try {
    return localStorage.getItem(NUDGE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissNudge(): void {
  try {
    localStorage.setItem(NUDGE_DISMISSED_KEY, "1");
  } catch {
    // Private mode or blocked storage: the card just shows again next time.
  }
}
