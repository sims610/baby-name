import { useState } from "react";
import { Link } from "react-router";
import type { NameGender } from "shared";
import { useDemoMode } from "@/auth/useDemoMode";
import DemoModeToggle from "@/components/common/DemoModeToggle";
import Notice from "@/components/common/Notice";
import PageTopbar from "@/components/common/PageTopbar";
import NameCard from "@/components/favorites/NameCard";
import type { SavedName } from "@/components/favorites/NameCard";
import TopPicks, { ShortlistRemoveZone, startFavoriteDrag } from "@/components/favorites/TopPicks";
import { SHORTLIST_SIZE, useNameLists } from "@/components/favorites/useNameLists";
import type { NameLists } from "@/components/favorites/useNameLists";
import "./favorites.css";

type Filter = "all" | NameGender;

// Each filter wears its gender color; "All" uses the default green.
const filters: { value: Filter; label: string; theme: string }[] = [
  { value: "all", label: "All", theme: "default" },
  { value: "boy", label: "Boys", theme: "boy" },
  { value: "girl", label: "Girls", theme: "girl" },
];

/** Route-level page for `/favorites`: every name the user liked in Discover. */
export default function FavoritesView() {
  const [demoMode, setDemoMode] = useDemoMode();
  const lists = useNameLists(demoMode);
  const { favorites, loading, error } = lists;
  const [filter, setFilter] = useState<Filter>("all");

  const countFor = (value: Filter) =>
    value === "all" ? favorites.length : favorites.filter((f) => f.gender === value).length;

  const visible = filter === "all" ? favorites : favorites.filter((f) => f.gender === filter);

  return (
    <main className="favorites-page">
      <title>Favorites | LittleRoots</title>
      <div className="favorites-container">
        <PageTopbar current={{ to: "/favorites", label: "Favorites" }}>
          <DemoModeToggle on={demoMode} onChange={setDemoMode} hint="Sample favorites to explore" />
        </PageTopbar>

        <header className="favorites-heading">
          <span className="favorites-eyebrow">YOUR SAVED NAMES</span>
          <h1>Names you love.</h1>
          <p>Every name you liked while discovering lives here, rooted in your family's story.</p>
          {demoMode && <span className="favorites-demo-badge">Showing sample names</span>}
        </header>

        {loading ? (
          <p className="favorites-status" role="status">
            Gathering your favorites…
          </p>
        ) : error ? (
          <div className="favorites-notice">
            <Notice variant="error" title="Couldn't load favorites">
              {error}
            </Notice>
          </div>
        ) : (
          <>
            {lists.actionError && (
              <div className="favorites-notice">
                <Notice variant="error">{lists.actionError}</Notice>
              </div>
            )}

            {favorites.length === 0 ? (
              <section className="favorites-empty theme-default">
                <div className="favorites-empty-icon" aria-hidden="true">
                  ♡
                </div>
                <h2>No favorites yet</h2>
                <p>Swipe right on a name you love in Discover and it will be saved here.</p>
                <Link to="/discover" className="favorites-cta theme-default">
                  Start Discovering <span aria-hidden="true">→</span>
                </Link>
              </section>
            ) : (
              <>
                <TopPicks lists={lists} />

                <ShortlistRemoveZone lists={lists}>
                  <div className="favorites-filters" role="group" aria-label="Filter favorites">
                    {filters.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`favorites-filter theme-${option.theme}`}
                        aria-pressed={filter === option.value}
                        onClick={() => setFilter(option.value)}
                      >
                        {option.label}
                        <span className="favorites-filter-count">{countFor(option.value)}</span>
                      </button>
                    ))}
                  </div>

                  {visible.length === 0 ? (
                    <p className="favorites-status">
                      No {filter} names saved yet. <Link to="/discover">Find some in Discover</Link>
                    </p>
                  ) : (
                    <ul className="favorites-grid">
                      {visible.map((favorite) => (
                        <li
                          key={favorite.name}
                          className="favorites-draggable"
                          draggable
                          onDragStart={(e) => startFavoriteDrag(e, favorite.name)}
                        >
                          <NameCard name={favorite} actions={<FavoriteActions lists={lists} name={favorite} />} />
                        </li>
                      ))}
                    </ul>
                  )}
                </ShortlistRemoveZone>

                <div className="favorites-footer">
                  <Link to="/discover" className="favorites-cta theme-default">
                    Discover more names <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/** Shortlist and remove buttons on a favorite's card. */
function FavoriteActions({ lists, name }: { lists: NameLists; name: SavedName }) {
  const picked = lists.isShortlisted(name.name);
  const full = lists.shortlist.length >= SHORTLIST_SIZE;

  return (
    <>
      <button
        type="button"
        className="name-action"
        aria-pressed={picked}
        disabled={!picked && full}
        title={!picked && full ? `Your top ${SHORTLIST_SIZE} is full` : undefined}
        onClick={() => lists.toggleShortlist(name.name)}
      >
        <span aria-hidden="true">{picked ? "★" : "☆"}</span> Top {SHORTLIST_SIZE}
      </button>
      <button
        type="button"
        className="name-action name-action-quiet"
        aria-label={`Remove ${name.name} from favorites`}
        onClick={() => lists.removeFavorite(name.name)}
      >
        Remove
      </button>
    </>
  );
}
