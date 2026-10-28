import { describe, expect, test } from '@jest/globals';
import { cleanFirstName, fakeNameCandidates, toNameCandidates } from '../names.ts';

describe('cleanFirstName', () => {
  test('keeps the first word and trims stray punctuation', () => {
    expect(cleanFirstName('Mary Ann')).toBe('Mary');
    expect(cleanFirstName('"Hattie"')).toBe('Hattie');
    expect(cleanFirstName('  Jasper, ')).toBe('Jasper');
  });

  test('title-cases all-caps and all-lowercase names but keeps mixed case', () => {
    expect(cleanFirstName('WILLIAM')).toBe('William');
    expect(cleanFirstName('clara')).toBe('Clara');
    expect(cleanFirstName('McKenzie')).toBe('McKenzie');
  });

  test("allows accents, apostrophes and hyphens", () => {
    expect(cleanFirstName('Zoë')).toBe('Zoë');
    expect(cleanFirstName("D'Arcy")).toBe("D'Arcy");
    expect(cleanFirstName('Anne-Marie')).toBe('Anne-Marie');
  });

  test('rejects initials, digits, placeholders and blanks', () => {
    expect(cleanFirstName('J.')).toBeNull();
    expect(cleanFirstName('John2')).toBeNull();
    expect(cleanFirstName('Unknown')).toBeNull();
    expect(cleanFirstName('INFANT')).toBeNull();
    expect(cleanFirstName('Mrs. Smith')).toBeNull();
    expect(cleanFirstName('')).toBeNull();
    expect(cleanFirstName(undefined)).toBeNull();
  });
});

describe('toNameCandidates', () => {
  test('maps genders and skips the member themself', () => {
    const candidates = toNameCandidates([
      { firstName: 'Jordan', gender: 'Male', degrees: 0 },
      { firstName: 'Thomas', gender: 'Male', degrees: 1 },
      { firstName: 'Margaret', gender: 'Female', degrees: 1 },
    ]);

    expect(candidates).toEqual([
      { name: 'Thomas', gender: 'boy' },
      { name: 'Margaret', gender: 'girl' },
    ]);
  });

  test('skips unknown genders and unusable names', () => {
    const candidates = toNameCandidates([
      { firstName: 'Robin', gender: '', degrees: 2 },
      { firstName: 'Unknown', gender: 'Female', degrees: 2 },
      { gender: 'Male', degrees: 3 },
    ]);

    expect(candidates).toEqual([]);
  });

  test('falls back to the preferred name when the first name is missing or unusable', () => {
    const candidates = toNameCandidates([
      { realName: 'Hattie', gender: 'Female', degrees: 2 },
      { firstName: 'J.', realName: 'James', gender: 'Male', degrees: 2 },
    ]);

    expect(candidates).toEqual([
      { name: 'Hattie', gender: 'girl' },
      { name: 'James', gender: 'boy' },
    ]);
  });
});

describe('fakeNameCandidates', () => {
  test('skips the user and uses first names only', () => {
    const candidates = fakeNameCandidates();

    expect(candidates.map((c) => c.name)).not.toContain('Jordan');
    expect(candidates).toContainEqual({ name: 'Thomas', gender: 'boy' });
    expect(candidates).toContainEqual({ name: 'Margaret', gender: 'girl' });
  });
});
