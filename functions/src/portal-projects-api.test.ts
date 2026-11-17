// Unit tests for GET /api/portal/projects (H1, 2026-11-16 security audit). Raw project documents
// are staff-only in firestore.rules; this endpoint is the only customer read path, so it must
// (1) return only the allow-listed fields and (2) never return another customer's project.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { id: string; exists: boolean; data: () => Record<string, unknown> | undefined };
const store = vi.hoisted(() => ({ projects: new Map<string, Record<string, unknown>>(), member: undefined as Record<string, unknown> | undefined, getAllCalls: [] as string[][] }));

function snapshot(id: string): Doc {
  const value = store.projects.get(id);
  return { id, exists: value !== undefined, data: () => value };
}

vi.mock("./firebase.js", () => {
  const query = (filter?: { field: string; value: unknown }) => ({
    where: (field: string, _op: string, value: unknown) => query({ field, value }),
    orderBy: () => query(filter),
    limit: () => query(filter),
    get: async () => ({
      docs: [...store.projects.keys()].map(snapshot).filter(doc => !filter || doc.data()?.[filter.field] === filter.value),
    }),
  });
  return {
    db: {
      collection: () => ({ ...query(), doc: (id: string) => ({ id }) }),
      getAll: async (...refs: { id: string }[]) => { store.getAllCalls.push(refs.map(ref => ref.id)); return refs.map(ref => snapshot(ref.id)); },
    },
  };
});

vi.mock("./auth.js", () => ({
  requireRole: async (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }, _org: string, roles: string[]) => {
    if (!store.member || !roles.includes(String(store.member.role))) { res.status(403).json({ error: { code: "FORBIDDEN" } }); return undefined; }
    return store.member;
  },
}));

const { listPortalProjects, portalProject } = await import("./portal-projects-api.js");

function response() {
  const res = { statusCode: 200, body: undefined as unknown, headers: {} as Record<string, string> };
  return Object.assign(res, {
    status(code: number) { res.statusCode = code; return this; },
    json(body: unknown) { res.body = body; return this; },
    setHeader(name: string, value: string) { res.headers[name] = value; },
  });
}

async function call(query: Record<string, unknown> = { organizationId: "acme" }, user: unknown = { uid: "u1" }) {
  const res = response();
  await listPortalProjects({ user, query } as never, res as never);
  return res;
}

const secretFields = { budget: 50_000, revenue: 12_000, cost: 8_000, notes: "internal margin notes", internalNotes: "x", customerId: "cust-a", createdBy: "staff-1" };

beforeEach(() => {
  store.projects.clear();
  store.getAllCalls.length = 0;
  store.member = undefined;
  store.projects.set("p-a1", { ...secretFields, name: "Alpha site", status: "active", workflowStage: "design", progress: 40, updatedAt: "2026-11-01" });
  store.projects.set("p-a2", { ...secretFields, name: "Alpha shop", status: "active", progress: 10, updatedAt: "2026-11-02" });
  store.projects.set("p-b1", { ...secretFields, customerId: "cust-b", name: "Beta site", status: "active", progress: 90, updatedAt: "2026-11-03" });
});

describe("portalProject field projection", () => {
  it("returns only allow-listed fields and drops financial and internal fields", () => {
    const result = portalProject("p1", "acme", { ...secretFields, name: "Site", status: "active", progress: 50 });
    expect(result).toEqual({ id: "p1", organizationId: "acme", name: "Site", status: "active", progress: 50 });
    for (const key of Object.keys(secretFields)) expect(result).not.toHaveProperty(key);
  });

  it("does not let stored id/organizationId override the trusted path values", () => {
    expect(portalProject("p1", "acme", { id: "evil", organizationId: "other-org" })).toMatchObject({ id: "p1", organizationId: "acme" });
  });

  it("clamps progress, hides the blocked reason text, and drops non-string field values", () => {
    expect(portalProject("p", "o", { progress: 250 }).progress).toBe(100);
    expect(portalProject("p", "o", { progress: -5 }).progress).toBe(0);
    expect(portalProject("p", "o", { progress: "90" }).progress).toBe(0);
    expect(portalProject("p", "o", { blockedReason: "client owes us money" }).blockedReason).toBe("blocked");
    expect(portalProject("p", "o", { name: { nested: true } })).not.toHaveProperty("name");
  });

  it("keeps only https website URLs without embedded credentials", () => {
    expect(portalProject("p", "o", { websiteUrl: "https://example.com/" }).websiteUrl).toBe("https://example.com/");
    expect(portalProject("p", "o", { websiteUrl: "javascript:alert(1)" })).not.toHaveProperty("websiteUrl");
    expect(portalProject("p", "o", { websiteUrl: "http://example.com/" })).not.toHaveProperty("websiteUrl");
    expect(portalProject("p", "o", { websiteUrl: "https://user:pass@example.com/" })).not.toHaveProperty("websiteUrl");
    expect(portalProject("p", "o", { websiteUrl: "not a url" })).not.toHaveProperty("websiteUrl");
  });
});

describe("GET /api/portal/projects", () => {
  it("rejects unauthenticated requests and invalid organization ids", async () => {
    expect((await call({ organizationId: "acme" }, null)).statusCode).toBe(401);
    expect((await call({})).statusCode).toBe(400);
    expect((await call({ organizationId: "a/b" })).statusCode).toBe(400);
  });

  it("rejects callers without an organization membership", async () => {
    expect((await call()).statusCode).toBe(403);
  });

  it("returns only the client's own customer projects, without financial fields", async () => {
    store.member = { role: "client", customerId: "cust-a" };
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("no-store");
    const data = (res.body as { data: Record<string, unknown>[] }).data;
    expect(data.map(item => item.id).sort()).toEqual(["p-a1", "p-a2"]);
    for (const item of data) for (const key of Object.keys(secretFields)) expect(item).not.toHaveProperty(key);
  });

  it("limits a client with projectIds to those assigned projects", async () => {
    store.member = { role: "client", customerId: "cust-a", projectIds: ["p-a1"] };
    const data = ((await call()).body as { data: { id: string }[] }).data;
    expect(data.map(item => item.id)).toEqual(["p-a1"]);
  });

  it("drops an assigned project that now belongs to another customer, and missing projects", async () => {
    store.member = { role: "client", customerId: "cust-a", projectIds: ["p-a1", "p-b1", "deleted"] };
    const data = ((await call()).body as { data: { id: string }[] }).data;
    expect(data.map(item => item.id)).toEqual(["p-a1"]);
  });

  it("fails closed on malformed client scope instead of widening access", async () => {
    store.member = { role: "client" };
    expect((await call()).statusCode).toBe(403);
    store.member = { role: "client", customerId: "cust-a", projectIds: "p-a1" };
    expect((await call()).statusCode).toBe(403);
    store.member = { role: "client", customerId: "cust-a", projectIds: ["../p-b1"] };
    expect((await call()).statusCode).toBe(403);
    store.member = { role: "client", customerId: "cust-a", projectIds: Array.from({ length: 101 }, (_, i) => `p${i}`) };
    expect((await call()).statusCode).toBe(403);
    expect(store.getAllCalls).toEqual([]);
  });

  it("lets staff see every project, still through the same field projection", async () => {
    store.member = { role: "member" };
    const data = ((await call()).body as { data: Record<string, unknown>[] }).data;
    expect(data.map(item => item.id).sort()).toEqual(["p-a1", "p-a2", "p-b1"]);
    for (const item of data) expect(item).not.toHaveProperty("budget");
  });
});
