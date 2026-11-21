
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { BabyName } from "shared";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import Notice from "@/components/common/Notice";
import "./NameSwiper.css";

export type Gender = "boy" | "girl" | "surprise";

/** Where names come from: sample data, or the user's own tree (WikiTree or an imported GEDCOM file). */
export type NameSource = "demo" | "wikitree";

type NameSwiperProps = {
  gender: Gender;
  source: NameSource;
  onChangePreference: () => void;
};

const SWIPE_THRESHOLD = 100;
const ANIMATION_DURATION = 280;

/**
 * How many names one round shows before the summary. Change it to resize rounds;
 * the server takes up to 100 (MAX_PAGE_SIZE in server/src/routes/nameRouter.ts).
 */
const ROUND_SIZE = 25;

type NamePage = { names: BabyName[]; remaining: number; total: number };

/** A new shuffle order for each session; the server repeats it for every round. */
const randomSeed = () => Math.floor(Math.random() * 0x100000000);

export default function NameSwiper({
  gender,
  source,
  onChangePreference,
}: NameSwiperProps) {
  const { authRequest } = useAuth();
  const [names, setNames] = useState<BabyName[]>([]);
  const [seed, setSeed] = useState(randomSeed);
  const [round, setRound] = useState(1);
  // From the server: names from this round's page on, and names in the whole tree.
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  // How many names earlier rounds showed. Only demo pages by offset: the user's own
  // tree leaves out swiped names, so its next round is always the first page.
  const [shownBefore, setShownBefore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedNames, setLikedNames] = useState<BabyName[]>([]);
  const [passedNames, setPassedNames] = useState<BabyName[]>([]);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<
    "left" | "right" | null
  >(null);

  const pointerStartX = useRef<number | null>(null);
  const activePointerId = useRef<number | null>(null);
  const swipeLocked = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  // Likes and passes still being saved. The next round waits for them, or the
  // server wouldn't know to leave those names out yet.
  const pendingSwipes = useRef(new Set<Promise<unknown>>());

  const trackSwipe = (request: Promise<unknown>) => {
    pendingSwipes.current.add(request);
    void request.finally(() => pendingSwipes.current.delete(request));
  };

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      source,
      limit: String(ROUND_SIZE),
      seed: String(seed),
      offset: String(source === "demo" ? shownBefore : 0),
    });
    if (gender !== "surprise") params.set("gender", gender);

    setLoading(true);
    setError(null);

    Promise.allSettled([...pendingSwipes.current])
      .then(() =>
        authRequest<NamePage>(`/name/list?${params}`, {
          signal: controller.signal,
        })
      )
      .then((data) => {
        setNames(data.names);
        setRemaining(data.remaining);
        setTotal(data.total);
        setCurrentIndex(0);
        setLikedNames([]);
        setPassedNames([]);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't load names. Please try again."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [authRequest, gender, source, seed, round, shownBefore]);

  const currentName = names[currentIndex];
  const nextName = names[currentIndex + 1];

  const isFinished = !loading && !error && currentIndex >= names.length;
  // Names still to come after this round.
  const leftAfterRound = remaining - names.length;

  const saveFavorite = ({ name, gender }: BabyName) => {
    setSaveError(null);

    trackSwipe(authRequest("/name", {
      method: "POST",
      body: { name, gender },
    }).catch((err: unknown) => {
      // 409 means it's already a favorite, which is what the user wanted anyway.
      if (err instanceof ApiError && err.status === 409) return;
      setSaveError(
        `${name} wasn't saved to your favorites. ${
          err instanceof Error ? err.message : ""
        }`.trim()
      );
    }));
  };

  // Only the user's own tree remembers passes; sample names come back every visit.
  const savePass = ({ name }: BabyName) => {
    if (source !== "wikitree") return;

    trackSwipe(authRequest("/name/passed", {
      method: "POST",
      body: { name },
    }).catch(() => {
      // Not worth interrupting the swiping for: the name just shows up again later.
    }));
  };

  const completeSwipe = (direction: "left" | "right") => {
    if (swipeLocked.current || !currentName) return;

    swipeLocked.current = true;

    if (direction === "right") {
      saveFavorite(currentName);
    } else {
      savePass(currentName);
    }

    setDragging(false);
    setExitDirection(direction);

    exitTimer.current = setTimeout(() => {
      if (direction === "right") {
        setLikedNames((prev) => [...prev, currentName]);
      } else {
        setPassedNames((prev) => [...prev, currentName]);
      }

      setCurrentIndex((prev) => prev + 1);
      setDragX(0);
      setExitDirection(null);
      swipeLocked.current = false;
      exitTimer.current = null;
    }, ANIMATION_DURATION);
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (swipeLocked.current || !currentName) return;

    pointerStartX.current = event.clientX;
    activePointerId.current = event.pointerId;
    setDragging(true);

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (
      pointerStartX.current === null ||
      activePointerId.current !== event.pointerId ||
      swipeLocked.current
    ) {
      return;
    }

    setDragX(event.clientX - pointerStartX.current);
  };

  const handlePointerUp = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (activePointerId.current !== event.pointerId) return;

    const distance =
      pointerStartX.current === null
        ? 0
        : event.clientX - pointerStartX.current;

    pointerStartX.current = null;
    activePointerId.current = null;
    setDragging(false);

    if (distance > SWIPE_THRESHOLD) {
      completeSwipe("right");
    } else if (distance < -SWIPE_THRESHOLD) {
      completeSwipe("left");
    } else {
      setDragX(0);
    }
  };

  const handlePointerCancel = () => {
    pointerStartX.current = null;
    activePointerId.current = null;
    setDragging(false);
    setDragX(0);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;

      if (
        target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        document.getElementById("name-like-button")?.click();
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        document.getElementById("name-pass-button")?.click();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (exitTimer.current !== null) {
        clearTimeout(exitTimer.current);
      }
    };
  }, []);

  const resetCard = () => {
    if (exitTimer.current !== null) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }

    swipeLocked.current = false;
    setDragX(0);
    setExitDirection(null);
  };

  const handleNextRound = () => {
    resetCard();
    setShownBefore((prev) => prev + names.length);
    setRound((prev) => prev + 1);
  };

  // Every name has been swiped: forget the passes (favorites stay saved) and
  // start a fresh shuffle.
  const handleStartOver = async () => {
    resetCard();
    setSaveError(null);
    if (source === "wikitree") {
      try {
        await Promise.allSettled([...pendingSwipes.current]);
        await authRequest("/name/passed", { method: "DELETE" });
      } catch (err) {
        setSaveError(
          err instanceof Error
            ? err.message
            : "Couldn't start over. Please try again."
        );
        return;
      }
    }
    setShownBefore(0);
    setRound(1);
    setSeed(randomSeed());
  };

  const genderLabel =
    gender === "boy"
      ? "Boy Names"
      : gender === "girl"
      ? "Girl Names"
      : "All Names";

  return (
    <section className={`name-swiper theme-${gender}`}>
      <div className="swiper-header">
        <span className="swiper-eyebrow">
          DISCOVER YOUR FAVORITES
        </span>

        <h1>Find a name to love.</h1>

        <p>
          Every name has a story. Swipe through and
          discover the one that feels right.
        </p>

        <div className="swiper-preferences">
          <span className="swiper-gender-label">
            {genderLabel}
          </span>

          <button
            type="button"
            onClick={onChangePreference}
            className="swiper-change-btn"
          >
            Change Preference
          </button>
        </div>
      </div>

      {saveError && (
        <Notice variant="error">{saveError}</Notice>
      )}

      {loading ? (
        <p className="swiper-instructions">
          {source === "wikitree"
            ? "Gathering names from your family tree…"
            : "Loading names…"}
        </p>
      ) : error ? (
        <Notice variant="error" title="Couldn't load names">
          {error}
        </Notice>
      ) : names.length === 0 && total > 0 ? (
        <div className="swiper-finished">
          <div className="finished-icon">♡</div>

          <h2>You've seen every name</h2>

          <p>
            You've swiped through all {total} names. Your
            favorites are saved; start over to see the ones
            you passed on again.
          </p>

          <button
            type="button"
            className="swiper-restart-btn"
            onClick={handleStartOver}
          >
            Start Over →
          </button>

          <button
            type="button"
            className="swiper-finished-change"
            onClick={onChangePreference}
          >
            Change Preference
          </button>
        </div>
      ) : names.length === 0 ? (
        <Notice variant="info" title="No names yet">
          {source === "wikitree"
            ? "We couldn't find any ancestor names in your family tree yet. Add parents or grandparents to your tree, or try Demo mode."
            : "No names match this preference."}
        </Notice>
      ) : !isFinished ? (
        <>
          <div className="swiper-progress">
            <span>
              Round {round} · Name {currentIndex + 1} of {names.length}
            </span>

            <span>
              {likedNames.length} liked · {remaining - currentIndex} left
            </span>
          </div>

          <div className="swiper-progress-track">
            <div
              className="swiper-progress-fill"
              style={{
                width: `${
                  (currentIndex / names.length) * 100
                }%`,
              }}
            />
          </div>

          <div className="swiper-card-stack">
            {nextName && (
              <div className="name-card next-card">
                <span className="name-card-decoration">
                  ✦
                </span>
              </div>
            )}

            <div
              className={`name-card active-card ${
                dragging ? "dragging" : ""
              }`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              style={{
                transform: exitDirection
                  ? `translateX(${
                      exitDirection === "right"
                        ? "650px"
                        : "-650px"
                    }) rotate(${
                      exitDirection === "right"
                        ? "20deg"
                        : "-20deg"
                    })`
                  : `translateX(${dragX}px) rotate(${
                      dragX * 0.035
                    }deg)`,
                opacity: exitDirection ? 0 : 1,
              }}
            >
              <span className="name-card-decoration">
                ✦
              </span>

              {dragX > 35 && (
                <span className="swipe-indicator like-indicator">
                  LIKE
                </span>
              )}

              {dragX < -35 && (
                <span className="swipe-indicator pass-indicator">
                  PASS
                </span>
              )}

              <div className="name-card-content">
                <span
                  className={`name-card-label theme-${currentName.gender}`}
                >
                  {currentName.gender === "boy"
                    ? "Boy Name"
                    : "Girl Name"}
                </span>

                <h2>{currentName.name}</h2>

                {currentName.tree && (
                  <span className={`name-card-tree theme-${currentName.gender}`}>
                    {currentName.tree === "both"
                      ? "🌳 In both of your family trees"
                      : "🌳 From your partner's family tree"}
                  </span>
                )}

                <div className="name-card-divider" />

                <div className="name-detail">
                  <span className="detail-label">
                    ORIGIN
                  </span>
                  <span className="detail-value">
                    {currentName.origin}
                  </span>
                </div>

                <div className="name-detail">
                  <span className="detail-label">
                    MEANING
                  </span>
                  <span className="detail-value">
                    {currentName.meaning}
                  </span>
                </div>
              </div>

              <div className="name-card-bottom">
                LittleRoots · Every name has a story
              </div>
            </div>
          </div>

          <div className="swiper-actions">
            <button
              id="name-pass-button"
              type="button"
              className="swipe-action pass-action"
              onClick={() => completeSwipe("left")}
              disabled={exitDirection !== null}
              aria-label="Pass on this name"
            >
              <span className="action-icon">×</span>
              <span>Pass</span>
            </button>

            <button
              id="name-like-button"
              type="button"
              className="swipe-action like-action"
              onClick={() => completeSwipe("right")}
              disabled={exitDirection !== null}
              aria-label="Like this name"
            >
              <span className="action-icon">♡</span>
              <span>Like</span>
            </button>
          </div>

          <p className="swiper-instructions">
            ← Swipe left to pass · Swipe right to like →
          </p>
        </>
      ) : (
        <div className="swiper-finished">
          <div className="finished-icon">♡</div>

          <h2>
            {leftAfterRound > 0
              ? `Round ${round} done!`
              : "You've explored all the names!"}
          </h2>

          <p>
            {leftAfterRound > 0
              ? `${leftAfterRound} more ${
                  leftAfterRound === 1 ? "name is" : "names are"
                } waiting in the next round.`
              : "Every great name starts with a little discovery."}
          </p>

          <div className="finished-stats">
            <div>
              <strong>{likedNames.length}</strong>
              <span>Names Liked</span>
            </div>

            <div>
              <strong>{passedNames.length}</strong>
              <span>Names Passed</span>
            </div>
          </div>

          {likedNames.length > 0 && (
            <div className="finished-favorites">
              <h3>Your Favorite Names</h3>

              <div className="favorite-name-list">
                {likedNames.map((name) => (
                  <span
                    key={name.name}
                    className={`theme-${name.gender}`}
                  >
                    ♡ {name.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {leftAfterRound > 0 ? (
            <button
              type="button"
              className="swiper-restart-btn"
              onClick={handleNextRound}
            >
              Keep Going →
            </button>
          ) : (
            <button
              type="button"
              className="swiper-restart-btn"
              onClick={handleStartOver}
            >
              Start Over →
            </button>
          )}

          <button
            type="button"
            className="swiper-finished-change"
            onClick={onChangePreference}
          >
            Change Preference
          </button>
        </div>
      )}
    </section>
  );
}
