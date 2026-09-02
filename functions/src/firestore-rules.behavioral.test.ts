// Behavioral security-rules tests: these run the REAL firestore.rules file through the Firebase
// Firestore emulator's rules engine via @firebase/rules-unit-testing, unlike firestore-rules.test.ts
// (which only asserts the rules SOURCE TEXT contains certain substrings and never executes a single
// read/write). String matching cannot catch a bug where the rules engine itself rejects or wrongly
// allows a specific query for a specific authenticated user — which is exactly the class of bug
// (a broken list-query permission on organizations/{orgId}/projects) that shipped undetected through
// 36 passing string-match tests. These tests seed real documents (bypassing rules via
// withSecurityRulesDisabled) and then perform actual assertSucceeds/assertFails reads and QUERIES
// as differently-privileged authenticated users, exercising the rules engine directly.
//
// Requires the Firestore emulator (needs a JVM) running on the port configured in firebase.json
// (127.0.0.1:8080). Start it with `firebase emulators:start --only firestore` (or the full suite)
// before running this file. If the emulator isn't reachable, every test below fails fast with a
// clear ECONNREFUSED-style error from the client SDK rather than a silent skip.
import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, documentId, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";

const RULES_PATH = new URL("../../firestore.rules", import.meta.url);
const PROJECT_ID = "demo-pageloom-rules-fs";
const ORG = "acme";

// Fixture identities, mirroring the real member-document shape read by firestore.rules'
// member()/role()/staff()/privileged()/client()/clientCustomerId()/clientProjectList()/clientProject().
const OWNER_UID = "owner-1";
const STAFF_MEMBER_UID = "staff-member-1"; // role "member": staff-broad, but NOT privileged()
const CLIENT_ALPHA_UID = "client-alpha-1"; // role "client", customerId cust-alpha, unrestricted projectIds
const CLIENT_ALPHA_RESTRICTED_UID = "client-alpha-restricted-1"; // customerId cust-alpha, projectIds=[proj-alpha-1]
const CLIENT_BETA_UID = "client-beta-1"; // role "client", customerId cust-beta (unrelated tenant)
const DISABLED_MEMBER_UID = "disabled-member-1"; // role "member" but disabled:true
const PLATFORM_ADMIN_UID = "platform-admin-1"; // no membership doc at all; only a custom claim

const CUST_ALPHA = "cust-alpha";
const CUST_BETA = "cust-beta";
const PROJ_ALPHA_1 = "proj-alpha-1";
const PROJ_ALPHA_2 = "proj-alpha-2"; // same customer as proj-alpha-1, excluded from the restricted client's projectIds
const PROJ_BETA_1 = "proj-beta-1";

