import type { NameGender } from "shared";

/** Link to a name's detail page. Pass the gender when known so the page can color itself. */
export function nameDetailPath(name: string, gender?: NameGender): string {
  const path = `/names/${encodeURIComponent(name)}`;
  return gender ? `${path}?gender=${gender}` : path;
}
