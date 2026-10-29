import type { FavoriteName } from "shared";

// Sample data for demo mode. Every name is in the demo family tree, so Discover
// shows the same names, and the origin and meaning come from the server's dictionary.

/** Sample favorites, newest first. */
export const DEMO_FAVORITES: FavoriteName[] = [
  { name: "Hazel", gender: "girl" },
  { name: "Oliver", gender: "boy" },
  { name: "Eleanor", gender: "girl" },
  { name: "Jasper", gender: "boy" },
  { name: "Clara", gender: "girl" },
  { name: "Henry", gender: "boy" },
  { name: "Violet", gender: "girl" },
  { name: "Silas", gender: "boy" },
  { name: "Astrid", gender: "girl" },
  { name: "Ezra", gender: "boy" },
  { name: "Mabel", gender: "girl" },
];

/** Sample final picks, best first. Each is one of DEMO_FAVORITES. */
export const DEMO_SHORTLIST = ["Hazel", "Jasper"];

/** A sample linked partner and the names they liked. */
export const DEMO_PARTNER: { name: string; favorites: FavoriteName[] } = {
  name: "Daniel",
  favorites: [
    ...DEMO_FAVORITES.filter((f) => ["Hazel", "Jasper", "Clara", "Silas", "Ezra"].includes(f.name)),
    { name: "Arthur", gender: "boy" },
    { name: "Rose", gender: "girl" },
    { name: "Samuel", gender: "boy" },
    { name: "Margaret", gender: "girl" },
  ],
};
