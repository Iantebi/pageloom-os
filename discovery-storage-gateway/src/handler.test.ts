import { describe, expect, it } from "vitest";
import { handle, type GatewayRequest, type ObjectStore } from "./handler.js";
import { sha256Hex, sign, type Op, type Side } from "./protocol.js";

const SECRET = "k".repeat(48);
const NOW = 1_795_500_000;
const KEY = "discovery/dev/6b050b7f0788758abcd8eea5/Zx9_abcdefgh12345";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]);

function memoryStore(opts: { failBackupCopy?: boolean } = {}) {
  const data: Record<Side, Map<string, { bytes: Uint8Array; contentType: string }>> = { primary: new Map(), backup: new Map() };
  const store: ObjectStore = {
    async save(side, key, bytes, contentType) {
      if (data[side].has(key)) return "exists";
      data[side].set(key, { bytes, contentType });
      return "created";
    },
    async read(side, key) {
      return data[side].get(key) ?? null;
    },
    async copy(from, to, key) {
      if (opts.failBackupCopy && to === "backup") throw new Error("copy failed");
      const source = data[from].get(key);
      if (!source) return "missing";
      if (data[to].has(key)) return "exists";
      data[to].set(key, { ...source });
      return "created";
    },
  };
  return { store, data };
}

function signed(op: Op, opts: { key?: string; body?: Uint8Array; from?: Side; to?: Side; contentType?: string; ts?: number; secret?: string } = {}): GatewayRequest {
  const body = opts.body ?? new Uint8Array();
  const ts = String(opts.ts ?? NOW);
  const key = opts.key ?? KEY;
  const sig = sign(opts.secret ?? SECRET, { op, key, ts, from: opts.from, to: opts.to, bodySha256: sha256Hex(body) });
  const query: Record<string, unknown> = { op, key, ts };
  if (opts.from) query.from = opts.from;
  if (opts.to) query.to = opts.to;
  return { method: "POST", query, headers: { "x-pldsg-signature": sig, "content-type": opts.contentType ?? "image/jpeg" }, body };
}

const deps = (store: ObjectStore) => ({ secret: SECRET, store, now: () => NOW });
const parse = (r: { body: Uint8Array | string }) => JSON.parse(String(r.body));

describe("put", () => {
  it("stores the original and a backup copy", async () => {
    const { store, data } = memoryStore();
    const r = await handle(signed("put", { body: JPEG }), deps(store));
    expect(r.status).toBe(200);
    expect(parse(r)).toEqual({ ok: true, size: JPEG.byteLength, backup: true });
    expect(data.primary.get(KEY)?.bytes).toEqual(JPEG);
    expect(data.backup.get(KEY)?.bytes).toEqual(JPEG);
  });

  it("a failed backup copy keeps the original and says backup:false (caller records it; repaired later)", async () => {
    const { store, data } = memoryStore({ failBackupCopy: true });
    const r = await handle(signed("put", { body: JPEG }), deps(store));
    expect(r.status).toBe(200);
    expect(parse(r).backup).toBe(false);
    expect(data.primary.has(KEY)).toBe(true);
    expect(data.backup.has(KEY)).toBe(false);
  });

  it("never overwrites an existing object", async () => {
    const { store, data } = memoryStore();
    await handle(signed("put", { body: JPEG }), deps(store));
    const again = await handle(signed("put", { body: PNG, contentType: "image/png" }), deps(store));
    expect(again.status).toBe(409);
    expect(data.primary.get(KEY)?.bytes).toEqual(JPEG);
  });

  it("type must be allowed AND match the bytes", async () => {
    const { store } = memoryStore();
    expect((await handle(signed("put", { body: JPEG, contentType: "image/svg+xml" }), deps(store))).status).toBe(415);
    expect((await handle(signed("put", { body: PNG, contentType: "image/jpeg" }), deps(store))).status).toBe(415);
    expect((await handle(signed("put", { body: new TextEncoder().encode("<html>"), contentType: "image/jpeg" }), deps(store))).status).toBe(415);
    expect((await handle(signed("put", { body: new Uint8Array(), contentType: "image/jpeg" }), deps(store))).status).toBe(400);
  });

  it("refuses bodies over 10 MB before checking anything else", async () => {
    const { store } = memoryStore();
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    expect((await handle(signed("put", { body: big }), deps(store))).status).toBe(413);
  });
});

