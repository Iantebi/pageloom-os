import { describe, expect, it } from "vitest";
import { KEY_RE, sha256Hex, sign, sniffType, validKey, verify, type SignedFields } from "./protocol.js";

const SECRET = "s".repeat(48);
const KEY = "discovery/prod/6b03a8b45b42eb316c54c4e6/abcdEFGH1234_-xyz";
const NOW = 1_795_500_000;
const base = (over: Partial<SignedFields> = {}): SignedFields => ({ op: "get", key: KEY, ts: String(NOW), bodySha256: sha256Hex(new Uint8Array()), ...over });

describe("object keys", () => {
  it("accepts only discovery/<env>/<case id>/<random id>", () => {
    expect(validKey(KEY)).toBe(true);
    expect(validKey("discovery/dev/6b03a8b45b42eb316c54c4e6/abcdEFGH1234_-xyz")).toBe(true);
    for (const bad of [
      "discovery/test/6b03a8b45b42eb316c54c4e6/abcdEFGH1234_-xyz", // unknown env
      "discovery/prod/6b03a8b45b42eb316c54c4e6/../../x", // traversal
      "discovery/prod/NOTHEX/abcdEFGH1234_-xyz",
      "discovery/prod/6b03a8b45b42eb316c54c4e6/short",
      "other/prod/6b03a8b45b42eb316c54c4e6/abcdEFGH1234_-xyz",
      `${KEY}/extra`,
      "",
    ]) expect(validKey(bad), bad).toBe(false);
    expect(KEY_RE.source.startsWith("^discovery\\/")).toBe(true);
  });
});

describe("signatures", () => {
  it("a correct, fresh signature passes", () => {
    expect(verify(SECRET, base(), sign(SECRET, base()), NOW)).toBeNull();
    expect(verify(SECRET, base(), sign(SECRET, base()), NOW + 60)).toBeNull();
  });
  it("rejects stale or future timestamps (60 s window)", () => {
    expect(verify(SECRET, base(), sign(SECRET, base()), NOW + 61)).toBe("stale");
    expect(verify(SECRET, base(), sign(SECRET, base()), NOW - 61)).toBe("stale");
    expect(verify(SECRET, base({ ts: "abc" }), sign(SECRET, base({ ts: "abc" })), NOW)).toBe("stale");
  });
  it("any changed field breaks the signature", () => {
    const sig = sign(SECRET, base());
    expect(verify(SECRET, base({ key: KEY.replace("abcd", "abce") }), sig, NOW)).toBe("bad_signature");
    expect(verify(SECRET, base({ op: "put" }), sig, NOW)).toBe("bad_signature");
    expect(verify(SECRET, base({ from: "backup" }), sig, NOW)).toBe("bad_signature");
    expect(verify(SECRET, base({ bodySha256: sha256Hex(new Uint8Array([1])) }), sig, NOW)).toBe("bad_signature");
  });
  it("wrong secret, missing or malformed signature, weak secret", () => {
    expect(verify(SECRET, base(), sign("x".repeat(48), base()), NOW)).toBe("bad_signature");
    expect(verify(SECRET, base(), undefined, NOW)).toBe("bad_signature");
    expect(verify(SECRET, base(), "zz", NOW)).toBe("bad_signature");
    expect(verify("short", base(), sign("short", base()), NOW)).toBe("bad_signature");
    expect(verify("", base(), sign("", base()), NOW)).toBe("bad_signature");
  });
  it("bad key is reported before the signature is even checked", () => {
    expect(verify(SECRET, base({ key: "../etc" }), "0".repeat(64), NOW)).toBe("bad_key");
  });
});

describe("type sniffing", () => {
  it("recognises the allowed types only", () => {
    expect(sniffType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBe("");
  });
});
