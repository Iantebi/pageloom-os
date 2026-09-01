import { describe, expect, it } from "vitest";
import { launchChecklist } from "./launch-checklist.js";

describe("launch checklist", () => {
  it("starts with every item incomplete", () => {
    const items = launchChecklist();
    expect(items.length).toBeGreaterThan(5);
    expect(items.every(item => item.complete === false)).toBe(true);
  });
  it("has unique ids and covers the mission's required checks", () => {
    const ids = launchChecklist().map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const required of ["domain", "ssl", "forms", "phone", "whatsapp", "email", "mobile", "desktop", "favicon", "seo", "analytics", "privacy", "accessibility"]) {
      expect(ids).toContain(required);
    }
  });
  it("returns a fresh array each call (no shared mutable state)", () => {
    const a = launchChecklist();
    a[0].complete = true;
    expect(launchChecklist()[0].complete).toBe(false);
  });
});
