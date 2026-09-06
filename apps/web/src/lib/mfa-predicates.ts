// Pure MFA predicates, kept separate from mfa.ts so they can be unit tested without transitively
// importing ./firebase (which bootstraps the real Firebase client SDK — initializeApp/getAuth/
// getFirestore/getStorage — as a side effect of import, same as every other module in this app that
// needs firebaseAuth; no existing test imports it unmocked, and this file intentionally doesn't
// either). Importing "firebase/auth" itself is safe here: it only defines classes/constants at
// module scope, it never touches window/an app instance.
import { TotpMultiFactorGenerator, type MultiFactorInfo, type MultiFactorResolver } from "firebase/auth";

/** True for the exact Firebase Auth error thrown mid sign-in when a second factor is required. */
export function isMfaRequiredError(failure: unknown): boolean {
  return (failure as { code?: string })?.code === "auth/multi-factor-auth-required";
}

/** The first enrolled TOTP factor offered by a sign-in resolver, if any (this app only supports TOTP). */
export function totpHint(resolver: Pick<MultiFactorResolver, "hints">): MultiFactorInfo | undefined {
  return resolver.hints.find(hint => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID);
}
