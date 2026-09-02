import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouteErrorBoundary } from "./route-error-boundary";

function Bomb(): React.ReactElement {
  throw new Error("boom");
}

// RoleScopedExtras (dashboard/CRM/agents widgets reading raw Firestore documents) is rendered by
// (product)/layout.tsx *outside* Next's own app/(product)/error.tsx boundary - see the comment on
// RouteErrorBoundary. This proves the boundary itself contains a throwing child instead of letting
// the crash propagate up through the whole authenticated shell (sidebar/nav included).
describe("RouteErrorBoundary", () => {
  it("contains a throwing child instead of propagating the error", () => {
    expect(() => renderToStaticMarkup(<RouteErrorBoundary><Bomb /></RouteErrorBoundary>)).not.toThrow();
  });
  it("renders the fallback UI when a child throws", () => {
    const html = renderToStaticMarkup(<RouteErrorBoundary><Bomb /></RouteErrorBoundary>);
    expect(html.length).toBeGreaterThan(0);
  });
  it("renders children normally when nothing throws", () => {
    const html = renderToStaticMarkup(<RouteErrorBoundary><p>fine</p></RouteErrorBoundary>);
    expect(html).toContain("fine");
  });
});
