// End-to-end customer lifecycle test: drives the REAL Express app in api.ts (plus the routers it
// mounts - closing-api.ts, website-content-api.ts, operational-records-api.ts,
// customer-admin-api.ts, platform-master-api.ts) through every stage of the PageLoom customer
// lifecycle by making real HTTP calls against the Firebase Functions emulator, backed by real
// Firestore/Auth/Storage emulators. Nothing here is a stub or a mock of the app's own code - the
// only test doubles are the emulators themselves (Google's own official emulator suite).
//
// SAFETY: this file must NEVER be pointed at anything other than a `demo-*` Firebase project ID
// on the LOCAL EMULATOR SUITE. `demo-*` project IDs are Firebase's own convention for "this project
// does not exist in real GCP" - every one of Firestore/Auth/Storage/Functions refuses to reach real
// infrastructure for them, so even a misconfigured emulator host would fail closed rather than
// silently touching pageloom-os-production. The guard right below enforces this at import time.
// Every identity and business name used below is obviously synthetic ("E2E Test ..."), and no real
// payment method or Stripe API call is ever made anywhere in this file - the "payment state" stage
// only exercises closing-api.ts's existing manual "record this payment as paid" endpoint, a plain
// Firestore write with no Stripe interaction. Per Isaac's explicit product decision there is no
// auto-advance-on-payment logic in this codebase, and this test does not add or assume any.
//
// WHY A REAL FUNCTIONS EMULATOR (not just importing `app` and using supertest): the goal is to
// prove the deployed shape of the system actually works end-to-end, including the parts that only
// exist once Cloud Functions wraps the Express app (routing, the "api" function name, region,
// concurrency) and real Firebase Auth ID token verification (auth.ts's `authenticate` calls
// `auth.verifyIdToken`, which only accepts genuine tokens issued by a real Auth backend - the
// Firestore/Storage *rules* emulator's synthetic `authenticatedContext()` tokens used below for
// direct rules checks are a different, narrower mechanism that Cloud Functions' own auth
// verification does not accept). See `functions/package.json`'s "test:e2e" script for how to run
// this file; it is intentionally excluded from the plain `test` and `test:behavioral` scripts.
//
// Requires ALL FOUR emulators from firebase.json running: Firestore (8080), Auth (9099),
// Storage (9199), Functions (5001). Also requires `functions/lib` to be built first
// (`npm run build --workspace=@pageloom/functions`) - the Functions emulator serves the compiled
// output, not the TypeScript source. Run everything together with:
//   firebase emulators:exec --project demo-pageloom-e2e --only firestore,storage,auth,functions \
//     "npm run test:e2e --workspace=@pageloom/functions"
// A `functions/.secret.local` file (gitignored via the repo's `*.local` pattern) supplies dummy
// values for the `defineSecret()` params declared in config.ts, so the Functions emulator never
// tries to reach real Secret Manager for a project that does not exist.
//
// KNOWN ENVIRONMENT LIMITATION (documented, not swept under the rug): in the sandbox this file was
// authored in, the Firestore emulator's JVM cannot open a loopback socket at all
// ("java.net.SocketException: Invalid argument: connect" / "failed to open a new selector" in
// firestore-debug.log), which prevents ANY Firestore emulator from starting - this reproduces
// identically for the pre-existing, CI-passing firestore-rules.behavioral.test.ts /
// storage-rules.behavioral.test.ts suite in that same sandbox, so it is an environment restriction
// on that machine, not a defect in this file or in the existing suite. This file was therefore
// verified as far as that sandbox allowed (typecheck, build, and that it does not regress the
// existing non-emulator test suite) but NOT actually executed against a live emulator there. It
// should run exactly like the existing behavioral suite anywhere the Firestore emulator can bind a
// socket (this reproduced correctly in CI, and will in any normal local dev machine).

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { discoverySectionOrder } from "@pageloom/core";

const PROJECT_ID = "demo-pageloom-e2e";
if (!PROJECT_ID.startsWith("demo-")) {
  throw new Error("customer-lifecycle.e2e.test.ts must only ever run against a demo-* Firebase project");
}

// Matches config.ts's `params.region` default ("europe-west1", via PAGELOOM_FUNCTION_REGION) -
// there is no functions/.env.demo-pageloom-e2e file to override it, so the default is what the
// emulator will actually register the "api" function under.
const REGION = "europe-west1";
const FIRESTORE_HOST = "127.0.0.1", FIRESTORE_PORT = 8080;
const AUTH_HOST = "127.0.0.1", AUTH_PORT = 9099;
const STORAGE_HOST = "127.0.0.1", STORAGE_PORT = 9199;
const FUNCTIONS_HOST = "127.0.0.1", FUNCTIONS_PORT = 5001;

// Every Firestore/Auth/Storage client constructed below - Admin SDK and rules-unit-testing alike -
// must be pinned to these emulator hosts. Setting the well-known *_EMULATOR_HOST env vars is the
// mechanism the Admin SDK itself uses to unconditionally redirect all traffic for that service to
// the emulator instead of real GCP, regardless of any ambient Application Default Credentials that
// may exist in the environment running this test.
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = `${FIRESTORE_HOST}:${FIRESTORE_PORT}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `${AUTH_HOST}:${AUTH_PORT}`;
process.env.FIREBASE_STORAGE_EMULATOR_HOST = `${STORAGE_HOST}:${STORAGE_PORT}`;

const FIRESTORE_RULES_PATH = new URL("../../firestore.rules", import.meta.url);
const STORAGE_RULES_PATH = new URL("../../storage.rules", import.meta.url);
const FUNCTION_BASE = `http://${FUNCTIONS_HOST}:${FUNCTIONS_PORT}/${PROJECT_ID}/${REGION}/api`;

// ---------------------------------------------------------------------------------------------
// Synthetic fixtures. Two entirely separate organizations (never one org with two customers) so
// the cross-tenant checks below prove real tenant isolation, not just same-org customer scoping
// (which functions/src/firestore-rules.behavioral.test.ts and storage-rules.behavioral.test.ts
// already cover thoroughly within a single "acme" org).
// ---------------------------------------------------------------------------------------------
const ORG_ALPHA = "e2e-test-org-alpha";
const ORG_BETA = "e2e-test-org-beta";

const OWNER_ALPHA_UID = "e2e-owner-alpha", OWNER_ALPHA_EMAIL = "owner@e2e-test-org-alpha.example.com";
const STAFF_MEMBER_ALPHA_UID = "e2e-staff-member-alpha", STAFF_MEMBER_ALPHA_EMAIL = "staff@e2e-test-org-alpha.example.com";
const CLIENT_ALPHA_UID = "e2e-client-alpha", CLIENT_ALPHA_EMAIL = "client@e2e-test-customer-alpha.example.com";
const OWNER_BETA_UID = "e2e-owner-beta", OWNER_BETA_EMAIL = "owner@e2e-test-org-beta.example.com";
const CLIENT_BETA_UID = "e2e-client-beta", CLIENT_BETA_EMAIL = "client@e2e-test-customer-beta.example.com";
const CUSTOMER_BETA_ID = "e2e-test-customer-beta";

const CUSTOMER_ALPHA_BUSINESS_NAME = "E2E Test Customer Co";

