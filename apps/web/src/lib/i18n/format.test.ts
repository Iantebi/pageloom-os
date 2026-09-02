import { describe, expect, it } from "vitest";
import { dateOnly, dateTime } from "./format";

// Regression coverage for the /dashboard and /projects "This page couldn't load" crashes: a
// Firestore date field that's present but not a parseable date (legacy data, a manual edit, a bad
// migration) used to reach `Intl.DateTimeFormat.format()` as an Invalid Date, which throws
// `RangeError: Invalid time value` and crashed the whole page around it.
describe("dateTime", () => {
  it("does not throw on an unparseable date string", () => {
    expect(() => dateTime("not-a-real-date")).not.toThrow();
  });
  it("falls back to the em dash placeholder for an unparseable date string", () => {
    expect(dateTime("not-a-real-date")).toBe("—");
  });
  it("falls back to the em dash placeholder for missing/empty values", () => {
    expect(dateTime(undefined)).toBe("—");
    expect(dateTime("")).toBe("—");
  });
  it("still formats a real ISO date (no behavior change for well-formed data)", () => {
    expect(dateTime("2026-01-15T10:30:00.000Z")).not.toBe("—");
  });
});

describe("dateOnly", () => {
  it("does not throw on an unparseable date string", () => {
    expect(() => dateOnly("not-a-real-date")).not.toThrow();
  });
  it("falls back to the em dash placeholder for an unparseable date string", () => {
    expect(dateOnly("not-a-real-date")).toBe("—");
  });
});
