import { readFileSync } from "node:fs";
import process from "node:process";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Last-resort MFA recovery for an Owner/Admin who is locked out of every in-app path: they cannot
// call the /staff/:uid/mfa-reset API themself (resolving a second-factor challenge happens before
// a session/ID token exists), and if they are the organization's *sole* Owner, no other Owner can
// call it for them either. This mirrors provision-platform-owner.mjs's safety conventions: dry-run
// by default, pinned to the production project, requires the account's exact verified email as a
// second confirming input, and revokes refresh tokens after the change so it takes effect
// immediately rather than waiting for the existing session to expire.
const args = new Map(process.argv.slice(2).map(value => { const [key, ...rest] = value.split("="); return [key, rest.join("=") || true]; }));
const uid = String(args.get("--uid") ?? ""), expectedEmail = String(args.get("--email") ?? "").trim().toLowerCase(), apply = args.has("--apply");
if (!uid || !expectedEmail) throw new Error("Usage: node functions/scripts/mfa-recovery.mjs --uid=<firebase-uid> --email=<verified-email> [--apply]");
const project = JSON.parse(readFileSync(new URL("../../.firebaserc", import.meta.url), "utf8")).projects?.default;
if (project !== "pageloom-os-production") throw new Error(`Refusing MFA recovery for unexpected Firebase project: ${project || "unknown"}`);
if (!getApps().length) initializeApp({ credential: process.env.GOOGLE_APPLICATION_CREDENTIALS ? cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"))) : applicationDefault(), projectId: project });
const auth = getAuth(), user = await auth.getUser(uid);
if (!user.emailVerified || user.email?.trim().toLowerCase() !== expectedEmail) throw new Error("The Firebase user must have the exact verified email supplied to this command");
const enrolledFactors = (user.multiFactor?.enrolledFactors ?? []).map(factor => ({ uid: factor.uid, factorId: factor.factorId, displayName: factor.displayName }));
if (!apply) { console.log(JSON.stringify({ dryRun: true, project, uid: user.uid, emailVerified: user.emailVerified, enrolledFactors })); process.exit(0); }
if (enrolledFactors.length === 0) { console.log(JSON.stringify({ applied: false, project, uid, reason: "No enrolled second factors to remove" })); process.exit(0); }
await auth.updateUser(uid, { multiFactor: { enrolledFactors: null } });
await auth.revokeRefreshTokens(uid);
await getFirestore().collection("mfaRecoveryLog").add({ uid, removedFactors: enrolledFactors, recoveredAt: new Date().toISOString(), mechanism: "verified-cli" });
console.log(JSON.stringify({ applied: true, project, uid, removedFactors: enrolledFactors, tokensRevoked: true }));
