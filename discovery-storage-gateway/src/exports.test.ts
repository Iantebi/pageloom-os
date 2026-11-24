// Guards what a deploy of this codebase can create: exactly one HTTPS function, signed requests,
// its own service account, no list/delete operations.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const handler = readFileSync(new URL("./handler.ts", import.meta.url), "utf8");
const store = readFileSync(new URL("./store.ts", import.meta.url), "utf8");

describe("discovery-gateway codebase", () => {
  it("exports exactly one function: discoveryStorageGateway", () => {
    const exported = [...index.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
    expect(exported).toEqual(["discoveryStorageGateway"]);
  });
  it("runs as its own service account with the secret bound, europe-west1 by default", () => {
    expect(index).toMatch(/serviceAccount: params\.serviceAccount/);
    expect(index).toMatch(/secrets: \[gatewaySecret\]/);
    expect(readFileSync(new URL("./config.ts", import.meta.url), "utf8")).toMatch(/discovery-storage-gw@pageloom-os-production/);
  });
  it("has no delete, list, overwrite or signed-URL code paths", () => {
    for (const src of [handler, store, index]) {
      expect(src).not.toMatch(/\.delete\(|getFiles\(|getSignedUrl|makePublic|setMetadata\(/);
    }
  });
});
