import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, apiRequest } from "@/api/client";
import type { RequestOptions } from "@/api/client";
import { logout } from "@/api/auth";
import { forgetPushOnSignOut, resumePush } from "@/notifications/push";
import { AuthContext } from "@/auth/AuthContext";
import type { AuthContextValue, SignInOptions, SignOutOptions } from "@/auth/AuthContext";
import {
  SESSION_KEY,
  clearAuthStorage,
  readLastActivity,
  readSession,
  writeLastActivity,
  writeSession,
} from "@/auth/storage";
import type { Session } from "@/auth/types";
import { IDLE_TIMEOUT_MS } from "@/auth/config";

/**
 * Restores a saved session on page load, unless the user went idle while the
 * app was closed. An expired session is cleared rather than restored.
 */
function restoreSession(): Session | null {
  const session = readSession();
  if (!session) {
    return null;
  }
  const lastActivity = readLastActivity();
  if (lastActivity === null || Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
    clearAuthStorage();
    // Best effort: also end the session on the server.
    logout(session.token).catch(() => undefined);
    return null;
  }
  return session;
}

/** Holds the signed-in session for the whole app and persists it across reloads. */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(restoreSession);
  const token = session?.token ?? null;

  /** Ends the session in this tab and wipes everything the app stored. */
  const clearSession = useCallback(() => {
    clearAuthStorage();
    setSession(null);
  }, []);

  const signIn = useCallback((next: Session, { remember = false }: SignInOptions = {}) => {
    writeLastActivity(Date.now());
    writeSession(next, remember);
    setSession(next);
  }, []);

  const signOut = useCallback(
    async ({ stopNotifications = false }: SignOutOptions = {}) => {
      clearSession();
      if (token) {
        // The local session is already gone; a failed server call shouldn't block logout.
        // Notifications keep coming after an idle timeout, so a partner's match can bring
        // the user back. Only a sign-out they chose turns them off (first, while the token works).
        if (stopNotifications) {
          await forgetPushOnSignOut(token).catch(() => undefined);
        }
        await logout(token).catch(() => undefined);
      }
    },
    [clearSession, token],
  );

  // Notifications are on by default in the installed app: once this device has allowed
  // them, every sign-in subscribes it for the user again, without asking.
  useEffect(() => {
    if (token) {
      resumePush(token).catch((err: unknown) => console.error("Couldn't resume notifications:", err));
    }
  }, [token]);

  // Keep tabs in sync: signing in or out in one tab updates the others.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      // `key` is null when another tab called localStorage.clear().
      if (event.key === SESSION_KEY || event.key === null) {
        setSession(readSession());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const authRequest = useCallback(
    async <T,>(path: string, options?: Omit<RequestOptions, "token">): Promise<T> => {
      try {
        return await apiRequest<T>(path, { ...options, token });
      } catch (error) {
        // The server keeps sessions in memory, so a restart invalidates every token.
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
        }
        throw error;
      }
    },
    [clearSession, token],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token,
      isAuthenticated: session !== null,
      signIn,
      signOut,
      authRequest,
    }),
    [session, token, signIn, signOut, authRequest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
