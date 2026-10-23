/** Public user shape returned by the auth endpoints. */
export interface User {
  id: string;
  name: string;
  email: string;
}

export type NameGender = 'boy' | 'girl';

/** A name a user saved as a favorite. */
export interface FavoriteName {
  name: string;
  gender?: NameGender;
}

/** A name to show the user, with where it comes from and what it means. */
export interface BabyName {
  name: string;
  gender: NameGender;
  origin: string;
  meaning: string;
}
