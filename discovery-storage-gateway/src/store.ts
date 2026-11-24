// Cloud Storage implementation of ObjectStore. Writes and copies use ifGenerationMatch=0, so an
// existing object is never overwritten (the runtime service account has no delete permission either).
import type { Bucket } from "@google-cloud/storage";
import type { ObjectStore, StoredObject } from "./handler.js";
import type { Side } from "./protocol.js";

const codeOf = (error: unknown): number => Number((error as { code?: unknown })?.code ?? 0);

export function gcsStore(buckets: Record<Side, Bucket>): ObjectStore {
  return {
    async save(side, key, bytes, contentType) {
      try {
        await buckets[side].file(key).save(Buffer.from(bytes), {
          resumable: false,
          contentType,
          metadata: { cacheControl: "private, no-store" },
          preconditionOpts: { ifGenerationMatch: 0 },
        });
        return "created";
      } catch (error) {
        if (codeOf(error) === 412) return "exists";
        throw error;
      }
    },

    async read(side, key): Promise<StoredObject | null> {
      const file = buckets[side].file(key);
      try {
        const [metadata] = await file.getMetadata();
        const [bytes] = await file.download();
        return { bytes: new Uint8Array(bytes), contentType: String(metadata.contentType ?? "") };
      } catch (error) {
        if (codeOf(error) === 404) return null;
        throw error;
      }
    },

    async copy(from, to, key) {
      try {
        await buckets[from].file(key).copy(buckets[to].file(key), { preconditionOpts: { ifGenerationMatch: 0 } });
        return "created";
      } catch (error) {
        const code = codeOf(error);
        if (code === 412) return "exists";
        if (code === 404) return "missing";
        throw error;
      }
    },
  };
}
