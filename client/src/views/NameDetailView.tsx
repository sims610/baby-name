import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import type { NameGender, NameInfo, NameRoot } from "shared";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import { useDemoMode } from "@/auth/useDemoMode";
import DemoModeToggle from "@/components/common/DemoModeToggle";
import Notice from "@/components/common/Notice";
import PageTopbar from "@/components/common/PageTopbar";
import { nameDetailPath } from "@/components/favorites/nameDetailPath";
import { SHORTLIST_SIZE, useNameLists } from "@/components/favorites/useNameLists";
import "@/components/favorites/NameCard.css";
import "./nameDetail.css";

const genderLabels: Record<NameGender | "any", string> = { boy: "♂ Boy", girl: "♀ Girl", any: "✦ Any" };

const isGender = (value: string | null | undefined): value is NameGender => value === "boy" || value === "girl";

/** Route-level page for `/names/:name`: one name's story, and what you've decided about it. */
export default function NameDetailView() {
  const { name: rawName = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { user, authRequest } = useAuth();
  const [demoMode, setDemoMode] = useDemoMode();
  const lists = useNameLists(demoMode);

  const [info, setInfo] = useState<NameInfo | null>(null);
  const [infoState, setInfoState] = useState<"loading" | "found" | "unknown" | "error">("loading");
  const [roots, setRoots] = useState<NameRoot[]>([]);
  const [lastName, setLastName] = useState(() => {
    const parts = user?.name.trim().split(/\s+/) ?? [];
    return parts.length > 1 ? parts[parts.length - 1] : "";
  });

  useEffect(() => {
    const controller = new AbortController();
    setInfoState("loading");
    authRequest<NameInfo>(`/name/info/${encodeURIComponent(rawName)}`, { signal: controller.signal })
      .then((data) => {
        setInfo(data);
        setInfoState("found");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setInfo(null);
        setInfoState(err instanceof ApiError && err.status === 404 ? "unknown" : "error");
      });
    return () => controller.abort();
  }, [authRequest, rawName]);

  // Ancestors who had this name. Quietly empty when the tree can't be read (e.g. no WikiTree sign-in).
  useEffect(() => {
    const controller = new AbortController();
    const source = demoMode ? "demo" : "wikitree";
    authRequest<{ roots: NameRoot[] }>(`/name/roots/${encodeURIComponent(rawName)}?source=${source}`, {
      signal: controller.signal,
    })
      .then((data) => setRoots(data.roots))
      .catch(() => {
        if (!controller.signal.aborted) setRoots([]);
      });
    return () => controller.abort();
  }, [authRequest, rawName, demoMode]);

  const saved = lists.favorites.find((f) => f.name.toLowerCase() === rawName.toLowerCase());
  const name = saved?.name ?? info?.name ?? rawName;
  const queryGender = searchParams.get("gender");
  const gender = saved?.gender ?? (isGender(queryGender) ? queryGender : undefined);
  const origin = info?.origin ?? saved?.origin;
  const meaning = info?.meaning ?? saved?.meaning;

  const favorite = lists.isFavorite(name);
  const rank = lists.shortlist.findIndex((n) => n.toLowerCase() === name.toLowerCase()) + 1;
  const shortlistFull = lists.shortlist.length >= SHORTLIST_SIZE;
  const theme = gender ?? "surprise";

  const status =
    rank > 0
      ? `♥ In your favorites · ★ #${rank} in your top ${SHORTLIST_SIZE}`
      : favorite
        ? "♥ In your favorites"
        : "Not saved yet";

  const fullName = `${name}${lastName.trim() ? ` ${lastName.trim()}` : ""}`;
  const initials = fullName
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase())
    .join(".");

  return (
    <main className="name-detail-page">
      <title>{`${name} | LittleRoots`}</title>
      <div className="name-detail-container">
        <PageTopbar
          trail={[{ to: "/favorites", label: "Favorites" }]}
          current={{ to: nameDetailPath(name, gender), label: name }}
        >
          <DemoModeToggle on={demoMode} onChange={setDemoMode} hint="Sample favorites to explore" />
        </PageTopbar>

        {lists.actionError && (
          <div className="name-detail-notice">
            <Notice variant="error">{lists.actionError}</Notice>
          </div>
        )}

        <div className="name-detail-layout">
          <section className={`name-detail-hero theme-${theme}`} aria-label={`${name} at a glance`}>
            <span className="name-detail-gender">{genderLabels[gender ?? "any"]}</span>
            <h1>{name}</h1>
            {origin && <p className="name-detail-origin">{origin}</p>}
            <p className="name-detail-status">{status}</p>

            {roots.length > 0 && (
              <div className="name-detail-roots">
                <span className="name-detail-roots-label">From your family tree</span>
                <ul>
                  {roots.map((root) => (
                    <li key={`${root.fullName}-${root.relation}`}>
                      <strong>{root.fullName}</strong>
                      <span>
                        Your {root.relation}
                        {root.birthYear ? ` · born ${root.birthYear}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="name-detail-actions">
              <button
                type="button"
                className="name-action"
                aria-pressed={favorite}
                onClick={() =>
                  favorite ? lists.removeFavorite(name) : lists.addFavorite({ name, gender, origin, meaning })
                }
              >
                <span aria-hidden="true">{favorite ? "♥" : "♡"}</span> {favorite ? "Saved" : "Save to favorites"}
              </button>
              {favorite && (
                <button
                  type="button"
                  className="name-action"
                  aria-pressed={rank > 0}
                  disabled={rank === 0 && shortlistFull}
                  title={rank === 0 && shortlistFull ? `Your top ${SHORTLIST_SIZE} is full` : undefined}
                  onClick={() => lists.toggleShortlist(name)}
                >
                  <span aria-hidden="true">{rank > 0 ? "★" : "☆"}</span> Top {SHORTLIST_SIZE}
                </button>
              )}
            </div>
          </section>

          <div className="name-detail-side">
            <section className="name-detail-card" aria-labelledby="name-story-title">
              <h2 id="name-story-title">The story behind {name}</h2>
              {infoState === "loading" && !meaning ? (
                <p className="name-detail-muted" role="status">
                  Looking up this name…
                </p>
              ) : origin || meaning ? (
                <dl className="name-detail-facts">
                  {origin && (
                    <>
                      <dt>Origin</dt>
                      <dd>{origin}</dd>
                    </>
                  )}
                  {meaning && (
                    <>
                      <dt>Meaning</dt>
                      <dd>{meaning}</dd>
                    </>
                  )}
                </dl>
              ) : (
                <p className="name-detail-muted">
                  {infoState === "error"
                    ? "We couldn't look up this name right now. Please try again."
                    : "We don't know this name's story yet."}
                </p>
              )}
            </section>

            <section className="name-detail-card" aria-labelledby="name-try-title">
              <div className="name-detail-try-header">
                <h2 id="name-try-title">Say it out loud</h2>
                <label className="name-detail-field">
                  <span>Last name</span>
                  <input
                    type="text"
                    value={lastName}
                    placeholder="Add a last name"
                    autoComplete="family-name"
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </label>
              </div>

              <div className={`name-detail-preview theme-${theme}`}>
                <p className="name-detail-print">{fullName}</p>
                <p className="name-detail-cursive">{fullName}</p>
                <p className="name-detail-initials">Initials · {initials}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
