import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Reproduction for the "Discovery page shows only the error screen" bug report. The mission's own
// repro instruction is "Open http://localhost:3000/discovery" - no ?projectId= query param. Visiting
// the bare route (what an authenticated staff member typing the URL directly would see, and what 9
// days of production Cloud Functions logs show as the *only* way anyone has ever hit /discovery -
// every logged GET to /api/projects/rehearsal-project-001/discovery came bundled with the staff
// Admin project-detail page's other tab requests, never a standalone customer session) hits
// apps/web/src/app/discovery/page.tsx:30 before any network call is ever made. It used to render the
// exact same "couldn't load, refresh and try again" string as a genuine fetch failure - this test now
// pins the fixed, accurate "no project selected" message instead.

vi.mock("@/lib/organization", () => ({
  useOrganization: () => ({ organizationId: "org1", organizations: [{ id: "org1", name: "Org", role: "owner" }], setOrganizationId: () => {}, loading: false, error: "", retry: () => {} }),
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ signOut: () => Promise.resolve() }) }));

// Deliberately returns a "loading" (never resolved) state - if the bare-URL branch in page.tsx
// weren't hit first, this mock would make the page hang on <Loading/> forever, never on loadError.
vi.mock("@/lib/discovery", () => ({
  useDiscovery: () => ({ state: undefined, loading: true, error: "", reload: () => {} }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/discovery",
  useSearchParams: () => ({ get: () => null }), // bare /discovery - no ?projectId=
}));

vi.mock("@/lib/firebase", () => ({
  firebaseAuth: { currentUser: null },
  firestore: {},
  firebaseStorage: {},
  firebaseConfigured: true,
}));

describe("bare /discovery (no projectId)", () => {
  it("renders the accurate 'no project selected' message, not the generic load-failure text", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain("לא נבחר פרויקט");
    expect(html).not.toContain("לא הצלחנו לטעון את אפיון העסק");
  });
});
