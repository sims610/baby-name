import { Link } from "react-router";
import { useAuth } from "@/auth/useAuth";
import { useDemoMode } from "@/auth/useDemoMode";
import { useWikiTreeLogin } from "@/auth/useWikiTreeLogin";
import type { WikiTreeLoginState } from "@/auth/useWikiTreeLogin";
import DemoModeToggle from "@/components/common/DemoModeToggle";
import Notice from "@/components/common/Notice";
import PageTopbar from "@/components/common/PageTopbar";
import PrivacySettings from "@/components/dashboard/PrivacySettings";
import { nameDetailPath } from "@/components/favorites/nameDetailPath";
import TopPicks, { ShortlistRemoveZone, startFavoriteDrag } from "@/components/favorites/TopPicks";
import { useNameLists } from "@/components/favorites/useNameLists";
import type { NameLists } from "@/components/favorites/useNameLists";
import "./dashboard.css";

const RECENT_LIMIT = 6;

const quickLinks = [
  {
    to: "/discover",
    icon: "✦",
    title: "Discover names",
    description: "Swipe through names from your family tree.",
  },
  {
    to: "/favorites",
    icon: "♥",
    title: "Your favorites",
    description: "Revisit every name you've fallen for.",
  },
  {
    to: "/matches",
    icon: "♡",
    title: "Matches",
    description: "See the names you and your partner both love.",
  },
];

