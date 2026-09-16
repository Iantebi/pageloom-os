import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { discoverySection, isQuestionVisible } from "@pageloom/core";
import { DiscoverySection } from "./DiscoverySection";

// DiscoveryQuestionField.tsx imports firebaseAuth/firebaseStorage for its file-upload fields
// (getDownloadURL preview, current uid for the upload path) — importing the real module
// initializes the Firebase SDK, which throws without a configured API key in the test
// environment. Mocked the same way apps/web/src/app/discovery/repro.test.tsx already does.
vi.mock("@/lib/firebase", () => ({
  firebaseAuth: { currentUser: null },
  firestore: {},
  firebaseStorage: {},
  firebaseConfigured: true,
}));

// Regression coverage for a real accessibility gap (2026-09-16): question labels were plain
// <span> elements with no programmatic association to their input — a screen reader had no way
// to connect "מה שם העסק?" to the text box it belongs to, despite PRD.md §29 already documenting
// "every input has a visible, associated label" as a requirement. Fixed by pairing a <label
// htmlFor={question.id}> with a matching id on the single-input field types, plus a
// role="group" aria-labelledby wrapper covering every field type uniformly (composite types
// included). This test proves the association actually exists in the rendered HTML, not just in
// the source — a passing render alone would not have caught the original gap.
describe("DiscoverySection accessibility", () => {
  it("renders a <label htmlFor> that matches a real input id for every single-input question in a section", () => {
    const html = renderToStaticMarkup(
      <DiscoverySection organizationId="org1" projectId="p1" sectionId="business" initialResponses={{}} readOnly={false} onSectionCompleted={() => {}} />,
    );
    const section = discoverySection("business");
    const singleInputTypes = new Set(["short_text", "long_text", "email", "phone", "url", "date", "select"]);
    const checked = section.questions.filter(question => singleInputTypes.has(question.type) && isQuestionVisible(question, {}));
    expect(checked.length).toBeGreaterThan(0);
    for (const question of checked) {
      expect(html).toContain(`for="${question.id}"`);
      expect(html).toContain(`id="${question.id}"`);
    }
  });

  it("wraps every question's field in role=\"group\" aria-labelledby, covering composite field types the htmlFor pairing above does not reach", () => {
    const html = renderToStaticMarkup(
      <DiscoverySection organizationId="org1" projectId="p1" sectionId="branding" initialResponses={{}} readOnly={false} onSectionCompleted={() => {}} />,
    );
    const section = discoverySection("branding");
    for (const question of section.questions.filter(candidate => isQuestionVisible(candidate, {}))) {
      expect(html).toContain(`aria-labelledby="${question.id}-label"`);
    }
  });
});
