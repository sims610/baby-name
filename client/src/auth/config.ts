/** Signed-in users are logged out after this long without any activity. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** How long before the idle logout the warning dialog appears. */
export const IDLE_WARNING_MS = 2 * 60 * 1000;

/** Where users land after an idle logout. */
export const LOGIN_PATH = "/login";

/** Password pages. */
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
export const CHANGE_PASSWORD_PAGE_PATH = "/account/password";

/** Where users land after signing up or logging in. */
export const HOME_PATH = "/";

/**
 * Pages only signed-in users can see. The header and footer hide links to these
 * when nobody is logged in; the routes themselves are guarded by wrapping them in
 * <RequireAuth /> in app/app.tsx. Keep the two in sync.
 */
export const MEMBERS_ONLY_PATHS: ReadonlySet<string> = new Set([
  "/dashboard",
  "/discover",
  "/favorites",
  "/matches",
  CHANGE_PASSWORD_PAGE_PATH,
]);

/** Whether a link to `path` should be shown, given whether someone is signed in. */
export function isLinkVisible(path: string, isAuthenticated: boolean): boolean {
  return isAuthenticated || !MEMBERS_ONLY_PATHS.has(path);
}
