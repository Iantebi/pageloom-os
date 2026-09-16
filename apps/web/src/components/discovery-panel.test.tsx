import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryPanel } from "./discovery-panel";

// DiscoveryPanel fetches its own data via useDiscovery (unlike DiscoverySection, which takes
// props) — renderToStaticMarkup never runs effects, so without this mock `state` would stay
// undefined/loading forever and we could never observe the "no progress yet" or "in progress"
// render branches this test actually exercises.
let mockState: { state: unknown; loading: boolean } = { state: undefined, loading: true };
vi.mock("@/lib/discovery", () => ({
  useDiscovery: () => ({ ...mockState, reload: () => {} }),
  markDiscoveryReviewed: () => Promise.resolve(),
  reopenDiscoverySection: () => Promise.resolve(),
  loadDiscoveryNotes: () => Promise.resolve([]),
  addDiscoveryNote: () => Promise.resolve({}),
}));

// Regression coverage for the "generate a shareable client link" feature (2026-09-16): staff
// need a way to hand a client a direct Discovery link, and the panel used to return null
// entirely before the client had ever opened Discovery — hiding the copy-link action exactly
// when staff most need it (to prompt a client who hasn't started yet).
describe("DiscoveryPanel — shareable client link", () => {
  it("shows the copy-link action even before the client has started Discovery (no progress doc yet)", () => {
    mockState = { state: { progress: null, sections: {} }, loading: false };
    const html = renderToStaticMarkup(<DiscoveryPanel organizationId="org1" project={{ id: "p1", name: "Test Project" }} />);
    expect(html).toContain("העתקת קישור ללקוח"); // "Copy client link" (he, the resolved default locale)
    expect(html).not.toBe("");
  });

  it("still shows the copy-link action once Discovery is in progress, alongside the status badge", () => {
    mockState = {
      state: {
        progress: { id: "current", projectId: "p1", templateVersion: 1, status: "in_progress", completedSectionIds: ["business"], percentComplete: 11, lastActivityAt: "2026-01-01T00:00:00.000Z" },
        sections: {},
      },
      loading: false,
    };
    const html = renderToStaticMarkup(<DiscoveryPanel organizationId="org1" project={{ id: "p1", name: "Test Project" }} />);
    expect(html).toContain("העתקת קישור ללקוח");
  });
});
