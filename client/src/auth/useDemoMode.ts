import { useCallback, useState } from "react";

// Remembered per browser. Uses the app's "littleroots." prefix, so logging out clears it.
const DEMO_MODE_KEY = "littleroots.demoMode";

function readDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDemoMode(on: boolean): void {
  try {
    localStorage.setItem(DEMO_MODE_KEY, on ? "1" : "0");
  } catch {
    // Ignore: demo mode still applies for this visit.
  }
}

/**
 * Whether pages show sample data instead of the user's WikiTree tree and saved
 * favorites. Shared by Discover, Favorites and Dashboard through localStorage.
 */
export function useDemoMode(): [boolean, (on: boolean) => void] {
  const [demoMode, setDemoModeState] = useState(readDemoMode);

  const setDemoMode = useCallback((on: boolean) => {
    setDemoModeState(on);
    writeDemoMode(on);
  }, []);

  return [demoMode, setDemoMode];
}
