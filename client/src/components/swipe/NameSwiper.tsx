
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { BabyName } from "shared";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import Notice from "@/components/common/Notice";
import "./NameSwiper.css";

export type Gender = "boy" | "girl" | "surprise";

type NameSwiperProps = {
  gender: Gender;
  onChangePreference: () => void;
};

const SWIPE_THRESHOLD = 100;
const ANIMATION_DURATION = 280;

export default function NameSwiper({
  gender,
  onChangePreference,
}: NameSwiperProps) {
  const { authRequest } = useAuth();
  const [names, setNames] = useState<BabyName[]>([]);
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

  useEffect(() => {
    const controller = new AbortController();
    const query = gender === "surprise" ? "" : `?gender=${gender}`;

    setLoading(true);
    setError(null);

    authRequest<{ names: BabyName[] }>(`/name/list${query}`, {
      signal: controller.signal,
    })
      .then((data) => setNames(data.names))
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
  }, [authRequest, gender]);

  const currentName = names[currentIndex];
  const nextName = names[currentIndex + 1];

  const isFinished = !loading && !error && currentIndex >= names.length;

  const saveFavorite = ({ name, gender }: BabyName) => {
    setSaveError(null);

    authRequest("/name", {
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
    });
  };

  const completeSwipe = (direction: "left" | "right") => {
    if (swipeLocked.current || !currentName) return;

    swipeLocked.current = true;

    if (direction === "right") {
      saveFavorite(currentName);
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

  const handleRestart = () => {
    if (exitTimer.current !== null) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }

    swipeLocked.current = false;
    setCurrentIndex(0);
    setLikedNames([]);
    setPassedNames([]);
    setDragX(0);
    setExitDirection(null);
  };

  const genderLabel =
    gender === "boy"
      ? "Boy Names"
      : gender === "girl"
      ? "Girl Names"
      : "All Names";

  return (
    <section className="name-swiper">
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
        <p className="swiper-instructions">Loading names…</p>
      ) : error ? (
        <Notice variant="error" title="Couldn't load names">
          {error}
        </Notice>
      ) : !isFinished ? (
        <>
          <div className="swiper-progress">
            <span>
              Name {currentIndex + 1} of {names.length}
            </span>

            <span>{likedNames.length} liked</span>
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
                <span className="name-card-label">
                  {currentName.gender === "boy"
                    ? "Boy Name"
                    : "Girl Name"}
                </span>

                <h2>{currentName.name}</h2>

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

          <h2>You've explored all the names!</h2>

          <p>
            Every great name starts with a little
            discovery.
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
                  <span key={name.name}>
                    ♡ {name.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            className="swiper-restart-btn"
            onClick={handleRestart}
          >
            Discover Again →
          </button>

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
