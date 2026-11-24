// Framework-free request handling for the Discovery storage gateway, tested with an in-memory store.
// Operations (POST only, each signed - see protocol.ts):
//   put  : store the body under `key` in the primary bucket, then copy it to the backup bucket.
//   get  : return the object's bytes (from=primary|backup).
//   copy : server-side copy of `key` between buckets (from -> to): backup repair and restore.
// Deliberately absent: list, delete, overwrite, signed URLs. Nothing here can enumerate or remove files.
import { CONTENT_TYPES, MAX_BYTES, isOp, isSide, sha256Hex, sniffType, verify, type Op, type Side, type SignedFields } from "./protocol.js";

export interface StoredObject {
  bytes: Uint8Array;
  contentType: string;
}

export interface ObjectStore {
  // Must never overwrite: "exists" when the key is already taken.
  save(side: Side, key: string, bytes: Uint8Array, contentType: string): Promise<"created" | "exists">;
  read(side: Side, key: string): Promise<StoredObject | null>;
  // Server-side copy; "exists" when the target already has the key, "missing" when the source has not.
  copy(from: Side, to: Side, key: string): Promise<"created" | "exists" | "missing">;
}

export interface GatewayRequest {
  method: string;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: Uint8Array;
}

export interface GatewayResponse {
  status: number;
  contentType: string;
  body: Uint8Array | string;
}

const json = (status: number, value: unknown): GatewayResponse => ({ status, contentType: "application/json", body: JSON.stringify(value) });
const str = (v: unknown): string => (typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? v[0] : "");

export interface GatewayDeps {
  secret: string;
  store: ObjectStore;
  now?: () => number; // unix seconds
  log?: (event: Record<string, unknown>) => void;
}

export async function handle(req: GatewayRequest, deps: GatewayDeps): Promise<GatewayResponse> {
  const log = deps.log ?? (() => {});
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const op = str(req.query.op);
  const key = str(req.query.key);
  const ts = str(req.query.ts);
  const from = str(req.query.from) || undefined;
  const to = str(req.query.to) || undefined;
  if (!isOp(op)) return json(400, { error: "bad_request" });
  if (req.body.byteLength > MAX_BYTES) return json(413, { error: "too_large" });
  if (op !== "put" && req.body.byteLength > 0) return json(400, { error: "bad_request" });

  const fields: SignedFields = { op: op as Op, key, ts, from: from as Side | undefined, to: to as Side | undefined, bodySha256: sha256Hex(req.body) };
  const now = (deps.now ?? (() => Math.floor(Date.now() / 1000)))();
  const rejected = verify(deps.secret, fields, str(req.headers["x-pldsg-signature"]), now);
  if (rejected) {
    // Never log the key of a rejected request beyond its prefix; never log signatures or bodies.
    log({ event: "rejected", op, reason: rejected });
    const status = rejected === "bad_request" ? 400 : rejected === "bad_key" ? 400 : 401;
    return json(status, { error: rejected });
  }

  if (op === "put") {
    const contentType = str(req.headers["content-type"]).split(";")[0]?.trim().toLowerCase() ?? "";
    if (!(CONTENT_TYPES as readonly string[]).includes(contentType)) return json(415, { error: "bad_type" });
    if (req.body.byteLength === 0) return json(400, { error: "empty_file" });
    if (sniffType(req.body) !== contentType) return json(415, { error: "bad_type" });
    const saved = await deps.store.save("primary", key, req.body, contentType);
    if (saved === "exists") return json(409, { error: "exists" });
    // The original is stored. A failed backup copy must not fail the upload: report it so the
    // caller records "no backup copy yet" and the next backup run repairs it (op=copy).
    let backup = false;
    try {
      backup = (await deps.store.copy("primary", "backup", key)) !== "missing";
    } catch {
      backup = false;
    }
    log({ event: "put", size: req.body.byteLength, backup });
    return json(200, { ok: true, size: req.body.byteLength, backup });
  }

  if (op === "get") {
    const side: Side = from === undefined ? "primary" : isSide(from) ? from : "primary";
    if (from !== undefined && !isSide(from)) return json(400, { error: "bad_request" });
    const object = await deps.store.read(side, key);
    if (!object) return json(404, { error: "not_found" });
    log({ event: "get", side, size: object.bytes.byteLength });
    return { status: 200, contentType: object.contentType || "application/octet-stream", body: object.bytes };
  }

  // copy
  if (!isSide(from) || !isSide(to) || from === to) return json(400, { error: "bad_request" });
  const result = await deps.store.copy(from, to, key);
  if (result === "missing") return json(404, { error: "not_found" });
  log({ event: "copy", from, to, result });
  return json(200, { ok: true, result });
}
