// Staged MFA rollout policy — pure logic shared by functions/src/auth.ts (enforcement) and
// apps/web (UI copy/gating). Kept dependency-free like the rest of this package so it vendors
// cleanly into functions without dragging in firebase-admin or firebase client types.
//
// "off" (default): zero behavior change — existing sign-in and API access is untouched. This is
// the safe default so enabling this feature can never lock out an existing Owner/Admin who has
// not yet enrolled a second factor.
// "optional": the product surfaces enrollment UI to Owner/Admin but never blocks API access.
// "required": Owner/Admin API access requires a verified second factor on the ID token.
export type MfaEnforcementMode = "off" | "optional" | "required";

const MFA_ENFORCEMENT_MODES: readonly MfaEnforcementMode[] = ["off", "optional", "required"];

// Only the two most-privileged organization roles are ever subject to MFA — matches the issue's
// scope ("MFA for Owner/Admin accounts") and the existing escalation-control precedent in
// staff-admin-api.ts, where only owner/admin can grant/change owner/admin access.
const MFA_ELIGIBLE_ROLES = ["owner", "admin"] as const;
export type MfaEligibleRole = (typeof MFA_ELIGIBLE_ROLES)[number];

export function parseMfaEnforcementMode(raw: string | undefined | null): MfaEnforcementMode {
  return (MFA_ENFORCEMENT_MODES as readonly string[]).includes(String(raw)) ? (raw as MfaEnforcementMode) : "off";
}

export function isMfaEligibleRole(role: string): role is MfaEligibleRole {
  return (MFA_ELIGIBLE_ROLES as readonly string[]).includes(role);
}

/** True when the given organization role must present a verified second factor under the given mode. */
export function mfaRequiredForRole(role: string, mode: MfaEnforcementMode): boolean {
  return mode === "required" && isMfaEligibleRole(role);
}

/** True when Owner/Admin enrollment UI should be offered (both "optional" and "required" modes). */
export function mfaEnrollmentOffered(role: string, mode: MfaEnforcementMode): boolean {
  return mode !== "off" && isMfaEligibleRole(role);
}
