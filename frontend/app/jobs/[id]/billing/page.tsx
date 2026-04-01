"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";
const fmt  = (n: number) => `$${(n ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtD = (s: string) => { try { return new Date(s).toLocaleDateString("en-AU"); } catch { return s; } };
const todayStr = () => new Date().toISOString().slice(0, 10);

interface Payment { id: number; amount: number; method: string; reference?: string; paidOn: string; }
interface Invoice {
  id: number; invoiceNumber: string; invoiceDate: string; dueDate: string;
  grossAmount: number; taxAmount: number; totalAmount: number;
  credit: number; retentionRelease: number; status: string; notes?: string;
  payments: Payment[];
}
interface Job {
  id: number; title: string; status: string; jobRef?: string;
  costPrice?: number; sellPrice?: number; finalQuote?: number; gstRate?: number;
  customer?: { name?: string; email?: string; phone?: string; };
  customerName?: string;
  siteStreet?: string; siteTown?: string; siteState?: string; siteZip?: string;
}

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  unpaid:  { bg: "#fee2e2", color: "#991b1b", label: "Unpaid"  },
  partial: { bg: "#fff7ed", color: "#c2410c", label: "Partial" },
  paid:    { bg: "#dcfce7", color: "#166534", label: "Paid"    },
};

export default function BillingPage() {
  const router = useRouter();
  const params = useParams();
  const jobId  = params?.id as string;

  const [job,      setJob]      = useState<Job | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);

  // Editable job reference
  const [jobRef,     setJobRef]     = useState("");
  const [editingRef, setEditingRef] = useState(false);

  // New invoice form
  const [showForm, setShowForm] = useState(false);
  const [newInv,   setNewInv]   = useState({ invoiceDate: todayStr(), grossAmount: "", credit: "", retention: "", notes: "" });

  // Payment form (shown inline under the invoice row)
  const [payId,   setPayId]   = useState<number | null>(null);
  const [newPay,  setNewPay]  = useState({ paidOn: todayStr(), amount: "", method: "EFT", reference: "" });

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      const [jr, br] = await Promise.all([
        fetch(`${API}/jobs/${jobId}`),
        fetch(`${API}/billing/jobs/${jobId}/invoices`),
      ]);
      const jd: Job = await jr.json();
      setJob(jd);
      setJobRef(jd.jobRef ?? "");
      if (br.ok) {
        const bd = await br.json();
        setInvoices(Array.isArray(bd) ? bd : []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived totals (use totalAmount which includes GST) ──────────────────
  const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount ?? 0), 0);
  const totalReceived = invoices.reduce((s, i) => s + (i.payments ?? []).reduce((ps, p) => ps + (p.amount ?? 0), 0), 0);
  const balanceDue    = totalInvoiced - totalReceived;

  // ── Create invoice ────────────────────────────────────────────────────────
  const createInvoice = async () => {
    if (!newInv.grossAmount) { showToast("Enter a gross amount", false); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/billing/jobs/${jobId}/invoices`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceDate:     newInv.invoiceDate,
          grossAmount:     parseFloat(newInv.grossAmount),
          credit:          parseFloat(newInv.credit)     || 0,
          retentionRelease:parseFloat(newInv.retention)  || 0,
          notes:           newInv.notes || null,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      setShowForm(false);
      setNewInv({ invoiceDate: todayStr(), grossAmount: "", credit: "", retention: "", notes: "" });
      showToast("Invoice created", true);
      load();
    } catch (e) { showToast((e as Error).message, false); }
    finally { setSaving(false); }
  };

  // Open new invoice form and pre-fill amount from job's final quote
  const openNewInvoice = () => {
    const prefill = String(job?.finalQuote || job?.sellPrice || "");
    setNewInv(p => ({ ...p, grossAmount: p.grossAmount || prefill }));
    setShowForm(true);
  };

  // ── Record payment ────────────────────────────────────────────────────────
  const recordPayment = async () => {
    if (!payId || !newPay.amount) { showToast("Enter payment amount", false); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/billing/invoices/${payId}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount:    parseFloat(newPay.amount),
          method:    newPay.method,
          reference: newPay.reference || null,
          paidOn:    newPay.paidOn,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      setPayId(null);
      setNewPay({ paidOn: todayStr(), amount: "", method: "EFT", reference: "" });
      showToast("Payment recorded", true);
      load();
    } catch (e) { showToast((e as Error).message, false); }
    finally { setSaving(false); }
  };

  // Pre-fill payment amount with remaining balance
  const openPayment = (inv: Invoice) => {
    const paid = (inv.payments ?? []).reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, (inv.totalAmount ?? 0) - paid);
    setPayId(inv.id);
    setNewPay({ paidOn: todayStr(), amount: remaining > 0 ? remaining.toFixed(2) : "", method: "EFT", reference: "" });
  };

  // ── Save job reference ───────────────────────────────────────────────────
  const saveJobRef = async () => {
    try {
      await fetch(`${API}/jobs/${jobId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobRef }),
      });
      setEditingRef(false);
      showToast("Job reference saved", true);
      load();
    } catch { showToast("Failed to save reference", false); }
  };

  // ── Delete payment ────────────────────────────────────────────────────────
  const deletePayment = async (invId: number, payId: number) => {
    try {
      await fetch(`${API}/billing/invoices/${invId}/payments/${payId}`, { method: "DELETE" });
      showToast("Payment removed", true);
      load();
    } catch { showToast("Failed to remove payment", false); }
  };

  if (loading) return <div style={styles.center}>Loading…</div>;
  if (!job)    return <div style={{ ...styles.center, color: "#dc2626" }}>Job not found</div>;

  const clientName = job.customer?.name ?? job.customerName ?? "";
  const siteAddr   = [job.siteStreet, job.siteTown, job.siteState, job.siteZip].filter(Boolean).join(", ");

  return (
    <div style={styles.page}>
      {toast && <div style={{ ...styles.toast, background: toast.ok ? "#15803d" : "#b91c1c" }}>{toast.ok ? "✓" : "✕"} {toast.msg}</div>}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={styles.pageHeader}>
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
            Job #{job.id} &nbsp;·&nbsp; {clientName}{siteAddr ? ` — ${siteAddr}` : ""}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Billing</div>
          {/* Editable Job Reference */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Job Ref:</span>
            {editingRef ? (
              <>
                <input
                  value={jobRef}
                  onChange={e => setJobRef(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveJobRef(); if (e.key === "Escape") setEditingRef(false); }}
                  autoFocus
                  placeholder="e.g. JOB-001, PO-1234…"
                  style={{ fontSize: 12, padding: "4px 8px", border: "1.5px solid #2563eb", borderRadius: 6, outline: "none", width: 180, fontFamily: "'DM Mono',monospace" }}
                />
                <button onClick={saveJobRef} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>Save</button>
                <button onClick={() => setEditingRef(false)} style={{ fontSize: 11, padding: "4px 8px", background: "none", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 5, cursor: "pointer" }}>Cancel</button>
              </>
            ) : (
              <span
                onClick={() => setEditingRef(true)}
                title="Click to edit job reference"
                style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: jobRef ? "#111827" : "#9ca3af", cursor: "pointer", borderBottom: "1px dashed #d1d5db", paddingBottom: 1 }}>
                {jobRef || "— click to set —"}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.btnGhost} onClick={() => router.push(`/jobs/${jobId}/tax-invoice`)}>
            🧾 View Tax Invoice
          </button>
          <button style={styles.btnPrimary} onClick={openNewInvoice}>
            + New Invoice
          </button>
        </div>
      </div>

      {/* ── Financial summary ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total Cost",     value: fmt(job.costPrice  ?? 0), color: "#374151", sub: "ex GST" },
          { label: "Total Sell",     value: fmt(job.finalQuote ?? job.sellPrice ?? 0), color: "#2563eb", sub: "inc GST" },
          { label: "Total Invoiced", value: fmt(totalInvoiced),        color: "#7c3aed", sub: "inc GST" },
          { label: "Total Received", value: fmt(totalReceived),        color: "#16a34a", sub: "" },
          { label: "Balance Due",    value: fmt(balanceDue),           color: balanceDue > 0 ? "#dc2626" : "#16a34a", sub: "" },
        ].map(c => (
          <div key={c.label} style={styles.card}>
            <div style={styles.cardLabel}>{c.label}</div>
            <div style={{ ...styles.cardValue, color: c.color }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── New Invoice form ────────────────────────────────────────────── */}
      {showForm && (
        <div style={styles.formBox}>
          <div style={styles.formTitle}>New Invoice for Job #{job.id}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
            {[
              { label: "Date",              key: "invoiceDate",  type: "date"   },
              { label: "Gross Amount ($)",  key: "grossAmount",  type: "number" },
              { label: "Credit ($)",        key: "credit",       type: "number" },
              { label: "Retention ($)",     key: "retention",    type: "number" },
            ].map(f => (
              <div key={f.key}>
                <label style={styles.label}>{f.label}</label>
                <input type={f.type} value={newInv[f.key as keyof typeof newInv]}
                  onChange={e => setNewInv(p => ({ ...p, [f.key]: e.target.value }))}
                  style={styles.input} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={styles.label}>Notes (optional)</label>
            <input value={newInv.notes} onChange={e => setNewInv(p => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Deposit invoice, Progress claim #1…" style={styles.input} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.btnPrimary} onClick={createInvoice} disabled={saving}>{saving ? "Creating…" : "Create Invoice"}</button>
            <button style={styles.btnGhost}   onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Invoices ───────────────────────────────────────────────────── */}
      <div style={styles.tableBox}>
        <div style={styles.tableHeader}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Invoices ({invoices.length})</span>
        </div>

        {invoices.length === 0 ? (
          <div style={styles.empty}>No invoices yet — click &quot;+ New Invoice&quot; to create one</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["Invoice #", "Date", "Due", "Amount (inc GST)", "Paid", "Balance", "Status", ""].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, idx) => {
                const invPaid = (inv.payments ?? []).reduce((s, p) => s + p.amount, 0);
                const invBal  = (inv.totalAmount ?? 0) - invPaid;
                const sc = STATUS[inv.status] ?? STATUS.unpaid;
                const overdue = invBal > 0 && new Date(inv.dueDate) < new Date();
                return (
                  <React.Fragment key={inv.id}>
                    {/* Invoice row */}
                    <tr style={{ borderBottom: "1px solid #f3f4f6", background: payId === inv.id ? "#fafbff" : undefined }}>
                      <td style={{ ...styles.td, fontWeight: 700, color: "#2563eb", fontFamily: "monospace" }}>{inv.invoiceNumber}</td>
                      <td style={styles.td}>{fmtD(inv.invoiceDate)}</td>
                      <td style={{ ...styles.td, color: overdue ? "#dc2626" : "#374151" }}>{fmtD(inv.dueDate)}</td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{fmt(inv.totalAmount)}</td>
                      <td style={{ ...styles.td, color: "#16a34a" }}>{fmt(invPaid)}</td>
                      <td style={{ ...styles.td, fontWeight: 600, color: invBal > 0 ? "#dc2626" : "#16a34a" }}>{fmt(invBal)}</td>
                      <td style={styles.td}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: sc.bg, color: sc.color }}>{sc.label}</span>
                      </td>
                      <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={styles.actionBtn} onClick={() => payId === inv.id ? setPayId(null) : openPayment(inv)}>
                            {payId === inv.id ? "Cancel" : "💰 Receive Payment"}
                          </button>
                          <button style={{ ...styles.actionBtn, background: "#f0fdf4", color: "#16a34a" }}
                            onClick={() => router.push(`/jobs/${jobId}/tax-invoice?inv=${inv.id}`)}>
                            🧾 Tax Invoice
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Receive payment form */}
                    {payId === inv.id && (
                      <tr>
                        <td colSpan={8} style={{ padding: "14px 16px", background: "#f0fdf4", borderBottom: "1px solid #bbf7d0" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 10 }}>
                            Record Payment — {inv.invoiceNumber} &nbsp;(Balance: {fmt(invBal)})
                          </div>
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                            <div>
                              <label style={styles.label}>Date</label>
                              <input type="date" value={newPay.paidOn} onChange={e => setNewPay(p => ({ ...p, paidOn: e.target.value }))} style={{ ...styles.input, width: 145 }} />
                            </div>
                            <div>
                              <label style={styles.label}>Amount ($)</label>
                              <input type="number" step="0.01" value={newPay.amount} onChange={e => setNewPay(p => ({ ...p, amount: e.target.value }))} style={{ ...styles.input, width: 130, fontFamily: "monospace" }} />
                            </div>
                            <div>
                              <label style={styles.label}>Method</label>
                              <select value={newPay.method} onChange={e => setNewPay(p => ({ ...p, method: e.target.value }))} style={{ ...styles.input, width: 130 }}>
                                {["EFT","Cash","Cheque","Credit Card","EFTPOS","Other"].map(m => <option key={m}>{m}</option>)}
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={styles.label}>Reference</label>
                              <input value={newPay.reference} placeholder={`Job #${jobId}`} onChange={e => setNewPay(p => ({ ...p, reference: e.target.value }))} style={styles.input} />
                            </div>
                            <button style={{ ...styles.btnPrimary, background: "#16a34a" }} onClick={recordPayment} disabled={saving}>
                              {saving ? "Saving…" : "✓ Save Payment"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Payments sub-rows */}
                    {(inv.payments ?? []).map(p => (
                      <tr key={p.id} style={{ background: "#fafffe", borderBottom: "1px solid #f0fdf4" }}>
                        <td colSpan={2} style={{ ...styles.td, paddingLeft: 28, fontSize: 12, color: "#6b7280" }}>
                          ↳ Payment &nbsp; {fmtD(p.paidOn)}
                        </td>
                        <td colSpan={2} style={{ ...styles.td, fontSize: 12, color: "#6b7280" }}>
                          {p.method}{p.reference ? ` · ref: ${p.reference}` : ""}
                        </td>
                        <td style={{ ...styles.td, color: "#16a34a", fontWeight: 600, fontSize: 12 }}>{fmt(p.amount)}</td>
                        <td colSpan={2} style={styles.td} />
                        <td style={styles.td}>
                          <button onClick={() => deletePayment(inv.id, p.id)}
                            style={{ background: "none", border: "1px solid #f0f0f0", color: "#d1d5db", borderRadius: 4, cursor: "pointer", padding: "2px 7px", fontSize: 11 }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#dc2626"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#d1d5db"; }}>✕</button>
                        </td>
                      </tr>
                    ))}

                    {/* After payment recorded — send invoice prompt */}
                    {inv.status === "paid" && (
                      <tr>
                        <td colSpan={8} style={{ padding: "10px 16px", background: "#f0fdf4", borderBottom: "1px solid #bbf7d0" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>✓ Invoice fully paid — send the customer their receipt?</span>
                            <button style={{ ...styles.btnPrimary, background: "#16a34a", fontSize: 12, padding: "6px 14px" }}
                              onClick={() => router.push(`/jobs/${jobId}/tax-invoice?inv=${inv.id}`)}>Send Receipt / Tax Invoice →</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
      `}</style>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
import React from "react";

const styles: Record<string, React.CSSProperties> = {
  page:       { fontFamily: "'DM Sans',sans-serif", maxWidth: 1100, margin: "0 auto", padding: "24px 28px" },
  center:     { display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", fontFamily: "'DM Sans',sans-serif", color: "#9ca3af" },
  toast:      { position: "fixed", bottom: 24, right: 24, zIndex: 9999, padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  card:       { background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "16px 20px" },
  cardLabel:  { fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.7px", color: "#9ca3af", marginBottom: 6 },
  cardValue:  { fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700 },
  formBox:    { background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "18px 20px", marginBottom: 16 },
  formTitle:  { fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 14 },
  tableBox:   { background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, overflow: "hidden" },
  tableHeader:{ padding: "13px 18px", borderBottom: "1px solid #f3f4f6" },
  empty:      { padding: 36, textAlign: "center" as const, color: "#9ca3af", fontSize: 13 },
  th:         { padding: "9px 14px", textAlign: "left" as const, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.5px", color: "#6b7280", borderBottom: "1.5px solid #e5e7eb", background: "#f9fafb", whiteSpace: "nowrap" as const },
  td:         { padding: "11px 14px", fontSize: 13, color: "#374151" },
  label:      { display: "block" as const, fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 4 },
  input:      { width: "100%", padding: "8px 10px", fontSize: 13, border: "1.5px solid #e5e7eb", borderRadius: 7, outline: "none", fontFamily: "'DM Sans',sans-serif" },
  btnPrimary: { padding: "9px 18px", fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap" as const },
  btnGhost:   { padding: "8px 14px", fontSize: 13, fontWeight: 600, background: "#fff", color: "#374151", border: "1.5px solid #e5e7eb", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap" as const },
  actionBtn:  { fontSize: 12, fontWeight: 600, color: "#2563eb", background: "#eff6ff", border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" as const },
};
