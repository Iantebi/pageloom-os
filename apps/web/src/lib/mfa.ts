"use client";
import {
  getMultiFactorResolver,
  multiFactor,
  TotpMultiFactorGenerator,
  type Auth,
  type MultiFactorInfo,
  type MultiFactorResolver,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "./firebase";

export { isMfaRequiredError, totpHint } from "./mfa-predicates";

/** The first enrolled TOTP factor on a signed-in user's own account, if any. */
export function enrolledTotpFactor(user: User): MultiFactorInfo | undefined {
  return multiFactor(user).enrolledFactors.find(factor => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID);
}

export function resolverFromError(failure: unknown): MultiFactorResolver {
  return getMultiFactorResolver(firebaseAuth as Auth, failure as never);
}

/** Step 1 of enrollment: starts a session and generates a TOTP secret + a local (never transmitted) otpauth:// URI. */
export async function startTotpEnrollment(user: User, accountLabel: string) {
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  return { secret, qrCodeUrl: secret.generateQrCodeUrl(accountLabel, "PageLoom OS") };
}

/** Step 2 of enrollment: verifies the 6-digit code the user's authenticator app produced and enrolls the factor. */
export async function finishTotpEnrollment(user: User, secret: Awaited<ReturnType<typeof TotpMultiFactorGenerator.generateSecret>>, code: string, displayName: string) {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
  await multiFactor(user).enroll(assertion, displayName);
}

export async function unenrollTotpFactor(user: User, factor: MultiFactorInfo) {
  await multiFactor(user).unenroll(factor);
}

/** Completes a challenged sign-in by verifying the 6-digit code against the resolver's TOTP hint. */
export async function completeTotpSignIn(resolver: MultiFactorResolver, hint: MultiFactorInfo, code: string) {
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code);
  return resolver.resolveSignIn(assertion);
}
