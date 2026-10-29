import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import { Link, useSearchParams } from "react-router";
import type { BabyName } from "shared";
import { useAuth } from "@/auth/useAuth";
import { useDemoMode } from "@/auth/useDemoMode";
import Notice from "@/components/common/Notice";
import PageTopbar from "@/components/common/PageTopbar";
import NameCard from "@/components/favorites/NameCard";
import { nameDetailPath } from "@/components/favorites/nameDetailPath";
import { useNameLists } from "@/components/favorites/useNameLists";
import "./search.css";

/** Route-level page for `/search?q=`: names matching what was typed in the header. */
export default function SearchView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const { authRequest } = useAuth();
  const [demoMode] = useDemoMode();
  const lists = useNameLists(demoMode);

  const [draft, setDraft] = useState(query);
  const [results, setResults] = useState<BabyName[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the box in step with the header search and the back button.
  useEffect(() => setDraft(query), [query]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    authRequest<{ names: BabyName[] }>(`/name/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((data) => setResults(data.names))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Search didn't work. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [authRequest, query]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = draft.trim();
    setSearchParams(q ? { q } : {});
  }

  return (
    <main className="search-page">
      <title>{query ? `${query} | Search | LittleRoots` : "Search | LittleRoots"}</title>
      <div className="search-container">
        <PageTopbar current={{ to: query ? `/search?q=${encodeURIComponent(query)}` : "/search", label: "Search" }} />

        <header className="search-heading">
          <span className="search-eyebrow">SEARCH NAMES</span>
          <h1>{query ? `Results for "${query}"` : "Find a name."}</h1>
          <form className="search-form" role="search" onSubmit={handleSubmit}>
            <input
              type="search"
              value={draft}
              placeholder="Type part of a name, like ha"
              aria-label="Search names"
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit">Search</button>
          </form>
        </header>

        {!query ? (
          <p className="search-status">Search the sample names and the names from your WikiTree tree.</p>
        ) : loading ? (
          <p className="search-status" role="status">
            Searching…
          </p>
        ) : error ? (
          <div className="search-notice">
            <Notice variant="error">{error}</Notice>
          </div>
        ) : results.length === 0 ? (
          <div className="search-empty">
            <p>No names match "{query}".</p>
            <Link to={nameDetailPath(query)}>Look up "{query}" anyway →</Link>
          </div>
        ) : (
          <>
            <p className="search-status">
              {results.length} {results.length === 1 ? "name" : "names"}
            </p>
            <ul className="search-grid">
              {results.map((result) => (
                <li key={result.name}>
                  <NameCard
                    name={{
                      name: result.name,
                      gender: result.gender,
                      // "Unknown" is the server's placeholder; leave it out.
                      origin: result.origin === "Unknown" ? undefined : result.origin,
                      meaning: result.meaning === "Unknown" ? undefined : result.meaning,
                    }}
                    badge={lists.isFavorite(result.name) ? "♥ Saved" : undefined}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
