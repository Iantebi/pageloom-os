import { afterEach, describe, expect, it, vi } from "vitest";

// Firebase App Check verification, monitoring-only (see the design rationale comment in
// app-check.ts): every scenario below must call next() exactly once and must never call
// res.status/res.json, regardless of whether a token is present, valid, or invalid. That
// "never rejects" behavior is the whole point of shipping App Check in monitoring mode first.

function fakeRes() {
  const res = { status: vi.fn(() => res), json: vi.fn(() => res) };
  return res;
}

afterEach(() => { vi.restoreAllMocks(); vi.doUnmock("firebase-admin/app-check"); });

describe("monitorAppCheck", () => {
  it("passes through and marks unverified when the X-Firebase-AppCheck header is missing", async () => {
    const { monitorAppCheck } = await import("./app-check.js");
    const req = { headers: {}, path: "/api/me" } as never, res = fakeRes(), next = vi.fn();
    await monitorAppCheck(req, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect((req as { appCheck?: { verified: boolean } }).appCheck).toEqual({ verified: false });
  });

  it("passes through and marks verified when the token is valid", async () => {
    vi.doMock("firebase-admin/app-check", () => ({ getAppCheck: () => ({ verifyToken: vi.fn().mockResolvedValue({ appId: "app-1" }) }) }));
    vi.resetModules();
    const { monitorAppCheck } = await import("./app-check.js");
    const req = { headers: { "x-firebase-appcheck": "a-valid-token" }, path: "/api/me" } as never, res = fakeRes(), next = vi.fn();
    await monitorAppCheck(req, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect((req as { appCheck?: { verified: boolean } }).appCheck).toEqual({ verified: true });
  });

  it("still passes through — never rejects — when the token is invalid", async () => {
    vi.doMock("firebase-admin/app-check", () => ({ getAppCheck: () => ({ verifyToken: vi.fn().mockRejectedValue(new Error("invalid token")) }) }));
    vi.resetModules();
    const { monitorAppCheck } = await import("./app-check.js");
    const req = { headers: { "x-firebase-appcheck": "not-a-real-token" }, path: "/api/me" } as never, res = fakeRes(), next = vi.fn();
    await monitorAppCheck(req, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect((req as { appCheck?: { verified: boolean } }).appCheck).toEqual({ verified: false });
  });
});
