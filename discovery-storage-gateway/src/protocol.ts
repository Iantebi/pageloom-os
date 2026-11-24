// Request signing and validation for the Discovery storage gateway. Pure functions, no I/O.
//
// Caller: the Base44 "PageLoom - Client Discovery" backend functions (they run outside Google Cloud,
// so they cannot present a Google identity). They have already checked that the signed-in person
// owns the case (or is an admin) before they call here. This gateway adds a second, independent
// layer: only requests signed with the shared secret, fresh (60 s), for an allowed object key.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_SKEW_SECONDS = 60;
export const OPS = ["put", "get", "copy"] as const;
export type Op = (typeof OPS)[number];
export const SIDES = ["primary", "backup"] as const;
export type Side = (typeof SIDES)[number];

// discovery/<prod|dev>/<24-hex case id>/<random object id>. Nothing outside this prefix is reachable.
export const KEY_RE = /^discovery\/(prod|dev)\/[0-9a-f]{24}\/[A-Za-z0-9_-]{16,64}$/;
export const CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export const isOp = (v: unknown): v is Op => typeof v === "string" && (OPS as readonly string[]).includes(v);
export const isSide = (v: unknown): v is Side => typeof v === "string" && (SIDES as readonly string[]).includes(v);
export const validKey = (v: unknown): v is string => typeof v === "string" && KEY_RE.test(v);

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface SignedFields {
  op: Op;
  key: string;
  ts: string; // unix seconds
  from?: Side | undefined;
  to?: Side | undefined;
  bodySha256: string; // hex sha256 of the raw body ("" body for get/copy)
}

// The exact bytes both sides sign. Order and separators are part of the protocol.
export function canonical(f: SignedFields): string {
  return ["PLDSG1", f.op, f.key, f.ts, f.from ?? "", f.to ?? "", f.bodySha256].join("\n");
}

export function sign(secret: string, f: SignedFields): string {
  return createHmac("sha256", secret).update(canonical(f)).digest("hex");
}

export type Rejection = "bad_request" | "bad_signature" | "stale" | "bad_key";

// Returns null when the request may proceed.
export function verify(secret: string, f: SignedFields, signature: unknown, nowSeconds: number): Rejection | null {
  if (!secret || secret.length < 32) return "bad_signature"; // never run with a missing/weak secret
  if (!isOp(f.op)) return "bad_request";
  if (!validKey(f.key)) return "bad_key";
  if (!/^\d{9,11}$/.test(f.ts)) return "stale";
  if (Math.abs(nowSeconds - Number(f.ts)) > MAX_SKEW_SECONDS) return "stale";
  if (typeof signature !== "string" || !/^[0-9a-f]{64}$/.test(signature)) return "bad_signature";
  const expected = Buffer.from(sign(secret, f), "hex");
  const given = Buffer.from(signature, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "bad_signature";
  return null;
}

// The real type comes from the bytes. Must agree with the declared content type.
export function sniffType(b: Uint8Array): string {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  return "";
}
