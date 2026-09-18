import { describe, expect, it } from "vitest";
import { INITIAL_DISCOVERY_DATA } from "../data/initialData";
import { toRealSectionResponses } from "./discoveryMapping";

// Regression test (found 2026-09-18 while verifying Phase 1's required-field validation in
// production): data.hasExistingDomain is typed `boolean | null` — unanswered is a literal `null`,
// not `undefined`. The cleaning filter here only excluded `undefined`/""/empty-array, so an
// unanswered domain question sent `"presence.hasWebsite": null` straight to the server on every
// autosave, which discoveryResponseValueSchema (no null variant) rejected with a 400 — every
// single time, for as long as the question stayed unanswered. Client-side validation correctly
// blocked step 7 from advancing the whole time, so this was invisible except as a permanent
// "sync error" pill with no obvious cause.
describe("toRealSectionResponses — null-valued fields", () => {
  it("omits presence.hasWebsite/hasDomain entirely when hasExistingDomain is null (unanswered)", () => {
    const data = { ...INITIAL_DISCOVERY_DATA, hasExistingDomain: null };
    const sections = toRealSectionResponses(data);
    expect(sections.presence?.["presence.hasWebsite"]).toBeUndefined();
    expect(sections.presence?.["presence.hasDomain"]).toBeUndefined();
    expect(Object.keys(sections.presence ?? {})).not.toContain("presence.hasWebsite");
  });

  it("still includes them once answered, including a `false` (meaningful) answer", () => {
    const answeredFalse = toRealSectionResponses({ ...INITIAL_DISCOVERY_DATA, hasExistingDomain: false, phone: "050-1234567", email: "a@b.co" });
    expect(answeredFalse.presence?.["presence.hasWebsite"]).toBe(false);
    expect(answeredFalse.presence?.["presence.hasDomain"]).toBe(false);

    const answeredTrue = toRealSectionResponses({ ...INITIAL_DISCOVERY_DATA, hasExistingDomain: true, phone: "050-1234567", email: "a@b.co" });
    expect(answeredTrue.presence?.["presence.hasWebsite"]).toBe(true);
  });
});
