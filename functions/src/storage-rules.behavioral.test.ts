// Behavioral security-rules tests: these run the REAL storage.rules file through the Firebase
// Storage emulator's rules engine via @firebase/rules-unit-testing, unlike storage-rules.test.ts
// (which only asserts the rules SOURCE TEXT contains certain substrings and never performs a single
// upload/download). storage.rules cross-references Firestore membership/project documents via
// firestore.get()/firestore.exists(), so this suite also runs the Firestore emulator and seeds real
// member/project documents (bypassing rules) to exercise that cross-service logic for real.
//
// Requires BOTH the Firestore and Storage emulators (Firestore needs a JVM) running on the ports
// configured in firebase.json (127.0.0.1:8080 and 127.0.0.1:9199). Start them with
// `firebase emulators:start --only firestore,storage` (or the full suite) before running this file.
import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";

const FIRESTORE_RULES_PATH = new URL("../../firestore.rules", import.meta.url);
const STORAGE_RULES_PATH = new URL("../../storage.rules", import.meta.url);
const PROJECT_ID = "demo-pageloom-rules-storage";
const ORG = "acme";

const OWNER_UID = "owner-1";
const STAFF_MEMBER_UID = "staff-member-1";
const CLIENT_ALPHA_UID = "client-alpha-1"; // role "client", customerId cust-alpha, unrestricted projectIds
const CLIENT_BETA_UID = "client-beta-1"; // role "client", customerId cust-beta (unrelated tenant)
const DISABLED_MEMBER_UID = "disabled-member-1";

const CUST_ALPHA = "cust-alpha";
const CUST_BETA = "cust-beta";
const PROJ_ALPHA_1 = "proj-alpha-1";
const PROJ_BETA_1 = "proj-beta-1";
const WEBSITE_ALPHA = "site-alpha";

let testEnv: RulesTestEnvironment;

const TEXT_BYTES = new TextEncoder().encode("hello world");
const PNG_BYTES = new TextEncoder().encode("not-really-a-png-but-content-type-is-what-matters");

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const set = (path: string, data: Record<string, unknown>) => setDoc(doc(db, path), data);
    await Promise.all([
      set(`organizations/${ORG}/members/${OWNER_UID}`, { role: "owner", disabled: false }),
      set(`organizations/${ORG}/members/${STAFF_MEMBER_UID}`, { role: "member", disabled: false }),
      set(`organizations/${ORG}/members/${CLIENT_ALPHA_UID}`, {
        role: "client",
        disabled: false,
        customerId: CUST_ALPHA,
        projectIds: [],
      }),
      set(`organizations/${ORG}/members/${CLIENT_BETA_UID}`, {
        role: "client",
        disabled: false,
        customerId: CUST_BETA,
        projectIds: [],
      }),
      set(`organizations/${ORG}/members/${DISABLED_MEMBER_UID}`, { role: "member", disabled: true }),
      set(`organizations/${ORG}/projects/${PROJ_ALPHA_1}`, { customerId: CUST_ALPHA, name: "Alpha One" }),
      set(`organizations/${ORG}/projects/${PROJ_BETA_1}`, { customerId: CUST_BETA, name: "Beta One" }),
    ]);
  });
}