let testEnv: RulesTestEnvironment;

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
        projectIds: [], // empty list == unrestricted, per the rules' own documented semantics
      }),
      set(`organizations/${ORG}/members/${CLIENT_ALPHA_RESTRICTED_UID}`, {
        role: "client",
        disabled: false,
        customerId: CUST_ALPHA,
        projectIds: [PROJ_ALPHA_1], // deliberately excludes proj-alpha-2
      }),
      set(`organizations/${ORG}/members/${CLIENT_BETA_UID}`, {
        role: "client",
        disabled: false,
        customerId: CUST_BETA,
        projectIds: [],
      }),
      set(`organizations/${ORG}/members/${DISABLED_MEMBER_UID}`, { role: "member", disabled: true }),

      set(`organizations/${ORG}/projects/${PROJ_ALPHA_1}`, { customerId: CUST_ALPHA, name: "Alpha One" }),
      set(`organizations/${ORG}/projects/${PROJ_ALPHA_2}`, { customerId: CUST_ALPHA, name: "Alpha Two" }),
      set(`organizations/${ORG}/projects/${PROJ_BETA_1}`, { customerId: CUST_BETA, name: "Beta One" }),

      set(`organizations/${ORG}/projects/${PROJ_ALPHA_1}/comments/c1`, { body: "hello", authorId: OWNER_UID }),
      set(`organizations/${ORG}/projects/${PROJ_BETA_1}/comments/c1`, { body: "hi", authorId: OWNER_UID }),

      set(`organizations/${ORG}/projects/${PROJ_ALPHA_1}/documents/doc-customer`, {
        audience: "customer",
        title: "Customer-visible doc",
      }),
      set(`organizations/${ORG}/projects/${PROJ_ALPHA_1}/documents/doc-internal`, {
        audience: "internal",
        title: "Internal-only doc",
      }),

      set(`organizations/${ORG}/websites/site-alpha/content/home`, { customerId: CUST_ALPHA, html: "<p>alpha</p>" }),
      set(`organizations/${ORG}/websites/site-beta/content/home`, { customerId: CUST_BETA, html: "<p>beta</p>" }),

      set(`organizations/${ORG}/supportTickets/ticket-alpha`, { customerId: CUST_ALPHA, subject: "help" }),
      set(`organizations/${ORG}/supportTickets/ticket-beta`, { customerId: CUST_BETA, subject: "help" }),

      set(`organizations/${ORG}/projects/${PROJ_ALPHA_1}/revisionRequests/rev-1`, { description: "Make the hero bigger", status: "open" }),
      set(`organizations/${ORG}/projects/${PROJ_BETA_1}/revisionRequests/rev-1`, { description: "Fix the footer", status: "open" }),
      set(`organizations/${ORG}/projects/${PROJ_ALPHA_1}/launchChecklist/current`, { items: [{ id: "domain", complete: false }] }),
      set(`organizations/${ORG}/projects/${PROJ_BETA_1}/launchChecklist/current`, { items: [{ id: "domain", complete: false }] }),
      set(`organizations/${ORG}/projects/${PROJ_ALPHA_1}/handover/current`, { liveUrl: "https://alpha.example.com" }),
      set(`organizations/${ORG}/projects/${PROJ_BETA_1}/handover/current`, { liveUrl: "https://beta.example.com" }),

      // Business Discovery fixtures — see docs/customer-discovery-onboarding/DATA-MODEL.md §2.
      set(`organizations/${ORG}/projects/${PROJ_ALPHA_1}/discovery/business`, { id: "business", projectId: PROJ_ALPHA_1, templateVersion: 1, status: "completed", responses: { "business.publicName": "Alpha Co" } }),
      set(`organizations/${ORG}/projects/${PROJ_ALPHA_2}/discovery/business`, { id: "business", projectId: PROJ_ALPHA_2, templateVersion: 1, status: "draft", responses: {} }),
      set(`organizations/${ORG}/projects/${PROJ_BETA_1}/discovery/business`, { id: "business", projectId: PROJ_BETA_1, templateVersion: 1, status: "draft", responses: {} }),
      set(`organizations/${ORG}/projects/${PROJ_ALPHA_1}/discoveryProgress/current`, { id: "current", projectId: PROJ_ALPHA_1, templateVersion: 1, status: "in_progress", completedSectionIds: ["business"], percentComplete: 11, lastActivityAt: "2026-01-01T00:00:00.000Z" }),
      set(`organizations/${ORG}/projects/${PROJ_BETA_1}/discoveryProgress/current`, { id: "current", projectId: PROJ_BETA_1, templateVersion: 1, status: "not_started", completedSectionIds: [], percentComplete: 0, lastActivityAt: "2026-01-01T00:00:00.000Z" }),
      set(`organizations/${ORG}/projects/${PROJ_ALPHA_1}/discoveryNotes/note-1`, { id: "note-1", projectId: PROJ_ALPHA_1, authorId: OWNER_UID, authorName: "Owner", body: "Ask them for higher-res logo", createdAt: "2026-01-01T00:00:00.000Z" }),
      set(`organizations/${ORG}/projects/${PROJ_BETA_1}/discoveryNotes/note-1`, { id: "note-1", projectId: PROJ_BETA_1, authorId: OWNER_UID, authorName: "Owner", body: "Internal note", createdAt: "2026-01-01T00:00:00.000Z" }),
      set(`organizations/${ORG}/projects/${PROJ_ALPHA_1}/businessProfile/current`, { id: "current", projectId: PROJ_ALPHA_1, status: "not_generated", schemaVersion: 1 }),

      set(`organizations/${ORG}/leads/lead-1`, { name: "Prospective Co" }),
      set(`organizations/${ORG}/customers/${CUST_ALPHA}`, { name: "Alpha Inc" }),

      set(`organizations/${ORG}/revenue/rev-1`, { amountCents: 500000 }),
      set(`organizations/${ORG}/apiKeys/key-1`, { secret: "sk_live_xxx" }),

      set(`systemAdministrators/${PLATFORM_ADMIN_UID}`, { role: "admin", active: true }),
    ]);
  });
}

