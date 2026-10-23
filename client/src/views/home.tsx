import { Link } from "react-router";
import "./home.css";

const steps = [
  {
    icon: "🌳",
    title: "Connect Your Tree",
  },
  {
    icon: "🚗",
    title: "Discover Names",
  },
  {
    icon: "🧸",
    title: "Swipe Your Favorites",
  },
  {
    icon: "💞",
    title: "Match Together",
  },
];

export default function Home() {
  return (
    <div className="home">
      <section className="home__hero">
        <div className="home__hero-inner">
          <div className="home__hero-image">
            <img
              src="/LittleRoots_Home.png"
              alt="Happy baby playing"
              className="home__baby-image"
            />
          </div>

          <div className="home__hero-content">
            <h1>Find a Name to Love</h1>
            <p>
              Discover meaningful baby names inspired by your
              family tree.
            </p>

            <Link to="/discover" className="home__discover-button">
              Discover Now
            </Link>
          </div>
        </div>
      </section>

      <section className="home__how">
        <div className="home__how-inner">
          <h2>How It Works</h2>
          <p>Finding a meaningful name together is simple.</p>

          <div className="home__steps">
            {steps.map((step) => (
              <div className="home__step" key={step.title}>
                <div className="home__step-icon">
                  <span>{step.icon}</span>
                </div>
                <h3>{step.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}