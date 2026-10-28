import type { WikiTreeUser } from 'shared';

// See https://github.com/wikitree/wikitree-api/blob/main/authentication.md
// WikiTree only allows browser (CORS) calls from its own allowlisted origins, so the
// server talks to WikiTree for the client and keeps the session cookies, the way
// WikiTree's Python example does.
const WIKITREE_API_URL = 'https://api.wikitree.com/api.php';
const WIKITREE_APP_ID = 'LittleRoots';

interface ClientLoginResponse {
  clientLogin?: {
    result?: string;
    userid?: number | string;
    username?: string;
  };
}

/** A confirmed WikiTree member plus the cookies that carry their session at api.wikitree.com. */
export interface WikiTreeSession extends WikiTreeUser {
  cookies: string;
}

/** Joins `Set-Cookie` headers into a `Cookie` header, dropping cookies WikiTree is deleting. */
function toCookieHeader(setCookies: string[]): string {
  return setCookies
    .map((cookie) => cookie.split(';')[0].trim())
    .filter((pair) => pair.includes('=') && !pair.endsWith('=deleted'))
    .join('; ');
}

async function clientLogin(
  params: Record<string, string>,
  cookies = '',
): Promise<{ data: ClientLoginResponse; cookies: string }> {
  const response = await fetch(WIKITREE_API_URL, {
    method: 'POST',
    headers: cookies ? { Cookie: cookies } : {},
    body: new URLSearchParams({ action: 'clientLogin', appId: WIKITREE_APP_ID, ...params }),
  });
  if (!response.ok) {
    throw new Error(`WikiTree responded with ${response.status}`);
  }
  const data = (await response.json()) as ClientLoginResponse;
  return { data, cookies: toCookieHeader(response.headers.getSetCookie()) };
}

/** Exchanges the one-time authcode WikiTree sent back for the member and their session, or null if rejected. */
export async function confirmWikiTreeLogin(authcode: string): Promise<WikiTreeSession | null> {
  const { data, cookies } = await clientLogin({ authcode });
  const login = data.clientLogin;
  if (login?.result !== 'Success' || login.userid === undefined || !login.username) {
    return null;
  }
  return { userId: Number(login.userid), userName: login.username, cookies };
}

/** Whether the stored WikiTree session is still signed in. */
export async function checkWikiTreeLogin(session: WikiTreeSession): Promise<boolean> {
  const { data } = await clientLogin({ checkLogin: String(session.userId) }, session.cookies);
  return data.clientLogin?.result === 'ok';
}

/** Ends the WikiTree session held by the server. */
export async function logoutWikiTree(session: WikiTreeSession): Promise<void> {
  await clientLogin({ doLogout: '1' }, session.cookies);
}