describe("Storage rules engine (behavioral, via emulator)", () => {
  beforeEach(async () => {
    if (!testEnv) {
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules: readFileSync(FIRESTORE_RULES_PATH, "utf8"),
          host: "127.0.0.1",
          port: 8080,
        },
        storage: {
          rules: readFileSync(STORAGE_RULES_PATH, "utf8"),
          host: "127.0.0.1",
          port: 9199,
        },
      });
    }
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
    await seed();
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  describe("organizations/{orgId}/uploads/{userId}/{projectId} tenant + owner-path scoping", () => {
    it("lets a client upload and read under their own uid and their own assigned project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = `organizations/${ORG}/uploads/${CLIENT_ALPHA_UID}/${PROJ_ALPHA_1}/notes.txt`;
      await assertSucceeds(uploadBytes(ref(client.storage(), path), TEXT_BYTES, { contentType: "text/plain" }));
      await assertSucceeds(getBytes(ref(client.storage(), path)));
    });

    it("denies a client from uploading under another user's uid segment, even within their own project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = `organizations/${ORG}/uploads/${OWNER_UID}/${PROJ_ALPHA_1}/notes.txt`;
      await assertFails(uploadBytes(ref(client.storage(), path), TEXT_BYTES, { contentType: "text/plain" }));
    });

    it("denies a client from reading or writing under another customer's project (cross-tenant isolation)", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = `organizations/${ORG}/uploads/${CLIENT_ALPHA_UID}/${PROJ_BETA_1}/notes.txt`;
      await assertFails(uploadBytes(ref(client.storage(), path), TEXT_BYTES, { contentType: "text/plain" }));

      // Seed the object via bypass, then confirm the client still can't read it back.
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await uploadBytes(ref(context.storage(), path), TEXT_BYTES, { contentType: "text/plain" });
      });
      await assertFails(getBytes(ref(client.storage(), path)));
    });

    it("denies a disabled member from uploading even to their own uid/project path", async () => {
      const disabled = testEnv.authenticatedContext(DISABLED_MEMBER_UID);
      const path = `organizations/${ORG}/uploads/${DISABLED_MEMBER_UID}/${PROJ_ALPHA_1}/notes.txt`;
      await assertFails(uploadBytes(ref(disabled.storage(), path), TEXT_BYTES, { contentType: "text/plain" }));
    });

    it("rejects an upload whose content-type is outside the declared safeUpload allow-list", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = `organizations/${ORG}/uploads/${CLIENT_ALPHA_UID}/${PROJ_ALPHA_1}/payload.exe`;
      await assertFails(
        uploadBytes(ref(client.storage(), path), TEXT_BYTES, { contentType: "application/x-msdownload" }),
      );
    });

    it("rejects an upload larger than the declared 25MB safeUpload size limit", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = `organizations/${ORG}/uploads/${CLIENT_ALPHA_UID}/${PROJ_ALPHA_1}/big.bin`;
      const oversized = new Uint8Array(26 * 1024 * 1024);
      await assertFails(uploadBytes(ref(client.storage(), path), oversized, { contentType: "application/zip" }));
    }, 30000);

    it("lets staff read/write across any project's uploads regardless of the uid segment", async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      const path = `organizations/${ORG}/uploads/${CLIENT_BETA_UID}/${PROJ_BETA_1}/staff-file.txt`;
      await assertSucceeds(uploadBytes(ref(owner.storage(), path), TEXT_BYTES, { contentType: "text/plain" }));
      await assertSucceeds(getBytes(ref(owner.storage(), path)));
    });
  });

  describe("organizations/{orgId}/discovery/{projectId}/{sectionId}/{fieldId}/{userId} tenant + owner-path scoping", () => {
    const discoveryPath = (projectId: string, uid: string, fileName: string) =>
      `organizations/${ORG}/discovery/${projectId}/business/branding.logo/${uid}/${fileName}`;

    it("lets a client upload and read a Discovery file under their own uid and their own assigned project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = discoveryPath(PROJ_ALPHA_1, CLIENT_ALPHA_UID, "logo.png");
      await assertSucceeds(uploadBytes(ref(client.storage(), path), PNG_BYTES, { contentType: "image/png" }));
      await assertSucceeds(getBytes(ref(client.storage(), path)));
    });

    it("denies a client from uploading a Discovery file under another user's uid segment, even within their own project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = discoveryPath(PROJ_ALPHA_1, OWNER_UID, "logo.png");
      await assertFails(uploadBytes(ref(client.storage(), path), PNG_BYTES, { contentType: "image/png" }));
    });

    it("denies a client from uploading OR reading a Discovery file scoped to another customer's project (cross-customer upload rejection)", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = discoveryPath(PROJ_BETA_1, CLIENT_ALPHA_UID, "logo.png");
      await assertFails(uploadBytes(ref(client.storage(), path), PNG_BYTES, { contentType: "image/png" }));

      await testEnv.withSecurityRulesDisabled(async (context) => {
        await uploadBytes(ref(context.storage(), path), PNG_BYTES, { contentType: "image/png" });
      });
      await assertFails(getBytes(ref(client.storage(), path)));
    });

    it("denies a disabled member from uploading a Discovery file even to their own uid/project path", async () => {
      const disabled = testEnv.authenticatedContext(DISABLED_MEMBER_UID);
      const path = discoveryPath(PROJ_ALPHA_1, DISABLED_MEMBER_UID, "logo.png");
      await assertFails(uploadBytes(ref(disabled.storage(), path), PNG_BYTES, { contentType: "image/png" }));
    });

    it("rejects a Discovery upload whose content-type is outside the declared safeUpload allow-list", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = discoveryPath(PROJ_ALPHA_1, CLIENT_ALPHA_UID, "payload.exe");
      await assertFails(uploadBytes(ref(client.storage(), path), TEXT_BYTES, { contentType: "application/x-msdownload" }));
    });

    it("rejects a Discovery upload larger than the declared 25MB safeUpload size limit", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = discoveryPath(PROJ_ALPHA_1, CLIENT_ALPHA_UID, "big.bin");
      const oversized = new Uint8Array(26 * 1024 * 1024);
      await assertFails(uploadBytes(ref(client.storage(), path), oversized, { contentType: "application/zip" }));
    }, 30000);

    it("lets staff read/write Discovery uploads across any project regardless of the uid segment", async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      const path = discoveryPath(PROJ_BETA_1, CLIENT_BETA_UID, "staff-uploaded.png");
      await assertSucceeds(uploadBytes(ref(owner.storage(), path), PNG_BYTES, { contentType: "image/png" }));
      await assertSucceeds(getBytes(ref(owner.storage(), path)));
    });
  });

  describe("organizations/{orgId}/customers/{customerId}/{userId} tenant scoping", () => {
    it("lets a client read/write under their own customerId", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = `organizations/${ORG}/customers/${CUST_ALPHA}/${CLIENT_ALPHA_UID}/file.txt`;
      await assertSucceeds(uploadBytes(ref(client.storage(), path), TEXT_BYTES, { contentType: "text/plain" }));
      await assertSucceeds(getBytes(ref(client.storage(), path)));
    });

    it("denies a client from reading or writing under another customer's customerId path", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = `organizations/${ORG}/customers/${CUST_BETA}/${CLIENT_ALPHA_UID}/file.txt`;
      await assertFails(uploadBytes(ref(client.storage(), path), TEXT_BYTES, { contentType: "text/plain" }));

      await testEnv.withSecurityRulesDisabled(async (context) => {
        await uploadBytes(ref(context.storage(), path), TEXT_BYTES, { contentType: "text/plain" });
      });
      await assertFails(getBytes(ref(client.storage(), path)));
    });
  });

  describe("organizations/{orgId}/website-media/{customerId}/{projectId}/{websiteId}/{userId}/{fileName}", () => {
    const mediaPath = (customerId: string, projectId: string, uid: string, fileName: string) =>
      `organizations/${ORG}/website-media/${customerId}/${projectId}/${WEBSITE_ALPHA}/${uid}/${fileName}`;

    it("lets a client upload a valid image to their own customer/project scope and read it back", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = mediaPath(CUST_ALPHA, PROJ_ALPHA_1, CLIENT_ALPHA_UID, "hero.png");
      await assertSucceeds(uploadBytes(ref(client.storage(), path), PNG_BYTES, { contentType: "image/png" }));
      await assertSucceeds(getBytes(ref(client.storage(), path)));
    });

    it("denies uploading website media scoped to another customer/project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = mediaPath(CUST_BETA, PROJ_BETA_1, CLIENT_ALPHA_UID, "hero.png");
      await assertFails(uploadBytes(ref(client.storage(), path), PNG_BYTES, { contentType: "image/png" }));
    });

    it("rejects a disallowed file extension/content-type combination declared by safeWebsiteMedia", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = mediaPath(CUST_ALPHA, PROJ_ALPHA_1, CLIENT_ALPHA_UID, "hero.svg");
      await assertFails(uploadBytes(ref(client.storage(), path), PNG_BYTES, { contentType: "image/svg+xml" }));
    });

    it("lets the uploading user delete their own website media", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = mediaPath(CUST_ALPHA, PROJ_ALPHA_1, CLIENT_ALPHA_UID, "hero.png");
      await assertSucceeds(uploadBytes(ref(client.storage(), path), PNG_BYTES, { contentType: "image/png" }));
      await assertSucceeds(deleteObject(ref(client.storage(), path)));
    });
  });

  describe("staff-only artifact paths deny direct client writes", () => {
    it("denies a client from writing to organizations/{orgId}/artifacts even under their own path shape", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const path = `organizations/${ORG}/artifacts/${CLIENT_ALPHA_UID}.txt`;
      await assertFails(uploadBytes(ref(client.storage(), path), TEXT_BYTES, { contentType: "text/plain" }));
    });

    it("allows staff to read organizations/{orgId}/artifacts but denies a client", async () => {
      const path = `organizations/${ORG}/artifacts/report.txt`;
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await uploadBytes(ref(context.storage(), path), TEXT_BYTES, { contentType: "text/plain" });
      });
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertSucceeds(getBytes(ref(owner.storage(), path)));
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getBytes(ref(client.storage(), path)));
    });
  });

  describe("default deny for unlisted paths", () => {
    it("denies read and write on a path not covered by any match block", async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      const path = `organizations/${ORG}/some-unlisted-collection/file.txt`;
      await assertFails(uploadBytes(ref(owner.storage(), path), TEXT_BYTES, { contentType: "text/plain" }));
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await uploadBytes(ref(context.storage(), path), TEXT_BYTES, { contentType: "text/plain" });
      });
      await assertFails(getBytes(ref(owner.storage(), path)));
    });
  });
});
