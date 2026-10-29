import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { FavoritesVisibility } from "shared";
import { useAuth } from "@/auth/useAuth";
import Notice from "@/components/common/Notice";
import "./PrivacySettings.css";

const options: { value: FavoritesVisibility; title: string; description: string; icon: ReactNode }[] = [
  {
    value: "private",
    title: "Only me",
    description: "Your favorites stay private. Your partner won't see your matches either.",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "partner",
    title: "My partner",
    description: "Your linked partner can see your favorites and your matches.",
    icon: "♥",
  },
  {
    value: "public",
    title: "Anyone with the link",
    description: "Your partner sees them now. Sharing a link with family is coming soon.",
    icon: "✦",
  },
];

/** Who can see the names the user liked. Saved on the server, so it applies to Matches. */
export default function PrivacySettings() {
  const { authRequest } = useAuth();
  const [visibility, setVisibility] = useState<FavoritesVisibility | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    authRequest<{ favoritesVisibility: FavoritesVisibility }>("/settings", { signal: controller.signal })
      .then((data) => setVisibility(data.favoritesVisibility))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Couldn't load your privacy setting.");
      });
    return () => controller.abort();
  }, [authRequest]);

  const choose = (value: FavoritesVisibility) => {
    const previous = visibility;
    setVisibility(value);
    setError(null);
    authRequest("/settings", { method: "PUT", body: { favoritesVisibility: value } }).catch((err: unknown) => {
      setVisibility(previous);
      setError(err instanceof Error ? err.message : "That didn't save. Please try again.");
    });
  };

  return (
    <section className="privacy" aria-labelledby="privacy-title">
      <div className="privacy-header">
        <h2 id="privacy-title">Privacy</h2>
        <p>Choose who can see the names you liked.</p>
      </div>

      <fieldset className="privacy-options">
        <legend className="privacy-legend">Who can see your favorites</legend>
        {options.map((option) => (
          <label key={option.value} className="privacy-option theme-default">
            <input
              type="radio"
              name="favorites-visibility"
              value={option.value}
              checked={visibility === option.value}
              disabled={visibility === null}
              onChange={() => choose(option.value)}
            />
            <span className="privacy-option-icon" aria-hidden="true">
              {option.icon}
            </span>
            <span className="privacy-option-text">
              <strong>{option.title}</strong>
              <span>{option.description}</span>
            </span>
            <span className="privacy-option-check" aria-hidden="true">
              ✓
            </span>
          </label>
        ))}
      </fieldset>

      {error && (
        <div className="privacy-error">
          <Notice variant="error">{error}</Notice>
        </div>
      )}
    </section>
  );
}
