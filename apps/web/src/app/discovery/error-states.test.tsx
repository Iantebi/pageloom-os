import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ApiErrorKind } from "@/lib/api";

// Regression coverage for a real gap found 2026-09-16: docs/customer-discovery-onboarding/
// PRD.md §30 documents distinct messages for network/session-expired/permission-denied load
// failures, and discoveryShell.ts's dictionary already had the Hebrew/English copy written -
// but nothing in the code path actually distinguished the failure cause, so every load error
// rendered the same generic "couldn't load, refresh and try again" text regardless of why.
// classifyApiErrorKind (lib/api.ts) is what makes these specific messages reachable; this test
// proves the wiring from errorKind through to the rendered HTML, not just that the strings exist.

let mockErrorKind: ApiErrorKind = "generic";
vi.mock("@/lib/organization", () => ({
  useOrganization: () => ({ organizationId: "org1", organizations: [{ id: "org1", name: "Org", role: "owner" }], setOrganizationId: () => {}, loading: false, error: "", retry: () => {} }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ signOut: () => Promise.resolve() }) }));
vi.mock("@/lib/discovery", () => ({
  useDiscovery: () => ({ state: undefined, loading: false, error: "load failed", errorKind: mockErrorKind, reload: () => {} }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/discovery",
  useSearchParams: () => ({ get: () => "project1" }),
}));
vi.mock("@/lib/firebase", () => ({
  firebaseAuth: { currentUser: null }, firestore: {}, firebaseStorage: {}, firebaseConfigured: true,
}));

async function renderPage() {
  const { default: Page } = await import("./page");
  return renderToStaticMarkup(<Page />);
}

describe("/discovery load-error messages by cause", () => {
  it("shows the offline-specific message for a network failure, not the generic one", async () => {
    mockErrorKind = "network";
    const html = await renderPage();
    expect(html).toContain("אין חיבור לאינטרנט"); // networkOffline
    expect(html).not.toContain("לא הצלחנו לטעון את אפיון העסק"); // loadError
  });

  it("shows the session-expired message and a sign-in-again action for a 401", async () => {
    mockErrorKind = "session_expired";
    const html = await renderPage();
    expect(html).toContain("החיבור פג"); // sessionExpired
    expect(html).toContain("התחברות מחדש"); // signInAgain button
  });

  it("shows the generic 'no access' message for a 403, with no information disclosure about why", async () => {
    mockErrorKind = "permission_denied";
    const html = await renderPage();
    expect(html).toContain("אין לכם גישה לפרויקט הזה"); // permissionDenied
  });

  it("falls back to the generic load-error message for anything else", async () => {
    mockErrorKind = "generic";
    const html = await renderPage();
    expect(html).toContain("לא הצלחנו לטעון את אפיון העסק"); // loadError
  });
});
