import { useCallback, useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import { Link } from "react-router";
import type { FavoriteName, Partner, PartnerMatches } from "shared";
import { useAuth } from "@/auth/useAuth";
import { useDemoMode } from "@/auth/useDemoMode";
import DemoModeToggle from "@/components/common/DemoModeToggle";
import Notice from "@/components/common/Notice";
import PageTopbar from "@/components/common/PageTopbar";
import { DEMO_FAVORITES, DEMO_PARTNER } from "@/components/favorites/demoNames";
import NameCard from "@/components/favorites/NameCard";
import type { SavedName } from "@/components/favorites/NameCard";
import { nameDetailPath } from "@/components/favorites/nameDetailPath";
import { useNameDictionary, withDetails } from "@/components/favorites/useNameDictionary";
import "./matches.css";

const initial = (name: string) => name.trim()[0]?.toUpperCase() ?? "?";
const firstName = (name: string | undefined) => name?.trim().split(/\s+/)[0] ?? "You";

/** Route-level page for `/matches`: names the user and their linked partner both liked. */
export default function MatchesView() {
  const { user } = useAuth();
  const [demoMode, setDemoMode] = useDemoMode();

  return (
    <main className="matches-page">
      <title>Matches | LittleRoots</title>
      <div className="matches-container">
        <PageTopbar current={{ to: "/matches", label: "Matches" }}>
          <DemoModeToggle on={demoMode} onChange={setDemoMode} hint="Sample partner and matches" />
        </PageTopbar>

        <header className="matches-heading">
          <span className="matches-eyebrow">YOUR MATCHES</span>
          <h1>Names you both love.</h1>
          <p>Link accounts with your partner and see where your favorites meet.</p>
        </header>

        {demoMode ? <DemoMatches you={firstName(user?.name)} /> : <LiveMatches you={firstName(user?.name)} />}
      </div>
    </main>
  );
}

/** Sample matches between the demo favorites and a demo partner's. */
function DemoMatches({ you }: { you: string }) {
  const partnerNames = new Set(DEMO_PARTNER.favorites.map((f) => f.name));
  const yourNames = new Set(DEMO_FAVORITES.map((f) => f.name));

  return (
    <MatchesBoard
      you={you}
      partnerName={DEMO_PARTNER.name}
      status="Linked · demo"
      shared
      matches={DEMO_FAVORITES.filter((f) => partnerNames.has(f.name))}
      onlyYou={DEMO_FAVORITES.filter((f) => !partnerNames.has(f.name))}
      onlyPartner={DEMO_PARTNER.favorites.filter((f) => !yourNames.has(f.name))}
    />
  );
}

type LiveState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "unlinked"; inviteCode: string }
  | { kind: "linked"; result: PartnerMatches };

/** The real partner link: an invite code to share, or the comparison once linked. */
function LiveMatches({ you }: { you: string }) {
  const { authRequest } = useAuth();
  const [state, setState] = useState<LiveState>({ kind: "loading" });

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const { partner, inviteCode } = await authRequest<{ partner: Partner | null; inviteCode: string }>(
          "/partner",
          { signal },
        );
        if (!partner) {
          setState({ kind: "unlinked", inviteCode });
          return;
        }
        const result = await authRequest<PartnerMatches>("/partner/matches", { signal });
        setState({ kind: "linked", result });
      } catch (err) {
        if (signal?.aborted) return;
        setState({ kind: "error", message: err instanceof Error ? err.message : "Couldn't load your matches." });
      }
    },
    [authRequest],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const unlink = async (partnerName: string) => {
    if (!window.confirm(`Unlink from ${partnerName}? You can link again any time with an invite code.`)) return;
    await authRequest("/partner", { method: "DELETE" }).catch(() => undefined);
    void load();
  };

  if (state.kind === "loading") {
    return (
      <p className="matches-status" role="status">
        Checking your partner link…
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="matches-notice">
        <Notice variant="error" title="Couldn't load matches">
          {state.message}
        </Notice>
      </div>
    );
  }
  if (state.kind === "unlinked") {
    return <LinkPartner you={you} inviteCode={state.inviteCode} onLinked={() => void load()} />;
  }

  const { result } = state;
  // The server lists favorites oldest first; show the newest first like everywhere else.
  const newest = (names: FavoriteName[]) => [...names].reverse();
  return (
    <MatchesBoard
      you={you}
      partnerName={result.partner.name}
      status={`Linked with ${result.partner.email}`}
      shared={result.shared}
      matches={newest(result.matches)}
      onlyYou={newest(result.onlyYou)}
      onlyPartner={newest(result.onlyPartner)}
      onUnlink={() => unlink(result.partner.name)}
    />
  );
}

