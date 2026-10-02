# Problems & Solutions

**Problem:** FamilySearch API's are only available once your application is approved. Our application is unlikely to be approved.\
**Solutions:** Luckily, there are many other sites and options to provide us the data that we need. One option is wikitree and their API's

---

# FamilySearch API: Random Boy or Girl Name

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

## Step 1: Get the current user's person ID

```
GET https://api.familysearch.org/platform/tree/current-person
```
Returns `303 See Other`. The `Location` header has the person URL, e.g.
`.../platform/tree/persons/KWCB-HZV`. The ID is the last part (`KWCB-HZV`).

## Step 2: Get their ancestors

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

## Step 3: Pick a random boy or girl name

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
