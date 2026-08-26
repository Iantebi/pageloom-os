"use client";
import { useEffect, useState } from "react";
import { salesPackages, type ClosingChecklistItem, type ClosingProposal, type ContractAcceptance, type Payment } from "@pageloom/core";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { useLiveCollection } from "@/lib/live-data";
import { Button, Card, Empty, Loading, Status, money } from "./product-ui";

type Customer = { id: string; businessName: string };
type ClosingState = { proposal: ClosingProposal | null; contract: ContractAcceptance | null; payments: Payment[]; checklist: ClosingChecklistItem[]; startAt: string | null };

// Everything here is persisted server-side (organizations/{org}/customers/{customer}/closing/current)
// so a signed contract or a marked-paid deposit survives a reload instead of living only in this
// component's state. See functions/src/closing-api.ts for the authorization boundary.
export function ClosingWorkspace() {
  const { organizationId } = useOrganization();
  const customers = useLiveCollection<Customer>(organizationId ? `organizations/${organizationId}/customers` : undefined);
  const [customerId, setCustomerId] = useState("");
  const selected = customerId || customers.data[0]?.id || "";
  const [state, setState] = useState<ClosingState>();
  // Which customer `state` actually belongs to, and which customer the last fetch attempt was
  // for — both set only from promise callbacks (never synchronously in the effect body) so a
  // switch between customers can't flash the previous customer's proposal/contract/payments,
  // and `loading` below can be a plain derived value instead of its own effect-driven state.
  const [stateFor, setStateFor] = useState("");
  const [attemptedFor, setAttemptedFor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ customer: "", business: "", packageId: "growth" as "launch" | "growth" | "authority", challenge: "", validUntil: "", startAt: "" });
  const [signature, setSignature] = useState("");

  const loading = Boolean(selected) && attemptedFor !== selected;
  const data = stateFor === selected ? state : undefined;

  useEffect(() => {
    if (!organizationId || !selected) return;
    let cancelled = false;
    api<ClosingState>(`/customers/${selected}/closing?organizationId=${organizationId}`)
      .then(value => { if (!cancelled) { setState(value); setStateFor(selected); setError(""); } })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load the closing workspace"); })
      .finally(() => { if (!cancelled) setAttemptedFor(selected); });
    return () => { cancelled = true; };
  }, [organizationId, selected]);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await api<ClosingState>(`/customers/${selected}/closing/proposals`, { method: "POST", body: JSON.stringify({ organizationId, ...form }) });
      setState(result); setStateFor(selected); setSignature("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not generate the proposal"); }
    finally { setBusy(false); }
  }

  async function sign() {
    setBusy(true); setError("");
    try {
      const result = await api<ClosingState>(`/customers/${selected}/closing/sign`, { method: "POST", body: JSON.stringify({ organizationId, typedSignature: signature }) });
      setState(result); setStateFor(selected);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Signature does not match the customer name on the proposal"); }
    finally { setBusy(false); }
  }

  async function paid(paymentId: string) {
    setBusy(true); setError("");
    try {
      const result = await api<ClosingState>(`/customers/${selected}/closing/payments/${paymentId}/paid`, { method: "POST", body: JSON.stringify({ organizationId }) });
      setState(result); setStateFor(selected);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not mark the payment as paid"); }
    finally { setBusy(false); }
  }

  async function toggleChecklist(itemId: string, complete: boolean) {
    if (!data) return;
    setState({ ...data, checklist: data.checklist.map(item => item.id === itemId ? { ...item, complete } : item) });
    try {
      await api(`/customers/${selected}/closing/checklist/${itemId}`, { method: "PATCH", body: JSON.stringify({ organizationId, complete }) });
    } catch (reason) {
      setState(current => current ? { ...current, checklist: current.checklist.map(item => item.id === itemId ? { ...item, complete: !complete } : item) } : current);
      setError(reason instanceof Error ? reason.message : "Could not save the checklist change");
    }
  }

  const proposal = data?.proposal;
  const signed = Boolean(data?.contract);

  return <section className="space-y-4">
    <Card>
      <h2 className="text-sm font-semibold">Closing workspace</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">Proposal → contract → payment → onboarding → kickoff.</p>
      {!customers.loading && !customers.data.length
        ? <Empty title="No customers yet" description="Add a customer in the CRM before starting a closing pack." />
        : <label className="field mt-4"><span>Customer</span><select className="input" value={selected} onChange={event => setCustomerId(event.target.value)} disabled={customers.loading}>{customers.data.map(item => <option key={item.id} value={item.id}>{item.businessName}</option>)}</select></label>}
      {selected && <form onSubmit={generate} className="mt-5 grid gap-3 md:grid-cols-2">
        <Field label="Customer contact" value={form.customer} set={customer => setForm({ ...form, customer })} />
        <Field label="Business" value={form.business} set={business => setForm({ ...form, business })} />
        <label className="field"><span>Package</span><select className="input" value={form.packageId} onChange={e => setForm({ ...form, packageId: e.target.value as typeof form.packageId })}>{salesPackages.map(item => <option key={item.id} value={item.id}>{item.name} · {money(item.price)}</option>)}</select></label>
        <label className="field"><span>Kickoff date</span><input required type="date" className="input" value={form.startAt} onChange={e => setForm({ ...form, startAt: e.target.value })} /></label>
        <label className="field md:col-span-2"><span>Customer priority</span><textarea required className="input min-h-20" value={form.challenge} onChange={e => setForm({ ...form, challenge: e.target.value })} /></label>
        <label className="field"><span>Proposal valid until</span><input required type="date" className="input" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} /></label>
        <Button type="submit" disabled={busy}>{busy ? "Generating…" : proposal ? "Generate a new closing pack" : "Generate closing pack"}</Button>
      </form>}
      {error && <p className="mt-4 text-xs text-red-700" role="alert">{error}</p>}
    </Card>
    {loading && <Loading label="Loading the closing workspace…" />}
    {proposal && data && <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><div className="flex justify-between"><h2 className="text-sm font-semibold">Proposal · {proposal.package.name}</h2><Status value={proposal.status} /></div><p className="mt-3 text-xs">{proposal.challenge}</p><div className="mt-4 grid grid-cols-3 gap-2"><Metric label="Investment" value={money(proposal.investment)} /><Metric label="Deposit" value={money(proposal.deposit)} /><Metric label="Balance" value={money(proposal.balance)} /></div>{proposal.package.outcomes.map(item => <p key={item} className="mt-2 text-xs">✓ {item}</p>)}</Card>
        <Card><h2 className="text-sm font-semibold">Digital contract</h2><p className="mt-2 text-xs text-[var(--muted)]">Agreement v1.0 · package, scope, payment schedule, and delivery target attached to this proposal.</p><label className="field mt-4"><span>Type &ldquo;{proposal.customer}&rdquo; to sign</span><input disabled={signed || busy} className="input" value={signature} onChange={e => setSignature(e.target.value)} /></label><Button className="mt-3" disabled={signed || busy || !signature.trim()} onClick={() => void sign()}>{signed ? "Contract signed" : "Accept and sign"}</Button></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="text-sm font-semibold">Onboarding checklist</h2>{data.checklist.map(item => <label key={item.id} className="mt-3 flex items-center gap-3 text-xs"><input type="checkbox" checked={item.complete} disabled={busy} onChange={() => void toggleChecklist(item.id, !item.complete)} /><span className="flex-1">{item.label}</span><small>{item.owner}</small></label>)}</Card>
        <Card><h2 className="text-sm font-semibold">Payment tracking</h2>{data.payments.length ? data.payments.map(item => <div key={item.id} className="mt-3 flex items-center justify-between rounded-xl border p-3"><span><b className="block text-xs">{item.label}</b><small>{money(item.amount)}</small></span><Button variant="secondary" disabled={item.status === "paid" || busy} onClick={() => void paid(item.id)}>{item.status === "paid" ? "Paid" : "Mark paid"}</Button></div>) : <Empty title="No payment schedule" description="Set a kickoff date when generating the proposal to create a payment schedule." />}</Card>
      </div>
    </>}
  </section>;
}
function Field({ label, value, set }: { label: string; value: string; set: (value: string) => void }) { return <label className="field"><span>{label}</span><input required className="input" value={value} onChange={e => set(e.target.value)} /></label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#fafaf8] p-3"><small>{label}</small><b className="mt-1 block text-sm">{value}</b></div>; }
