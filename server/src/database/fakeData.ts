// Fake ancestry data shaped like the FamilySearch `GET /platform/tree/ancestry` response
// (see notes.md). Ascendancy number 1 is the user; even numbers are fathers (male)
// and odd numbers are mothers (female). Birth years are made up for the demo.

export interface AncestorPerson {
  id: string;
  display: {
    name: string;
    gender: 'Male' | 'Female';
    ascendancyNumber: string;
    birthYear: number;
  };
}

function person(id: string, name: string, ascendancyNumber: number, birthYear: number): AncestorPerson {
  return {
    id,
    display: {
      name,
      gender: ascendancyNumber % 2 === 0 ? 'Male' : 'Female',
      ascendancyNumber: String(ascendancyNumber),
      birthYear,
    },
  };
}

export const fakeAncestry: { persons: AncestorPerson[] } = {
  persons: [
    person('KWCB-HZV', 'Jordan Smith', 1, 1994),
    // Parents
    person('KWCB-001', 'Thomas Smith', 2, 1962),
    person('KWCB-002', 'Margaret Ellis', 3, 1965),
    // Grandparents
    person('KWCB-003', 'Henry Smith', 4, 1931),
    person('KWCB-004', 'Eleanor Brooks', 5, 1934),
    person('KWCB-005', 'Walter Ellis', 6, 1929),
    person('KWCB-006', 'Clara Jensen', 7, 1936),
    // Great-grandparents
    person('KWCB-007', 'Samuel Smith', 8, 1898),
    person('KWCB-008', 'Rose Whitaker', 9, 1902),
    person('KWCB-009', 'Oliver Brooks', 10, 1900),
    person('KWCB-010', 'Hazel Morgan', 11, 1903),
    person('KWCB-011', 'Arthur Ellis', 12, 1896),
    person('KWCB-012', 'Mabel Young', 13, 1901),
    person('KWCB-013', 'Lars Jensen', 14, 1904),
    person('KWCB-014', 'Ingrid Nilsson', 15, 1907),
    // 2nd great-grandparents
    person('KWCB-015', 'Ezra Smith', 16, 1866),
    person('KWCB-016', 'Lydia Hale', 17, 1867),
    person('KWCB-017', 'Silas Whitaker', 18, 1868),
    person('KWCB-018', 'Beatrice Lane', 19, 1869),
    person('KWCB-019', 'Josiah Brooks', 20, 1870),
    person('KWCB-020', 'Adeline Price', 21, 1871),
    person('KWCB-021', 'Calvin Morgan', 22, 1872),
    person('KWCB-022', 'Violet Reed', 23, 1873),
    person('KWCB-023', 'Jasper Ellis', 24, 1874),
    person('KWCB-024', 'Florence Hart', 25, 1875),
    person('KWCB-025', 'Gideon Young', 26, 1876),
    person('KWCB-026', 'Opal Carter', 27, 1877),
    person('KWCB-027', 'Anders Jensen', 28, 1878),
    person('KWCB-028', 'Astrid Berg', 29, 1879),
    person('KWCB-029', 'Magnus Nilsson', 30, 1880),
    person('KWCB-030', 'Sigrid Holm', 31, 1881),
  ],
};
