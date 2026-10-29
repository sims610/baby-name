import { useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { Link } from "react-router";
import { nameDetailPath } from "./nameDetailPath";
import { SHORTLIST_SIZE } from "./useNameLists";
import type { NameLists } from "./useNameLists";
import "./TopPicks.css";

// Custom drag types, so drop zones can tell a top-3 spot from a favorite while dragging.
const SHORTLIST_TYPE = "application/x-littleroots-shortlist";
const FAVORITE_TYPE = "application/x-littleroots-favorite";

const carries = (e: DragEvent, type: string) => e.dataTransfer.types.includes(type);

/** Ignores dragleave events fired when the pointer just moves onto a child. */
const reallyLeft = (e: DragEvent) => !e.currentTarget.contains(e.relatedTarget as Node | null);

/** Call from a favorite's onDragStart so it can be dropped into a top-3 spot. */
export function startFavoriteDrag(e: DragEvent, name: string): void {
  e.dataTransfer.setData(FAVORITE_TYPE, name);
  e.dataTransfer.setData("text/plain", name);
  e.dataTransfer.effectAllowed = "copyMove";
}

interface TopPicksProps {
  lists: NameLists;
  /** Smaller spots for the dashboard. */
  compact?: boolean;
}

/**
 * The user's final picks as three ranked spots. Drag a favorite onto a spot to
 * add it there, drag spots to reorder, or drag a spot into a ShortlistRemoveZone
 * to take it out. The × and ☆ buttons do the same without a mouse.
 */
export default function TopPicks({ lists, compact = false }: TopPicksProps) {
  const [overSpot, setOverSpot] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const spots = Array.from({ length: SHORTLIST_SIZE }, (_, i) => lists.shortlist[i]);

  const handleDragOver = (e: DragEvent, index: number) => {
    if (!carries(e, SHORTLIST_TYPE) && !carries(e, FAVORITE_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = carries(e, SHORTLIST_TYPE) ? "move" : "copy";
    setOverSpot(index);
  };

  const handleDrop = (e: DragEvent, index: number) => {
    const name = e.dataTransfer.getData(SHORTLIST_TYPE) || e.dataTransfer.getData(FAVORITE_TYPE);
    setOverSpot(null);
    if (!name) return;
    e.preventDefault();
    // Put the name at this rank. A full list pushes its last pick out.
    const rest = lists.shortlist.filter((n) => n.toLowerCase() !== name.toLowerCase());
    void lists.setShortlist([...rest.slice(0, index), name, ...rest.slice(index)]);
  };

  return (
    <section className={`top-picks${compact ? " top-picks-compact" : ""}`} aria-labelledby="top-picks-title">
      <div className="top-picks-header">
        <h2 id="top-picks-title">Your top {SHORTLIST_SIZE}</h2>
        <p>
          {dragging
            ? `Drop it on the names below to take it out of your top ${SHORTLIST_SIZE}.`
            : "Drag a favorite into a spot, or drag spots to reorder."}
        </p>
      </div>

      <ol className="top-picks-spots">
        {spots.map((name, i) => {
          const favorite = name ? lists.favorites.find((f) => f.name === name) : undefined;
          const dropProps = {
            onDragOver: (e: DragEvent) => handleDragOver(e, i),
            onDragLeave: (e: DragEvent) => reallyLeft(e) && setOverSpot(null),
            onDrop: (e: DragEvent) => handleDrop(e, i),
          };
          const overClass = overSpot === i ? " top-pick-over" : "";

          if (!name) {
            return (
              <li key={`empty-${i}`} className={`top-pick top-pick-empty${overClass}`} {...dropProps}>
                <span className="top-pick-rank">{i + 1}</span>
                <span className="top-pick-placeholder">Drop a name here</span>
              </li>
            );
          }
          return (
            <li
              key={name}
              className={`top-pick theme-${favorite?.gender ?? "surprise"}${overClass}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(SHORTLIST_TYPE, name);
                e.dataTransfer.setData("text/plain", name);
                e.dataTransfer.effectAllowed = "move";
                setDragging(true);
              }}
              onDragEnd={() => setDragging(false)}
              {...dropProps}
            >
              <span className="top-pick-grip" aria-hidden="true">
                ⋮⋮
              </span>
              <span className="top-pick-rank">{i + 1}</span>
              <div className="top-pick-text">
                <Link to={nameDetailPath(name, favorite?.gender)} draggable={false}>
                  {name}
                </Link>
                {!compact && favorite?.origin && <span>{favorite.origin}</span>}
              </div>
              <button
                type="button"
                className="top-pick-remove"
                aria-label={`Take ${name} out of your top ${SHORTLIST_SIZE}`}
                onClick={() => lists.toggleShortlist(name)}
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface ShortlistRemoveZoneProps {
  lists: NameLists;
  className?: string;
  children: ReactNode;
}

/** An area that takes a dragged top-3 spot out of the shortlist when it's dropped here. */
export function ShortlistRemoveZone({ lists, className = "", children }: ShortlistRemoveZoneProps) {
  const [active, setActive] = useState(false);

  return (
    <div
      className={`shortlist-remove-zone${active ? " shortlist-remove-active" : ""} ${className}`}
      onDragOver={(e) => {
        if (!carries(e, SHORTLIST_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setActive(true);
      }}
      onDragLeave={(e) => reallyLeft(e) && setActive(false)}
      onDrop={(e) => {
        const name = e.dataTransfer.getData(SHORTLIST_TYPE);
        setActive(false);
        if (!name) return;
        e.preventDefault();
        void lists.toggleShortlist(name);
      }}
    >
      {active && (
        <span className="shortlist-remove-label" aria-hidden="true">
          Drop to take it out of your top {SHORTLIST_SIZE}
        </span>
      )}
      {children}
    </div>
  );
}