// All 19 website content fields from packages/core/src/website-content.ts, split the same way the
// product's own defaults do: every field customer-editable except the two SEO/technical fields.
const CONTENT_FIELD_IDS = ["heroHeading", "heroSubheading", "heroBody", "heroImage", "ctaLabel", "ctaUrl", "aboutHeading", "aboutBody", "phone", "email", "address", "hours", "socialLinks", "services", "galleryImages", "videos", "testimonials", "faqItems"];
const PROTECTED_FIELD_IDS = ["seoTitle", "seoDescription"];
const contentPermissionFields = Object.fromEntries([...CONTENT_FIELD_IDS.map(id => [id, true]), ...PROTECTED_FIELD_IDS.map(id => [id, false])]);

const PNG_BYTES = new TextEncoder().encode("not-a-real-png-but-the-content-type-is-what-matters-for-rules");
const PDF_BYTES = new TextEncoder().encode("%PDF-1.4 not-a-real-pdf-but-the-content-type-is-what-matters-for-rules");

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

let adminAuth: import("firebase-admin/auth").Auth;
let adminDb: import("firebase-admin/firestore").Firestore;
let testEnv: RulesTestEnvironment;

async function createIdentity(uid: string, email: string) {
  try {
    await adminAuth.createUser({ uid, email, emailVerified: true });
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/uid-already-exists") throw error;
    await adminAuth.updateUser(uid, { email, emailVerified: true });
  }
}

/** Mints a REAL Firebase ID token via the Auth emulator's REST API - the only kind auth.ts's
 * `authenticate` middleware (`auth.verifyIdToken`) will accept. */
async function idTokenFor(uid: string): Promise<string> {
  const customToken = await adminAuth.createCustomToken(uid);
  const response = await fetch(`http://${AUTH_HOST}:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-e2e-fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Failed to mint an emulator ID token for ${uid}: ${JSON.stringify(data)}`);
  return data.idToken as string;
}

interface ApiResult { status: number; data: { data?: any; error?: { code: string; message: string } } }

