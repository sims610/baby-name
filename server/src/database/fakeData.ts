// Fake ancestry data shaped like the FamilySearch `GET /platform/tree/ancestry` response
// (see notes.md). Ascendancy number 1 is the user; even numbers are fathers (male)
// and odd numbers are mothers (female).

export interface AncestorPerson {
  id: string;
  display: {
    name: string;
    gender: 'Male' | 'Female';
    ascendancyNumber: string;
  };
}

function person(id: string, name: string, ascendancyNumber: number): AncestorPerson {
  return {
    id,
    display: {
      name,
      gender: ascendancyNumber % 2 === 0 ? 'Male' : 'Female',
      ascendancyNumber: String(ascendancyNumber),
    },
  };
}

export const fakeAncestry: { persons: AncestorPerson[] } = {
  persons: [
    person('KWCB-HZV', 'Jordan Smith', 1),
    // Parents
    person('KWCB-001', 'Thomas Smith', 2),
    person('KWCB-002', 'Margaret Ellis', 3),
    // Grandparents
    person('KWCB-003', 'Henry Smith', 4),
    person('KWCB-004', 'Eleanor Brooks', 5),
    person('KWCB-005', 'Walter Ellis', 6),
    person('KWCB-006', 'Clara Jensen', 7),
    // Great-grandparents
    person('KWCB-007', 'Samuel Smith', 8),
    person('KWCB-008', 'Rose Whitaker', 9),
    person('KWCB-009', 'Oliver Brooks', 10),
    person('KWCB-010', 'Hazel Morgan', 11),
    person('KWCB-011', 'Arthur Ellis', 12),
    person('KWCB-012', 'Mabel Young', 13),
    person('KWCB-013', 'Lars Jensen', 14),
    person('KWCB-014', 'Ingrid Nilsson', 15),
    // 2nd great-grandparents
    person('KWCB-015', 'Ezra Smith', 16),
    person('KWCB-016', 'Lydia Hale', 17),
    person('KWCB-017', 'Silas Whitaker', 18),
    person('KWCB-018', 'Beatrice Lane', 19),
    person('KWCB-019', 'Josiah Brooks', 20),
    person('KWCB-020', 'Adeline Price', 21),
    person('KWCB-021', 'Calvin Morgan', 22),
    person('KWCB-022', 'Violet Reed', 23),
    person('KWCB-023', 'Jasper Ellis', 24),
    person('KWCB-024', 'Florence Hart', 25),
    person('KWCB-025', 'Gideon Young', 26),
    person('KWCB-026', 'Opal Carter', 27),
    person('KWCB-027', 'Anders Jensen', 28),
    person('KWCB-028', 'Astrid Berg', 29),
    person('KWCB-029', 'Magnus Nilsson', 30),
    person('KWCB-030', 'Sigrid Holm', 31),
  ],
};
