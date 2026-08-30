"use client";
import { useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { useLiveCollection } from "@/lib/live-data";
import { Button, Card, CardHeader, Empty, Status } from "./product-ui";
import { t } from "@/lib/i18n";

type Member = { id: string; email?: string; role: string; disabled?: boolean };
type Invitation = { id: string; email: string; role: string; status: string };

export function TeamAccess() {
  const s = t("teamAccess");
  const n = t("nav");
  const roleLabel = (role: string) => role === "owner" ? n.roleOwner : role === "admin" ? n.roleAdmin : role === "operator" ? n.roleOperator : role === "member" ? n.roleMember : role;
  const { organizationId, membership } = useOrganization();
  const members = useLiveCollection<Member>(organizationId ? `organizations/${organizationId}/members` : undefined);
  const invitations = useLiveCollection<Invitation>(organizationId ? `organizations/${organizationId}/staffInvitations` : undefined);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isOwner = membership?.role === "owner";
  if (!membership || !["owner", "admin"].includes(membership.role)) return null;

  const staff = members.data.filter(item => item.role !== "client");
  const pending = invitations.data.filter(item => item.status === "pending");
  const invitableRoles = isOwner ? ["owner", "admin", "operator", "member"] : ["operator", "member"];
  const assignableRoles = isOwner ? ["owner", "admin", "operator", "member"] : ["operator", "member"];

  async function invite() {
    setBusy("invite"); setError(""); setMessage("");
    try { await api("/staff/invite", { method: "POST", body: JSON.stringify({ organizationId, email, role }) }); setEmail(""); setMessage(s.inviteSuccess(email)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : s.inviteError); }
    finally { setBusy(""); }
  }
  async function updateRole(member: Member, nextRole: string) {
    setBusy(member.id); setError("");
    try { await api(`/staff/${member.id}`, { method: "PATCH", body: JSON.stringify({ organizationId, role: nextRole }) }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : s.roleUpdateError); }
    finally { setBusy(""); }
  }
  async function toggleDisabled(member: Member) {
    const next = member.disabled !== true;
    if (next && !window.confirm(s.disableConfirm(member.email ?? member.id))) return;
    setBusy(member.id); setError("");
    try { await api(`/staff/${member.id}`, { method: "PATCH", body: JSON.stringify({ organizationId, disabled: next }) }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : s.accessUpdateError); }
    finally { setBusy(""); }
  }

  return <Card>
    <CardHeader icon={ShieldCheck} title={s.title} subtitle={s.subtitle} />
    <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
      <label className="field"><span>{s.emailFieldLabel}</span><input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={busy === "invite"} /></label>
      <label className="field"><span>{s.roleFieldLabel}</span><select className="input" value={role} onChange={event => setRole(event.target.value)} disabled={busy === "invite"}>{invitableRoles.map(item => <option key={item} value={item}>{roleLabel(item)}</option>)}</select></label>
      <Button className="self-end" disabled={!email || busy === "invite"} onClick={() => void invite()}><UserPlus className="h-4 w-4" />{busy === "invite" ? s.invitingButton : s.inviteButton}</Button>
    </div>
    {error && <p className="notice notice-error mt-3" role="alert">{error}</p>}
    {message && <p className="notice notice-success mt-3" role="status">{message}</p>}
    <div className="mt-5 space-y-2">
      {staff.length ? staff.map(member => {
        const locked = !isOwner && ["owner", "admin"].includes(member.role);
        return <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] p-3" key={member.id}>
          <span className="min-w-0 flex-1"><b className="block truncate text-[11px]">{member.email ?? member.id}</b></span>
          <select className="input max-w-32" value={member.role} disabled={busy === member.id || locked} onChange={event => void updateRole(member, event.target.value)}>{[...new Set([member.role, ...assignableRoles])].map(item => <option key={item} value={item}>{roleLabel(item)}</option>)}</select>
          <Status value={member.disabled === true ? "blocked" : "active"} />
          <Button variant="secondary" disabled={busy === member.id || locked} onClick={() => void toggleDisabled(member)}>{member.disabled === true ? s.reactivateButton : s.disableButton}</Button>
        </div>;
      }) : <Empty title={s.noStaffTitle} description={s.noStaffDescription} />}
    </div>
    {pending.length > 0 && <div className="mt-5 border-t border-[var(--border)] pt-4">
      <b className="text-[10px]">{s.pendingInvitationsTitle}</b>
      <div className="mt-2 space-y-1">{pending.map(item => <div className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] p-2 text-[10px]" key={item.id}><span>{item.email}</span><Status value={item.role} label={roleLabel(item.role)} /></div>)}</div>
    </div>}
  </Card>;
}
