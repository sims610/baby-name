import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/useAuth";
import { disablePush, enablePush, getPushState } from "@/notifications/push";
import type { PushState } from "@/notifications/push";

export interface PushNotifications {
  /** Null while checking this device. */
  state: PushState | null;
  busy: boolean;
  error: string | null;
  /** Call straight from a click: it may show the permission prompt. */
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

/** This device's match notifications: whether they're on, and switching them. */
export function usePushNotifications(): PushNotifications {
  const { token, authRequest } = useAuth();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPushState()
      .then((next) => active && setState(next))
      .catch(() => active && setState("unsupported"));
    return () => {
      active = false;
    };
  }, []);

  // `work` is called before anything is awaited, so a permission prompt stays inside the click.
  const run = useCallback(async (work: () => Promise<PushState>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      setState(await work());
    } catch (err) {
      setError(err instanceof Error ? err.message : failure);
      setState(await getPushState().catch(() => "unsupported" as const));
    } finally {
      setBusy(false);
    }
  }, []);

  const enable = useCallback(
    () =>
      run(
        () => (token ? enablePush(token) : Promise.reject(new Error("Please sign in again."))),
        "Couldn't turn on notifications. Please try again.",
      ),
    [token, run],
  );

  const disable = useCallback(
    () =>
      run(async () => {
        await disablePush(authRequest);
        return "off";
      }, "Couldn't turn off notifications. Please try again."),
    [authRequest, run],
  );

  return { state, busy, error, enable, disable };
}
