import type { GedcomAncestor } from "shared";
import Notice from "@/components/common/Notice";
import GedcomImport from "@/components/wikitree/GedcomImport";

interface WikiTreeLoginPromptProps {
  error: string | null;
  onLogin: () => void;
  onImportGedcom: (fileName: string, ancestors: GedcomAncestor[]) => Promise<void>;
}

/** Shown on Discover until the visitor has connected a family tree: WikiTree or a GEDCOM file. */
export default function WikiTreeLoginPrompt({ error, onLogin, onImportGedcom }: WikiTreeLoginPromptProps) {
  return (
    <section className="wikitree-prompt">
      <div className="gender-heading">
        <span className="gender-eyebrow">CONNECT YOUR FAMILY TREE</span>

        <h1>Bring your family tree</h1>

        <p>
          We'll suggest names from your ancestors.
          <br />
          Sign in to WikiTree, or import a tree from another genealogy site.
        </p>
      </div>

      {error && (
        <div className="wikitree-error">
          <Notice variant="error">{error}</Notice>
        </div>
      )}

      <button type="button" className="discover-start-btn" onClick={onLogin}>
        Sign in with WikiTree
        <span aria-hidden="true">→</span>
      </button>

      <p className="discover-hint">You'll sign in on WikiTree's site. We never see your WikiTree password.</p>

      <p className="gedcom-divider">or</p>

      <GedcomImport onImport={onImportGedcom} />
    </section>
  );
}
