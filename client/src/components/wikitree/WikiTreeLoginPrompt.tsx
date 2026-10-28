import Notice from "@/components/common/Notice";

interface WikiTreeLoginPromptProps {
  error: string | null;
  onLogin: () => void;
}

/** Shown on Discover until the visitor has signed in to WikiTree. */
export default function WikiTreeLoginPrompt({ error, onLogin }: WikiTreeLoginPromptProps) {
  return (
    <section className="wikitree-prompt">
      <div className="gender-heading">
        <span className="gender-eyebrow">CONNECT YOUR FAMILY TREE</span>

        <h1>Sign in with WikiTree</h1>

        <p>
          We'll suggest names from your ancestors on WikiTree.
          <br />
          Sign in to WikiTree to start discovering.
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
    </section>
  );
}
