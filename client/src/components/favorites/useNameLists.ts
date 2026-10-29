import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { FavoriteName } from "shared";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import { DEMO_FAVORITES, DEMO_SHORTLIST } from "./demoNames";
import type { SavedName } from "./NameCard";
import { useNameDictionary, withDetails } from "./useNameDictionary";

/** How many final picks the user can make. Matches the server's limit. */
export const SHORTLIST_SIZE = 3;

interface Lists {
  /** Liked names, newest first. */
  favorites: SavedName[];
  /** Up to SHORTLIST_SIZE favorite names, best first. */
  shortlist: string[];
}

export interface NameLists extends Lists {
  loading: boolean;
  /** Loading the lists failed. */
  error: string | null;
  /** The last change (remove, shortlist, …) failed. */
  actionError: string | null;
  isFavorite: (name: string) => boolean;
  isShortlisted: (name: string) => boolean;
  addFavorite: (name: SavedName) => Promise<void>;
  removeFavorite: (name: string) => Promise<void>;
  /** Adds a favorite to the end of the shortlist, or takes it off. No-op when the list is full. */
  toggleShortlist: (name: string) => Promise<void>;
  /** Replaces the shortlist, e.g. after a drag and drop. Extra names past the limit are dropped. */
  setShortlist: (names: string[]) => Promise<void>;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function withShortlistToggled(shortlist: string[], name: string): string[] {
  if (shortlist.some((n) => same(n, name))) return shortlist.filter((n) => !same(n, name));
  return shortlist.length < SHORTLIST_SIZE ? [...shortlist, name] : shortlist;
}

// ---- Demo mode: kept in memory, so changes last until the page reloads ----

let demoLists: Lists = { favorites: DEMO_FAVORITES, shortlist: DEMO_SHORTLIST };
const demoListeners = new Set<() => void>();

function updateDemo(change: (lists: Lists) => Partial<Lists>): void {
  demoLists = { ...demoLists, ...change(demoLists) };
  demoListeners.forEach((listener) => listener());
}

function subscribeDemo(listener: () => void) {
  demoListeners.add(listener);
  return () => demoListeners.delete(listener);
}

// ---- Hook ----

const newestFirst = (favorites: FavoriteName[]) => [...favorites].reverse();

/** The user's favorites and shortlist, from the server or from demo data. */
export function useNameLists(demoMode: boolean): NameLists {
  const { authRequest } = useAuth();
  const dictionary = useNameDictionary();
  const demo = useSyncExternalStore(subscribeDemo, () => demoLists);
  const [live, setLive] = useState<Lists>({ favorites: [], shortlist: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    const controller = new AbortController();
    const get = <T,>(path: string) => authRequest<T>(path, { signal: controller.signal });
    setLoading(true);
    setError(null);

    Promise.all([get<{ favorites: FavoriteName[] }>("/name/favorites"), get<{ shortlist: string[] }>("/name/shortlist")])
      .then(([f, s]) => setLive({ favorites: newestFirst(f.favorites), shortlist: s.shortlist }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Couldn't load your names. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [authRequest, demoMode]);

  const lists = demoMode ? demo : live;

  /** Applies a change to demo data, or sends it to the server and keeps what comes back. */
  const change = useCallback(
    async (demoChange: (lists: Lists) => Partial<Lists>, server: () => Promise<Partial<Lists>>) => {
      setActionError(null);
      if (demoMode) {
        updateDemo(demoChange);
        return;
      }
      try {
        const next = await server();
        setLive((current) => ({ ...current, ...next }));
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "That didn't save. Please try again.");
      }
    },
    [demoMode],
  );

  const putShortlist = async (names: string[]) => {
    const res = await authRequest<{ shortlist: string[] }>("/name/shortlist", { method: "PUT", body: { names } });
    return { shortlist: res.shortlist };
  };

  const addFavorite = (name: SavedName) =>
    change(
      (l) => (l.favorites.some((f) => same(f.name, name.name)) ? {} : { favorites: [name, ...l.favorites] }),
      async () => {
        try {
          const res = await authRequest<{ favorites: FavoriteName[] }>("/name", {
            method: "POST",
            body: { name: name.name, gender: name.gender },
          });
          return { favorites: newestFirst(res.favorites) };
        } catch (err) {
          // 409: already a favorite, which is what the user wanted.
          if (err instanceof ApiError && err.status === 409) return {};
          throw err;
        }
      },
    );

  const removeFavorite = (name: string) =>
    change(
      (l) => ({
        favorites: l.favorites.filter((f) => !same(f.name, name)),
        shortlist: l.shortlist.filter((n) => !same(n, name)),
      }),
      async () => {
        const res = await authRequest<{ favorites: FavoriteName[] }>(`/name/favorites/${encodeURIComponent(name)}`, {
          method: "DELETE",
        });
        return { favorites: newestFirst(res.favorites), shortlist: live.shortlist.filter((n) => !same(n, name)) };
      },
    );

  const toggleShortlist = (name: string) =>
    change(
      (l) => ({ shortlist: withShortlistToggled(l.shortlist, name) }),
      () => putShortlist(withShortlistToggled(live.shortlist, name)),
    );

  const setShortlist = (names: string[]) => {
    const picks = names.slice(0, SHORTLIST_SIZE);
    return change(
      () => ({ shortlist: picks }),
      () => putShortlist(picks),
    );
  };

  return {
    favorites: lists.favorites.map((f) => withDetails(f, dictionary)),
    shortlist: lists.shortlist,
    loading: demoMode ? false : loading,
    error: demoMode ? null : error,
    actionError,
    isFavorite: (name) => lists.favorites.some((f) => same(f.name, name)),
    isShortlisted: (name) => lists.shortlist.some((n) => same(n, name)),
    addFavorite,
    removeFavorite,
    toggleShortlist,
    setShortlist,
  };
}
