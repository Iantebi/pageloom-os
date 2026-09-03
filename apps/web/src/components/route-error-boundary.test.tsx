import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RouteErrorBoundary, RouteErrorFallback } from "./route-error-boundary";

// RoleScopedExtras (dashboard/CRM/agents widgets reading raw Firestore documents) is rendered by
// (product)/layout.tsx *outside* Next's own app/(product)/error.tsx boundary - see the comment on
// RouteErrorBoundary. This proves the boundary itself contains a throwing child instead of letting
// the crash propagate up through the whole authenticated shell (sidebar/nav included).
//
// `react-dom/server`'s renderToStaticMarkup never invokes componentDidCatch/getDerivedStateFromError
// - SSR has no client reconciler pass to catch a render error in, so a throwing child's error always
// propagates straight through it regardless of an ancestor error boundary. To prove the boundary
// itself catches a client render error and swaps in its fallback, the tests below drive the same
// lifecycle hooks React calls on the client when a descendant throws during render.
describe("RouteErrorBoundary", () => {
  it("getDerivedStateFromError flags the boundary as failed when a child throws", () => {
    expect(RouteErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true });
  });

  it("renders the fallback once a child has thrown and state.failed is set", () => {
    const boundary = new RouteErrorBoundary({ children: <p>fine</p> });
    boundary.state = RouteErrorBoundary.getDerivedStateFromError();
    const rendered = boundary.render() as ReactElement;
    expect(rendered.type).toBe(RouteErrorFallback);
    expect(renderToStaticMarkup(rendered).length).toBeGreaterThan(0);
  });

  it("renders children normally when nothing throws", () => {
    const html = renderToStaticMarkup(<RouteErrorBoundary><p>fine</p></RouteErrorBoundary>);
    expect(html).toContain("fine");
  });
});