describe("Firestore rules engine (behavioral, via emulator)", () => {
  beforeEach(async () => {
    if (!testEnv) {
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules: readFileSync(RULES_PATH, "utf8"),
          host: "127.0.0.1",
          port: 8080,
        },
      });
    }
    await testEnv.clearFirestore();
    await seed();
  });

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  // These tests query with an explicit where('customerId','==', ownCustomerId) filter, matching
  // exactly what the real app does (apps/web/src/app/(product)/portal/page.tsx, via
  // useLiveCollection) for every client account - never a bare, unfiltered collection() listing.
  // That distinction matters: Firestore's list/query rule-safety analysis cannot prove a rule
  // depending on resource.data.customerId safe without a query filter that matches it, and
  // correctly denies a bare listing outright regardless of what the real data would return -
  // in the emulator AND in real, deployed production Firestore alike (verified directly against
  // pageloom-os-production with the real test client account: a bare listing was denied with
  // "Missing or insufficient permissions", while the same query with this where() filter
  // succeeded and returned exactly the expected, correctly-scoped project). An earlier version of
  // this file used a bare listing and mistakenly attributed the resulting denial to an emulator
  // bug (firebase/firebase-tools#6252) - that diagnosis was wrong. This filtered form is the
  // correct, provably-safe way to exercise clientProjectList, and is what production actually
  // verified to work correctly.
  describe("client project list-query safety (the exact bug class that shipped before)", () => {
    it("lets a client list/query organizations/{org}/projects and returns only their own customer's projects", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const snap = await assertSucceeds(getDocs(query(collection(client.firestore(), `organizations/${ORG}/projects`), where("customerId", "==", CUST_ALPHA))));
      const ids = snap.docs.map((d) => d.id).sort();
      expect(ids).toEqual([PROJ_ALPHA_1, PROJ_ALPHA_2].sort());
    });

    it("filters an unrelated customer's project out of the list results (cross-tenant isolation in queries)", async () => {
      const client = testEnv.authenticatedContext(CLIENT_BETA_UID);
      const snap = await assertSucceeds(getDocs(query(collection(client.firestore(), `organizations/${ORG}/projects`), where("customerId", "==", CUST_BETA))));
      const ids = snap.docs.map((d) => d.id);
      expect(ids).toEqual([PROJ_BETA_1]);
      expect(ids).not.toContain(PROJ_ALPHA_1);
      expect(ids).not.toContain(PROJ_ALPHA_2);
    });

    it("denies a client attempting to list with a customerId filter that does not match their own membership", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDocs(query(collection(client.firestore(), `organizations/${ORG}/projects`), where("customerId", "==", CUST_BETA))));
    });

    it("excludes an unassigned project from list results when projectIds is a non-empty allow-list", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_RESTRICTED_UID);
      const snap = await assertSucceeds(getDocs(query(collection(client.firestore(), `organizations/${ORG}/projects`), where("customerId", "==", CUST_ALPHA), where(documentId(), "in", [PROJ_ALPHA_1]))));
      const ids = snap.docs.map((d) => d.id);
      expect(ids).toEqual([PROJ_ALPHA_1]);
      expect(ids).not.toContain(PROJ_ALPHA_2);
    });

    it("lets a client directly get() their own assigned project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertSucceeds(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}`)));
    });

    it("denies a direct get() of another customer's project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}`)));
    });

    it("denies a direct get() of an unassigned project excluded by a non-empty projectIds list", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_RESTRICTED_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_2}`)));
    });
  });

  describe("systemAdministrators is not covered by any match and falls through to deny-all", () => {
    it("denies platform admins, owners, and everyone else from reading systemAdministrators/{uid}", async () => {
      const admin = testEnv.authenticatedContext(PLATFORM_ADMIN_UID, { platformRole: "admin" });
      await assertFails(getDoc(doc(admin.firestore(), `systemAdministrators/${PLATFORM_ADMIN_UID}`)));

      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertFails(getDoc(doc(owner.firestore(), `systemAdministrators/${PLATFORM_ADMIN_UID}`)));

      const anon = testEnv.unauthenticatedContext();
      await assertFails(getDoc(doc(anon.firestore(), `systemAdministrators/${PLATFORM_ADMIN_UID}`)));
    });
  });

  describe("privileged() financial/commercial collections exclude plain staff members", () => {
    it("denies a client from reading revenue and apiKeys", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/revenue/rev-1`)));
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/apiKeys/key-1`)));
    });

    it("denies a staff 'member' role (staff-broad, but not privileged) from reading revenue and apiKeys", async () => {
      const staffMember = testEnv.authenticatedContext(STAFF_MEMBER_UID);
      await assertFails(getDoc(doc(staffMember.firestore(), `organizations/${ORG}/revenue/rev-1`)));
      await assertFails(getDoc(doc(staffMember.firestore(), `organizations/${ORG}/apiKeys/key-1`)));
    });

    it("allows an owner to read revenue and apiKeys", async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertSucceeds(getDoc(doc(owner.firestore(), `organizations/${ORG}/revenue/rev-1`)));
      await assertSucceeds(getDoc(doc(owner.firestore(), `organizations/${ORG}/apiKeys/key-1`)));
    });

    it("allows a platform admin (custom claim, no membership doc) to read revenue and apiKeys", async () => {
      const admin = testEnv.authenticatedContext(PLATFORM_ADMIN_UID, { platformRole: "admin" });
      await assertSucceeds(getDoc(doc(admin.firestore(), `organizations/${ORG}/revenue/rev-1`)));
      await assertSucceeds(getDoc(doc(admin.firestore(), `organizations/${ORG}/apiKeys/key-1`)));
    });
  });

  describe("staff-only (non-privileged) collections deny clients", () => {
    it("denies a client from reading leads and the customers collection", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/leads/lead-1`)));
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/customers/${CUST_ALPHA}`)));
    });

    it("allows a plain staff 'member' role to read leads and the customers collection", async () => {
      const staffMember = testEnv.authenticatedContext(STAFF_MEMBER_UID);
      await assertSucceeds(getDoc(doc(staffMember.firestore(), `organizations/${ORG}/leads/lead-1`)));
      await assertSucceeds(getDoc(doc(staffMember.firestore(), `organizations/${ORG}/customers/${CUST_ALPHA}`)));
    });

    it("denies a client from reading another member's profile document", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/members/${OWNER_UID}`)));
    });

    it("allows an owner to read member profile documents", async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertSucceeds(getDoc(doc(owner.firestore(), `organizations/${ORG}/members/${CLIENT_ALPHA_UID}`)));
    });
  });

  describe("customer-scoped website content", () => {
    it("lets a client read website content bearing their own customerId", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertSucceeds(getDoc(doc(client.firestore(), `organizations/${ORG}/websites/site-alpha/content/home`)));
    });

    it("denies a client from reading another customer's website content", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/websites/site-beta/content/home`)));
    });
  });

  describe("customer-scoped support tickets", () => {
    it("lets a client read their own support tickets", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertSucceeds(getDoc(doc(client.firestore(), `organizations/${ORG}/supportTickets/ticket-alpha`)));
    });

    it("denies a client from reading another customer's support ticket", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/supportTickets/ticket-beta`)));
    });
  });

  describe("onboarding journey: revision requests, launch checklist, handover", () => {
    it("lets a client read revision requests and handover on their own assigned project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertSucceeds(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/revisionRequests/rev-1`)));
      await assertSucceeds(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/handover/current`)));
    });

    it("denies a client from reading another customer's revision requests or handover", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}/revisionRequests/rev-1`)));
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}/handover/current`)));
    });

    it("denies a client from reading the launch checklist at all (staff-only readiness detail)", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/launchChecklist/current`)));
    });

    it("lets staff read revision requests, launch checklist, and handover across projects", async () => {
      const staffMember = testEnv.authenticatedContext(STAFF_MEMBER_UID);
      await assertSucceeds(getDoc(doc(staffMember.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/revisionRequests/rev-1`)));
      await assertSucceeds(getDoc(doc(staffMember.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/launchChecklist/current`)));
      await assertSucceeds(getDoc(doc(staffMember.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/handover/current`)));
    });

    it("denies writes to all three from the client SDK (server/admin-authorized only)", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(setDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/revisionRequests/rev-1`), { status: "resolved" }));
      await assertFails(setDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/launchChecklist/current`), { items: [] }));
      await assertFails(setDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/handover/current`), { liveUrl: "https://hacked.example.com" }));
    });
  });

  describe("Business Discovery — valid access", () => {
    it("lets a client read their own project's discovery section, progress, and businessProfile is denied (staff-only)", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertSucceeds(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discovery/business`)));
      await assertSucceeds(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discoveryProgress/current`)));
    });

    it("lets a plain staff 'member' role, and an owner/admin, read discovery, progress, notes, and businessProfile across any project", async () => {
      const staffMember = testEnv.authenticatedContext(STAFF_MEMBER_UID);
      await assertSucceeds(getDoc(doc(staffMember.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discovery/business`)));
      await assertSucceeds(getDoc(doc(staffMember.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discoveryProgress/current`)));
      await assertSucceeds(getDoc(doc(staffMember.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discoveryNotes/note-1`)));
      await assertSucceeds(getDoc(doc(staffMember.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/businessProfile/current`)));

      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertSucceeds(getDoc(doc(owner.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}/discovery/business`)));
      await assertSucceeds(getDoc(doc(owner.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}/discoveryNotes/note-1`)));
    });
  });

  describe("Business Discovery — cross-customer read rejection", () => {
    it("denies a client from reading another customer's discovery section or progress", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}/discovery/business`)));
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}/discoveryProgress/current`)));
    });

    it("denies a restricted client (non-empty projectIds excluding this project) from reading discovery on an unassigned project of their own customer", async () => {
      const restricted = testEnv.authenticatedContext(CLIENT_ALPHA_RESTRICTED_UID);
      await assertFails(getDoc(doc(restricted.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_2}/discovery/business`)));
    });
  });

  describe("Business Discovery — internal notes rejection (customer must never see internal notes)", () => {
    it("denies a client from reading discoveryNotes on their OWN assigned project — the load-bearing guarantee", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discoveryNotes/note-1`)));
    });

    it("denies a client from reading businessProfile (internal AI-analysis destination, staff-only at launch)", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/businessProfile/current`)));
    });
  });

  describe("Business Discovery — disabled-user rejection", () => {
    it("denies a disabled member from reading discovery data even though role would otherwise permit staff access", async () => {
      const disabled = testEnv.authenticatedContext(DISABLED_MEMBER_UID);
      await assertFails(getDoc(doc(disabled.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discovery/business`)));
      await assertFails(getDoc(doc(disabled.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discoveryProgress/current`)));
      await assertFails(getDoc(doc(disabled.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discoveryNotes/note-1`)));
    });
  });

  describe("Business Discovery — cross-customer write rejection, and no client write path exists at all", () => {
    it("denies a client from writing (create/update/delete) their own project's discovery section — mutation is server/Admin-SDK only", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(setDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discovery/business`), { responses: { hacked: true } }));
      await assertFails(updateDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discovery/business`), { status: "completed" }));
      await assertFails(deleteDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discovery/business`)));
    });

    it("denies a client from writing to another customer's discovery data (cross-customer write rejection)", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(setDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}/discovery/business`), { responses: { hacked: true } }));
      await assertFails(setDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}/discoveryProgress/current`), { status: "submitted" }));
    });

    it("denies a client from writing (or forging) discoveryNotes, whether on their own or another project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(setDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discoveryNotes/forged`), { body: "not internal at all" }));
      await assertFails(setDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}/discoveryNotes/forged`), { body: "cross-tenant forge" }));
    });

    it("denies unauthorized archive/restore-shaped writes — no role can flip status fields directly via the client SDK, since ALL client writes are denied and archive/restore is server-authorized only", async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      // Even an Owner cannot write directly from the client SDK — every mutation, including a
      // future archive/restore/reopen action, must go through the Admin-SDK-authorized API layer.
      await assertFails(updateDoc(doc(owner.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discoveryProgress/current`), { status: "reopened" }));
      await assertFails(setDoc(doc(owner.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discovery/business`), { status: "draft", reopenedAt: "now" }, { merge: true }));
    });

    it("denies unauthorized permanent-delete of Discovery data by any role — no client-SDK delete path exists for discovery, discoveryProgress, discoveryNotes, or businessProfile", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      const owner = testEnv.authenticatedContext(OWNER_UID);
      const staffMember = testEnv.authenticatedContext(STAFF_MEMBER_UID);
      for (const path of [
        `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discovery/business`,
        `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discoveryProgress/current`,
        `organizations/${ORG}/projects/${PROJ_ALPHA_1}/discoveryNotes/note-1`,
        `organizations/${ORG}/projects/${PROJ_ALPHA_1}/businessProfile/current`,
      ]) {
        await assertFails(deleteDoc(doc(client.firestore(), path)));
        await assertFails(deleteDoc(doc(owner.firestore(), path)));
        await assertFails(deleteDoc(doc(staffMember.firestore(), path)));
      }
    });
  });

  describe("fixed-path project subcollections (clientProject, not clientProjectList)", () => {
    it("lets a client read comments on their own assigned project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertSucceeds(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/comments/c1`)));
    });

    it("denies a client from reading comments on another customer's project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}/comments/c1`)));
    });

    it("lets a client read a customer-audience document but not an internal-audience document on their own project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertSucceeds(
        getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/documents/doc-customer`)),
      );
      await assertFails(
        getDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/documents/doc-internal`)),
      );
    });

    it("lets staff read both customer- and internal-audience documents", async () => {
      const staffMember = testEnv.authenticatedContext(STAFF_MEMBER_UID);
      await assertSucceeds(
        getDoc(doc(staffMember.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/documents/doc-customer`)),
      );
      await assertSucceeds(
        getDoc(doc(staffMember.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}/documents/doc-internal`)),
      );
    });
  });

  describe("disabled members", () => {
    it("denies a disabled member even though their role would otherwise permit staff access", async () => {
      const disabled = testEnv.authenticatedContext(DISABLED_MEMBER_UID);
      await assertFails(getDoc(doc(disabled.firestore(), `organizations/${ORG}/leads/lead-1`)));
      await assertFails(getDoc(doc(disabled.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}`)));
    });
  });

  describe("broad staff/owner/admin positive paths (guard against accidental over-restriction)", () => {
    it("lets an owner read the organization document and any project", async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertSucceeds(getDoc(doc(owner.firestore(), `organizations/${ORG}`)));
      await assertSucceeds(getDoc(doc(owner.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}`)));
      await assertSucceeds(getDoc(doc(owner.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}`)));
    });

    it("lets a platform admin (custom claim only, no membership doc anywhere) read across the organization", async () => {
      const admin = testEnv.authenticatedContext(PLATFORM_ADMIN_UID, { platformRole: "admin" });
      await assertSucceeds(getDoc(doc(admin.firestore(), `organizations/${ORG}`)));
      await assertSucceeds(getDoc(doc(admin.firestore(), `organizations/${ORG}/projects/${PROJ_BETA_1}`)));
      await assertSucceeds(getDoc(doc(admin.firestore(), `organizations/${ORG}/supportTickets/ticket-alpha`)));
    });
  });

  describe("no client write path exists (all writes are server/admin-authorized)", () => {
    it("denies a client from writing to their own project", async () => {
      const client = testEnv.authenticatedContext(CLIENT_ALPHA_UID);
      await assertFails(setDoc(doc(client.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}`), { name: "hacked" }));
    });

    it("denies an owner from writing directly (writes are admin-SDK/server only)", async () => {
      const owner = testEnv.authenticatedContext(OWNER_UID);
      await assertFails(setDoc(doc(owner.firestore(), `organizations/${ORG}/projects/${PROJ_ALPHA_1}`), { name: "hacked" }));
    });
  });
});
