
import { useState } from "react";
import { Link } from "react-router";
import "./about.css";

const faqs = [
  {
    question: "How does LittleRoots suggest names?",
    answer:
      "Sign in with WikiTree and we read your direct ancestors, up to ten generations back. Their first names become your suggestions, tidied up (no \"Unknown\" or placeholder names) and shown with their origin and meaning when we know them.",
  },
  {
    question: "Do I need a WikiTree account?",
    answer:
      "To use your own family tree, yes. WikiTree is free to join. Just want to look around first? Turn on Demo mode on Discover to try names from a sample family.",
  },
  {
    question: "Why don't I see names from my tree yet?",
    answer:
      "Your WikiTree profile needs at least a parent or grandparent added. Brand-new profiles can also take a little while before WikiTree shares their family connections. Demo mode works in the meantime.",
  },
  {
    question: "How do favorites and the top 3 work?",
    answer:
      "Swipe right or tap Like to save a name. On your Favorites page, drag your finalists into the three top spots, drag them to change the order, or drag one back down to take it out.",
  },
  {
    question: "Can I choose names with my partner?",
    answer:
      "Yes. On the Matches page, share your invite code with your partner (or enter theirs) to link your accounts. Every name you both like shows up there as a match.",
  },
  {
    question: "Who can see my favorites?",
    answer:
      "You decide in your Dashboard. Choose \"Only me\" to keep them private, even from your partner, or share them with your linked partner. Sharing with family through a link is coming soon.",
  },
];

export default function About() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  };

  return (
    <main className="about-page">
      <div className="about-container">
        {/* Breadcrumb */}
        <nav className="about-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span className="about-breadcrumb-separator">/</span>
          <Link
            to="/about"
            className="about-breadcrumb-current"
            aria-current="page"
          >
            About
          </Link>
        </nav>

        {/* Hero Section */}
        <section className="about-hero">
          <div className="about-hero-content">
            <h1>
              Every name has a story.
              <br />
              Let's find the one that
              <br />
              starts yours.
            </h1>

            <p>
              Choosing a baby name is a small decision with a lifetime
              of meaning. Our Baby Name Generator makes it easier to
              explore names, discover their meanings and origins, and
              find one that feels special to you. From familiar favorites
              to names you may have never considered, we're here to
              help you enjoy the search.
            </p>

            <Link to="/contact" className="about-contact-button">
              Contact Us
            </Link>
          </div>

          <div className="about-hero-image">
            <img
              src="/about-hero.jpg"
              alt="Baby wrapped in a white blanket"
            />
          </div>
        </section>

        {/* FAQ Section */}
        <section className="about-faq">
          <div className="about-faq-header">
            <h2>Frequently asked questions</h2>
            <p>
              Still curious? <Link to="/contact">Send us a note</Link>.
            </p>
          </div>

          <div className="about-faq-list">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;

              return (
                <div
                  className={`about-faq-item${isOpen ? " open" : ""}`}
                  key={faq.question}
                >
                  <button
                    type="button"
                    className="about-faq-question"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                  >
                    <span>{faq.question}</span>
                    <svg
                      className="about-faq-chevron"
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <div
                    id={`faq-answer-${index}`}
                    hidden={!isOpen}
                  >
                    <p className="about-faq-answer">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