/** Not linked yet: share your code, or enter your partner's. */
function LinkPartner({ you, inviteCode, onLinked }: { you: string; inviteCode: string; onLinked: () => void }) {
  const { authRequest } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!code.trim()) return;
    setLinking(true);
    setError(null);
    try {
      await authRequest("/partner", { method: "POST", body: { code: code.trim() } });
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work. Please try again.");
    } finally {
      setLinking(false);
    }
  }

  const copy = () => {
    void navigator.clipboard?.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section className="matches-link">
      <div className="matches-avatars" aria-hidden="true">
        <span className="matches-avatar theme-default">{initial(you)}</span>
        <span className="matches-avatar-heart">♥</span>
        <span className="matches-avatar matches-avatar-empty">?</span>
      </div>
      <h2>Link with your partner</h2>
      <p>
        Share your code with your partner, or enter theirs. Once you're linked, every name you both like shows up
        here.
      </p>

      <div className="matches-link-grid">
        <div className="matches-link-box">
          <span className="matches-link-label">Your invite code</span>
          <div className="matches-code-row">
            <code className="matches-code">{inviteCode}</code>
            <button type="button" className="matches-copy" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <form className="matches-link-box" onSubmit={handleSubmit}>
          <label className="matches-link-label" htmlFor="partner-code">
            Partner's code
          </label>
          <div className="matches-code-row">
            <input
              id="partner-code"
              className="matches-code-input"
              value={code}
              maxLength={12}
              placeholder="e.g. K7MPQ2"
              autoComplete="off"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button type="submit" className="matches-btn theme-default" disabled={linking || !code.trim()}>
              {linking ? "Linking…" : "Link"}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="matches-link-error">
          <Notice variant="error">{error}</Notice>
        </div>
      )}
    </section>
  );
}

interface MatchesBoardProps {
  you: string;
  partnerName: string;
  status: string;
  /** False when the partner keeps their favorites private. */
  shared: boolean;
  matches: FavoriteName[];
  onlyYou: FavoriteName[];
  onlyPartner: FavoriteName[];
  onUnlink?: () => void;
}

/** The couple, the names you both like, and the ones only one of you likes. */
function MatchesBoard({ you, partnerName, status, shared, matches, onlyYou, onlyPartner, onUnlink }: MatchesBoardProps) {
  const dictionary = useNameDictionary();
  const details = (names: FavoriteName[]) => names.map((n) => withDetails(n, dictionary));

  return (
    <>
      <section className="matches-couple" aria-label="Linked accounts">
        <div className="matches-avatars" aria-hidden="true">
          <span className="matches-avatar theme-default">{initial(you)}</span>
          <span className="matches-avatar-heart">♥</span>
          <span className="matches-avatar theme-default">{initial(partnerName)}</span>
        </div>
        <p className="matches-couple-names">
          {you} &amp; {partnerName}
        </p>
        <span className="matches-linked">{status}</span>

        <dl className="matches-stats">
          <div>
            <dt>Matches</dt>
            <dd>{matches.length}</dd>
          </div>
          <div>
            <dt>You liked</dt>
            <dd>{matches.length + onlyYou.length}</dd>
          </div>
          <div>
            <dt>{partnerName} liked</dt>
            <dd>{shared ? matches.length + onlyPartner.length : "–"}</dd>
          </div>
        </dl>

        {onUnlink && (
          <button type="button" className="matches-unlink" onClick={onUnlink}>
            Unlink
          </button>
        )}
      </section>

      {!shared ? (
        <div className="matches-notice">
          <Notice variant="info" title={`${partnerName} keeps their favorites private`}>
            Matches will show up once they share their favorites with you from their Dashboard.
          </Notice>
        </div>
      ) : (
        <>
          <section className="matches-section" aria-labelledby="matches-both-title">
            <h2 id="matches-both-title" className="matches-section-title">
              It's a match <span className="matches-count">{matches.length}</span>
            </h2>
            {matches.length === 0 ? (
              <p className="matches-status">No matches yet. When you both like a name, it lands here.</p>
            ) : (
              <ul className="matches-grid">
                {details(matches).map((name) => (
                  <li key={name.name}>
                    <NameCard name={name} badge="♥ Match" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="matches-section" aria-labelledby="matches-deciding-title">
            <h2 id="matches-deciding-title" className="matches-section-title">
              Still deciding
            </h2>
            <div className="matches-columns">
              <NameList title="Only you liked" names={details(onlyYou)} />
              <NameList title={`Only ${partnerName} liked`} names={details(onlyPartner)} />
            </div>
          </section>
        </>
      )}

      <div className="matches-footer">
        <Link to="/discover" className="matches-btn theme-default">
          Discover more names <span aria-hidden="true">→</span>
        </Link>
      </div>
    </>
  );
}

/** Names only one of you liked, as gender-colored chips linking to each name. */
function NameList({ title, names }: { title: string; names: SavedName[] }) {
  return (
    <div className="matches-list">
      <h3>
        {title} <span className="matches-count">{names.length}</span>
      </h3>
      {names.length === 0 ? (
        <p className="matches-status">None right now.</p>
      ) : (
        <ul className="matches-chips">
          {names.map((name) => (
            <li key={name.name} className={`theme-${name.gender ?? "surprise"}`}>
              <Link to={nameDetailPath(name.name, name.gender)} title={name.meaning}>
                {name.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
