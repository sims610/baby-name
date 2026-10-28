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

/** The WikiTree member a user connected through WikiTree's clientLogin flow. */
export interface WikiTreeUser {
  userId: number;
  userName: string;
}

/** What a visitor submits through the Contact form. */
export interface ContactMessageInput {
  name: string;
  email: string;
  phone?: string;
  message: string;
}
