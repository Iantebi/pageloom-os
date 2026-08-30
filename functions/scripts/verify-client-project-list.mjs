// Read-only production verification for the exact `clientProjectList` behavior in firestore.rules
// (organizations/{orgId}/projects list/query rule): a client can list only their own assigned
// project(s), and cannot see another customer's projects. This exists because the equivalent
// behavioral test (functions/src/firestore-rules.behavioral.test.ts, "client project list-query
// safety" describe block) cannot currently run against the local Firestore emulator due to a
// confirmed, unresolved firebase-tools bug (https://github.com/firebase/firebase-tools/issues/6252)
// that double-evaluates list/query rules referencing resource.data and denies them on the first
// (throwaway) evaluation - this script verifies the SAME security boundary directly against real,
// deployed Firestore instead, where that emulator-only bug does not apply.
//
// Strictly read-only: it authenticates as an existing client account (via a freshly minted custom
// token - this does not alter that user's custom claims, membership doc, or any other data) and
// performs ONLY `getDocs()` reads through the client SDK, so every result reflects the real,
// deployed security rules being enforced by production Firestore. It never writes, never changes
// a role or claim, and never touches any collection other than reading `organizations/{orgId}/projects`
// and the caller's own membership doc.
//
// Usage: node scripts/verify-client-project-list.mjs --email=<existing-client-account-email>
//
// Requires Application Default Credentials for pageloom-os-production (the same credential this
// repo's other read/verification scripts use - GOOGLE_APPLICATION_CREDENTIALS or a already-run
// `gcloud auth application-default login`). Refuses to run against any other Firebase project.

import { readFileSync } from "node:fs";
import process from "node:process";
import { parse as parseEnv } from "dotenv";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp } from "firebase/app";
import { getAuth as getClientAuth, signInWithCustomToken } from "firebase/auth";
import { collection, getDocs, getFirestore as getClientFirestore } from "firebase/firestore";

const args = new Map(process.argv.slice(2).map(value => { const [key, ...rest] = value.split("="); return [key, rest.join("=") || true]; }));
const email = String(args.get("--email") ?? "").trim().toLowerCase();
if (!email) throw new Error("Usage: node scripts/verify-client-project-list.mjs --email=<existing-client-account-email>");

const project = JSON.parse(readFileSync(new URL("../../.firebaserc", import.meta.url), "utf8")).projects?.default;
if (project !== "pageloom-os-production") throw new Error(`Refusing to run against unexpected Firebase project: ${project || "unknown"}`);

if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: project });
const adminAuth = getAdminAuth(), adminDb = getAdminFirestore();

const user = await adminAuth.getUserByEmail(email);

// Read-only: find which organization this account belongs to and its membership doc (role,
// customerId, optional projectIds allow-list). Bypasses rules only because this is the Admin SDK
// establishing TEST ORACLE knowledge (what the correct answer should be) - it asserts nothing by
// itself; the actual security verification happens below through the client SDK.
const orgRefs = await adminDb.collection("organizations").listDocuments();
let orgId, orgDocRef, membership;
for (const ref of orgRefs) {
  const memberSnap = await ref.collection("members").doc(user.uid).get();
  if (memberSnap.exists) { orgId = ref.id; orgDocRef = ref; membership = memberSnap.data(); break; }
}
if (!orgId) throw new Error(`No organization membership found for ${email} (uid ${user.uid}) - cannot verify`);
if (membership.role !== "client") throw new Error(`${email} has role "${membership.role}", not "client" - pick a genuine client test account`);
if (membership.disabled === true) throw new Error(`${email} is disabled - pick an active client test account`);

const customerId = membership.customerId;
if (!customerId) throw new Error(`${email}'s membership doc has no customerId - cannot verify tenant scoping`);

// Read-only: the full project list for this org, purely to compute the expected answer (which
// project IDs belong to this customer vs a different one) - never written to, never mutated.
const allProjectsSnap = await orgDocRef.collection("projects").get();
const allProjects = allProjectsSnap.docs.map(d => ({ id: d.id, customerId: d.data().customerId }));
const ownProjectIds = new Set(allProjects.filter(p => p.customerId === customerId).map(p => p.id));
const foreignProjectIds = allProjects.filter(p => p.customerId !== customerId).map(p => p.id);
const restrictedTo = Array.isArray(membership.projectIds) && membership.projectIds.length > 0 ? new Set(membership.projectIds) : null;
const expectedVisibleIds = new Set([...ownProjectIds].filter(id => !restrictedTo || restrictedTo.has(id)));

if (expectedVisibleIds.size === 0) throw new Error(`${email}'s customer (${customerId}) has no visible projects in org ${orgId} to verify against - pick a test account with at least one assigned project`);
if (foreignProjectIds.length === 0) console.warn(`WARNING: no other customer's project exists in org ${orgId} - the cross-tenant exclusion check will be skipped (nothing to exclude)`);

// The client SDK's signInWithCustomToken calls the real Identity Toolkit REST API, which needs a
// real (public, client-safe - not a secret) Firebase Web API key. Reuse the one already checked
// into apps/web/.env.production rather than duplicating it here.
const webEnv = parseEnv(readFileSync(new URL("../../apps/web/.env.production", import.meta.url), "utf8"));
if (webEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== project) throw new Error("apps/web/.env.production does not match pageloom-os-production - refusing to proceed");

// The actual security verification: sign in as the real client account (custom token minting does
// not modify the user's claims, membership, or any other stored data) and read through the client
// SDK, which enforces the real, deployed firestore.rules - unlike the Admin SDK used above.
const customToken = await adminAuth.createCustomToken(user.uid);
const clientApp = initializeClientApp({
  apiKey: webEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: webEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: project,
}, "verify-client-project-list");
await signInWithCustomToken(getClientAuth(clientApp), customToken);
const snap = await getDocs(collection(getClientFirestore(clientApp), `organizations/${orgId}/projects`));
const visibleIds = new Set(snap.docs.map(d => d.id));

const missingOwnProjects = [...expectedVisibleIds].filter(id => !visibleIds.has(id));
const leakedForeignProjects = foreignProjectIds.filter(id => visibleIds.has(id));
const leakedRestrictedProjects = restrictedTo ? [...ownProjectIds].filter(id => !restrictedTo.has(id) && visibleIds.has(id)) : [];

const result = {
  project, orgId, email, uid: user.uid, customerId,
  expectedVisibleProjectIds: [...expectedVisibleIds].sort(),
  actualVisibleProjectIds: [...visibleIds].sort(),
  checks: {
    canListOwnAssignedProjects: missingOwnProjects.length === 0,
    cannotListAnotherCustomersProjects: leakedForeignProjects.length === 0,
    cannotListUnassignedProjectsUnderProjectIdsAllowList: leakedRestrictedProjects.length === 0,
  },
  missingOwnProjects, leakedForeignProjects, leakedRestrictedProjects,
};
console.log(JSON.stringify(result, null, 2));

const passed = Object.values(result.checks).every(Boolean);
if (!passed) { console.error("VERIFICATION FAILED - see missing/leaked project ids above"); process.exit(1); }
console.log("VERIFICATION PASSED - production clientProjectList behavior matches firestore.rules intent");
process.exit(0);