async function apiCall(idToken: string | undefined, method: string, path: string, body?: unknown): Promise<ApiResult> {
  const response = await fetch(`${FUNCTION_BASE}${path}`, {
    method,
    headers: { ...(idToken ? { authorization: `Bearer ${idToken}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : {} };
}

function withQuery(path: string, params: Record<string, string>) {
  return `${path}?${new URLSearchParams(params).toString()}`;
}

/** Endpoints that only call WorkflowEngine.emit() (not .process()) rely on the async
 * processWorkflowEvent Firestore trigger to actually apply the stage transition - unlike
 * onboarding-journey-api.ts's payment-confirmed endpoint, which drives the engine synchronously.
 * Polls a read until it matches, rather than asserting immediately after such a call. */
async function waitFor<T>(read: () => Promise<T>, matches: (value: T) => boolean, timeoutMs = 10_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await read();
    if (matches(value)) return value;
    if (Date.now() - start > timeoutMs) throw new Error("waitFor: condition was not met within the timeout");
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

// ---------------------------------------------------------------------------------------------
// Shared state threaded through the sequential lifecycle stages below.
// ---------------------------------------------------------------------------------------------
const state: {
  ownerAlphaToken?: string; staffMemberAlphaToken?: string; clientAlphaToken?: string;
  ownerBetaToken?: string; clientBetaToken?: string;
  leadId?: string; projectId?: string; customerId?: string;
  websiteId?: string;
  uploadedMediaPath?: string;
  version1RevisionId?: string; version1HeroHeading?: string;
} = {};

describe("Customer lifecycle (end-to-end, real Functions/Firestore/Auth/Storage emulators)", () => {
  beforeAll(async () => {
    const { getApps, initializeApp } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    const { getFirestore } = await import("firebase-admin/firestore");
    const app = getApps().find(candidate => candidate.name === "e2e-admin") ?? initializeApp({ projectId: PROJECT_ID }, "e2e-admin");
    adminAuth = getAuth(app);
    adminDb = getFirestore(app);

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: readFileSync(FIRESTORE_RULES_PATH, "utf8"), host: FIRESTORE_HOST, port: FIRESTORE_PORT },
      storage: { rules: readFileSync(STORAGE_RULES_PATH, "utf8"), host: STORAGE_HOST, port: STORAGE_PORT },
    });

    // Real Auth-emulator identities for every actor that will call the HTTP API.
    await Promise.all([
      createIdentity(OWNER_ALPHA_UID, OWNER_ALPHA_EMAIL),
      createIdentity(STAFF_MEMBER_ALPHA_UID, STAFF_MEMBER_ALPHA_EMAIL),
      createIdentity(CLIENT_ALPHA_UID, CLIENT_ALPHA_EMAIL),
      createIdentity(OWNER_BETA_UID, OWNER_BETA_EMAIL),
      createIdentity(CLIENT_BETA_UID, CLIENT_BETA_EMAIL),
    ]);
    [state.ownerAlphaToken, state.staffMemberAlphaToken, state.clientAlphaToken, state.ownerBetaToken, state.clientBetaToken] = await Promise.all([
      idTokenFor(OWNER_ALPHA_UID), idTokenFor(STAFF_MEMBER_ALPHA_UID), idTokenFor(CLIENT_ALPHA_UID), idTokenFor(OWNER_BETA_UID), idTokenFor(CLIENT_BETA_UID),
    ]);

    // Bootstrap staff org membership directly via the Admin SDK (bypasses rules, exactly like the
    // Admin SDK already does inside the app itself) - this is out of scope for the lifecycle under
    // test, which starts from an already-onboarded staff org, the same way the existing golden
    // rehearsal scripts assume an already-provisioned owner account rather than testing account
    // provisioning itself.
    const now = new Date().toISOString();
    await Promise.all([
      adminDb.doc(`organizations/${ORG_ALPHA}`).set({ id: ORG_ALPHA, name: "E2E Test Org Alpha", createdAt: now }),
      adminDb.doc(`organizations/${ORG_ALPHA}/members/${OWNER_ALPHA_UID}`).set({ uid: OWNER_ALPHA_UID, email: OWNER_ALPHA_EMAIL, role: "owner", disabled: false, createdAt: now }),
      adminDb.doc(`organizations/${ORG_ALPHA}/members/${STAFF_MEMBER_ALPHA_UID}`).set({ uid: STAFF_MEMBER_ALPHA_UID, email: STAFF_MEMBER_ALPHA_EMAIL, role: "member", disabled: false, createdAt: now }),
      adminDb.doc(`organizations/${ORG_BETA}`).set({ id: ORG_BETA, name: "E2E Test Org Beta", createdAt: now }),
      adminDb.doc(`organizations/${ORG_BETA}/members/${OWNER_BETA_UID}`).set({ uid: OWNER_BETA_UID, email: OWNER_BETA_EMAIL, role: "owner", disabled: false, createdAt: now }),
      adminDb.doc(`organizations/${ORG_BETA}/customers/${CUSTOMER_BETA_ID}`).set({ id: CUSTOMER_BETA_ID, businessName: "E2E Test Customer Beta Co", status: "onboarding", createdAt: now }),
      adminDb.doc(`organizations/${ORG_BETA}/members/${CLIENT_BETA_UID}`).set({ uid: CLIENT_BETA_UID, email: CLIENT_BETA_EMAIL, role: "client", customerId: CUSTOMER_BETA_ID, projectIds: [], permissions: { contentEdit: true, support: true, comments: true, assets: true }, disabled: false, createdAt: now }),
    ]);
  }, 60_000);

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  // ===== 1-3: lead creation, customer creation, project creation ("deal closed") =====
  it("1-3. creates a lead, then closes it into a customer + production project in one CEO action", async () => {
    const lead = await apiCall(state.ownerAlphaToken, "POST", "/api/leads", {
      organizationId: ORG_ALPHA, name: "E2E Test Prospect", company: "E2E Test Prospect Co", email: "prospect@e2e-test-prospect.example.com", value: 6500,
    });
    expect(lead.status).toBe(201);
    state.leadId = lead.data.data!.id;

    const closed = await apiCall(state.ownerAlphaToken, "POST", "/api/projects", {
      organizationId: ORG_ALPHA, leadId: state.leadId, name: "E2E Test Website Project", clientName: CUSTOMER_ALPHA_BUSINESS_NAME, locale: "en", budget: 6500,
      dealEvidence: "Synthetic e2e-test evidence: fictional phone close recorded by the automated lifecycle test harness, no real customer involved.",
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(closed.status).toBe(201);
    state.projectId = closed.data.data!.id;
    state.customerId = closed.data.data!.customerId;

    const [leadDoc, customerDoc, projectDoc] = await Promise.all([
      adminDb.doc(`organizations/${ORG_ALPHA}/leads/${state.leadId}`).get(),
      adminDb.doc(`organizations/${ORG_ALPHA}/customers/${state.customerId}`).get(),
      adminDb.doc(`organizations/${ORG_ALPHA}/projects/${state.projectId}`).get(),
    ]);
    expect(leadDoc.data()?.status).toBe("won");
    expect(customerDoc.data()?.status).toBe("onboarding");
    expect(customerDoc.data()?.businessName).toBe(CUSTOMER_ALPHA_BUSINESS_NAME);
    expect(projectDoc.data()?.journeyStage).toBe("deal_closed");
  });

  // ===== 4: proposal =====
  it("4. generates a closing proposal for the customer", async () => {
    const proposal = await apiCall(state.ownerAlphaToken, "POST", `/api/customers/${state.customerId}/closing/proposals`, {
      organizationId: ORG_ALPHA, customer: CUSTOMER_ALPHA_BUSINESS_NAME, business: CUSTOMER_ALPHA_BUSINESS_NAME, packageId: "launch",
      challenge: "Synthetic e2e test challenge: needs a simple, credible five-page website.",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      startAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(proposal.status).toBe(201);
    expect(proposal.data.data!.proposal.status).toBe("draft");
    expect(proposal.data.data!.payments.map((payment: { id: string }) => payment.id).sort()).toEqual(["balance", "deposit"]);
  });

  // ===== 5: contract =====
  it("5. accepts the digital contract with a matching typed signature", async () => {
    const signed = await apiCall(state.ownerAlphaToken, "POST", `/api/customers/${state.customerId}/closing/sign`, {
      organizationId: ORG_ALPHA, typedSignature: CUSTOMER_ALPHA_BUSINESS_NAME,
    });
    expect(signed.status).toBe(201);
    expect(signed.data.data!.contract.acceptedTerms).not.toBe(false);
    expect(signed.data.data!.checklist.find((item: { id: string }) => item.id === "contract").complete).toBe(true);
  });

  // ===== 6: payment state (manual confirmation ONLY - no auto-advance, no Stripe) =====
  it("6. records the deposit payment as paid via the existing manual confirmation endpoint (no Stripe call, no auto-advance)", async () => {
    const paid = await apiCall(state.ownerAlphaToken, "POST", `/api/customers/${state.customerId}/closing/payments/deposit/paid`, { organizationId: ORG_ALPHA });
    expect(paid.status).toBe(201);
    const deposit = paid.data.data!.payments.find((payment: { id: string }) => payment.id === "deposit");
    expect(deposit.status).toBe("paid");
    // The manual-confirmation design also auto-checks the "deposit" onboarding checklist item as a
    // side effect of this same endpoint - but nothing here advances project/journey status, which
    // is exactly the manual-only boundary Isaac decided to keep (see closing-api.ts).
    expect(paid.data.data!.checklist.find((item: { id: string }) => item.id === "deposit").complete).toBe(true);
  });

  // ===== 7: onboarding =====
  it("7. completes an onboarding checklist item", async () => {
    const kickoff = await apiCall(state.ownerAlphaToken, "PATCH", `/api/customers/${state.customerId}/closing/checklist/kickoff`, { organizationId: ORG_ALPHA, complete: true });
    expect(kickoff.status).toBe(200);
    expect(kickoff.data.data).toEqual({ id: "kickoff", complete: true });
  });

  // ===== 7a: PAYMENT CONFIRMED — the new, dedicated, Owner-only endpoint (mission section 1). =====
  // Advances the workflow through the new payment_confirmed stage into "questionnaire" and
  // initializes Business Discovery (NOT the legacy Website Brief — see the product decision recorded
  // in onboarding-journey-api.ts and docs/customer-discovery-onboarding/PRD.md §37), all in one
  // manual Owner action - no Stripe call, no scheduler.
  it("7a. Owner confirms payment via the dedicated payment-confirmed endpoint, which records payment state and initializes Business Discovery (not the legacy Website Brief)", async () => {
    const confirmed = await apiCall(state.ownerAlphaToken, "POST", `/api/projects/${state.projectId}/payment-confirmed`, {
      organizationId: ORG_ALPHA, paymentReference: "e2e-test-payment-ref-001",
      evidence: "Synthetic e2e-test evidence: payment confirmed by the owner, no real Stripe call.",
    });
    expect(confirmed.status).toBe(202);

    const [customerDoc, projectDoc] = await Promise.all([
      adminDb.doc(`organizations/${ORG_ALPHA}/customers/${state.customerId}`).get(),
      adminDb.doc(`organizations/${ORG_ALPHA}/projects/${state.projectId}`).get(),
    ]);
    // Security property: a payment reference is recorded, but never card details.
    expect(customerDoc.data()?.paymentStatus).toBe("paid");
    expect(customerDoc.data()?.paymentReference).toBe("e2e-test-payment-ref-001");
    expect(Object.keys(customerDoc.data() ?? {}).some(key => /card/i.test(key))).toBe(false);
    expect(projectDoc.data()?.workflowStage).toBe("questionnaire");

    // Business Discovery is initialized — NOT a Website Brief questionnaire document. This is the
    // one behavioral difference from the pre-Discovery flow: no questionnaires/{id} doc is created
    // here at all any more.
    const discoveryProgressDoc = await adminDb.doc(`organizations/${ORG_ALPHA}/projects/${state.projectId}/discoveryProgress/current`).get();
    expect(discoveryProgressDoc.data()?.status).toBe("not_started");
    expect(discoveryProgressDoc.data()?.completedSectionIds).toEqual([]);
    const questionnairesSnap = await adminDb.collection(`organizations/${ORG_ALPHA}/projects/${state.projectId}/questionnaires`).get();
    expect(questionnairesSnap.empty).toBe(true);

    // Idempotent: confirming payment again for the same project is a no-op, not a duplicate advance.
    const again = await apiCall(state.ownerAlphaToken, "POST", `/api/projects/${state.projectId}/payment-confirmed`, {
      organizationId: ORG_ALPHA, paymentReference: "e2e-test-payment-ref-001", evidence: "Second call, should be a no-op.",
    });
    expect(again.status).toBe(200);
    expect(again.data.data!.alreadyConfirmed).toBe(true);
  });

  // ===== 8: website creation + 9: draft creation =====
  it("8-9. configures website content permissions, which creates the website and its default draft", async () => {
    const config = await apiCall(state.ownerAlphaToken, "PUT", `/api/projects/${state.projectId}/website-content/config`, {
      organizationId: ORG_ALPHA, publishMode: "approval", showPrices: false, fields: contentPermissionFields,
    });
    expect(config.status).toBe(200);
    expect(config.data.data!.configured).toBe(true);
    state.websiteId = config.data.data!.websiteId;

    const draftDoc = await adminDb.doc(`organizations/${ORG_ALPHA}/websites/${state.websiteId}/content/draft`).get();
    expect(draftDoc.exists).toBe(true);
    expect(draftDoc.data()?.status).toBe("draft");
    expect(draftDoc.data()?.values.heroHeading).toBe(""); // default value - nobody has edited it yet
  });

  // ===== 10: customer portal access =====
  it("10. invites the customer and grants portal access once they authenticate", async () => {
    const invite = await apiCall(state.ownerAlphaToken, "POST", `/api/customers/${state.customerId}/invitations`, { organizationId: ORG_ALPHA, email: CLIENT_ALPHA_EMAIL });
    expect(invite.status).toBe(201);

    // GET /api/me is the endpoint that claims a pending invitation into a real membership doc
    // (see customer-invitations.ts's claimCustomerInvitations, mounted at "/api/me" in api.ts).
    const me = await apiCall(state.clientAlphaToken, "GET", "/api/me");
    expect(me.status).toBe(200);
    const membership = me.data.data!.organizations.find((org: { id: string }) => org.id === ORG_ALPHA);
    expect(membership?.role).toBe("client");
    expect(membership?.customerId).toBe(state.customerId);

    // The claimed membership actually grants portal access to the customer's own project.
    const portal = await apiCall(state.clientAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/website-content`, { organizationId: ORG_ALPHA }));
    expect(portal.status).toBe(200);
    expect(portal.data.data!.configured).toBe(true);
  });

  // ===== 10b: BUSINESS DISCOVERY — the customer works through all 9 stages, section by section, =====
  // ===== then submits, which advances the workflow into materials collection. =====
  // Requires the project to already be in "questionnaire" stage (set by 7a above). This is the
  // interactive-equivalent QA pass requested for pre-merge review: real Hebrew answers (long and
  // short), both boolean states across the run (branding.hasLogo=true here, presence.hasWebsite=
  // false here, trust.hasTestimonials flips false→true in test 10d below), real Storage-emulator
  // uploads (image + PDF, single and multi-file), a simulated "refresh mid-stage" (re-fetch before
  // completing a section, proving autosave persisted), and a simulated "leave and return" (re-fetch
  // partway through, proving the resume point is exactly right).
  it("10b. Customer completes Business Discovery section by section with realistic Hebrew answers and real file uploads, then submits, which advances the workflow into materials collection", async () => {
    // A hardcoded, explicit map (not derived from the template) so that a future required-question
    // added to discovery-template.ts without updating this test fails loudly here (a 422 from
    // /complete or /submit) rather than silently passing with a stale answer set.
    expect([...discoverySectionOrder]).toEqual(["business", "customers", "services", "differentiation", "trust", "branding", "materials", "presence", "goals"]);

    const clientStorage = testEnv.authenticatedContext(CLIENT_ALPHA_UID).storage();
    async function uploadDiscoveryFile(sectionId: string, fieldId: string, fileName: string, bytes: Uint8Array, contentType: string, itemIndex = 0) {
      const path = `organizations/${ORG_ALPHA}/discovery/${state.projectId}/${sectionId}/${fieldId}/${CLIENT_ALPHA_UID}/${itemIndex}-${fileName}`;
      await assertSucceeds(uploadBytes(ref(clientStorage, path), bytes, { contentType }));
      // A real, retrievable download URL — not just a successful write — is what the customer's
      // browser needs to render an image preview (see useFileUpload.ts).
      const url = await getDownloadURL(ref(clientStorage, path));
      expect(url).toContain("http");
      return { path, fileName, uploadedAt: new Date().toISOString(), sizeBytes: bytes.byteLength, source: "customer" as const };
    }

    const responsesBySection: Record<string, Record<string, unknown>> = {
      business: {
        "business.publicName": "מספרת שלום", // short Hebrew
        "business.whatItDoes": "מספרה בוטיק לגברים ונשים במרכז תל אביב, עם דגש על שירות אישי, זמינות גבוהה ותשומת לב לפרטים הקטנים שהופכים תספורת טובה לתספורת מעולה.", // long Hebrew
        "business.customerFeeling": "שירגישו בבית ושיצאו עם תספורת שהם גאים בה.",
      },
      customers: {
        "customers.idealCustomer": "אנשים עסוקים שמחפשים תוצאה מקצועית בלי להתפשר על זמן, בדרך כלל בגילאי 25-45.",
        "customers.beforeContact": "מחפשים המלצה מחבר או רואים ביקורות טובות ברשת.",
        "customers.realProblem": "קשה למצוא ספר טוב שגם זמין וגם אמין לאורך זמן.",
        "customers.desiredOutcome": "תספורת שמחזיקה מעמד ומרגישה שהם השקיעו בעצמם.",
      },
      services: { "services.list": [
        { name: "תספורת גברים", forWhom: "גברים", problem: "תספורת לא מדויקת", outcome: "מראה מסודר ומטופח", priceLabel: "₪80-120", promote: true },
        { name: "עיצוב זקן", promote: false },
      ] }, // multiple services
      differentiation: {
        "differentiation.whyCustomersChoseYou": "אנחנו תמיד עומדים בזמנים ומקשיבים בדיוק למה שהלקוח רוצה, לא משנה כמה עמוסים אנחנו.",
        "differentiation.processAdvantages": ["availability", "personal_service"],
      },
      trust: { "trust.hasTestimonials": false }, // boolean "No" — flipped to "Yes" with a real testimonial in test 10d
      branding: {
        "branding.hasLogo": true, // boolean "Yes" (presence section below covers "No" for its own booleans)
        "branding.colors": ["#111111", "#b8860b"],
        "branding.style": ["premium", "warm_friendly"],
        "branding.avoid": "בלי צבעים זוהרים מדי, רוצים להישאר קלאסיים.",
      },
      materials: {}, // filled with real uploads below (multiple images + a PDF)
      presence: {
        "presence.phone": "0501234567",
        "presence.whatsapp": "0501234567",
        "presence.email": "hello@shalom-barber.example",
        "presence.address": { line1: "רחוב דיזנגוף 100", city: "תל אביב", serviceAreas: ["תל אביב", "רמת גן"] },
        "presence.hours": "א'-ה' 9:00-20:00, ו' 9:00-14:00",
        "presence.hasWebsite": false, // boolean "No" — existing-website URL correctly stays optional/hidden
        "presence.hasDomain": false,
      },
      goals: {
        "goals.biggestProblem": "אנשים לא מוצאים אותנו בגוגל ומפספסים אותנו לטובת מתחרים עם נוכחות דיגיטלית חזקה יותר.",
        "goals.sixMonthSuccess": "יומן מלא כל שבוע מלקוחות חדשים שמצאו אותנו בחיפוש.",
        "goals.priorityOutcomes": ["more_inquiries", "better_google_visibility"],
        "goals.capacityCheck": "כן, יש לנו שני ספרים נוספים שיכולים לקלוט עומס נוסף.",
      },
    };

    for (const [index, sectionId] of discoverySectionOrder.entries()) {
      if (sectionId === "branding") {
        responsesBySection.branding!["branding.logo"] = [await uploadDiscoveryFile("branding", "branding.logo", "logo.png", PNG_BYTES, "image/png")];
      }
      if (sectionId === "materials") {
        // Multiple relevant assets in one repeater, plus a second field type (PDF), in one section.
        responsesBySection.materials!["materials.ownerPhotos"] = [
          await uploadDiscoveryFile("materials", "materials.ownerPhotos", "owner-1.png", PNG_BYTES, "image/png", 0),
          await uploadDiscoveryFile("materials", "materials.ownerPhotos", "owner-2.png", PNG_BYTES, "image/png", 1),
        ];
        responsesBySection.materials!["materials.priceListOrBrochure"] = [await uploadDiscoveryFile("materials", "materials.priceListOrBrochure", "pricelist.pdf", PDF_BYTES, "application/pdf")];
      }

      const saved = await apiCall(state.clientAlphaToken, "PATCH", `/api/projects/${state.projectId}/discovery/sections/${sectionId}`, {
        organizationId: ORG_ALPHA, responses: responsesBySection[sectionId],
      });
      expect(saved.status, `save ${sectionId}`).toBe(200);

      // "Refresh mid-stage": before marking this section complete, re-fetch Discovery state from
      // scratch — exactly what a browser reload would do — and confirm the just-autosaved (not yet
      // completed) answers are exactly what's already persisted server-side, proving autosave
      // survives a refresh rather than only living in component state.
      const midStageReload = await apiCall(state.clientAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/discovery`, { organizationId: ORG_ALPHA }));
      expect(midStageReload.status).toBe(200);
      expect(midStageReload.data.data!.sections[sectionId]?.status).toBe("draft");
      for (const [key, value] of Object.entries(responsesBySection[sectionId]!)) {
        expect(midStageReload.data.data!.sections[sectionId]?.responses?.[key], `${sectionId}.${key} after refresh`).toEqual(value);
      }

      const completedSection = await apiCall(state.clientAlphaToken, "POST", `/api/projects/${state.projectId}/discovery/sections/${sectionId}/complete`, { organizationId: ORG_ALPHA });
      expect(completedSection.status, `complete ${sectionId}: ${JSON.stringify(completedSection.data)}`).toBe(200);

      // "Leave and return": after the 3rd section, re-fetch and confirm the resume point (current
      // section, completed list, percent) is exactly what the dashboard task card and /discovery
      // page would compute for a customer who closed the tab and came back later.
      if (index === 2) {
        const resumeCheck = await apiCall(state.clientAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/discovery`, { organizationId: ORG_ALPHA }));
        expect(resumeCheck.data.data!.progress.completedSectionIds).toEqual(["business", "customers", "services"]);
        expect(resumeCheck.data.data!.progress.currentSectionId).toBe("services");
        expect(resumeCheck.data.data!.progress.percentComplete).toBe(Math.round((3 / 9) * 100));
      }
    }

    const progressDoc = await adminDb.doc(`organizations/${ORG_ALPHA}/projects/${state.projectId}/discoveryProgress/current`).get();
    expect(progressDoc.data()?.percentComplete).toBe(100);

    const submitted = await apiCall(state.clientAlphaToken, "POST", `/api/projects/${state.projectId}/discovery/submit`, { organizationId: ORG_ALPHA });
    expect(submitted.status, JSON.stringify(submitted.data)).toBe(202);
    // Unlike the Website Brief's completion, /discovery/submit calls engine.process() synchronously
    // (see discovery-api.ts), so the transition is already applied by the time this call returns -
    // no polling needed, though waitFor is still a correct (just redundant) safety net here.
    const projectDoc = await waitFor(
      () => adminDb.doc(`organizations/${ORG_ALPHA}/projects/${state.projectId}`).get(),
      snap => snap.data()?.workflowStage === "assets",
    );
    expect(projectDoc.data()?.workflowStage).toBe("assets");

    // Idempotent: submitting an already-submitted Discovery is a no-op, not a duplicate advance.
    const again = await apiCall(state.clientAlphaToken, "POST", `/api/projects/${state.projectId}/discovery/submit`, { organizationId: ORG_ALPHA });
    expect(again.status).toBe(200);
    expect(again.data.data!.alreadySubmitted).toBe(true);
  }, 20_000);

  // ===== 10c: internal Discovery notes are staff-only — never visible to the customer, at either =====
  // the API or the Firestore-rules layer, matching the platform-wide "customer must never see
  // internal notes" guarantee (SECURITY.md §3.3).
  it("10c. Owner adds an internal Discovery note; the customer can neither read it via the API nor via a direct Firestore rules read", async () => {
    const note = await apiCall(state.ownerAlphaToken, "POST", `/api/projects/${state.projectId}/discovery/notes`, {
      organizationId: ORG_ALPHA, sectionId: "trust", body: "Internal-only: the customer's first testimonial reads a little generic — worth asking for a second, more specific one before launch.",
    });
    expect(note.status).toBe(201);
    const noteId = note.data.data!.id as string;

    // Denied as the customer, via the API...
    const deniedApi = await apiCall(state.clientAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/discovery/notes`, { organizationId: ORG_ALPHA }));
    expect(deniedApi.status).toBe(403);
    // ...and denied directly at the Firestore rules layer, independent of the API.
    const clientFirestore = testEnv.authenticatedContext(CLIENT_ALPHA_UID).firestore();
    await assertFails(getDoc(doc(clientFirestore, `organizations/${ORG_ALPHA}/projects/${state.projectId}/discoveryNotes/${noteId}`)));

    // Positive control: staff can read it.
    const asStaff = await apiCall(state.ownerAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/discovery/notes`, { organizationId: ORG_ALPHA }));
    expect(asStaff.status).toBe(200);
    expect(asStaff.data.data!.some((n: { id: string }) => n.id === noteId)).toBe(true);
  });

  // ===== 10d: staff reopens a section — the customer sees exactly what's requested, updates it =====
  // ===== (flipping a boolean "No" to "Yes" with real new content), and resubmits. =====
  it("10d. Owner reopens the Trust section with a reason; the customer's prior answer is preserved on reopen, then updates it (flips hasTestimonials false→true with a real testimonial) and resubmits — unrelated project data is untouched throughout", async () => {
    const reopened = await apiCall(state.ownerAlphaToken, "POST", `/api/projects/${state.projectId}/discovery/sections/trust/reopen`, {
      organizationId: ORG_ALPHA, reason: "לפני שממשיכים, נשמח אם תוכלו לשתף לפחות המלצה אחת מלקוח מרוצה — זה יעזור מאוד לבניית אמון באתר.",
    });
    expect(reopened.status).toBe(200);

    const sectionDoc = await adminDb.doc(`organizations/${ORG_ALPHA}/projects/${state.projectId}/discovery/trust`).get();
    expect(sectionDoc.data()?.status).toBe("draft");
    expect(sectionDoc.data()?.responses["trust.hasTestimonials"]).toBe(false); // preserved on reopen, not cleared

    // A client cannot reopen a section themselves (staff-only action) — and the customer sees
    // exactly what's requested via the reopened section's own reopenReason field.
    const deniedClientReopen = await apiCall(state.clientAlphaToken, "POST", `/api/projects/${state.projectId}/discovery/sections/trust/reopen`, {
      organizationId: ORG_ALPHA, reason: "Attempting to self-approve.",
    });
    expect(deniedClientReopen.status).toBe(403);
    const beforeUpdate = await apiCall(state.clientAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/discovery`, { organizationId: ORG_ALPHA }));
    expect(beforeUpdate.data.data!.sections.trust.reopenReason).toContain("המלצה אחת מלקוח מרוצה");

    // The customer updates the flagged answer — autosaves, then completes.
    const updated = await apiCall(state.clientAlphaToken, "PATCH", `/api/projects/${state.projectId}/discovery/sections/trust`, {
      organizationId: ORG_ALPHA, responses: { "trust.hasTestimonials": true, "trust.testimonials": [{ text: "השירות הכי טוב שקיבלתי אי פעם — מקצועי, מדויק ותמיד בזמן.", author: "דני כהן" }] },
    });
    expect(updated.status).toBe(200);
    const recompleted = await apiCall(state.clientAlphaToken, "POST", `/api/projects/${state.projectId}/discovery/sections/trust/complete`, { organizationId: ORG_ALPHA });
    expect(recompleted.status, JSON.stringify(recompleted.data)).toBe(200);

    // Previous, unrelated project data (a completely different section, answered back in 10b) must
    // not be accidentally disturbed by this reopen/update cycle.
    const businessDoc = await adminDb.doc(`organizations/${ORG_ALPHA}/projects/${state.projectId}/discovery/business`).get();
    expect(businessDoc.data()?.responses["business.publicName"]).toBe("מספרת שלום");

    const resubmitted = await apiCall(state.clientAlphaToken, "POST", `/api/projects/${state.projectId}/discovery/submit`, { organizationId: ORG_ALPHA });
    expect(resubmitted.status).toBe(202);

    // Owner sees the customer's response to the request — the same discovery_submitted signal
    // fires again on resubmission, correctly surfacing "customer responded" (PRD.md §15).
    const finalRead = await apiCall(state.ownerAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/discovery`, { organizationId: ORG_ALPHA }));
    expect(finalRead.data.data!.progress.status).toBe("submitted");
    expect(finalRead.data.data!.sections.trust.responses["trust.hasTestimonials"]).toBe(true);
  });

  // ===== 10e: disabling then re-enabling the customer's portal access via the REAL admin endpoint =====
  // ===== (not a rules-layer bypass) preserves every byte of Discovery data. =====
  it("10e. Disabling then re-enabling the customer's portal access (the real admin endpoint) does not lose any Discovery data", async () => {
    const disable = await apiCall(state.ownerAlphaToken, "PATCH", `/api/admin/customers/${state.customerId}/portal-users/${CLIENT_ALPHA_UID}`, { organizationId: ORG_ALPHA, disabled: true });
    expect(disable.status).toBe(200);

    // Denied via the real API while disabled — not just a Firestore-rules-layer check.
    const deniedWhileDisabled = await apiCall(state.clientAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/discovery`, { organizationId: ORG_ALPHA }));
    expect(deniedWhileDisabled.status).toBe(403);

    // Staff confirms the data is completely untouched while the customer is disabled.
    const whileDisabled = await apiCall(state.ownerAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/discovery`, { organizationId: ORG_ALPHA }));
    expect(whileDisabled.data.data!.sections.business.responses["business.publicName"]).toBe("מספרת שלום");
    expect(whileDisabled.data.data!.progress.percentComplete).toBe(100);

    const reEnable = await apiCall(state.ownerAlphaToken, "PATCH", `/api/admin/customers/${state.customerId}/portal-users/${CLIENT_ALPHA_UID}`, { organizationId: ORG_ALPHA, disabled: false });
    expect(reEnable.status).toBe(200);

    // The customer regains access to the EXACT same data, unmodified — nothing was lost or migrated.
    const restored = await apiCall(state.clientAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/discovery`, { organizationId: ORG_ALPHA }));
    expect(restored.status).toBe(200);
    expect(restored.data.data!.sections.business.responses["business.publicName"]).toBe("מספרת שלום");
    expect(restored.data.data!.sections.trust.responses["trust.hasTestimonials"]).toBe(true);
    expect(restored.data.data!.progress.percentComplete).toBe(100);
  });

  // ===== 11: media upload =====
  it("11. uploads customer website media under the customer/project/website storage boundary", async () => {
    const path = `organizations/${ORG_ALPHA}/website-media/${state.customerId}/${state.projectId}/${state.websiteId}/${CLIENT_ALPHA_UID}/hero.png`;
    const clientStorage = testEnv.authenticatedContext(CLIENT_ALPHA_UID).storage();
    await assertSucceeds(uploadBytes(ref(clientStorage, path), PNG_BYTES, { contentType: "image/png" }));
    state.uploadedMediaPath = path;
  });

  // ===== 12: a permitted content edit (+ protected-field enforcement) =====
  it("12. lets the customer edit a customer-editable field (including the uploaded media) but blocks a protected field", async () => {
    state.version1HeroHeading = `Welcome to ${CUSTOMER_ALPHA_BUSINESS_NAME}`;
    const edit = await apiCall(state.clientAlphaToken, "PUT", `/api/projects/${state.projectId}/website-content/draft`, {
      organizationId: ORG_ALPHA, values: { heroHeading: state.version1HeroHeading, heroImage: state.uploadedMediaPath },
    });
    expect(edit.status).toBe(200);
    expect(edit.data.data!.draft.heroHeading).toBe(state.version1HeroHeading);

    // Security property: protected fields remain protected - a customer cannot write an
    // owner/staff-only field (seoTitle is customerEditableDefault: false in packages/core).
    const blocked = await apiCall(state.clientAlphaToken, "PUT", `/api/projects/${state.projectId}/website-content/draft`, {
      organizationId: ORG_ALPHA, values: { seoTitle: "hacked seo title" },
    });
    expect(blocked.status).toBe(403);
    expect(blocked.data.error?.code).toBe("PROTECTED_CONTENT_FIELD");

    // And it isn't just write-protected: the customer's own read of website content never
    // includes a protected field at all (see website-content-api.ts's scopeValues()).
    const portalView = await apiCall(state.clientAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/website-content`, { organizationId: ORG_ALPHA }));
    expect(portalView.data.data!.fields.some((field: { id: string }) => field.id === "seoTitle")).toBe(false);
    expect(Object.keys(portalView.data.data!.draft)).not.toContain("seoTitle");
  });

  // ===== 13: submission =====
  it("13. submits the edited content for PageLoom review", async () => {
    const submitted = await apiCall(state.clientAlphaToken, "POST", `/api/projects/${state.projectId}/website-content/submit`, { organizationId: ORG_ALPHA });
    expect(submitted.status).toBe(200);
    expect(submitted.data.data!.status).toBe("pending");
  });

  // ===== 14: Owner approval (publishes version 1 from the customer's submission) =====
  it("14. Owner approves the submission, which publishes version 1 with the customer's submitted content", async () => {
    const decision = await apiCall(state.ownerAlphaToken, "POST", `/api/projects/${state.projectId}/website-content/decision`, { organizationId: ORG_ALPHA, decision: "approved" });
    expect(decision.status).toBe(200);
    expect(decision.data.data!.status).toBe("published");
    expect(decision.data.data!.version).toBe(1);
    state.version1RevisionId = decision.data.data!.revisionId;

    const published = await adminDb.doc(`organizations/${ORG_ALPHA}/websites/${state.websiteId}/content/published`).get();
    expect(published.data()?.values.heroHeading).toBe(state.version1HeroHeading);
  });

  // ===== 15: a revision, published directly (16: publish) =====
  it("15-16. Owner makes a further revision and publishes it directly as version 2 (staff bypasses customer approval mode)", async () => {
    const revisedHeading = "Revised: now booking for E2E Test Customer Co";
    const revise = await apiCall(state.ownerAlphaToken, "PUT", `/api/projects/${state.projectId}/website-content/draft`, {
      organizationId: ORG_ALPHA, values: { heroHeading: revisedHeading, seoTitle: "E2E Test Customer Co | Official Site" },
    });
    expect(revise.status).toBe(200); // staff can edit protected fields the client cannot

    const publish = await apiCall(state.ownerAlphaToken, "POST", `/api/projects/${state.projectId}/website-content/publish`, { organizationId: ORG_ALPHA });
    expect(publish.status).toBe(200);
    expect(publish.data.data!.version).toBe(2);

    const published = await adminDb.doc(`organizations/${ORG_ALPHA}/websites/${state.websiteId}/content/published`).get();
    expect(published.data()?.values.heroHeading).toBe(revisedHeading);
  });

  // ===== 17: rollback to a prior version - and prove it restores the PRIOR content, not the =====
  // ===== pre-rollback (version 2) content. =====
  it("17. rolls back to version 1's snapshot and restores version 1's ORIGINAL content, not version 2's", async () => {
    // Security property: only an Owner (or platform admin) may roll back - a plain staff "member"
    // role must be denied first, proving the boundary is actually enforced before the real owner
    // action below relies on it.
    const deniedRollback = await apiCall(state.staffMemberAlphaToken, "POST", `/api/projects/${state.projectId}/website-content/rollback`, {
      organizationId: ORG_ALPHA, revisionId: state.version1RevisionId,
    });
    expect(deniedRollback.status).toBe(403);

    const rollback = await apiCall(state.ownerAlphaToken, "POST", `/api/projects/${state.projectId}/website-content/rollback`, {
      organizationId: ORG_ALPHA, revisionId: state.version1RevisionId,
    });
    expect(rollback.status).toBe(200);
    expect(rollback.data.data!.version).toBe(3); // rollback always creates a NEW version...

    const published = await adminDb.doc(`organizations/${ORG_ALPHA}/websites/${state.websiteId}/content/published`).get();
    // ...but the CONTENT must be restored to version 1's, not left at version 2's pre-rollback text.
    expect(published.data()?.values.heroHeading).toBe(state.version1HeroHeading);
    expect(published.data()?.values.heroHeading).not.toBe("Revised: now booking for E2E Test Customer Co");
  });

  // ===== 18: support request =====
  it("18. lets the customer open a support request, scoped to their own project", async () => {
    const ticket = await apiCall(state.clientAlphaToken, "POST", `/api/projects/${state.projectId}/support-tickets`, {
      organizationId: ORG_ALPHA, subject: "E2E test support request", description: "Synthetic support ticket created by the automated end-to-end lifecycle test harness.", category: "other", priority: "normal",
    });
    expect(ticket.status).toBe(201);
    (state as { ticketId?: string }).ticketId = ticket.data.data!.id;
  });

  // ===== 6. REVISION REQUESTS — structured, recorded, resolvable (mission section 6). =====
  it("19. lets the customer submit a structured revision request, and the Owner resolve it", async () => {
    const created = await apiCall(state.clientAlphaToken, "POST", `/api/projects/${state.projectId}/revision-requests`, {
      organizationId: ORG_ALPHA, description: "Synthetic e2e test: please enlarge the hero call-to-action button.", area: "Homepage",
    });
    expect(created.status).toBe(201);
    expect(created.data.data!.status).toBe("open");
    const requestId = created.data.data!.id as string;

    // Security property: a different tenant's owner cannot resolve this org's revision request.
    const crossTenant = await apiCall(state.ownerBetaToken, "PATCH", `/api/projects/${state.projectId}/revision-requests/${requestId}/resolve`, { organizationId: ORG_ALPHA, resolutionNote: "hijacked" });
    expect(crossTenant.status).toBe(403);

    const resolved = await apiCall(state.ownerAlphaToken, "PATCH", `/api/projects/${state.projectId}/revision-requests/${requestId}/resolve`, {
      organizationId: ORG_ALPHA, resolutionNote: "Enlarged the button as requested.",
    });
    expect(resolved.status).toBe(200);
    expect(resolved.data.data!.status).toBe("resolved");
  });

  // ===== 7. PUBLISH — launch readiness checklist (mission section 7). =====
  it("20. lets staff load and complete the pre-launch checklist", async () => {
    const loaded = await apiCall(state.ownerAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/launch-checklist`, { organizationId: ORG_ALPHA }));
    expect(loaded.status).toBe(200);
    const items = loaded.data.data!.items as { id: string; required: boolean }[];
    expect(items.length).toBeGreaterThan(5);

    // Security property: the customer identity cannot read the launch checklist at all.
    const asClient = await apiCall(state.clientAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/launch-checklist`, { organizationId: ORG_ALPHA }));
    expect(asClient.status).toBe(403);

    for (const item of items) {
      const toggled = await apiCall(state.ownerAlphaToken, "PATCH", `/api/projects/${state.projectId}/launch-checklist/${item.id}`, { organizationId: ORG_ALPHA, complete: true });
      expect(toggled.status).toBe(200);
    }
  });

  // ===== 8. HANDOVER — recorded once at launch (mission section 8). =====
  it("21. records handover, which the customer can then read and which feeds the portal's live-site link", async () => {
    const recorded = await apiCall(state.ownerAlphaToken, "POST", `/api/projects/${state.projectId}/handover`, {
      organizationId: ORG_ALPHA,
      liveUrl: "https://e2e-test-customer-co.example.com",
      supportInstructions: "Open a support ticket from your portal for anything you need.",
      maintenanceInfo: "PageLoom monitors uptime and applies security updates automatically.",
      pageloomResponsibilities: "Hosting, uptime, and security updates.",
      customerResponsibilities: "Keeping your business information up to date.",
    });
    expect(recorded.status).toBe(201);

    const asClient = await apiCall(state.clientAlphaToken, "GET", withQuery(`/api/projects/${state.projectId}/handover`, { organizationId: ORG_ALPHA }));
    expect(asClient.status).toBe(200);
    expect(asClient.data.data!.liveUrl).toBe("https://e2e-test-customer-co.example.com");

    const projectDoc = await adminDb.doc(`organizations/${ORG_ALPHA}/projects/${state.projectId}`).get();
    expect(projectDoc.data()?.websiteUrl).toBe("https://e2e-test-customer-co.example.com");

    // Security property: a different tenant's client cannot read this project's handover.
    const crossTenant = await apiCall(state.clientBetaToken, "GET", withQuery(`/api/projects/${state.projectId}/handover`, { organizationId: ORG_ALPHA }));
    expect(crossTenant.status).toBe(403);
  });

  // ===== 22: WEBSITE BRIEF REGRESSION — the legacy generic questionnaire mechanism is untouched =====
  // and still fully usable by staff, even though it is no longer auto-created at payment time (see
  // 7a above, and onboarding-journey-api.ts's own comment on this product decision). Deliberately
  // run here, at the very end of the sequential lifecycle (the project is long past "questionnaire"
  // stage by now) so that this generic questionnaire's own QuestionnaireCompleted event — which the
  // real endpoint always emits — cannot interfere with the Discovery-driven stage transition that
  // steps 7a/10b already exercised and asserted on. A no-op event this late is exactly the correct,
  // safe outcome (see workflow-engine.md: an event that doesn't match the current stage is recorded
  // "ignored", never a duplicate advance), not a gap in this test's coverage.
  it("22. staff can still create and complete a generic (Website-Brief-shaped) questionnaire by hand — the legacy mechanism is preserved, just no longer auto-created for new projects", async () => {
    const created = await apiCall(state.ownerAlphaToken, "POST", `/api/projects/${state.projectId}/questionnaires`, {
      organizationId: ORG_ALPHA, title: "Ad-hoc staff questionnaire",
      fields: [{ id: "note", label: "Internal note", type: "short_text", required: true }],
    });
    expect(created.status).toBe(201);
    const questionnaireId = created.data.data!.id as string;
    expect(created.data.data!.version).toBe(1);

    // Security property: a client cannot create a generic questionnaire (staff-only), matching
    // api.ts's requireRole default (owner/admin/operator, no client).
    const deniedCreate = await apiCall(state.clientAlphaToken, "POST", `/api/projects/${state.projectId}/questionnaires`, {
      organizationId: ORG_ALPHA, title: "Attempted client-created questionnaire", fields: [{ id: "note", label: "Attempted field", type: "short_text", required: false }],
    });
    expect(deniedCreate.status, JSON.stringify(deniedCreate.data)).toBe(403);

    // But the client CAN complete it (requireProjectAccess includes client) — same as the Website
    // Brief always could.
    const completed = await apiCall(state.clientAlphaToken, "POST", `/api/projects/${state.projectId}/questionnaires/${questionnaireId}/complete`, {
      organizationId: ORG_ALPHA, responses: { note: "Synthetic e2e-test answer" }, filePaths: [],
    });
    expect(completed.status).toBe(202);

    const doc = await adminDb.doc(`organizations/${ORG_ALPHA}/projects/${state.projectId}/questionnaires/${questionnaireId}`).get();
    expect(doc.data()?.status).toBe("completed");
    expect(doc.data()?.kind).toBeUndefined(); // no "website_brief" kind tag — this is a genuinely generic, ad-hoc questionnaire, not the auto-created brief
  });

  // =================================================================================================
  // Security properties
  // =================================================================================================

  it("security: a customer identity cannot access the staff-only /master route (and gets a clear 401 with no token at all)", async () => {
    const noAuth = await apiCall(undefined, "GET", "/api/platform/master");
    expect(noAuth.status).toBe(401);

    const asClient = await apiCall(state.clientAlphaToken, "GET", "/api/platform/master");
    expect(asClient.status).toBe(403);
    expect(asClient.data.error?.code).toBe("PLATFORM_ADMIN_REQUIRED");
  });

  it("security: cross-tenant access is denied at the HTTP API layer (a different organization's owner cannot touch this org's data)", async () => {
    const crossOrgRead = await apiCall(state.ownerBetaToken, "GET", withQuery(`/api/admin/customers/${state.customerId}`, { organizationId: ORG_ALPHA }));
    expect(crossOrgRead.status).toBe(403);
    expect(crossOrgRead.data.error?.code).toBe("FORBIDDEN");

    const crossOrgWrite = await apiCall(state.clientBetaToken, "PUT", `/api/projects/${state.projectId}/website-content/draft`, {
      organizationId: ORG_ALPHA, values: { heroHeading: "hijacked by a different tenant" },
    });
    expect(crossOrgWrite.status).toBe(403);
  });

  it("security: cross-tenant access is denied directly at the Firestore/Storage rules layer, independent of the API", async () => {
    const betaFirestore = testEnv.authenticatedContext(CLIENT_BETA_UID).firestore();
    await assertFails(getDoc(doc(betaFirestore, `organizations/${ORG_ALPHA}/websites/${state.websiteId}/content/published`)));
    await assertFails(getDoc(doc(betaFirestore, `organizations/${ORG_ALPHA}/supportTickets/${(state as { ticketId?: string }).ticketId}`)));

    const betaStorage = testEnv.authenticatedContext(CLIENT_BETA_UID).storage();
    const hijackPath = `organizations/${ORG_ALPHA}/website-media/${state.customerId}/${state.projectId}/${state.websiteId}/${CLIENT_BETA_UID}/hack.png`;
    await assertFails(uploadBytes(ref(betaStorage, hijackPath), PNG_BYTES, { contentType: "image/png" }));

    // Positive control: the SAME documents remain readable by their own tenant's staff/client, so
    // the denials above are genuinely about tenant scoping, not a broken/over-restrictive rule.
    const ownAlphaOwner = testEnv.authenticatedContext(OWNER_ALPHA_UID).firestore();
    await assertSucceeds(getDoc(doc(ownAlphaOwner, `organizations/${ORG_ALPHA}/supportTickets/${(state as { ticketId?: string }).ticketId}`)));
    const ownAlphaClient = testEnv.authenticatedContext(CLIENT_ALPHA_UID).firestore();
    await assertSucceeds(getDoc(doc(ownAlphaClient, `organizations/${ORG_ALPHA}/supportTickets/${(state as { ticketId?: string }).ticketId}`)));
  });

  it("security: the Owner identity can do what only Owners can (already proven throughout: proposal, contract, approval, rollback all succeeded above as Owner and rollback was denied to a plain staff member)", async () => {
    // This is a summary assertion over state already established by the sequential stages above -
    // by this point in the suite, every Owner-gated action (closing/proposals, closing/sign,
    // website-content/decision, website-content/rollback) has already succeeded as OWNER_ALPHA, and
    // the immediately preceding rollback test already proved a non-owner staff "member" is denied
    // the same action. Re-fetching the published content here just re-confirms the end state is
    // exactly what the Owner-only rollback produced.
    const published = await adminDb.doc(`organizations/${ORG_ALPHA}/websites/${state.websiteId}/content/published`).get();
    expect(published.data()?.values.heroHeading).toBe(state.version1HeroHeading);
  });
});
