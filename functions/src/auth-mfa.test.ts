import { afterEach, describe, expect, it, vi } from "vitest";

// Behavioral coverage for the staged-MFA enforcement added to auth.ts's require* gates. The
// module reads MFA_ENFORCEMENT_MODE once at import time (see auth.ts), so each scenario resets
// the module registry and re-imports with the env var it needs — this is the only way to exercise
// both "off" (today's default, must never lock anyone out) and "required" behavior in one file.

function fakeMember(data: Record<string, unknown> | null) {
  return { doc: (_path: string) => ({ get: async () => ({ exists: data !== null, data: () => data }) }) };
}

function fakeRes() {
  const res: { statusCode?: number; body?: unknown; status: (code: number) => typeof res; json: (body: unknown) => typeof res } = {
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; return res; },
  };
  return res;
}

async function loadAuth(mode?: string) {
  vi.resetModules();
  if (mode === undefined) delete process.env.MFA_ENFORCEMENT_MODE;
  else process.env.MFA_ENFORCEMENT_MODE = mode;
  return import("./auth.js");
}

afterEach(() => { delete process.env.MFA_ENFORCEMENT_MODE; vi.doUnmock("./firebase.js"); });

describe("requireRole — MFA_ENFORCEMENT_MODE=off (default)", () => {
  it("never blocks an owner without a second factor — the safe default that cannot lock out existing users", async () => {
    vi.doMock("./firebase.js", () => ({ db: fakeMember({ role: "owner", disabled: false }), auth: {} }));
    const { requireRole } = await loadAuth(undefined);
    const req = { user: { uid: "u1", emailVerified: true, mfaVerified: false } } as never, res = fakeRes();
    const member = await requireRole(req, res as never, "org1", ["owner"]);
    expect(member).toEqual({ role: "owner", disabled: false });
    expect(res.statusCode).toBeUndefined();
  });
});

describe("requireRole — MFA_ENFORCEMENT_MODE=required", () => {
  it("denies an owner who has not completed a second factor", async () => {
    vi.doMock("./firebase.js", () => ({ db: fakeMember({ role: "owner", disabled: false }), auth: {} }));
    const { requireRole } = await loadAuth("required");
    const req = { user: { uid: "u1", emailVerified: true, mfaVerified: false } } as never, res = fakeRes();
    const member = await requireRole(req, res as never, "org1", ["owner"]);
    expect(member).toBeUndefined();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: { code: "MFA_REQUIRED", message: "Multi-factor authentication is required for this role" } });
  });

  it("allows an owner who has completed a second factor", async () => {
    vi.doMock("./firebase.js", () => ({ db: fakeMember({ role: "owner", disabled: false }), auth: {} }));
    const { requireRole } = await loadAuth("required");
    const req = { user: { uid: "u1", emailVerified: true, mfaVerified: true } } as never, res = fakeRes();
    const member = await requireRole(req, res as never, "org1", ["owner"]);
    expect(member).toEqual({ role: "owner", disabled: false });
    expect(res.statusCode).toBeUndefined();
  });

  it("never requires MFA for roles outside owner/admin", async () => {
    vi.doMock("./firebase.js", () => ({ db: fakeMember({ role: "operator", disabled: false }), auth: {} }));
    const { requireRole } = await loadAuth("required");
    const req = { user: { uid: "u1", emailVerified: true, mfaVerified: false } } as never, res = fakeRes();
    const member = await requireRole(req, res as never, "org1", ["owner", "admin", "operator"]);
    expect(member).toEqual({ role: "operator", disabled: false });
    expect(res.statusCode).toBeUndefined();
  });

  it("still denies a disabled owner before ever reaching the MFA check", async () => {
    vi.doMock("./firebase.js", () => ({ db: fakeMember({ role: "owner", disabled: true }), auth: {} }));
    const { requireRole } = await loadAuth("required");
    const req = { user: { uid: "u1", emailVerified: true, mfaVerified: true } } as never, res = fakeRes();
    const member = await requireRole(req, res as never, "org1", ["owner"]);
    expect(member).toBeUndefined();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: { code: "FORBIDDEN", message: "Organization role does not permit this action" } });
  });

  it("denies a platform administrator (claim-based) without a verified second factor", async () => {
    vi.doMock("./firebase.js", () => ({ db: fakeMember(null), auth: {} }));
    const { requirePlatformAdmin } = await loadAuth("required");
    const req = { user: { uid: "u1", emailVerified: true, mfaVerified: false, platformRole: "owner" } } as never, res = fakeRes();
    const administrator = await requirePlatformAdmin(req, res as never);
    expect(administrator).toBeUndefined();
    expect(res.statusCode).toBe(403);
    expect((res.body as { error: { code: string } }).error.code).toBe("MFA_REQUIRED");
  });
});
