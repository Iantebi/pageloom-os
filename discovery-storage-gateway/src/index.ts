// Discovery storage gateway: the ONLY function in the "discovery-gateway" codebase.
// Private file storage for the Base44 Client Discovery app (logo, photos, testimonial screenshots).
// Invoker is public on purpose: the caller (Base44, outside Google Cloud) cannot present a Google
// identity, so every request must carry a fresh HMAC signature instead (see protocol.ts).
// The buckets themselves stay private (public access prevention): knowing an object key is useless
// without Google credentials, and the only identity with access is this function's service account.
import { Storage } from "@google-cloud/storage";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { gatewaySecret, params } from "./config.js";
import { handle } from "./handler.js";
import { gcsStore } from "./store.js";

// Application default credentials = this function's runtime service account (no key file).
const storage = new Storage();

export const discoveryStorageGateway = onRequest(
  {
    region: params.region,
    serviceAccount: params.serviceAccount,
    secrets: [gatewaySecret],
    invoker: "public",
    cors: false,
    memory: "512MiB",
    timeoutSeconds: 60,
    maxInstances: 10,
    concurrency: 20,
  },
  async (req, res) => {
    const store = gcsStore({
      primary: storage.bucket(params.primaryBucket.value()),
      backup: storage.bucket(params.backupBucket.value()),
    });
    try {
      const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
      const result = await handle(
        { method: req.method, query: req.query as Record<string, unknown>, headers: req.headers as Record<string, unknown>, body: raw ? new Uint8Array(raw) : new Uint8Array() },
        { secret: gatewaySecret.value(), store, log: (event) => logger.info("discovery-gateway", event) },
      );
      res.status(result.status);
      res.set("Content-Type", result.contentType);
      res.set("Cache-Control", "no-store");
      res.set("X-Content-Type-Options", "nosniff");
      res.send(typeof result.body === "string" ? result.body : Buffer.from(result.body));
    } catch (error) {
      logger.error("discovery-gateway failure", { message: (error as Error).message });
      res.status(500).set("Cache-Control", "no-store").json({ error: "gateway_error" });
    }
  },
);
