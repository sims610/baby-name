# General Notes

## Problems & Solutions

**Problem:** FamilySearch API's are only available once your application is approved. Our application is unlikely to be approved.
- **Solution:** Wikitree is a potential solution. Wikitree is a family tree website that offers free api use. Trees may be selected as private, and only users with the right access can look at those files.
- **Solution:** Downloading a GED file from RootsMagic per use-case scenario.
- **Solution:** Hard-code user data for demo purposes.

## Links

- [Wikitree API guide](https://github.com/wikitree/wikitree-api/blob/main/README.md)
- [Wikitree Login/Logout help](https://github.com/wikitree/wikitree-api/blob/main/authentication.md)

## Website Function

| User activity | Frontend component | Backend endpoints | Database |
| --- | --- | --- | --- |
| View home page | home.tsx | none | none |
| Register new user | CreateAccountView.tsx | POST /api/auth | `addUser` → users.get(email), users.set(email, user)<br>`createSession` → sessions.set(token, userId) |
| Login new user | unknown | PUT /api/auth | `verifyUser` → users.get(email)<br>`createSession` → sessions.set(token, userId) |
| Logout | unknown | DELETE /api/auth | `getUserByToken` → sessions.get(token)<br>`deleteSession` → sessions.delete(token) |
| Generate name | unknown | GET /api/name?source=demo\|wikitree | `getUserByToken` → sessions.get(token)<br>`getRandomName` → demo: fakeAncestry.persons; wikitree: wikiTreeNames.get(userId), or WikiTree getPeople (10 generations of ancestors) cleaned by `toNameCandidates` |
| List names to swipe (Discover; Demo mode toggle picks the source) | discover.tsx, NameSwiper.tsx | GET /api/name/list?source=demo\|wikitree | same as Generate name, via `listNames` (dedupe + shuffle) |
| Save name as favorite | unknown | POST /api/name | `getUserByToken` → sessions.get(token)<br>`addFavorite` → favorites.get(userId), favorites.set(userId, [...]) |
| View favorites | unknown | GET /api/name/favorites | `getUserByToken` → sessions.get(token)<br>`listFavorites` → favorites.get(userId) |
| Sign in to WikiTree (redirect back to Discover) | discover.tsx, useWikiTreeLogin.ts | POST /api/wikitree/login | `confirmWikiTreeLogin` → WikiTree clientLogin(authcode)<br>`setWikiTreeSession` → wikiTreeSessions.set(userId, session) |
| Check WikiTree sign-in on Discover | discover.tsx, useWikiTreeLogin.ts | GET /api/wikitree/session | `getWikiTreeSession` → wikiTreeSessions.get(userId)<br>`checkWikiTreeLogin` → WikiTree clientLogin(checkLogin) |
| Sign out of WikiTree | discover.tsx, useWikiTreeLogin.ts | DELETE /api/wikitree/session | `deleteWikiTreeSession` → wikiTreeSessions.delete(userId)<br>`logoutWikiTree` → WikiTree clientLogin(doLogout) |

**Database collections** (key-value, in memory in `server/src/database/database.ts`):

| Collection | Key | Value |
| --- | --- | --- |
| users | email (lowercased) | `{ id, name, email, passwordHash }` |
| sessions | token | userId |
| favorites | userId | `[{ name, gender? }]` |
| wikiTreeSessions | userId | `{ userId, userName, cookies }` (WikiTree member + api.wikitree.com session cookies) |
| wikiTreeNames | userId | `{ fetchedAt, candidates: [{ name, gender }] }` (cleaned ancestor names, kept 1 hour; cleared on WikiTree sign-in/out) |
| fakeAncestry (read-only, `fakeData.ts`) | none | `{ persons: [{ id, display: { name, gender, ascendancyNumber } }] }` |

## FamilySearch API: Random Boy or Girl Name

FamilySearch has **no "random name" endpoint**. Instead:
1. Get the signed-in user's person ID.
2. Pull their ancestors (up to 8 generations).
3. Keep only males (boy) or females (girl).
4. Pick one at random in our code.

All calls need an OAuth access token (from FamilySearch sign-in).

**Headers for every call:**
```
Authorization: Bearer <ACCESS_TOKEN>
Accept: application/x-fs-v1+json
```

### Step 1: Get the current user's person ID

```
GET https://api.familysearch.org/platform/tree/current-person
```
Returns `303 See Other`. The `Location` header has the person URL, e.g.
`.../platform/tree/persons/KWCB-HZV`. The ID is the last part (`KWCB-HZV`).

### Step 2: Get their ancestors

```
GET https://api.familysearch.org/platform/tree/ancestry?person=KWCB-HZV&generations=8
```
- `person` = ID from Step 1
- `generations` = how far back (max 8)

Example response (trimmed):
```json
{
  "persons": [
    {
      "id": "KWCB-HZV",
      "display": {
        "name": "John Smith",
        "gender": "Male",
        "ascendancyNumber": "2"
      }
    }
  ]
}
```

### Step 3: Pick a random boy or girl name

Filter `persons` by `display.gender` (`"Male"` or `"Female"`), skip the user
themself (`ascendancyNumber` `"1"`), then pick one at random and use the first
word of `display.name`.

```js
async function randomName(gender, token) {  // gender: "Male" or "Female"
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/x-fs-v1+json",
  };
  const base = "https://api.familysearch.org/platform/tree";

  // Step 1 (browser fetch follows the redirect; the final URL holds the ID)
  const me = await fetch(`${base}/current-person`, { headers });
  const personId = me.url.split("/").pop();

  // Step 2
  const res = await fetch(`${base}/ancestry?person=${personId}&generations=8`, { headers });
  const { persons } = await res.json();

  // Step 3
  const matches = persons.filter(p =>
    p.display.gender === gender && p.display.ascendancyNumber !== "1");
  const pick = matches[Math.floor(Math.random() * matches.length)];
  return pick.display.name.split(" ")[0];
}

randomName("Male", token);    // boy
randomName("Female", token);  // girl
```

**Tip:** `ascendancyNumber` also tells gender: even numbers (2, 4, 6...)
are always fathers (male), odd numbers (3, 5, 7...) are always mothers (female).

Docs: https://www.familysearch.org/developers/docs/api/resources