/** Route-level page for `/dashboard`: a signed-in member's overview. */
export default function DashboardView() {
  const { user } = useAuth();
  const [demoMode, setDemoMode] = useDemoMode();
  const lists = useNameLists(demoMode);
  const { favorites, loading, error } = lists;
  // Also completes a WikiTree sign-in started from this page.
  const wikiTree = useWikiTreeLogin();

  const firstName = user?.name.trim().split(/\s+/)[0] ?? "there";
  const boys = favorites.filter((f) => f.gender === "boy").length;
  const girls = favorites.filter((f) => f.gender === "girl").length;

  const stats = [
    { label: "Favorite names", value: favorites.length, theme: "default", icon: "♥" },
    { label: "Boy names", value: boys, theme: "boy", icon: "♂" },
    { label: "Girl names", value: girls, theme: "girl", icon: "♀" },
  ];

  return (
    <main className="dashboard-page">
      <title>Dashboard | LittleRoots</title>
      <div className="dashboard-container">
        <PageTopbar current={{ to: "/dashboard", label: "Dashboard" }}>
          <DemoModeToggle on={demoMode} onChange={setDemoMode} hint="Sample favorites and family tree" />
        </PageTopbar>

        <header className="dashboard-heading">
          <span className="dashboard-eyebrow">YOUR DASHBOARD</span>
          <h1>Welcome back, {firstName}.</h1>
          <p>Here's how your search for the perfect name is growing.</p>
        </header>

        {error && (
          <div className="dashboard-notice">
            <Notice variant="error" title="Couldn't load favorites">
              {error}
            </Notice>
          </div>
        )}

        <section className="dashboard-stats" aria-label="Favorites at a glance">
          {stats.map((stat) => (
            <div key={stat.label} className={`dashboard-stat theme-${stat.theme}`}>
              <div className="dashboard-stat-icon" aria-hidden="true">
                {stat.icon}
              </div>
              <div>
                <strong>{loading ? "–" : stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            </div>
          ))}
        </section>

        <div className="dashboard-panels">
          <RecentFavorites lists={lists} boys={boys} girls={girls} />
          <FamilyTreePanel demoMode={demoMode} wikiTree={wikiTree} />
        </div>

        <PrivacySettings />

        <section aria-labelledby="dashboard-quick-title">
          <h2 id="dashboard-quick-title" className="dashboard-section-title">
            Keep exploring
          </h2>
          <div className="dashboard-quick">
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to} className="dashboard-quick-card theme-default">
                <div className="dashboard-quick-icon" aria-hidden="true">
                  {link.icon}
                </div>
                <h3>{link.title}</h3>
                <p>{link.description}</p>
                <span className="dashboard-quick-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

interface RecentFavoritesProps {
  lists: NameLists;
  boys: number;
  girls: number;
}

/** The newest saved names, plus how they split between boys and girls. */
function RecentFavorites({ lists, boys, girls }: RecentFavoritesProps) {
  const { favorites, loading } = lists;
  const others = favorites.length - boys - girls;

  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-recent-title">
      <div className="dashboard-panel-header">
        <h2 id="dashboard-recent-title">Recent favorites</h2>
        {favorites.length > 0 && <Link to="/favorites">View all →</Link>}
      </div>

      {loading ? (
        <p className="dashboard-muted" role="status">
          Gathering your favorites…
        </p>
      ) : favorites.length === 0 ? (
        <div className="dashboard-empty">
          <p className="dashboard-muted">No favorites yet. Swipe right on a name you love and it will show up here.</p>
          <Link to="/discover" className="dashboard-btn theme-default">
            Start Discovering <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
        <>
          <TopPicks lists={lists} compact />

          <ShortlistRemoveZone lists={lists}>
            <ul className="dashboard-chips">
              {favorites.slice(0, RECENT_LIMIT).map((favorite) => (
                <li
                  key={favorite.name}
                  className={`theme-${favorite.gender ?? "surprise"}`}
                  draggable
                  onDragStart={(e) => startFavoriteDrag(e, favorite.name)}
                >
                  <Link to={nameDetailPath(favorite.name, favorite.gender)} draggable={false}>
                    ♥ {favorite.name}
                  </Link>
                </li>
              ))}
            </ul>
          </ShortlistRemoveZone>

          <div className="dashboard-mix">
            <div className="dashboard-mix-label">
              <span>Your mix</span>
              <span>
                {boys} boy · {girls} girl
              </span>
            </div>
            {/* Decorative: the counts are spelled out just above. */}
            <div className="dashboard-mix-bar" aria-hidden="true">
              {[
                { theme: "boy", count: boys },
                { theme: "girl", count: girls },
                { theme: "surprise", count: others },
              ]
                .filter(({ count }) => count > 0)
                .map(({ theme, count }) => (
                  <span key={theme} className={`theme-${theme}`} style={{ flexGrow: count }} />
                ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

interface FamilyTreePanelProps {
  demoMode: boolean;
  wikiTree: WikiTreeLoginState;
}

/** Where names come from: the WikiTree connection, or the sample tree in demo mode. */
function FamilyTreePanel({ demoMode, wikiTree }: FamilyTreePanelProps) {
  return (
    <section className="dashboard-panel dashboard-tree" aria-labelledby="dashboard-tree-title">
      <div className="dashboard-panel-header">
        <h2 id="dashboard-tree-title">Family tree</h2>
      </div>

      <div className="dashboard-tree-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="5" r="2.5" />
          <circle cx="5" cy="19" r="2.5" />
          <circle cx="19" cy="19" r="2.5" />
          <path d="M12 7.5v5M5 16.5v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
        </svg>
      </div>

      {demoMode ? (
        <>
          <p className="dashboard-tree-status">Using the sample family tree</p>
          <p className="dashboard-muted">Turn off Demo mode to see names from your own WikiTree ancestors.</p>
        </>
      ) : wikiTree.status === "checking" ? (
        <p className="dashboard-muted" role="status">
          Checking your WikiTree sign-in…
        </p>
      ) : wikiTree.status === "signedIn" ? (
        <>
          <p className="dashboard-tree-status">
            Connected as <strong>{wikiTree.user?.userName}</strong>
          </p>
          <p className="dashboard-muted">Names in Discover come from your WikiTree ancestors.</p>
          <button type="button" className="dashboard-link-btn" onClick={wikiTree.logout}>
            Sign out of WikiTree
          </button>
        </>
      ) : (
        <>
          <p className="dashboard-tree-status">Not connected</p>
          <p className="dashboard-muted">Sign in with WikiTree to discover names from your ancestors.</p>
          {wikiTree.error && <Notice variant="error">{wikiTree.error}</Notice>}
          <button type="button" className="dashboard-btn theme-default" onClick={wikiTree.login}>
            Sign in with WikiTree <span aria-hidden="true">→</span>
          </button>
        </>
      )}
    </section>
  );
}
