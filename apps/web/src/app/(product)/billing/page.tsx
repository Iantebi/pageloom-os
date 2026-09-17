"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, Trash2, Wallet, X } from "lucide-react";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/organization";
import { t } from "@/lib/i18n";
import { Button, Card, Empty, Loading, PageHeader, Status, dateTime, money } from "@/components/product-ui";

// Owner Workspace "Billing" section (2026-09-17 nav unification). Customers/invoices/payments
// existed only as read-only display data inside /master/customer before this — nothing ever wrote
// an invoice or a payment. This page is the first real, cross-customer billing surface: it can
// create invoices (using the previously-unused Israeli VAT calculator in @pageloom/core, via the new
// POST /billing/invoices) and record payments against them (POST /billing/invoices/:id/payments).
// Subscriptions has no backing concept anywhere in this codebase (no schema, no recurring-billing
// integration) — its tab is an honest "not available yet" state, not a fabricated feature.

type Customer = { id: string; name?: string; businessName?: string; email?: string };
type InvoiceLine = { descriptionHebrew: string; quantity: number; unitPriceAgorot: number };
type Invoice = { id: string; number: string; customerId: string; lines: InvoiceLine[]; subtotalAgorot: number; vatAgorot: number; totalAgorot: number; paidAgorot: number; status: string; createdAt: string };
type Payment = { id: string; invoiceId: string; customerId: string; amountAgorot: number; method: string; createdAt: string };
type Overview = { customers: Customer[]; invoices: Invoice[]; payments: Payment[]; subscriptions: unknown[] };

const documentTypes = ["transaction_invoice", "tax_invoice", "receipt", "tax_invoice_receipt", "credit_note"] as const;
const paymentMethods = ["bank_transfer", "credit_card", "cash", "cheque", "other"] as const;
type Tab = "invoices" | "customers" | "payments" | "subscriptions";

function customerName(customer?: Customer) { return customer?.businessName ?? customer?.name ?? "—"; }

