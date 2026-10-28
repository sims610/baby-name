import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import type { WikiTreeUser } from "shared";
import { logoutWikiTreeInBrowser, wikiTreeLoginUrl } from "@/api/wikitree";
import { useAuth } from "@/auth/useAuth";

export type WikiTreeLoginStatus = "checking" | "signedOut" | "signedIn";

export interface WikiTreeLoginState {
  status: WikiTreeLoginStatus;
  user: WikiTreeUser | null;
  error: string | null;
  login: () => void;
  logout: () => void;
}

type WikiTreeResponse = { user: WikiTreeUser | null };

// An authcode can only be exchanged once. StrictMode runs effects twice in
// development, so both runs share the same request.
const pendingAuthcodes = new Map<string, Promise<WikiTreeResponse>>();

/**
 * Tracks whether the visitor is signed in to WikiTree. Handles the `?authcode=`
 * redirect back from WikiTree, and asks the server to re-check on every visit.
 */
export function useWikiTreeLogin(): WikiTreeLoginState {
  const { authRequest } = useAuth();
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const authcode = searchParams.get("authcode");

  const [status, setStatus] = useState<WikiTreeLoginStatus>("checking");
  const [user, setUser] = useState<WikiTreeUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    let request: Promise<WikiTreeResponse>;
    if (authcode) {
      request = pendingAuthcodes.get(authcode) ?? authRequest<WikiTreeResponse>("/wikitree/login", { method: "POST", body: { authcode } });
      pendingAuthcodes.set(authcode, request);
    } else {
      request = authRequest<WikiTreeResponse>("/wikitree/session");
    }

    request
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        // Keep a failed authcode's error visible after the URL is cleaned up.
        if (data.user) setError(null);
        setStatus(data.user ? "signedIn" : "signedOut");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setUser(null);
        setError(err instanceof Error ? err.message : "WikiTree sign-in failed. Please try again.");
        setStatus("signedOut");
      })
      .finally(() => {
        // Drop the one-time code from the address bar either way.
        if (!cancelled && authcode) {
          navigate(pathname, { replace: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authcode, authRequest, navigate, pathname]);

  const login = useCallback(() => {
    window.location.assign(wikiTreeLoginUrl(`${window.location.origin}${pathname}`));
  }, [pathname]);

  const logout = useCallback(() => {
    // End the server's WikiTree session and the browser's, then show the sign-in
    // prompt again in place. Failures are ignored: signing out shouldn't get stuck.
    Promise.allSettled([authRequest("/wikitree/session", { method: "DELETE" }), logoutWikiTreeInBrowser()]).then(() => {
      setUser(null);
      setError(null);
      setStatus("signedOut");
    });
  }, [authRequest]);

  return { status, user, error, login, logout };
}
