"use client";
import { useState } from "react";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import type { MultiFactorInfo, TotpSecret } from "firebase/auth";
import { useAuth } from "@/lib/auth";
import { useOrganization } from "@/lib/organization";
import { enrolledTotpFactor, finishTotpEnrollment, startTotpEnrollment, unenrollTotpFactor } from "@/lib/mfa";
import { Button, Card, CardHeader, Status } from "./product-ui";
import { t } from "@/lib/i18n";
import { mfaEnrollmentOffered, parseMfaEnforcementMode } from "@pageloom/core";

type Step = "idle" | "verifying";

// Owner/Admin-only self-service TOTP enrollment. Rendered on /settings (see settings/page.tsx).
// Deliberately never renders a QR code: TotpSecret.generateQrCodeUrl() only builds an otpauth://
// URI locally (no network call), but turning that into a scannable image would mean sending it to
// some image-rendering service - and that URI embeds the raw shared secret. Manual key / link entry
// is slower to type but leaks the secret to nobody; every authenticator app supports it.
export function AccountSecurity() {
  const s = t("accountSecurity");
  const { user } = useAuth();
  const { membership, platformRole } = useOrganization();
  const [step, setStep] = useState<Step>("idle");
  const [secret, setSecret] = useState<TotpSecret | undefined>(undefined);
  const [otpauthUri, setOtpauthUri] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const mode = parseMfaEnforcementMode(process.env.NEXT_PUBLIC_MFA_ENFORCEMENT_MODE);
  const eligible = mfaEnrollmentOffered(platformRole ?? membership?.role ?? "", mode);
  if (!eligible || !user) return null;

  // Derived directly from `user`, not effect+state: multiFactor(user).enroll()/.unenroll() (in mfa.ts)
  // mutate the same User object's multiFactor state in place, so this always reflects the latest
  // enrollment the moment either action's own setState calls below trigger a re-render - no separate
  // "have we checked yet" state or effect needed.
  const factor: MultiFactorInfo | undefined = enrolledTotpFactor(user);

  async function beginEnroll() {
    setBusy(true); setError(""); setMessage("");
    try {
      const { secret: newSecret, qrCodeUrl } = await startTotpEnrollment(user!, user!.email ?? user!.uid);
      setSecret(newSecret); setOtpauthUri(qrCodeUrl); setStep("verifying");
    } catch (failure) { setError(failure instanceof Error ? failure.message : s.enrollError); }
    finally { setBusy(false); }
  }
  async function confirmEnroll() {
    if (!secret) return;
    setBusy(true); setError("");
    try {
      await finishTotpEnrollment(user!, secret, code, s.defaultFactorName);
      setStep("idle"); setCode(""); setSecret(undefined); setOtpauthUri(""); setMessage(s.enrollSuccess);
    } catch (failure) { setError(failure instanceof Error ? failure.message : s.verifyError); }
    finally { setBusy(false); }
  }
  async function removeFactor() {
    if (!factor || !window.confirm(s.unenrollConfirm)) return;
    setBusy(true); setError("");
    try { await unenrollTotpFactor(user!, factor); setStep("idle"); setMessage(s.unenrollSuccess); }
    catch (failure) { setError(failure instanceof Error ? failure.message : s.unenrollError); }
    finally { setBusy(false); }
  }
  function cancelEnroll() { setStep("idle"); setSecret(undefined); setOtpauthUri(""); setCode(""); setError(""); }

  return (
    <Card>
      <CardHeader icon={ShieldCheck} title={s.title} subtitle={s.subtitle} />
      {factor ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] p-3">
          <span className="min-w-0 flex-1"><b className="block truncate text-[11px]">{factor.displayName ?? s.defaultFactorName}</b></span>
          <Status value="active" label={s.enrolledLabel} />
          <Button variant="secondary" disabled={busy} onClick={() => void removeFactor()}><ShieldOff className="h-4 w-4" />{s.unenrollButton}</Button>
        </div>
      ) : step === "idle" ? (
        <Button disabled={busy} onClick={() => void beginEnroll()}><KeyRound className="h-4 w-4" />{busy ? s.startingButton : s.enrollButton}</Button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-6 text-[var(--muted)]">{s.scanInstructions}</p>
          <label className="field"><span>{s.manualKeyLabel}</span><input className="input" readOnly value={secret?.secretKey ?? ""} onFocus={event => event.currentTarget.select()} /></label>
          <label className="field"><span>{s.otpauthUriLabel}</span><input className="input" readOnly value={otpauthUri} onFocus={event => event.currentTarget.select()} /></label>
          <label className="field"><span>{s.codeFieldLabel}</span><input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value)} disabled={busy} /></label>
          <div className="flex gap-2">
            <Button disabled={busy || code.length < 6} onClick={() => void confirmEnroll()}>{busy ? s.verifyingButton : s.verifyButton}</Button>
            <Button variant="secondary" disabled={busy} onClick={cancelEnroll}>{s.cancelButton}</Button>
          </div>
        </div>
      )}
      {error && <p className="notice notice-error mt-3" role="alert">{error}</p>}
      {message && <p className="notice notice-success mt-3" role="status">{message}</p>}
    </Card>
  );
}
