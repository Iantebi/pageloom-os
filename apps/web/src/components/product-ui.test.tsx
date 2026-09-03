import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Status } from "./product-ui";

// Regression coverage for the /projects crash: `<Status value={project.status}/>` used to throw
// `Cannot read properties of undefined (reading 'replaceAll')` whenever a project/task/ticket/etc.
// document was missing its status field - a single malformed record crashed the whole table/page
// rendering it, not just that one row.
describe("Status", () => {
  it("does not throw when value is undefined", () => {
    expect(() => renderToStaticMarkup(<Status value={undefined as unknown as string} />)).not.toThrow();
  });
  it("does not throw when value is an empty string", () => {
    expect(() => renderToStaticMarkup(<Status value="" />)).not.toThrow();
  });
  it("renders a placeholder instead of blowing up for a missing value", () => {
    const html = renderToStaticMarkup(<Status value={undefined as unknown as string} />);
    expect(html).toContain("—");
  });
  it("still renders a known status normally (no behavior change for well-formed data)", () => {
    const html = renderToStaticMarkup(<Status value="completed" />);
    expect(html).toContain("status-ok");
  });
});