describe("get", () => {
  it("returns the bytes and type; missing -> 404", async () => {
    const { store } = memoryStore();
    await handle(signed("put", { body: JPEG }), deps(store));
    const r = await handle(signed("get"), deps(store));
    expect(r.status).toBe(200);
    expect(r.contentType).toBe("image/jpeg");
    expect(r.body).toEqual(JPEG);
    const fromBackup = await handle(signed("get", { from: "backup" }), deps(store));
    expect(fromBackup.body).toEqual(JPEG);
    const other = await handle(signed("get", { key: KEY.replace("Zx9", "Qq9") }), deps(store));
    expect(other.status).toBe(404);
  });
});

describe("copy (backup repair and restore)", () => {
  it("repairs a missing backup copy exactly once", async () => {
    const { store, data } = memoryStore({ failBackupCopy: true });
    await handle(signed("put", { body: JPEG }), deps(store));
    const healthy = memoryStore();
    healthy.data.primary = data.primary; // same objects, copying works again
    const r1 = await handle(signed("copy", { from: "primary", to: "backup" }), deps(healthy.store));
    expect(parse(r1)).toEqual({ ok: true, result: "created" });
    const r2 = await handle(signed("copy", { from: "primary", to: "backup" }), deps(healthy.store));
    expect(parse(r2)).toEqual({ ok: true, result: "exists" });
    expect(healthy.data.backup.get(KEY)?.bytes).toEqual(JPEG);
  });

  it("restores from the backup bucket; source missing -> 404; same side -> 400", async () => {
    const { store, data } = memoryStore();
    data.backup.set(KEY, { bytes: PNG, contentType: "image/png" });
    expect(parse(await handle(signed("copy", { from: "backup", to: "primary" }), deps(store)))).toEqual({ ok: true, result: "created" });
    expect(data.primary.get(KEY)?.bytes).toEqual(PNG);
    expect((await handle(signed("copy", { from: "primary", to: "backup", key: KEY.replace("Zx9", "Ww9") }), deps(store))).status).toBe(404);
    expect((await handle(signed("copy", { from: "primary", to: "primary" }), deps(store))).status).toBe(400);
  });
});

describe("rejections", () => {
  it("unsigned, wrong secret, stale, tampered body, bad key, wrong method", async () => {
    const { store, data } = memoryStore();
    const unsigned = signed("put", { body: JPEG });
    unsigned.headers["x-pldsg-signature"] = "";
    expect((await handle(unsigned, deps(store))).status).toBe(401);
    expect((await handle(signed("put", { body: JPEG, secret: "w".repeat(48) }), deps(store))).status).toBe(401);
    expect((await handle(signed("put", { body: JPEG, ts: NOW - 120 }), deps(store))).status).toBe(401);
    const tampered = signed("put", { body: JPEG });
    tampered.body = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]);
    expect((await handle(tampered, deps(store))).status).toBe(401);
    expect((await handle(signed("get", { key: "discovery/prod/../../secret" }), deps(store))).status).toBe(400);
    expect((await handle({ ...signed("get"), method: "GET" }, deps(store))).status).toBe(405);
    expect(data.primary.size).toBe(0);
  });

  it("get/copy must not carry a body; unknown op -> 400", async () => {
    const { store } = memoryStore();
    expect((await handle(signed("get", { body: JPEG }), deps(store))).status).toBe(400);
    const r = signed("get");
    r.query.op = "delete";
    expect((await handle(r, deps(store))).status).toBe(400);
    r.query.op = "list";
    expect((await handle(r, deps(store))).status).toBe(400);
  });

  it("never logs keys, signatures or bodies of rejected requests", async () => {
    const { store } = memoryStore();
    const events: Record<string, unknown>[] = [];
    const bad = signed("get");
    bad.headers["x-pldsg-signature"] = "0".repeat(64);
    await handle(bad, { ...deps(store), log: (e) => events.push(e) });
    expect(JSON.stringify(events)).not.toContain(KEY);
    expect(JSON.stringify(events)).not.toContain("0".repeat(64));
  });
});
