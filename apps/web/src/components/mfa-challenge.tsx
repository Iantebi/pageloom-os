"use client";
import { useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";

export function MfaChallenge() {
  const { completeMfaSignIn, cancelMfaSignIn } = useAuth();
  const s = t("mfaChallenge");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleVerify() {
    setBusy(true); setError("");
    try { await completeMfaSignIn(code); }
    catch (failure) { setError((failure as { code?: string })?.code === "auth/invalid-verification-code" ? s.invalidCode : s.genericError); }
    finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center p-5">
      <section className="panel w-full max-w-md overflow-hidden">
        <div className="bg-[#174c32] p-8 text-white">
          <div className="mb-16 grid h-11 w-11 place-items-center rounded-xl bg-[#caff68] font-black text-[#131510]">P</div>
          <h1 className="mt-3 text-3xl font-bold tracking-[-.05em]">{s.title}</h1>
          <p className="mt-4 text-sm leading-6 text-[#c4d3c8]">{s.description}</p>
        </div>
        <div className="p-8">
          <div className="mb-5 flex items-center gap-3 text-sm text-[#60655b]">
            <KeyRound className="h-5 w-5 text-[#174c32]" />
          </div>
          {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700" role="alert">{error}</p>}
          <label className="field mb-4"><span>{s.codeFieldLabel}</span>
            <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value)} disabled={busy} />
          </label>
          <button disabled={busy || code.length < 6} onClick={() => void handleVerify()} className="flex w-full items-center justify-between rounded-xl bg-[#131510] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-40">
            <span>{busy ? s.verifyingButton : s.verifyButton}</span>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button onClick={cancelMfaSignIn} className="mt-3 w-full text-center text-xs text-[#60655b] underline">{s.cancelButton}</button>
        </div>
      </section>
    </main>
  );
}
