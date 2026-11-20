# Paginate Discover into rounds, with swipes remembered on the server

## Context
With GEDCOM import, a tree can give hundreds of unique first names. Today `GET /api/name/list` returns every name at once, shuffled fresh on every request (`listNames` in `server/src/database/database.ts:264`). `NameSwiper.tsx` shows "Name 1 of N", and progress only lives in React state. That causes three problems:
- A reload starts over.
- Favorites and passed names come back around.
- "Name 1 of 600" is daunting.

**Decided with the user:**
- Discover runs in **rounds of 25**, each fetched from the server as a page, with a short summary between rounds.
- Swipes are **remembered on the server**. Likes are already saved as favorites; passes get a new table. Later rounds and later sessions skip both.
- A "Start over" option clears the passes.

## Design

### Paging without offsets
Every swiped name is left out of the results, so the next page is always just "the first 25 unswiped names". There is no offset or cursor to track.
- The client picks a random `seed` once per session and sends it on every page request. The server shuffles with that seed, so the order stays stable within a session and different between sessions.
- A user who leaves mid-round gets the names they didn't swipe again next time.

### Server
1. **Table** in `server/src/database/db.ts`: `passed_names (user_id CHAR(36), name VARCHAR(50) COLLATE utf8mb4_0900_as_ci, passed_at BIGINT, PRIMARY KEY (user_id, name), FK → users ON DELETE CASCADE)`. Uses the same collation as `favorites.name`.
2. **Helpers** in `database.ts`:
   - `addPassedName(userId, name)`: an upsert.
   - `clearPassedNames(userId)`.
   - `swipedNames(userId): Set<string>`: lowercased names from `passed_names` UNION `favorites`.
3. **`listNames`** (`database.ts:264`) gets an optional `{ seed }`:
   - Remove duplicates as today, sort by name so the order is deterministic, then do the existing Fisher–Yates shuffle with a small seeded PRNG (mulberry32, about 6 lines) instead of `Math.random`.
   - Without a seed, it behaves exactly as today, so `useNameDictionary.ts` (the full demo list) is unaffected.
   - `partnerTrees` stays computed over all matches before anything is left out, so the "both trees" badges stay correct.
4. **`GET /api/name/list`** (`server/src/routes/nameRouter.ts:~210`):
   - New optional `limit` (an integer from 1 to 100) and `seed` (a 32-bit unsigned integer). Anything else gets a 400.
   - With `limit` and `source=wikitree`, swiped names are left out, the result is cut to `limit`, and the response is `{ names, remaining }`. `remaining` counts the unswiped names, including this page.
   - With `limit` and `source=demo`, names are paged from the seeded list but nothing is left out. Demo passes aren't recorded either, so sample data never mixes with the user's own history.
   - Without `limit`, the response stays exactly as today.
   - Update the endpoint `docs` entry.
5. **New endpoints** in `nameRouter.ts`:
   - `POST /api/name/passed` `{ name }` records a pass. It returns 400 for a missing name or one longer than `MAX_NAME_LENGTH`.
   - `DELETE /api/name/passed` clears all passes ("Start over"). Favorites stay left out, because they're already saved.
   - Both get `docs` entries.

### Client: `client/src/components/swipe/NameSwiper.tsx`
- **State:**
  - `seed`: a random integer from `useState(() => …)`, re-chosen on Start over.
  - `round`: the round number.
  - `names`: the current page.
  - `remaining`: from the server.
  - `pendingSwipes`: a ref holding the in-flight favorite and pass requests.
- **Loading:** the effect fetches `/name/list?source&gender&limit=25&seed`. A shared `loadRound()` is used both by the effect and by "Keep going".
- **Pass** (wikitree source only): fire a `POST /name/passed`, reporting errors the same way `saveFavorite` does, and push the promise into `pendingSwipes`. `saveFavorite` also pushes its promise there.
- **Next round:** `await Promise.allSettled(pendingSwipes)` before fetching the next page, so a swipe whose request hasn't finished can't show up again.
- **Progress line:** "Name 3 of 25 · Round 2 · 412 left", with the bar showing progress through the round.
- **When a round ends**, the existing finished screen becomes a round summary:
  - "Round 2 done. You liked 4 of 25."
  - If names remain: a **Keep going** button (loads the next round) plus the existing Change Preference button.
  - If none remain: "You've seen every name in your tree" with a **Start over** button. On wikitree it calls `DELETE /name/passed`, then picks a new seed and round 1. This replaces the current `handleRestart`.
- **Empty first page:** if the first page is empty but `remaining` is 0 because everything has already been swiped, show the "seen every name" state with Start over. Don't show the "No names yet" notice in that case.

### Docs
Add a row to the endpoint table in `notes.md` for `/api/name/passed` and the new `limit`/`seed` parameters.

## Verification
- **Server tests** (`server/src/tests/nameRouter.test.ts`, using the GEDCOM import from `gedcomRouter.test.ts` to seed a tree quickly):
  - `limit` cuts the list, and `remaining` is correct.
  - The same `seed` gives the same order.
  - Passed names and favorites are left out of later pages, and of other genders.
  - After everything is swiped, the response is `{ names: [], remaining: 0 }`.
  - `DELETE /passed` brings passed names back but not favorites.
  - Demo source pages but never leaves anything out.
  - Bad `limit` or `seed` values get a 400.
  - Without `limit`, the response is unchanged.
- Run with `TEST_DATABASE_URL=mysql://root:rootpass@localhost:3307 npx jest` in `server/`, plus `npm run typecheck` and `npm run lint`.
- **Client:** run `npx tsc --noEmit`, then an end-to-end Playwright check against both dev servers like last time, using a GEDCOM with 60 or more distinct names:
  - Swipe a round and check the summary.
  - Keep going, and check that names from round 1 don't repeat.
  - Reload, and check that swiped names stay gone.
  - Finish all rounds, Start over, and check that passed names return while favorites don't.
