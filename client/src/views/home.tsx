import type { ReactNode } from "react";
import { Link } from "react-router";
import "./home.css";

/** Thin line icons, drawn in the current text color. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const steps = [
  {
    title: "Connect your tree",
    description: "Sign in with WikiTree and we'll read up to ten generations of your ancestors.",
    icon: (
      <Icon>
        <circle cx="12" cy="5" r="2.5" />
        <circle cx="5" cy="19" r="2.5" />
        <circle cx="19" cy="19" r="2.5" />
        <path d="M12 7.5v4.5M5 16.5v-2.5h14v2.5" />
      </Icon>
    ),
  },
  {
    title: "Discover names",
    description: "Swipe through first names from your family, each with its origin and meaning.",
    icon: (
      <Icon>
        <rect x="6" y="3.5" width="12" height="17" rx="2.5" />
        <path d="M9.5 9h5M9.5 12.5h5M9.5 16h3" />
      </Icon>
    ),
  },
  {
    title: "Pick your favorites",
    description: "Save the names you love, then narrow them down to your top three.",
    icon: (
      <Icon>
        <path d="M12 20s-7-4.4-8.6-8.6C2.2 8.3 4 5 7.3 5c1.9 0 3.2 1 4.7 2.8C13.5 6 14.8 5 16.7 5 20 5 21.8 8.3 20.6 11.4 19 15.6 12 20 12 20Z" />
      </Icon>
    ),
  },
  {
    title: "Decide together",
    description: "Link with your partner and see the names you both chose.",
    icon: (
      <Icon>
        <circle cx="8.5" cy="8" r="3" />
        <circle cx="16" cy="9" r="2.5" />
        <path d="M3 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M14.5 14.2c.5-.1 1-.2 1.5-.2 2.3 0 4.2 1.6 5 5" />
      </Icon>
    ),
  },
];

const highlights = ["Ten generations of ancestors", "Origins and meanings", "Built for two"];

export default function Home() {
  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-content">
            <span className="home-eyebrow">
              <span className="home-eyebrow-dot" aria-hidden="true" />
              Baby names from your family tree
            </span>

            <h1>
              Find a name to love,
              <span className="home-hero-accent">rooted in your family.</span>
            </h1>

            <p className="home-hero-lead">
              LittleRoots turns the people in your family tree into a shortlist of meaningful baby names, each with
              the story of where it comes from.
            </p>

            <div className="home-hero-actions">
              <Link to="/discover" className="home-btn home-btn-primary">
                Start discovering <span aria-hidden="true">→</span>
              </Link>
              <a href="#how-it-works" className="home-btn home-btn-secondary">
                How it works
              </a>
            </div>

            <ul className="home-highlights">
              {highlights.map((item) => (
                <li key={item}>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                    <path
                      d="M3 8.5 6.5 12 13 4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="home-hero-visual">
            <img src="/LittleRoots_Home.png" alt="A smiling baby lying on a white blanket" />

            {/* A sample name card, to show what the app suggests. Decorative. */}
            <div className="home-preview-card" aria-hidden="true">
              <span className="home-preview-label">♀ Girl</span>
              <strong>Eleanor</strong>
              <span className="home-preview-meta">Your great-grandmother · Old French</span>
            </div>
            <span className="home-preview-match" aria-hidden="true">
              ♥ It's a match
            </span>
          </div>
        </div>
      </section>

      <section className="home-how" id="how-it-works" aria-labelledby="home-how-title">
        <div className="home-section-inner">
          <span className="home-section-eyebrow">HOW IT WORKS</span>
          <h2 id="home-how-title">From family tree to first name</h2>
          <p className="home-section-lead">Four simple steps, at your own pace.</p>

          <ol className="home-steps">
            {steps.map((step, i) => (
              <li key={step.title} className="home-step">
                <div className="home-step-top">
                  <span className="home-step-icon">{step.icon}</span>
                  <span className="home-step-number">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-cta" aria-labelledby="home-cta-title">
        <div className="home-cta-inner">
          <div>
            <h2 id="home-cta-title">Every name has a story.</h2>
            <p>Start with the one already in your family.</p>
          </div>
          <Link to="/discover" className="home-btn home-btn-primary">
            Get started <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
