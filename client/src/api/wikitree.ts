// See https://github.com/wikitree/wikitree-api/blob/main/authentication.md
// The browser only visits WikiTree to sign in and out. WikiTree blocks API calls
// from other origins, so confirming the login goes through our server
// (`/api/wikitree`, see server/src/routes/wikitreeRouter.ts).
const WIKITREE_API_URL = "https://api.wikitree.com/api.php";
const WIKITREE_APP_ID = "LittleRoots";

/** URL that sends the user to WikiTree to sign in, then back to `returnUrl?authcode=…`. */
export function wikiTreeLoginUrl(returnUrl: string): string {
  const params = new URLSearchParams({ action: "clientLogin", returnURL: returnUrl, appId: WIKITREE_APP_ID });
  return `${WIKITREE_API_URL}?${params}`;
}

/**
 * Asks WikiTree to end the browser's own session, without leaving the page.
 * WikiTree ignores `returnURL` on logout and just shows `[{"status":"Ok"}]`, so we
 * don't navigate there. The response is opaque (no CORS for our origin), which is
 * fine: we only need the request sent. Best effort, since browsers may withhold
 * WikiTree's cookies from a cross-site request.
 */
export async function logoutWikiTreeInBrowser(): Promise<void> {
  const params = new URLSearchParams({ action: "clientLogin", doLogout: "1", appId: WIKITREE_APP_ID });
  await fetch(`${WIKITREE_API_URL}?${params}`, { mode: "no-cors", credentials: "include" });
}
