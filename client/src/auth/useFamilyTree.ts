import { useCallback, useEffect, useState } from "react";
import type { GedcomAncestor, GedcomImport } from "shared";
import { useAuth } from "@/auth/useAuth";
import { useWikiTreeLogin } from "@/auth/useWikiTreeLogin";
import type { WikiTreeLoginState } from "@/auth/useWikiTreeLogin";

/** Where the user's own names come from: WikiTree, an imported GEDCOM file, or nowhere yet. */
export type FamilyTreeStatus = "checking" | "none" | "wikitree" | "gedcom";

export interface FamilyTreeState {
  status: FamilyTreeStatus;
  wikiTree: WikiTreeLoginState;
  gedcom: GedcomImport | null;
  gedcomError: string | null;
  /** Sends the ancestors read from a GEDCOM file. Rejects with a message to show. */
  importGedcom: (fileName: string, ancestors: GedcomAncestor[]) => Promise<void>;
  removeGedcom: () => void;
}

type GedcomResponse = { import: GedcomImport | null };

/**
 * The user's family tree, from either source. Wraps `useWikiTreeLogin` (so a
 * WikiTree sign-in redirect still completes) and the GEDCOM import. Only one is
 * active at a time: the server drops the other when one is set up.
 */
export function useFamilyTree(): FamilyTreeState {
  const { authRequest } = useAuth();
  const wikiTree = useWikiTreeLogin();
  const { markSignedOut } = wikiTree;

  const [gedcom, setGedcom] = useState<GedcomImport | null>(null);
  const [gedcomLoading, setGedcomLoading] = useState(true);
  const [gedcomError, setGedcomError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authRequest<GedcomResponse>("/gedcom")
      .then((data) => {
        if (!cancelled) setGedcom(data.import);
      })
      .catch(() => {
        // Treated as no import: the WikiTree prompt and import form still work.
      })
      .finally(() => {
        if (!cancelled) setGedcomLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authRequest]);

  // A WikiTree sign-in replaces the import on the server.
  const wikiTreeSignedIn = wikiTree.status === "signedIn";
  useEffect(() => {
    if (wikiTreeSignedIn) setGedcom(null);
  }, [wikiTreeSignedIn]);

  const importGedcom = useCallback(
    async (fileName: string, ancestors: GedcomAncestor[]) => {
      const data = await authRequest<GedcomResponse>("/gedcom", { method: "POST", body: { fileName, ancestors } });
      setGedcom(data.import);
      setGedcomError(null);
      markSignedOut();
    },
    [authRequest, markSignedOut],
  );

  const removeGedcom = useCallback(() => {
    authRequest("/gedcom", { method: "DELETE" })
      .then(() => {
        setGedcom(null);
        setGedcomError(null);
      })
      .catch((err: unknown) => {
        setGedcomError(err instanceof Error ? err.message : "Couldn't remove the imported tree. Please try again.");
      });
  }, [authRequest]);

  const status: FamilyTreeStatus =
    wikiTree.status === "signedIn"
      ? "wikitree"
      : wikiTree.status === "checking" || gedcomLoading
        ? "checking"
        : gedcom
          ? "gedcom"
          : "none";

  return { status, wikiTree, gedcom, gedcomError, importGedcom, removeGedcom };
}
