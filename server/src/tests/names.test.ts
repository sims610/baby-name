import { describe, expect, test } from '@jest/globals';
import { cleanFirstName, fakeNameCandidates, relationName, toNameCandidates } from '../names.ts';

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
      { name: 'Thomas', gender: 'boy', fullName: 'Thomas', generation: 1 },
      { name: 'Margaret', gender: 'girl', fullName: 'Margaret', generation: 1 },
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
      { name: 'Hattie', gender: 'girl', fullName: 'Hattie', generation: 2 },
      { name: 'James', gender: 'boy', fullName: 'James', generation: 2 },
    ]);
  });

  test('keeps who had the name: last name, generation and birth year', () => {
    const candidates = toNameCandidates([
      { firstName: 'Hazel', lastName: 'Morgan', gender: 'Female', birthDate: '1903-05-02', degrees: 3 },
      { firstName: 'Walter', gender: 'Male', birthDate: '0000-00-00', degrees: 2 },
    ]);

    expect(candidates).toEqual([
      { name: 'Hazel', gender: 'girl', fullName: 'Hazel Morgan', generation: 3, birthYear: 1903 },
      { name: 'Walter', gender: 'boy', fullName: 'Walter', generation: 2 },
    ]);
  });
});

describe('relationName', () => {
  test('names each generation', () => {
    expect(relationName(1, 'girl')).toBe('mother');
    expect(relationName(2, 'boy')).toBe('grandfather');
    expect(relationName(3, 'girl')).toBe('great-grandmother');
    expect(relationName(4, 'boy')).toBe('2nd great-grandfather');
    expect(relationName(5, 'girl')).toBe('3rd great-grandmother');
    expect(relationName(6, 'girl')).toBe('4th great-grandmother');
  });
});

describe('fakeNameCandidates', () => {
  test('skips the user and uses first names only', () => {
    const candidates = fakeNameCandidates();

    expect(candidates.map((c) => c.name)).not.toContain('Jordan');
    expect(candidates).toContainEqual(
      expect.objectContaining({ name: 'Thomas', gender: 'boy', fullName: 'Thomas Smith', generation: 1 }),
    );
    expect(candidates).toContainEqual(
      expect.objectContaining({ name: 'Hazel', gender: 'girl', fullName: 'Hazel Morgan', generation: 3 }),
    );
  });
});
