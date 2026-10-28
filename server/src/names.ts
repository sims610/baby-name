import type { NameGender } from 'shared';
import { fakeAncestry } from './database/fakeData.ts';
import type { WikiTreeAncestor } from './wikitree.ts';

/** A first name from the family tree, before origin and meaning are added. */
export interface NameCandidate {
  name: string;
  gender: NameGender;
}

// Words genealogists use when the real first name isn't known.
const PLACEHOLDERS = new Set([
  'unknown',
  'infant',
  'baby',
  'son',
  'daughter',
  'child',
  'stillborn',
  'mr',
  'mrs',
  'miss',
  'private',
]);

// Letters (any alphabet), apostrophes and hyphens: "Zoë", "O'Neil", "Anne-Marie".
const NAME_PATTERN = /^\p{L}[\p{L}'-]*$/u;

function toGender(gender: string | undefined): NameGender | null {
  return gender === 'Male' ? 'boy' : gender === 'Female' ? 'girl' : null;
}

/** First word of a recorded name, tidied up, or null if it isn't a usable first name. */
export function cleanFirstName(raw: string | undefined): string | null {
  // Trim quotes and punctuation, but not digits, so "John2" is rejected rather than becoming "John".
  const word = raw?.trim().split(/\s+/)[0]?.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (!word || word.length < 2 || !NAME_PATTERN.test(word) || PLACEHOLDERS.has(word.toLowerCase())) {
    return null;
  }
  // Fix "WILLIAM" and "william", but keep mixed case like "McKenzie" as recorded.
  if (word === word.toUpperCase() || word === word.toLowerCase()) {
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  }
  return word;
}

/** Usable names from a WikiTree batch, skipping the member themself. */
export function toNameCandidates(ancestors: WikiTreeAncestor[]): NameCandidate[] {
  return ancestors.flatMap((ancestor) => {
    const gender = toGender(ancestor.gender);
    const name = cleanFirstName(ancestor.firstName) ?? cleanFirstName(ancestor.realName);
    return ancestor.degrees > 0 && gender && name ? [{ name, gender }] : [];
  });
}

/** Demo mode: names from fakeData.ts, skipping the user themself (ascendancy number 1). */
export function fakeNameCandidates(): NameCandidate[] {
  return fakeAncestry.persons
    .filter((p) => p.display.ascendancyNumber !== '1')
    .map((p) => ({ name: p.display.name.split(' ')[0], gender: p.display.gender === 'Male' ? 'boy' : 'girl' }));
}
