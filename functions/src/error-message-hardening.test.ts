import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Each of these routers is mounted on the same `api` Cloud Function as api.ts, whose own error
// handler (see api-hardening.test.ts) already logs the real error server-side via safeErrorName
// and returns only a fixed generic message to the caller. These six routers used to leak the raw
// `error.message` of any non-Zod failure (Firestore/Storage internals, library errors, etc.)
// straight into the JSON response body instead. This test locks in the fix: every router must log
// via safeErrorName and must not build its client-facing error message from a bare `error.message`
// fallback.
const files = ["./document-api.ts", "./enterprise-api.ts", "./closing-api.ts", "./staff-admin-api.ts", "./operational-records-api.ts", "./website-content-api.ts"];

describe("API routers never echo a raw error.message fallback to the client", () => {
  for (const file of files) {
    it(`${file} logs failures server-side instead of leaking error.message`, () => {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).toContain("safeErrorName(error)");
      expect(source).not.toMatch(/error instanceof Error\s*\?\s*error\.message/);
    });
  }
});

describe("Manual AI output route only ever returns a known, non-sensitive rejection message", () => {
  const source = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
  it("logs the real error server-side before responding", () => {
    expect(source).toContain('operationalLog("error","api.manual_output.failed",{errorType:safeErrorName(error)})');
  });
  it("only echoes the allow-listed CentralOrchestrator messages, never an arbitrary error.message", () => {
    expect(source).toContain('const knownMessages=new Set(["Manual AI task is not awaiting output","Manual AI task was already submitted"]);');
    expect(source).toContain('const message=known?(error as Error).message:"Manual AI output was not accepted";');
  });
});
