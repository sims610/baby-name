
import { Link } from "react-router";
import { isLinkVisible } from "@/auth/config";
import { useAuth } from "@/auth/useAuth";

const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: (
      <>
        <rect
          x="6"
          y="6"
          width="12"
          height="12"
          rx="3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle
          cx="12"
          cy="12"
          r="2.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle
          cx="15.6"
          cy="8.4"
          r="0.9"
          fill="currentColor"
        />
      </>
    ),
  },
  {
    label: "Twitter",
    href: "https://twitter.com",
    icon: (
      <path
        fill="currentColor"
        d="M18.5 8.3c-.5.2-1 .4-1.5.4.6-.3 1-.9 1.2-1.5-.5.3-1.1.5-1.7.7a2.6 2.6 0 0 0-4.5 2.4A7.4 7.4 0 0 1 6.6 7.5a2.6 2.6 0 0 0 .8 3.5c-.4 0-.8-.1-1.2-.3 0 1.3.9 2.3 2.1 2.6-.4.1-.8.1-1.2 0 .3 1 1.3 1.8 2.4 1.8A5.3 5.3 0 0 1 5.6 16.2 7.4 7.4 0 0 0 17 9.9v-.3c.6-.4 1.1-.8 1.5-1.3z"
      />
    ),
  },
  {
    label: "Facebook",
    href: "https://facebook.com",
    icon: (
      <path
        fill="currentColor"
        d="M13.2 19v-6h2l.3-2.4h-2.3V9.1c0-.7.2-1.1 1.2-1.1h1.2V5.9a16 16 0 0 0-1.8-.1c-1.8 0-3 1.1-3 3.1v1.7h-2V13h2v6z"
      />
    ),
  },
  {
    label: "Pinterest",
    href: "https://pinterest.com",
    icon: (
      <path
        fill="currentColor"
        d="M12.3 5C8.4 5 6.5 7.8 6.5 10.1c0 1.4.5 2.7 1.7 3.1.2.1.4 0 .4-.2l.2-.7c.1-.2 0-.3-.1-.5-.3-.4-.6-1-.6-1.7 0-2.2 1.6-4.1 4.2-4.1 2.3 0 3.6 1.4 3.6 3.3 0 2.5-1.1 4.6-2.7 4.6-.9 0-1.6-.7-1.4-1.7.3-1.1.8-2.3.8-3.1 0-.7-.4-1.3-1.2-1.3-.9 0-1.7 1-1.7 2.3 0 .8.3 1.4.3 1.4l-1.1 4.6c-.3 1.4 0 3 0 3.2 0 .1.1.1.2 0 .1-.1 1-1.3 1.4-2.5l.5-2.1c.3.5 1.1 1 2 1 2.6 0 4.4-2.4 4.4-5.6C17.6 7.3 15.5 5 12.3 5z"
      />
    ),
  },
];

// Members-only links (see MEMBERS_ONLY_PATHS) are hidden until someone signs in.
const ACCOUNT_LINKS = [
  { to: "/discover", label: "Name Generator" },
  { to: "/terms", label: "Terms of use" },
  { to: "/favorites", label: "Favorites" },
  { to: "/feedback", label: "Submit Your feedback" },
];

export default function Footer() {
  const { isAuthenticated } = useAuth();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">

        {/* Logo and Social Media */}
        <div className="site-footer__brand">
          <Link to="/" className="site-footer__logo">
            <img
              src="/LittleRoots_Logo.png"
              alt="LittleRoots"
            />
          </Link>

          <ul className="site-footer__social">
            {SOCIAL_LINKS.map(({ label, href, icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    {icon}
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* My Account */}
        <div className="site-footer__col">
          <h3>My account</h3>
          <ul>
            {ACCOUNT_LINKS.filter(({ to }) => isLinkVisible(to, isAuthenticated)).map(({ to, label }) => (
              <li key={to}>
                <Link to={to}>{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Customer Service */}
        <div className="site-footer__col">
          <h3>Customer service</h3>
          <ul>
            <li>Monday to Friday</li>
            <li>9am - 5pm (UTC)</li>
            <li>
              Call us:{" "}
              <a href="tel:5554567868">
                555-456-7868
              </a>
            </li>
            <li>
              Email us:{" "}
              <a href="mailto:hello@little-roots.app">
                hello@little-roots.app
              </a>
            </li>
          </ul>
        </div>

      </div>
    </footer>
  );
}