export default function BillingPage() {
  const s = t("billingPage");
  const { organizationId, membership } = useOrganization();
  const isFinance = membership?.role === "owner" || membership?.role === "admin";
  const [data, setData] = useState<Overview>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("invoices");
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState<Invoice>();

  const load = useCallback(() => {
    if (!organizationId) return;
    api<Overview>(`/billing/overview?organizationId=${encodeURIComponent(organizationId)}`).then(result => { setError(""); setData(result); }).catch(failure => setError(failure instanceof Error ? failure.message : s.loadErrorFallback));
  }, [organizationId, s.loadErrorFallback]);

  useEffect(() => { load(); }, [load]);

  const customerById = useMemo(() => new Map((data?.customers ?? []).map(customer => [customer.id, customer])), [data]);

  if (!isFinance) return <Card><Empty title={t("common").adminRequiredTitle} description={t("common").adminRequiredDescription} /></Card>;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={s.eyebrow} title={s.title} description={s.description} actions={<Button onClick={() => setInvoiceModal(true)}><Plus className="h-4 w-4" />{s.newInvoice}</Button>} />
      {message && <p className="notice notice-success" role="status">{message}</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {!data && !error && <Loading />}

      {data && (
        <>
          <div className="tabs">
            <button className={`tab ${tab === "invoices" ? "tab-active" : ""}`} onClick={() => setTab("invoices")}>{s.tabInvoices(data.invoices.length)}</button>
            <button className={`tab ${tab === "customers" ? "tab-active" : ""}`} onClick={() => setTab("customers")}>{s.tabCustomers(data.customers.length)}</button>
            <button className={`tab ${tab === "payments" ? "tab-active" : ""}`} onClick={() => setTab("payments")}>{s.tabPayments(data.payments.length)}</button>
            <button className={`tab ${tab === "subscriptions" ? "tab-active" : ""}`} onClick={() => setTab("subscriptions")}>{s.tabSubscriptions}</button>
          </div>

          {tab === "invoices" && (
            <Card>
              {data.invoices.length === 0 && <Empty title={s.emptyInvoicesTitle} description={s.emptyInvoicesDescription} />}
              {data.invoices.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-start">
                    <thead><tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      <th className="p-2 text-start">{s.invoiceNumberColumn}</th>
                      <th className="p-2 text-start">{s.invoiceCustomerColumn}</th>
                      <th className="p-2 text-start">{s.invoiceTotalColumn}</th>
                      <th className="p-2 text-start">{s.invoiceStatusColumn}</th>
                      <th className="p-2 text-start">{s.invoiceActionsColumn}</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {data.invoices.map(invoice => (
                        <tr key={invoice.id}>
                          <td className="p-2 text-[11px]">{invoice.number}</td>
                          <td className="p-2 text-[11px]">{customerName(customerById.get(invoice.customerId))}</td>
                          <td className="p-2 text-[11px]">{money(invoice.totalAgorot / 100)}</td>
                          <td className="p-2"><Status value={invoice.status} /></td>
                          <td className="p-2">{invoice.status !== "paid" && <Button variant="secondary" onClick={() => setPaymentModal(invoice)}><Wallet className="h-3.5 w-3.5" />{s.recordPayment}</Button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === "customers" && (
            <Card>
              {data.customers.length === 0 && <Empty title={s.emptyCustomersTitle} description="" />}
              {data.customers.length > 0 && <div className="divide-y divide-[var(--border)]">{data.customers.map(customer => (
                <div key={customer.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-[11px] font-semibold">{customerName(customer)}</span>
                  <small className="text-[9px] text-[var(--muted)]">{customer.email ?? "—"}</small>
                </div>
              ))}</div>}
            </Card>
          )}

          {tab === "payments" && (
            <Card>
              {data.payments.length === 0 && <Empty title={s.emptyPaymentsTitle} description={s.emptyPaymentsDescription} />}
              {data.payments.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-start">
                    <thead><tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      <th className="p-2 text-start">{s.paymentInvoiceColumn}</th>
                      <th className="p-2 text-start">{s.paymentAmountColumn}</th>
                      <th className="p-2 text-start">{s.paymentMethodColumn}</th>
                      <th className="p-2 text-start">{s.paymentDateColumn}</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {data.payments.map(payment => {
                        const invoice = data.invoices.find(candidate => candidate.id === payment.invoiceId);
                        return <tr key={payment.id}>
                          <td className="p-2 text-[11px]">{invoice?.number ?? payment.invoiceId}</td>
                          <td className="p-2 text-[11px]">{money(payment.amountAgorot / 100)}</td>
                          <td className="p-2 text-[10px]">{(s.methods as Record<string, string>)[payment.method] ?? payment.method}</td>
                          <td className="p-2 text-[10px] text-[var(--muted)]">{dateTime(payment.createdAt)}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === "subscriptions" && <Card><Empty title={s.subscriptionsNotAvailableTitle} description={s.subscriptionsNotAvailableDescription} /></Card>}
        </>
      )}

      {invoiceModal && data && <NewInvoiceModal customers={data.customers} organizationId={organizationId} onClose={() => setInvoiceModal(false)} onCreated={() => { setInvoiceModal(false); setMessage(s.invoiceCreated); load(); }} />}
      {paymentModal && organizationId && <RecordPaymentModal invoice={paymentModal} organizationId={organizationId} onClose={() => setPaymentModal(undefined)} onRecorded={() => { setPaymentModal(undefined); setMessage(s.paymentRecorded); load(); }} />}
    </div>
  );
}

function NewInvoiceModal({ customers, organizationId, onClose, onCreated }: { customers: Customer[]; organizationId: string; onClose: () => void; onCreated: () => void }) {
  const s = t("billingPage");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [documentType, setDocumentType] = useState<typeof documentTypes[number]>("tax_invoice_receipt");
  const [vatPercent, setVatPercent] = useState(18);
  const [lines, setLines] = useState<{ descriptionHebrew: string; quantity: string; unitPrice: string }[]>([{ descriptionHebrew: "", quantity: "1", unitPrice: "0" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const parsedLines = lines.map(line => ({ descriptionHebrew: line.descriptionHebrew, quantity: Number(line.quantity) || 0, unitPriceAgorot: Math.round((Number(line.unitPrice) || 0) * 100) }));
  const subtotalAgorot = parsedLines.reduce((sum, line) => sum + line.quantity * line.unitPriceAgorot, 0);
  const vatAgorot = Math.round(subtotalAgorot * vatPercent / 100);

  async function submit() {
    setBusy(true); setError("");
    try {
      await api("/billing/invoices", { method: "POST", body: JSON.stringify({ organizationId, draft: { customerId, documentType, currency: "ILS", locale: "he", direction: "rtl", vatRateBps: Math.round(vatPercent * 100), lines: parsedLines } }) });
      onCreated();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : s.createInvoiceErrorFallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{s.newInvoice}</h2>
          <button onClick={onClose} aria-label={s.close}><X className="h-4 w-4" /></button>
        </div>
        {error && <p className="notice notice-error mb-3" role="alert">{error}</p>}
        <div className="grid gap-4">
          <label className="field">
            <span>{s.customerLabel}</span>
            <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              {customers.length === 0 && <option value="">{s.selectCustomerPlaceholder}</option>}
              {customers.map(customer => <option key={customer.id} value={customer.id}>{customerName(customer)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{s.documentTypeLabel}</span>
            <select className="input" value={documentType} onChange={e => setDocumentType(e.target.value as typeof documentTypes[number])}>
              {documentTypes.map(type => <option key={type} value={type}>{(s.documentTypes as Record<string, string>)[type]}</option>)}
            </select>
          </label>
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div className="grid grid-cols-[1fr_80px_100px_32px] gap-2" key={index}>
                <input className="input" placeholder={s.lineDescriptionLabel} value={line.descriptionHebrew} onChange={e => setLines(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, descriptionHebrew: e.target.value } : item))} />
                <input className="input" type="number" min={1} placeholder={s.lineQuantityLabel} value={line.quantity} onChange={e => setLines(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: e.target.value } : item))} />
                <input className="input" type="number" min={0} placeholder={s.lineUnitPriceLabel} value={line.unitPrice} onChange={e => setLines(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, unitPrice: e.target.value } : item))} />
                <button onClick={() => setLines(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={s.close} disabled={lines.length === 1}><Trash2 className="h-4 w-4 text-[var(--muted)]" /></button>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setLines(current => [...current, { descriptionHebrew: "", quantity: "1", unitPrice: "0" }])}><Plus className="h-3.5 w-3.5" />{s.addLine}</Button>
          </div>
          <label className="field">
            <span>{s.vatRateLabel}</span>
            <input className="input" type="number" min={0} max={100} value={vatPercent} onChange={e => setVatPercent(Number(e.target.value) || 0)} />
          </label>
          <div className="rounded-xl border border-[var(--border)] p-3 text-[11px]">
            <div className="flex justify-between"><span>{s.subtotal}</span><span>{money(subtotalAgorot / 100)}</span></div>
            <div className="flex justify-between"><span>{s.vat}</span><span>{money(vatAgorot / 100)}</span></div>
            <div className="mt-1 flex justify-between border-t border-[var(--border)] pt-1 font-semibold"><span>{s.total}</span><span>{money((subtotalAgorot + vatAgorot) / 100)}</span></div>
          </div>
          <Button disabled={busy || !customerId} onClick={() => void submit()}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{busy ? s.creatingInvoice : s.createInvoice}</Button>
        </div>
      </div>
    </div>
  );
}

function RecordPaymentModal({ invoice, organizationId, onClose, onRecorded }: { invoice: Invoice; organizationId: string; onClose: () => void; onRecorded: () => void }) {
  const s = t("billingPage");
  const outstandingAgorot = invoice.totalAgorot - invoice.paidAgorot;
  const [amount, setAmount] = useState(String(outstandingAgorot / 100));
  const [method, setMethod] = useState<typeof paymentMethods[number]>("bank_transfer");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true); setError("");
    try {
      await api(`/billing/invoices/${invoice.id}/payments`, { method: "POST", body: JSON.stringify({ organizationId, amountAgorot: Math.round((Number(amount) || 0) * 100), method, note: note || undefined }) });
      onRecorded();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : s.recordPaymentErrorFallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{s.invoiceOf(invoice.number)}</h2>
          <button onClick={onClose} aria-label={s.close}><X className="h-4 w-4" /></button>
        </div>
        {error && <p className="notice notice-error mb-3" role="alert">{error}</p>}
        <div className="grid gap-4">
          <label className="field"><span>{s.amountLabel}</span><input className="input" type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} /></label>
          <label className="field">
            <span>{s.methodLabel}</span>
            <select className="input" value={method} onChange={e => setMethod(e.target.value as typeof paymentMethods[number])}>
              {paymentMethods.map(item => <option key={item} value={item}>{(s.methods as Record<string, string>)[item]}</option>)}
            </select>
          </label>
          <label className="field"><span>{s.noteLabel}</span><input className="input" value={note} onChange={e => setNote(e.target.value)} /></label>
          <Button disabled={busy} onClick={() => void submit()}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{busy ? s.recordingPayment : s.recordPayment}</Button>
        </div>
      </div>
    </div>
  );
}
