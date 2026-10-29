import type { ReactNode } from "react";
import { Link } from "react-router";
import type { FavoriteName } from "shared";
import { nameDetailPath } from "./nameDetailPath";
import "./NameCard.css";

/** A saved name. Origin and meaning are filled in when we know them. */
export type SavedName = FavoriteName & { origin?: string; meaning?: string };

const genderDetails = {
  boy: { label: "Boy", icon: "♂", theme: "boy" },
  girl: { label: "Girl", icon: "♀", theme: "girl" },
  any: { label: "Any", icon: "✦", theme: "surprise" },
};

interface NameCardProps {
  name: SavedName;
  /** Optional note in the top corner, e.g. "Match" or "#1". */
  badge?: string;
  /** Buttons along the bottom of the card. */
  actions?: ReactNode;
}

/** A saved name with its gender, origin and meaning. The name links to its detail page. */
export default function NameCard({ name, badge, actions }: NameCardProps) {
  const details = genderDetails[name.gender ?? "any"];

  return (
    <article className={`name-tile theme-${details.theme}`}>
      <div className="name-tile-top">
        <span className="name-tile-label">
          <span aria-hidden="true">{details.icon} </span>
          {details.label}
        </span>
        {badge && <span className="name-tile-badge">{badge}</span>}
      </div>

      <h3>
        <Link to={nameDetailPath(name.name, name.gender)}>{name.name}</Link>
      </h3>

      {(name.origin || name.meaning) && (
        <dl className="name-tile-details">
          {name.origin && (
            <>
              <dt>Origin</dt>
              <dd>{name.origin}</dd>
            </>
          )}
          {name.meaning && (
            <>
              <dt>Meaning</dt>
              <dd>{name.meaning}</dd>
            </>
          )}
        </dl>
      )}

      {actions && <div className="name-tile-actions">{actions}</div>}
    </article>
  );
}
