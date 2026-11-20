import { useId, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { GedcomAncestor } from "shared";
import Notice from "@/components/common/Notice";
import { ancestorsOf, guessHomePerson, parseGedcom, personLabel } from "@/gedcom/parseGedcom";
import type { Gedcom } from "@/gedcom/parseGedcom";
import "./gedcom.css";

interface GedcomImportProps {
  /** Rejects with an Error whose message is shown. */
  onImport: (fileName: string, ancestors: GedcomAncestor[]) => Promise<void>;
  /** Text for the button that opens the file picker. */
  chooseLabel?: string;
}

// Big trees have thousands of people; the picker shows this many matches at a time.
const PICKER_LIMIT = 200;

interface LoadedFile {
  fileName: string;
  gedcom: Gedcom;
  /** Everyone in the file, sorted for the picker. */
  people: { id: string; label: string }[];
}

/**
 * Imports a family tree from a GEDCOM file, the format most genealogy sites and
 * apps export. The file is read here in the browser; only the ancestors' names,
 * sex and birth years are sent to the server.
 */
export default function GedcomImport({ onImport, chooseLabel = "Import a GEDCOM file" }: GedcomImportProps) {
  const inputId = useId();
  const searchId = useId();
  const pickerId = useId();
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [rootId, setRootId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ancestors = useMemo(() => (file && rootId ? ancestorsOf(file.gedcom, rootId) : []), [file, rootId]);

  const matches = useMemo(() => {
    if (!file) return [];
    const q = search.trim().toLowerCase();
    const found = q ? file.people.filter((p) => p.label.toLowerCase().includes(q)) : file.people;
    const shown = found.slice(0, PICKER_LIMIT);
    // Keep the chosen person visible while searching for someone else.
    const chosen = file.people.find((p) => p.id === rootId);
    return chosen && !shown.includes(chosen) ? [chosen, ...shown] : shown;
  }, [file, search, rootId]);

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    // Let the same file be picked again after a failed import.
    event.target.value = "";
    if (!picked) return;
    setError(null);
    setFile(null);
    setSearch("");
    try {
      const gedcom = parseGedcom(await picked.text());
      if (gedcom.people.size === 0) {
        setError("That doesn't look like a GEDCOM file. Export your tree as GEDCOM (.ged) and try again.");
        return;
      }
      const people = [...gedcom.people.values()]
        .map((p) => ({ id: p.id, label: personLabel(p) }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setFile({ fileName: picked.name, gedcom, people });
      setRootId(guessHomePerson(gedcom) ?? "");
    } catch {
      setError("We couldn't read that file. Please try again.");
    }
  };

  const submit = async () => {
    if (!file || ancestors.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await onImport(file.fileName, ancestors);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The import didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gedcom-import">
      {error && <Notice variant="error">{error}</Notice>}

      {!file ? (
        <>
          <label htmlFor={inputId} className="gedcom-choose">
            {chooseLabel}
          </label>
          <input id={inputId} type="file" accept=".ged,.gedcom" className="gedcom-file" onChange={chooseFile} />
          <p className="gedcom-hint">
            Export a .ged file from Ancestry, FamilySearch, MyHeritage, Gramps or your genealogy app. It's read on your
            device; we only keep your ancestors' first names, surnames and birth years.
          </p>
        </>
      ) : (
        <div className="gedcom-confirm">
          <p className="gedcom-file-name">
            <strong>{file.fileName}</strong> · {file.people.length} {file.people.length === 1 ? "person" : "people"}
          </p>

          <label htmlFor={searchId}>Which person in this tree is you?</label>
          <input
            id={searchId}
            type="search"
            className="gedcom-search"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            id={pickerId}
            aria-label="Person in the tree"
            className="gedcom-picker"
            size={6}
            value={rootId}
            onChange={(e) => setRootId(e.target.value)}
          >
            {matches.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <p className="gedcom-count" role="status">
            {ancestors.length > 0
              ? `${ancestors.length} ${ancestors.length === 1 ? "ancestor" : "ancestors"} found.`
              : "No parents found for this person. Pick someone whose parents are in the tree."}
          </p>

          <div className="gedcom-actions">
            <button
              type="button"
              className="discover-start-btn"
              onClick={submit}
              disabled={busy || ancestors.length === 0}
            >
              {busy ? "Importing…" : "Import names"}
              <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="gedcom-cancel" onClick={() => setFile(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
