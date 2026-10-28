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

async function wikiTreePost<T>(params: Record<string, string>, cookies = ''): Promise<{ data: T; cookies: string }> {
  const response = await fetch(WIKITREE_API_URL, {
    method: 'POST',
    headers: cookies ? { Cookie: cookies } : {},
    body: new URLSearchParams({ appId: WIKITREE_APP_ID, ...params }),
  });
  if (!response.ok) {
    throw new Error(`WikiTree responded with ${response.status}`);
  }
  const data = (await response.json()) as T;
  return { data, cookies: toCookieHeader(response.headers.getSetCookie()) };
}

function clientLogin(params: Record<string, string>, cookies = '') {
  return wikiTreePost<ClientLoginResponse>({ action: 'clientLogin', ...params }, cookies);
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

// See https://github.com/wikitree/wikitree-api/blob/main/getPeople.md
const ANCESTOR_GENERATIONS = 10;
const PAGE_LIMIT = 1000;
const MAX_PAGES = 3;

interface GetPeopleResponse {
  status?: string;
  people?: Record<string, { FirstName?: string; RealName?: string; Gender?: string; Meta?: { Degrees?: number } }>;
}

/** One profile from the member's tree. `degrees` is the generation: 0 is the member, 1 a parent. */
export interface WikiTreeAncestor {
  firstName?: string;
  realName?: string;
  gender?: string;
  degrees: number;
}

/** The member and their direct ancestors, fetched as one batch (paged when the tree is large). */
export async function fetchWikiTreeAncestors(session: WikiTreeSession): Promise<WikiTreeAncestor[]> {
  const ancestors = new Map<string, WikiTreeAncestor>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data } = await wikiTreePost<GetPeopleResponse[]>(
      {
        action: 'getPeople',
        keys: session.userName,
        ancestors: String(ANCESTOR_GENERATIONS),
        fields: 'Id,FirstName,RealName,Gender,Meta',
        limit: String(PAGE_LIMIT),
        start: String(page * PAGE_LIMIT),
      },
      session.cookies,
    );
    const result = data[0];
    if (!result || result.status) {
      throw new Error(`WikiTree getPeople failed: ${result?.status ?? 'empty response'}`);
    }
    const people = Object.entries(result.people ?? {});
    for (const [id, p] of people) {
      ancestors.set(id, { firstName: p.FirstName, realName: p.RealName, gender: p.Gender, degrees: p.Meta?.Degrees ?? 0 });
    }
    // The member is returned on every page; only their relatives count toward the limit.
    const related = people.filter(([, p]) => (p.Meta?.Degrees ?? 0) > 0).length;
    if (related < PAGE_LIMIT) {
      break;
    }
  }
  return [...ancestors.values()];
}

/** Ends the WikiTree session held by the server. */
export async function logoutWikiTree(session: WikiTreeSession): Promise<void> {
  await clientLogin({ doLogout: '1' }, session.cookies);
}
