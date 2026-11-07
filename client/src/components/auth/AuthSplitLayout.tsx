import { useId, useState } from "react";
import type { ReactNode } from "react";
import styles from "@/scss/components/AuthSplitLayout.module.scss";

// Served from client/public.
const DEFAULT_HERO_IMAGE = `${import.meta.env.BASE_URL}baby-hero.jpg`;
const DEFAULT_HERO_ALT = "Baby sitting on a white bed";

interface AuthSplitLayoutProps {
  title: string;
  subtitle: string;
  /**
   * Image for the left panel. Defaults to `public/baby-hero.jpg`. A styled
   * placeholder is shown if there is no image or it fails to load.
   */
  imageSrc?: string;
  /** Describes the image for screen readers. Pass "" if it's purely decorative. */
  imageAlt?: string;
  children: ReactNode;
}

/** Page frame shared by signup and login: image on one side, titled form panel on the other. */
export default function AuthSplitLayout({
  title,
  subtitle,
  imageSrc = DEFAULT_HERO_IMAGE,
  imageAlt = DEFAULT_HERO_ALT,
  children,
}: AuthSplitLayoutProps) {
  const titleId = useId();
  // Remembering which src failed (rather than a boolean) means a new imageSrc is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(imageSrc) && imageSrc !== failedSrc;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <aside className={styles.media}>
          {showImage ? (
            <img className={styles.image} src={imageSrc} alt={imageAlt} onError={() => setFailedSrc(imageSrc ?? null)} />
          ) : (
            <ImagePlaceholder />
          )}
        </aside>

        <section className={styles.panel} aria-labelledby={titleId}>
          <header className={styles.header}>
            <h1 id={titleId} className={styles.title}>
              {title}
            </h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </header>
          {children}
        </section>
      </div>
    </div>
  );
}

function ImagePlaceholder() {
  return (
    <div className={styles.placeholder} role="img" aria-label="Image placeholder">
      <svg viewBox="0 0 24 24" width="48" height="48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
      <span>Image placeholder</span>
    </div>
  );
}
