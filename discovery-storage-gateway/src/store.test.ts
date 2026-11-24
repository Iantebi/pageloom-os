import { describe, expect, it, vi } from "vitest";
import type { Bucket } from "@google-cloud/storage";
import { gcsStore } from "./store.js";

const err = (code: number) => Object.assign(new Error(`code ${code}`), { code });

function fakeBucket(file: Record<string, unknown>) {
  return { file: vi.fn(() => file) } as unknown as Bucket;
}

describe("gcsStore", () => {
  it("save uses ifGenerationMatch=0 and maps 412 to 'exists'", async () => {
    const save = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(err(412));
    const bucket = fakeBucket({ save });
    const store = gcsStore({ primary: bucket, backup: bucket });
    expect(await store.save("primary", "k", new Uint8Array([1]), "image/png")).toBe("created");
    expect(save.mock.calls[0]?.[1]).toMatchObject({ preconditionOpts: { ifGenerationMatch: 0 }, contentType: "image/png", resumable: false });
    expect(await store.save("primary", "k", new Uint8Array([1]), "image/png")).toBe("exists");
  });

  it("save rethrows other errors (no silent success)", async () => {
    const bucket = fakeBucket({ save: vi.fn().mockRejectedValue(err(403)) });
    await expect(gcsStore({ primary: bucket, backup: bucket }).save("primary", "k", new Uint8Array([1]), "image/png")).rejects.toThrow();
  });

  it("read returns bytes + type, 404 -> null", async () => {
    const ok = fakeBucket({ getMetadata: vi.fn().mockResolvedValue([{ contentType: "image/jpeg" }]), download: vi.fn().mockResolvedValue([Buffer.from([7, 8])]) });
    const missing = fakeBucket({ getMetadata: vi.fn().mockRejectedValue(err(404)) });
    expect(await gcsStore({ primary: ok, backup: missing }).read("primary", "k")).toEqual({ bytes: new Uint8Array([7, 8]), contentType: "image/jpeg" });
    expect(await gcsStore({ primary: ok, backup: missing }).read("backup", "k")).toBeNull();
  });

  it("copy never overwrites: 412 -> exists, 404 -> missing", async () => {
    const copy = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(err(412)).mockRejectedValueOnce(err(404));
    const source = fakeBucket({ copy });
    const target = fakeBucket({});
    const store = gcsStore({ primary: source, backup: target });
    expect(await store.copy("primary", "backup", "k")).toBe("created");
    expect(copy.mock.calls[0]?.[1]).toEqual({ preconditionOpts: { ifGenerationMatch: 0 } });
    expect(await store.copy("primary", "backup", "k")).toBe("exists");
    expect(await store.copy("primary", "backup", "k")).toBe("missing");
  });
});
