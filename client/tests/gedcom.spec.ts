import { expect, test } from "@playwright/test";
import { ancestorsOf, gedcomYear, guessHomePerson, MAX_ANCESTORS, parseGedcom, personLabel } from "../src/gedcom/parseGedcom";

// Pure functions: these run in Node, no browser page needed.

// Me → parents Walter & Hazel → Walter's parents George & Iris.
// Hazel's mother is also Iris (cousins married), so Iris should count once, at generation 2.
const TREE = [
  "﻿0 HEAD",
  "1 GEDC",
  "2 VERS 5.5.1",
  "1 CHAR UTF-8",
  "0 @I1@ INDI",
  "1 NAME Pat /Smith/",
  "1 SEX F",
  "1 FAMC @F1@",
  "0 @I2@ INDI",
  "1 NAME Walter James /Smith/",
  "1 SEX M",
  "1 BIRT",
  "2 DATE ABT 1902",
  "1 FAMC @F2@",
  "0 @I3@ INDI",
  "1 NAME Haz",
  "2 CONC el /Jones/",
  "1 SEX F",
  "1 BIRT",
  "2 DATE 12 MAR 1905",
  "1 BIRT",
  "2 DATE 1999",
  "1 FAMC @F3@",
  "0 @I4@ INDI",
  "1 NAME George /Smith/",
  "1 SEX M",
  "0 @I5@ INDI",
  "1 NAME /Brown/",
  "2 GIVN Iris May",
  "1 NAME Ivy /Alias/",
  "2 GIVN Ivy",
  "1 SEX F",
  "0 @F1@ FAM",
  "1 HUSB @I2@",
  "1 WIFE @I3@",
  "1 CHIL @I1@",
  "0 @F2@ FAM",
  "1 HUSB @I4@",
  "1 WIFE @I5@",
  "0 @F3@ FAM",
  "1 WIFE @I5@",
  "1 HUSB @I99@",
  "0 TRLR",
].join("\r\n");

test.describe("parseGedcom", () => {
  test("reads people, names, sex, birth years and parents", () => {
    const gedcom = parseGedcom(TREE);

    expect(gedcom.people.size).toBe(5);
    expect(gedcom.families.size).toBe(3);
    expect(gedcom.people.get("@I2@")).toEqual({
      id: "@I2@",
      givenName: "Walter James",
      surname: "Smith",
      sex: "M",
      birthYear: 1902,
      parentFamilies: ["@F2@"],
    });
  });

  test("joins CONC lines and keeps only the first birth date", () => {
    const hazel = parseGedcom(TREE).people.get("@I3@");

    expect(hazel?.givenName).toBe("Hazel");
    expect(hazel?.surname).toBe("Jones");
    expect(hazel?.birthYear).toBe(1905);
  });

  test("prefers GIVN and ignores alias names", () => {
    const iris = parseGedcom(TREE).people.get("@I5@");

    expect(iris?.givenName).toBe("Iris May");
    expect(iris?.surname).toBe("Brown");
  });

  test("skips lines it doesn't understand", () => {
    const gedcom = parseGedcom("garbage\n0 @I1@ INDI\n1 NAME Ann /Lee/\nnot a line\n1 SEX X\n");

    expect(gedcom.people.get("@I1@")).toEqual({ id: "@I1@", givenName: "Ann", surname: "Lee", parentFamilies: [] });
  });

  test("finds nobody in a file that isn't GEDCOM", () => {
    expect(parseGedcom("name,born\nHazel,1905\n").people.size).toBe(0);
  });
});

test.describe("guessHomePerson", () => {
  test("uses the header's home person", () => {
    const gedcom = parseGedcom(TREE.replace("1 CHAR UTF-8", "1 _HOME @I3@"));

    expect(guessHomePerson(gedcom)).toBe("@I3@");
  });

  test("falls back to the first person when the home person isn't in the file", () => {
    const gedcom = parseGedcom(TREE.replace("1 CHAR UTF-8", "1 _ROOT @I404@"));

    expect(guessHomePerson(gedcom)).toBe("@I1@");
  });

  test("is undefined for an empty tree", () => {
    expect(guessHomePerson(parseGedcom("0 HEAD\n0 TRLR"))).toBeUndefined();
  });
});

test.describe("ancestorsOf", () => {
  test("walks up the tree, counting someone who appears twice at their nearest generation", () => {
    const ancestors = ancestorsOf(parseGedcom(TREE), "@I1@");

    expect(ancestors).toEqual([
      { firstName: "Walter James", lastName: "Smith", gender: "Male", birthDate: "1902", degrees: 1 },
      { firstName: "Hazel", lastName: "Jones", gender: "Female", birthDate: "1905", degrees: 1 },
      { firstName: "George", lastName: "Smith", gender: "Male", degrees: 2 },
      { firstName: "Iris May", lastName: "Brown", gender: "Female", degrees: 2 },
    ]);
  });

  test("stops after the given number of generations", () => {
    expect(ancestorsOf(parseGedcom(TREE), "@I1@", 1).map((a) => a.degrees)).toEqual([1, 1]);
  });

  test("is empty for someone without parents in the file", () => {
    expect(ancestorsOf(parseGedcom(TREE), "@I4@")).toEqual([]);
  });

  test(`returns at most ${MAX_ANCESTORS} ancestors`, () => {
    // One generation wide enough to pass the cap: the root is a child in many families.
    const lines = ["0 @ROOT@ INDI", "1 NAME Pat /Smith/"];
    for (let i = 0; i < MAX_ANCESTORS; i++) lines.push(`1 FAMC @F${i}@`);
    for (let i = 0; i < MAX_ANCESTORS; i++) {
      lines.push(`0 @H${i}@ INDI`, "1 NAME Al /A/", `0 @W${i}@ INDI`, "1 NAME Bo /B/");
      lines.push(`0 @F${i}@ FAM`, `1 HUSB @H${i}@`, `1 WIFE @W${i}@`);
    }

    expect(ancestorsOf(parseGedcom(lines.join("\n")), "@ROOT@")).toHaveLength(MAX_ANCESTORS);
  });
});

test.describe("helpers", () => {
  test("gedcomYear reads the year from common date forms", () => {
    expect(gedcomYear("12 MAR 1902")).toBe(1902);
    expect(gedcomYear("BET 1840 AND 1845")).toBe(1840);
    expect(gedcomYear("ABT 850")).toBe(850);
    expect(gedcomYear("UNKNOWN")).toBeUndefined();
  });

  test("personLabel shows the name and birth year", () => {
    const people = parseGedcom(TREE).people;

    expect(personLabel(people.get("@I2@")!)).toBe("Walter James Smith (b. 1902)");
    expect(personLabel(people.get("@I4@")!)).toBe("George Smith");
    expect(personLabel({ id: "@X@", parentFamilies: [] })).toBe("Unnamed person");
  });
});
