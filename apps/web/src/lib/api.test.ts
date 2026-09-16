import { describe, expect, it, vi } from "vitest";

// api.ts imports firebaseAuth for the ID-token header — mocked to avoid initializing the real
// Firebase SDK in the test environment (same pattern as apps/web/src/app/discovery/repro.test.tsx).
vi.mock("./firebase", () => ({ firebaseAuth: { currentUser: null }, firestore: {}, firebaseStorage: {}, firebaseConfigured: true }));

import { ApiError, classifyApiErrorKind } from "./api";

// Regression coverage for the Discovery error-handling gap found 2026-09-16: PRD.md §30 documents
// distinct messages for offline/session-expired/permission-denied, but nothing in the code path
// distinguished them — every failure fell through to one generic message regardless of cause.
// classifyApiErrorKind is the piece that makes those specific messages actually reachable.
describe("classifyApiErrorKind", () => {
  it("classifies a network-level failure (fetch itself threw)", () => {
    expect(classifyApiErrorKind(new ApiError("x", "network"))).toBe("network");
  });

  it("classifies a 401 as session_expired", () => {
    expect(classifyApiErrorKind(new ApiError("x", 401))).toBe("session_expired");
  });

  it("classifies a 403 as permission_denied", () => {
    expect(classifyApiErrorKind(new ApiError("x", 403))).toBe("permission_denied");
  });

  it("classifies any other status as generic", () => {
    expect(classifyApiErrorKind(new ApiError("x", 500))).toBe("generic");
    expect(classifyApiErrorKind(new ApiError("x", 422))).toBe("generic");
  });

  it("classifies a non-ApiError (e.g. a thrown string, or a plain Error from unrelated code) as generic rather than throwing", () => {
    expect(classifyApiErrorKind("plain string")).toBe("generic");
    expect(classifyApiErrorKind(new Error("plain error"))).toBe("generic");
    expect(classifyApiErrorKind(undefined)).toBe("generic");
  });

  it("ApiError instances are still real Errors, so every existing `instanceof Error` call site across the app is unaffected", () => {
    const error = new ApiError("message text", 403);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("message text");
  });
});
