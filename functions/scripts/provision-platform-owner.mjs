import { readFileSync } from "node:fs";
import process from "node:process";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const args = new Map(process.argv.slice(2).map(value => { const [key, ...rest] = value.split("="); return [key, rest.join("=") || true]; }));
const uid = String(args.get("--uid") ?? ""), expectedEmail = String(args.get("--email") ?? "").trim().toLowerCase(), apply = args.has("--apply");
if (!uid || !expectedEmail) throw new Error("Usage: npm run provision:owner -- --uid=<firebase-uid> --email=<verified-email> [--apply]");
const project = JSON.parse(readFileSync(new URL("../../.firebaserc", import.meta.url), "utf8")).projects?.default;
if (project !== "pageloom-os-production") throw new Error(`Refusing owner provisioning for unexpected Firebase project: ${project || "unknown"}`);
if (!getApps().length) initializeApp({ credential: process.env.GOOGLE_APPLICATION_CREDENTIALS ? cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"))) : applicationDefault(), projectId: project });
const auth = getAuth(), user = await auth.getUser(uid);
if (!user.emailVerified || user.email?.trim().toLowerCase() !== expectedEmail) throw new Error("The Firebase user must have the exact verified email supplied to this command");
if (!apply) { console.log(JSON.stringify({ dryRun: true, project, uid: user.uid, emailVerified: user.emailVerified, intendedRole: "owner" })); process.exit(0); }
const previousClaims = user.customClaims ?? {};
if (previousClaims.platformRole && previousClaims.platformRole !== "owner") throw new Error("Refusing to replace an existing non-owner platform role without manual review");
await auth.setCustomUserClaims(uid, { ...previousClaims, platformRole: "owner" });
await getFirestore().doc(`systemAdministrators/${uid}`).set({ uid, email: expectedEmail, role: "owner", active: true, provisionedAt: new Date().toISOString(), mechanism: "verified-cli" }, { merge: true });
await auth.revokeRefreshTokens(uid);
console.log(JSON.stringify({ applied: true, project, uid, role: "owner", tokensRevoked: true }));
