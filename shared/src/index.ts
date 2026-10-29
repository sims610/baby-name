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

/** Where a first name comes from and what it means. */
export interface NameInfo {
  name: string;
  origin: string;
  meaning: string;
}

/** Who can see a user's favorites. */
export type FavoritesVisibility = 'private' | 'partner' | 'public';

/** The account a user linked with to compare favorites. */
export interface Partner {
  name: string;
  email: string;
}

/** Favorites compared with the linked partner's. */
export interface PartnerMatches {
  partner: Partner;
  /** False when the partner keeps their favorites private; the lists below are then empty. */
  shared: boolean;
  matches: FavoriteName[];
  onlyYou: FavoriteName[];
  onlyPartner: FavoriteName[];
}

/** An ancestor who carried a first name. */
export interface NameRoot {
  fullName: string;
  /** e.g. "great-grandmother" */
  relation: string;
  birthYear?: number;
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
