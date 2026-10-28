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

/** URL that ends the browser's WikiTree session, then returns to `returnUrl`. */
export function wikiTreeLogoutUrl(returnUrl: string): string {
  const params = new URLSearchParams({ action: "clientLogin", doLogout: "1", returnURL: returnUrl, appId: WIKITREE_APP_ID });
  return `${WIKITREE_API_URL}?${params}`;
}
