import type { GedcomAncestor } from "shared";

// Reads the parts of a GEDCOM file (the family tree export format of Ancestry,
// FamilySearch, MyHeritage, Gramps, RootsMagic, …) that LittleRoots needs: people,
// their parents, names, sex and birth year. Runs in the browser, so only the
// ancestors' names and years are sent to the server, never the file.
// See https://gedcom.io/specifications/ged551.pdf (5.5.1) and FamilySearch GEDCOM 7.

/** One INDI record. */
export interface GedcomPerson {
  id: string;
  givenName?: string;
  surname?: string;
  sex?: "M" | "F";
  birthYear?: number;
  /** FAMC: the families this person is a child in. */
  parentFamilies: string[];
}

/** One FAM record: just the parents, since we only walk up the tree. */
export interface GedcomFamily {
  id: string;
  husband?: string;
  wife?: string;
}

export interface Gedcom {
  /** In file order. */
  people: Map<string, GedcomPerson>;
  families: Map<string, GedcomFamily>;
  /** The home person some programs record in the header (`_HOME`/`_ROOT`). */
  homeId?: string;
}

/** Ancestors further back than this are left out, like the WikiTree import. */
export const MAX_GENERATIONS = 10;
/** The server takes at most this many ancestors. */
export const MAX_ANCESTORS = 3000;

// "0 @I1@ INDI", "1 NAME John /Smith/", "2 DATE ABT 1850". Some exports indent lines.
const LINE_PATTERN = /^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?: (.*))?$/;

/** "John Henry /Smith/ Jr" → given "John Henry", surname "Smith". */
function splitName(value: string): { given?: string; surname?: string } {
  const match = /^([^/]*)(?:\/([^/]*)\/?)?/.exec(value);
  const given = match?.[1]?.trim();
  const surname = match?.[2]?.trim();
  return { given: given || undefined, surname: surname || undefined };
}

/** The year from a GEDCOM date like "12 MAR 1902", "ABT 1850", "BET 1840 AND 1845" or "1902/03". */
export function gedcomYear(date: string): number | undefined {
  const match = /\b(\d{3,4})\b/.exec(date);
  const year = match ? Number(match[1]) : NaN;
  return year > 0 ? year : undefined;
}

/** Parses GEDCOM text. Lines it doesn't understand are skipped rather than rejected. */
export function parseGedcom(text: string): Gedcom {
  const people = new Map<string, GedcomPerson>();
  const families = new Map<string, GedcomFamily>();
  let homeId: string | undefined;

  // What the current lines belong to.
  let record: "HEAD" | "INDI" | "FAM" | null = null;
  let person: GedcomPerson | null = null;
  let family: GedcomFamily | null = null;
  // The level-1 tag the current level-2 lines sit under (NAME, BIRT, …).
  let level1Tag = "";
  // Only the first NAME and BIRT count: later ones are aliases or alternatives.
  let seenName = false;
  let seenBirth = false;
  let nameFromGivn = false;
  // The NAME value, kept so CONC/CONT lines can extend it.
  let nameValue: string | null = null;

  const applyName = () => {
    if (!person || nameValue === null) return;
    const { given, surname } = splitName(nameValue);
    if (!nameFromGivn) person.givenName = given;
    person.surname ??= surname;
  };

  for (const line of text.replace(/^﻿/, "").split(/\r\n|\r|\n/)) {
    const match = LINE_PATTERN.exec(line);
    if (!match) continue;
    const level = Number(match[1]);
    const xref = match[2];
    const tag = match[3].toUpperCase();
    const value = (match[4] ?? "").trim();

    if (level === 0) {
      applyName();
      person = null;
      family = null;
      nameValue = null;
      record = null;
      if (tag === "HEAD") {
        record = "HEAD";
      } else if (tag === "INDI" && xref) {
        record = "INDI";
        person = { id: xref, parentFamilies: [] };
        people.set(xref, person);
        seenName = seenBirth = nameFromGivn = false;
      } else if (tag === "FAM" && xref) {
        record = "FAM";
        family = { id: xref };
        families.set(xref, family);
      }
      continue;
    }

    if (level === 1) {
      level1Tag = tag;
      if (record === "HEAD" && (tag === "_HOME" || tag === "_ROOT") && value.startsWith("@")) {
        homeId = value;
      } else if (person) {
        applyName();
        nameValue = null;
        if (tag === "NAME" && !seenName) {
          seenName = true;
          nameValue = value;
        } else if (tag === "SEX") {
          const sex = value.toUpperCase();
          if (sex === "M" || sex === "F") person.sex = sex;
        } else if (tag === "FAMC" && value.startsWith("@")) {
          person.parentFamilies.push(value);
        }
      } else if (family) {
        if (tag === "HUSB" && value.startsWith("@")) family.husband = value;
        else if (tag === "WIFE" && value.startsWith("@")) family.wife = value;
      }
      continue;
    }

    if (!person || level !== 2) continue;
    if (level1Tag === "NAME" && nameValue !== null) {
      if (tag === "CONC") nameValue += value;
      else if (tag === "CONT") nameValue += ` ${value}`;
      else if (tag === "GIVN" && value) {
        person.givenName = value;
        nameFromGivn = true;
      } else if (tag === "SURN" && value) {
        person.surname = value;
      }
    } else if (level1Tag === "BIRT" && tag === "DATE" && !seenBirth) {
      seenBirth = true;
      person.birthYear = gedcomYear(value);
    }
  }
  applyName();

  return { people, families, homeId: homeId && people.has(homeId) ? homeId : undefined };
}

/**
 * Who the file is most likely about: the header's home person, or else the first
 * person in the file (Ancestry and RootsMagic exports start with the home person).
 */
export function guessHomePerson(gedcom: Gedcom): string | undefined {
  return gedcom.homeId ?? gedcom.people.keys().next().value;
}

/** "John Smith (b. 1902)", for picking who you are. */
export function personLabel(person: GedcomPerson): string {
  const name = [person.givenName, person.surname].filter(Boolean).join(" ") || "Unnamed person";
  return person.birthYear ? `${name} (b. ${person.birthYear})` : name;
}

/**
 * The ancestors of `rootId`, nearest generations first, up to `maxGenerations`
 * back. Someone who appears more than once in the tree (cousins who married) is
 * counted at their closest generation. The root person themself is left out.
 */
export function ancestorsOf(gedcom: Gedcom, rootId: string, maxGenerations = MAX_GENERATIONS): GedcomAncestor[] {
  const degrees = new Map<string, number>([[rootId, 0]]);
  const ancestors: GedcomAncestor[] = [];
  let current = [rootId];

  for (let generation = 1; generation <= maxGenerations && current.length > 0; generation++) {
    const next: string[] = [];
    for (const id of current) {
      for (const familyId of gedcom.people.get(id)?.parentFamilies ?? []) {
        const family = gedcom.families.get(familyId);
        for (const parentId of [family?.husband, family?.wife]) {
          if (!parentId || degrees.has(parentId)) continue;
          const parent = gedcom.people.get(parentId);
          if (!parent) continue;
          degrees.set(parentId, generation);
          next.push(parentId);
          if (ancestors.length < MAX_ANCESTORS) {
            ancestors.push({
              ...(parent.givenName ? { firstName: parent.givenName } : {}),
              ...(parent.surname ? { lastName: parent.surname } : {}),
              ...(parent.sex ? { gender: parent.sex === "M" ? "Male" : "Female" } : {}),
              ...(parent.birthYear ? { birthDate: String(parent.birthYear) } : {}),
              degrees: generation,
            });
          }
        }
      }
    }
    current = next;
  }
  return ancestors;
}
