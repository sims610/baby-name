import { useEffect, useState } from "react";
import type { BabyName } from "shared";
import { useAuth } from "@/auth/useAuth";
import type { SavedName } from "./NameCard";

type Dictionary = Map<string, BabyName>;

// Fetched once per page load and shared by every page that needs it.
let request: Promise<Dictionary> | null = null;

/**
 * Origins and meanings the server knows, keyed by lowercase name. The sample
 * names come with them, so we borrow the demo list. Null until loaded.
 */
export function useNameDictionary(): Dictionary | null {
  const { authRequest } = useAuth();
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);

  useEffect(() => {
    let active = true;
    request ??= authRequest<{ names: BabyName[] }>("/name/list?source=demo").then(
      (data) => new Map(data.names.map((n) => [n.name.toLowerCase(), n])),
    );
    request.then(
      (loaded) => active && setDictionary(loaded),
      () => {
        // Try again next time; cards just show without meanings meanwhile.
        request = null;
      },
    );
    return () => {
      active = false;
    };
  }, [authRequest]);

  return dictionary;
}

/** Adds the origin and meaning from the dictionary, when it has them. */
export function withDetails(name: SavedName, dictionary: Dictionary | null): SavedName {
  const entry = dictionary?.get(name.name.toLowerCase());
  return entry ? { ...name, origin: name.origin ?? entry.origin, meaning: name.meaning ?? entry.meaning } : name;
}
