import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Firebase Hosting and this Cloud Function both terminate HTTPS themselves, but neither told the
// browser to refuse a future plaintext connection to this origin, leaving every visit after the
// first vulnerable to an SSL-stripping downgrade. This locks in Strict-Transport-Security on both
// surfaces so browsers enforce HTTPS-only for the max-age window, matching this repo's existing
// X-Content-Type-Options/CSP hardening in api.ts and firebase.json.
describe("Strict-Transport-Security is enforced on every response surface", () => {
  it("the api Cloud Function sets it alongside the existing security headers", () => {
    const source = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
    expect(source).toContain('res.setHeader("Strict-Transport-Security","max-age=63072000; includeSubDomains")');
  });

  it("Firebase Hosting sets it on every response via firebase.json", () => {
    const firebase = JSON.parse(readFileSync(new URL("../../firebase.json", import.meta.url), "utf8"));
    const rule = firebase.hosting.headers.find((item: { source: string }) => item.source === "**");
    const hsts = rule.headers.find((item: { key: string }) => item.key === "Strict-Transport-Security");
    expect(hsts.value).toBe("max-age=63072000; includeSubDomains");
  });
});
