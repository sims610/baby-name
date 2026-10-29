
import { useState } from "react";
import "./discover.css";
import NameSwiper from "@/components/swipe/NameSwiper";
import WikiTreeLoginPrompt from "@/components/wikitree/WikiTreeLoginPrompt";
import { useWikiTreeLogin } from "@/auth/useWikiTreeLogin";
import { useDemoMode } from "@/auth/useDemoMode";
import DemoModeToggle from "@/components/common/DemoModeToggle";
import { Link } from "react-router";

type Gender = "boy" | "girl" | "surprise";

const genderOptions: {
  value: Gender;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "boy",
    title: "Boy",
    description: "Discover baby boy names",
    icon: "♂",
  },
  {
    value: "girl",
    title: "Girl",
    description: "Discover baby girl names",
    icon: "♀",
  },
  {
    value: "surprise",
    title: "Surprise Me",
    description: "Explore all baby names",
    icon: "✦",
  },
];

export default function Discover() {
  // Keeps running in demo mode too, so a WikiTree sign-in redirect still completes.
  const wikiTree = useWikiTreeLogin();

  const [demoMode, setDemoMode] = useDemoMode();

  const [selectedGender, setSelectedGender] =
    useState<Gender | null>(null);

  const [hasStarted, setHasStarted] = useState(false);

  const handleStart = () => {
    if (!selectedGender) return;

    setHasStarted(true);
  };

  const changeDemoMode = (on: boolean) => {
    setDemoMode(on);
    setHasStarted(false);
  };

  return (
    <main className="discover-page">
      <div className="discover-container">
        <div className="discover-topbar">
          <nav className="discover-breadcrumb">
            <Link to="/">Home</Link>
            <span className="discover-breadcrumb-separator">/</span>
            <Link
              to="/discover"
              className="discover-breadcrumb-current"
              aria-current="page"
            >
              Discover
            </Link>
          </nav>

          <DemoModeToggle
            on={demoMode}
            onChange={changeDemoMode}
            hint="Sample names, no WikiTree sign-in"
          />
        </div>

        {!demoMode && wikiTree.status === "checking" ? (
          <p className="wikitree-status" role="status">
            Checking your WikiTree sign-in…
          </p>
        ) : !demoMode && wikiTree.status === "signedOut" ? (
          <WikiTreeLoginPrompt
            error={wikiTree.error}
            onLogin={wikiTree.login}
          />
        ) : (
        <>
        {!demoMode && (
          <p className="wikitree-status">
            Signed in to WikiTree as{" "}
            <strong>{wikiTree.user?.userName}</strong>
            <span aria-hidden="true"> · </span>
            <button
              type="button"
              className="wikitree-signout"
              onClick={wikiTree.logout}
            >
              Sign out
            </button>
          </p>
        )}

        {!hasStarted ? (
          <section className="gender-selection">
            <div className="gender-heading">
              <span className="gender-eyebrow">
                FIND YOUR PERFECT NAME
              </span>

              <h1>Every name begins a story.</h1>

              <p>
                Let's find the perfect name for your little one.
                <br />
                First, who are we finding a name for?
              </p>
            </div>

            <div
              className="gender-options"
              role="group"
              aria-label="Select baby name gender"
            >
              {genderOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`gender-card theme-${option.value} ${
                    selectedGender === option.value
                      ? "selected"
                      : ""
                  }`}
                  aria-pressed={
                    selectedGender === option.value
                  }
                  onClick={() =>
                    setSelectedGender(option.value)
                  }
                >
                  <div className="gender-icon">
                    {option.icon}
                  </div>

                  <h2>{option.title}</h2>

                  <p>{option.description}</p>

                  <span className="gender-check">
                    {selectedGender === option.value
                      ? "✓"
                      : ""}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`discover-start-btn theme-${
                selectedGender ?? "default"
              }`}
              onClick={handleStart}
              disabled={!selectedGender}
            >
              Start Discovering
              <span aria-hidden="true">→</span>
            </button>

            <p className="discover-hint">
              You can change your preferences later.
            </p>
          </section>
        ) : selectedGender ? (
        <NameSwiper
            gender={selectedGender}
            source={demoMode ? "demo" : "wikitree"}
            onChangePreference={() => setHasStarted(false)}
        />
        ) : null}
        </>
        )}
      </div>
    </main>
  );
}
