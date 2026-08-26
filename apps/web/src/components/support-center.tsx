"use client";
import { useState } from "react";
import { Headphones, MessageSquareText } from "lucide-react";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { useLiveCollection } from "@/lib/live-data";
import { Button, Card, CardHeader, Empty, Status, dateTime } from "./product-ui";

type Ticket = { id: string; subject: string; description: string; category?: string; priority: string; status: string; customerId: string; projectId?: string; responseDueAt: string; resolution?: string; assignedTo?: string; attachmentPaths?: string[]; updatedAt: string };
type Note = { id: string; body: string; createdBy: string; createdAt: string };
const statuses = ["open", "in_progress", "waiting_customer", "resolved", "closed"] as const;
const priorities = ["critical", "high", "normal", "low"] as const;

export function SupportCenter() {
  const { organizationId } = useOrganization();
  const tickets = useLiveCollection<Ticket>(organizationId ? `organizations/${organizationId}/supportTickets` : undefined, "updatedAt", 200);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selected, setSelected] = useState<Ticket>();
  const notes = useLiveCollection<Note>(selected && organizationId ? `organizations/${organizationId}/supportTickets/${selected.id}/internalNotes` : undefined, "createdAt");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [resolution, setResolution] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function open(ticket: Ticket) {
    setSelected(ticket); setStatus(ticket.status); setPriority(ticket.priority); setAssignedTo(ticket.assignedTo ?? ""); setResolution(ticket.resolution ?? ""); setNote(""); setError(""); setMessage("");
  }

  async function save() {
    if (!selected) return;
    if (["resolved", "closed"].includes(status) && !resolution.trim()) { setError("Add resolution notes before marking this ticket resolved or closed."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/support-tickets/${selected.id}`, { method: "PATCH", body: JSON.stringify({ organizationId, status, priority, assignedTo: assignedTo || undefined, resolution: resolution || undefined, internalNote: note || undefined }) });
      setMessage("Ticket updated."); setNote("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Ticket update failed."); }
    finally { setBusy(false); }
  }

  const filtered = tickets.data.filter(ticket => (statusFilter === "all" || ticket.status === statusFilter) && (priorityFilter === "all" || ticket.priority === priorityFilter));

  return <Card>
    <CardHeader icon={Headphones} title="Support center" subtitle="Every customer support request across this organization" />
    <div className="flex flex-wrap gap-2">
      <select className="input max-w-48" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter tickets by status"><option value="all">Every status</option>{statuses.map(item => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
      <select className="input max-w-48" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)} aria-label="Filter tickets by priority"><option value="all">Every priority</option>{priorities.map(item => <option key={item} value={item}>{item}</option>)}</select>
    </div>
    {tickets.error && <p className="notice notice-error mt-3" role="alert">Support tickets could not be loaded.</p>}
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="max-h-[520px] space-y-2 overflow-auto">
        {filtered.length ? filtered.map(ticket => <button key={ticket.id} onClick={() => open(ticket)} className={`w-full rounded-xl border p-3 text-start ${selected?.id === ticket.id ? "border-[#7357ff] bg-[#f7f5ff]" : "border-[var(--border)]"}`}>
          <div className="flex items-start justify-between gap-2"><b className="text-[11px]">{ticket.subject}</b><Status value={ticket.status} /></div>
          <small className="mt-1 block text-[9px] text-[var(--muted)]">{ticket.category ?? "other"} · {ticket.priority} · due {dateTime(ticket.responseDueAt)}</small>
        </button>) : <Empty title="No support tickets" description="Customer requests will appear here automatically." icon={<Headphones className="h-4 w-4" />} />}
      </div>
      <Card>
        {selected ? <>
          <span className="eyebrow">TICKET</span>
          <h3 className="mt-2 text-sm font-semibold">{selected.subject}</h3>
          <p className="mt-2 text-[10px] leading-5 text-[var(--muted)]">{selected.description}</p>
          <p className="mt-2 text-[9px] text-[var(--muted)]">Customer {selected.customerId}{selected.projectId ? ` · Project ${selected.projectId}` : ""}{selected.attachmentPaths?.length ? ` · ${selected.attachmentPaths.length} attachment(s)` : ""}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="field"><span>Status</span><select className="input" value={status} onChange={event => setStatus(event.target.value)}>{statuses.map(item => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
            <label className="field"><span>Priority</span><select className="input" value={priority} onChange={event => setPriority(event.target.value)}>{priorities.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          <label className="field mt-3"><span>Assigned to</span><input className="input" value={assignedTo} onChange={event => setAssignedTo(event.target.value)} placeholder="Team member name or UID" maxLength={200} /></label>
          <label className="field mt-3"><span>Resolution{["resolved", "closed"].includes(status) ? " *" : ""}</span><textarea className="input min-h-20" value={resolution} onChange={event => setResolution(event.target.value)} maxLength={10000} /></label>
          <label className="field mt-3"><span>Add internal note</span><textarea className="input min-h-16" value={note} onChange={event => setNote(event.target.value)} maxLength={10000} /></label>
          <Button className="mt-3" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save ticket"}</Button>
          {message && <p className="notice notice-success mt-3" role="status">{message}</p>}
          {error && <p className="notice notice-error mt-3" role="alert">{error}</p>}
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <b className="text-[10px]">Internal notes</b>
            {notes.data.length ? notes.data.map(item => <div key={item.id} className="mt-2 rounded-lg bg-[#fafaf8] p-2"><p className="text-[10px]">{item.body}</p><small className="text-[8px] text-[var(--muted)]">{dateTime(item.createdAt)}</small></div>) : <p className="mt-2 text-[9px] text-[var(--muted)]">No internal notes yet.</p>}
          </div>
        </> : <Empty title="Select a ticket" description="Open a ticket to update status, priority, assignment, and resolution." icon={<MessageSquareText className="h-4 w-4" />} />}
      </Card>
    </div>
  </Card>;
}
