"use client";
import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";
const fmt = (n: number) => (n ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); } catch { return s; } };

const DEFAULT_TERMS = `TERMS - The balance on this invoice is DUE & PAYABLE NOW.

The goods supplied on this invoice are done so in accordance with the conditions set out in our quotation. Payment by CASH, CHEQUE or CREDIT CARD made in full on completion of job. Alternatively, payment can be made by ELECTRONIC TRANSFER (please put job name or number as reference),
BSB 063 237,  ACCOUNT NO. 10487235

We reserve the right to charge interest on all outstanding monies.

We will further invoice you for any variations you have agreed for and any works completed by us in which you failed to do in preparing for our installation, which we agreed you would do in acceptance of our quote. ie removal of furniture, floor coverings or any other preparation.`;

interface Payment { id: number; amount: number; method: string; reference?: string; paidOn: string; }
interface Invoice {
  id: number; invoiceNumber: string; invoiceDate: string; dueDate: string;
  grossAmount: number; taxAmount: number; totalAmount: number; status: string;
  credit?: number; retentionRelease?: number; notes?: string;
  payments: Payment[];
}
interface Job {
  id: number; title: string; status: string; gstRate?: number; description?: string;
  customer?: { name?: string; email?: string; phone?: string; address?: string; city?: string; state?: string; postcode?: string; };
  siteStreet?: string; siteTown?: string; siteState?: string; siteZip?: string;
  billingStreet?: string; billingTown?: string; billingState?: string; billingZip?: string;
  customerName?: string;
}

export default function TaxInvoicePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const jobId = params?.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scopeText, setScopeText] = useState("TO SUPPLY AND INSTALL :\n\nTO:\n\nTHIS QUOTATION INCLUDES:\nTAKE UP AND DISPOSAL OF EXISTING CARPET.\nBASIC FURNITURE HANDLING.\nPlease remove all personal items from movable wardrobes, dressers and the like. Ensure that computers and stereos are disconnected and removed.");
  const [termsText, setTermsText] = useState(DEFAULT_TERMS);
  const [payLabel, setPayLabel] = useState("C.O.D.");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [emailModal, setEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/jobs/${jobId}`),
      fetch(`${API}/billing/jobs/${jobId}/invoices`),
    ]).then(async ([jr, br]) => {
      const jd: Job = await jr.json();
      setJob(jd);
      if (jd.description) {
        try {
          const p = JSON.parse(jd.description);
          const parts = [];
          if (p.supplyInstall) parts.push(`TO SUPPLY AND INSTALL :\n${p.supplyInstall}`);
          if (p.rooms) parts.push(`TO:\n${p.rooms}`);
          const inc = p.inclusions || "TAKE UP AND DISPOSAL OF EXISTING CARPET.\nBASIC FURNITURE HANDLING.\nPlease remove all personal items from movable wardrobes, dressers and the like. Ensure that computers and stereos are disconnected and removed.";
          parts.push(`THIS QUOTATION INCLUDES:\n${inc}`);
          if (parts.length > 0) setScopeText(parts.join("\n\n"));
        } catch { /* use default */ }
      }
      if (br.ok) {
        const bd: Invoice[] = await br.json();
        const list = Array.isArray(bd) ? bd : [];
        setInvoices(list);
        if (list.length > 0) {
          const qInv = searchParams?.get("inv");
          const preselect = qInv ? list.find(i => i.id === parseInt(qInv)) : null;
          setSelectedId(preselect ? preselect.id : list[0].id);
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [jobId]);

  const inv = invoices.find(i => i.id === selectedId) ?? null;
  const paid = (inv?.payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
  const balance = (inv?.totalAmount ?? 0) - paid;
  const net = inv ? inv.totalAmount - inv.taxAmount : 0;

  const clientName = job?.customer?.name ?? job?.customerName ?? "";
  const clientState = job?.billingState ?? job?.customer?.state ?? "";
  const clientEmail = job?.customer?.email ?? "";
  const siteAddr = [job?.siteStreet, job?.siteTown, job?.siteState, job?.siteZip].filter(Boolean).join(" ");

  const openEmail = () => {
    if (!inv) return;
    setEmailTo(job?.customer?.email ?? "");
    setEmailSubject(`Tax Invoice ${inv.invoiceNumber} — Flooring Junction`);
    setEmailBody(`Dear ${clientName || "Customer"},\n\nPlease find attached your tax invoice ${inv.invoiceNumber}.\n\nIf you have any questions, please don't hesitate to contact us.\n\nThank you for your business.\n\nFlooring Junction\nP 03 9796 3255`);
    setEmailModal(true);
  };

  const doEmail = async () => {
    if (!inv || !emailTo) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/jobs/${jobId}/invoice/${inv.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo, subject: emailSubject, body: emailBody }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to send");
      setEmailModal(false);
      showToast(`Invoice emailed to ${emailTo}`, true);
    } catch (e) {
      showToast((e as Error).message || "Failed to send email", false);
    } finally {
      setSending(false);
    }
  };

  const doPrint = () => {
    if (!inv || !job) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Tax Invoice ${inv.invoiceNumber}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; padding: 28px 36px; color: #111; font-size: 12.5px; }
.top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.logo { font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #111; }
.logo-sub { font-size: 10px; color: #555; margin-top: 2px; letter-spacing: 1px; }
.co-info { text-align: right; font-size: 10px; color: #444; line-height: 1.75; }
.client-row { display: flex; justify-content: space-between; margin-bottom: 18px; }
.client-col { font-size: 12px; line-height: 1.9; }
.inv-col { text-align: right; }
.inv-title { font-size: 20px; font-weight: 700; color: #111; }
.inv-num { font-size: 14px; font-weight: 700; }
.inv-date { font-size: 12px; color: #444; }
.site-addr { font-size: 11.5px; color: #444; margin-top: 4px; }
.scope-box { border: 1px solid #bbb; padding: 10px 14px; min-height: 120px; font-size: 12px; line-height: 1.75; white-space: pre-wrap; margin-bottom: 14px; }
.cod-box { display: inline-block; border: 2px solid #bbb; padding: 6px 18px; font-size: 14px; font-weight: 700; margin-bottom: 12px; }
.terms-box { border: 1px solid #bbb; padding: 10px 14px; font-size: 11px; line-height: 1.75; white-space: pre-wrap; margin-bottom: 14px; }
.totals-wrap { display: flex; justify-content: flex-end; }
.totals-box { border: 1px solid #bbb; width: 260px; font-size: 12px; }
.totals-title { background: #f0f0f0; padding: 6px 12px; font-weight: 700; text-align: center; font-size: 11.5px; border-bottom: 1px solid #bbb; }
.totals-row { display: flex; justify-content: space-between; padding: 4px 12px; border-bottom: 1px solid #f0f0f0; }
.totals-row.bold { font-weight: 700; }
.totals-row.balance { font-weight: 700; background: #f9f9f9; }
@media print { body { padding: 16px 24px; } }
</style></head><body>
<div class="top">
  <div>
    <div class="logo">FLOORING JUNCTION</div>
    <div class="logo-sub">CARPET WORLD HALLAM</div>
  </div>
  <div class="co-info">
    Flooring Junction Pty Ltd<br>T/A Carpet World Hallam<br>3/2-10 Hallam South Road<br>HALLAM VIC 3803<br>P 03 9796 3255<br>info@carpetworld.com.au<br>ABN 90 661 948 456
  </div>
</div>
<div class="client-row">
  <div class="client-col">
    ${clientName ? `<strong>${clientName}</strong><br>` : ""}
    ${clientState ? `${clientState}<br>` : ""}
    Australia${clientEmail ? `<br>${clientEmail}` : ""}
  </div>
  <div class="inv-col">
    <div class="inv-title">Tax Invoice</div>
    <div class="inv-num">${inv.invoiceNumber}</div>
    <div class="inv-date">${fmtDate(inv.invoiceDate)}</div>
    <div class="site-addr">${siteAddr}<br>Australia</div>
  </div>
</div>
<div class="scope-box">${scopeText.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>")}</div>
<div class="cod-box">${payLabel}</div>
<div class="terms-box">${termsText.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>")}</div>
<div class="totals-wrap">
  <div class="totals-box">
    <div class="totals-title">Payment Due &nbsp;${fmtDate(inv.invoiceDate)}</div>
    <div class="totals-row"><span>Net</span><span>$${fmt(inv.totalAmount - inv.taxAmount)}</span></div>
    <div class="totals-row"><span>GST &nbsp;10%</span><span>$${fmt(inv.taxAmount)}</span></div>
    <div class="totals-row"><span>Rounding</span><span></span></div>
    <div class="totals-row bold"><span>Total Charge</span><span>$${fmt(inv.totalAmount)}</span></div>
    <div class="totals-row" style="color:#16a34a"><span>Paid</span><span>$${fmt(paid)}</span></div>
    <div class="totals-row"><span>Retention</span><span></span></div>
    <div class="totals-row"><span>Credit</span><span>${(inv.credit ?? 0) > 0 ? `$${fmt(inv.credit ?? 0)}` : ""}</span></div>
    <div class="totals-row balance"><span>Balance Due</span><span>$${fmt(Math.max(0, balance))}</span></div>
  </div>
</div>
</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 350);
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#9ca3af", fontFamily: "'DM Sans',sans-serif" }}>Loading…</div>;
  if (!job) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#dc2626" }}>Job not found</div>;

  const TA = ({ value, onChange, rows = 4 }: { value: string; onChange: (v: string) => void; rows?: number }) => (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
      style={{ width: "100%", padding: "10px 14px", fontSize: 12.5, border: "1px solid #bbb", borderRadius: 0, outline: "none", resize: "vertical", fontFamily: "Arial, sans-serif", lineHeight: 1.75, background: "#fff" }} />
  );

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", maxWidth: 860, margin: "0 auto", padding: "20px 24px" }}>
      {toast && <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: toast.ok ? "#16a34a" : "#dc2626" }}>{toast.ok ? "✓" : "✕"} {toast.msg}</div>}

      {/* Email Modal */}
      {emailModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setEmailModal(false)}>
          <div style={{ background: "#fff", borderRadius: 12, width: 520, maxWidth: "95vw", boxShadow: "0 20px 50px rgba(0,0,0,0.2)", fontFamily: "'DM Sans',sans-serif" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 22px", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Email Tax Invoice</span>
              <button onClick={() => setEmailModal(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "To", value: emailTo, set: setEmailTo, type: "email" },
                { label: "Subject", value: emailSubject, set: setEmailSubject, type: "text" },
              ].map(({ label, value, set, type }) => (
                <div key={label}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{label}</label>
                  <input type={type} value={value} onChange={e => set(e.target.value)}
                    style={{ width: "100%", padding: "8px 11px", fontSize: 13, border: "1px solid #e8eaed", borderRadius: 7, outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Message</label>
                <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6}
                  style={{ width: "100%", padding: "8px 11px", fontSize: 13, border: "1px solid #e8eaed", borderRadius: 7, outline: "none", resize: "vertical", fontFamily: "'DM Sans',sans-serif" }} />
              </div>
              <div style={{ fontSize: 11.5, color: "#9ca3af" }}>The invoice PDF will be attached automatically.</div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 22px", borderTop: "1px solid #f3f4f6" }}>
              <button onClick={() => setEmailModal(false)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #e8eaed", borderRadius: 7, cursor: "pointer" }}>Cancel</button>
              <button onClick={doEmail} disabled={sending || !emailTo}
                style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: sending || !emailTo ? "#e8eaed" : "#16a34a", color: sending || !emailTo ? "#9ca3af" : "#fff", border: "none", borderRadius: 7, cursor: sending || !emailTo ? "default" : "pointer" }}>
                {sending ? "Sending…" : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Invoice:</label>
          {invoices.length === 0
            ? <span style={{ fontSize: 13, color: "#9ca3af" }}>No invoices — create one in the Billing tab</span>
            : <select value={selectedId ?? ""} onChange={e => setSelectedId(Number(e.target.value))}
                style={{ fontSize: 13, padding: "7px 12px", border: "1px solid #e8eaed", borderRadius: 7, outline: "none", fontFamily: "'DM Sans',sans-serif" }}>
                {invoices.map(i => <option key={i.id} value={i.id}>{i.invoiceNumber} — {fmtDate(i.invoiceDate)} — ${fmt(i.totalAmount)}</option>)}
              </select>
          }
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={openEmail} disabled={!inv}
            style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, background: inv ? "#f0fdf4" : "#f9fafb", color: inv ? "#16a34a" : "#9ca3af", border: `1px solid ${inv ? "#86efac" : "#e8eaed"}`, borderRadius: 7, cursor: inv ? "pointer" : "default" }}>
            ✉ Email Invoice
          </button>
          <button onClick={doPrint} disabled={!inv}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: inv ? "#1e3a8a" : "#e8eaed", color: inv ? "#fff" : "#9ca3af", border: "none", borderRadius: 7, cursor: inv ? "pointer" : "default" }}>
            🖨 Print / Save PDF
          </button>
        </div>
      </div>

      {inv ? (
        <div style={{ background: "#fff", border: "1px solid #d1d5db", padding: "28px 36px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>

          {/* Company header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 2, color: "#111" }}>FLOORING JUNCTION</div>
              <div style={{ fontSize: 10, color: "#777", letterSpacing: 1, marginTop: 2 }}>CARPET WORLD HALLAM</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 10.5, color: "#555", lineHeight: 1.8 }}>
              Flooring Junction Pty Ltd<br />
              T/A Carpet World Hallam<br />
              3/2-10 Hallam South Road<br />
              HALLAM VIC 3803<br />
              P 03 9796 3255<br />
              info@carpetworld.com.au<br />
              ABN 90 661 948 456
            </div>
          </div>

          {/* Client + Invoice meta */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div style={{ fontSize: 13, lineHeight: 2, color: "#222" }}>
              {clientName && <div style={{ fontWeight: 600 }}>{clientName}</div>}
              {clientState && <div>{clientState}</div>}
              <div>Australia</div>
              {clientEmail && <div>{clientEmail}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>Tax Invoice</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{inv.invoiceNumber}</div>
              <div style={{ fontSize: 12, color: "#555" }}>{fmtDate(inv.invoiceDate)}</div>
              {siteAddr && <div style={{ fontSize: 11.5, color: "#666", marginTop: 4 }}>{siteAddr}<br />Australia</div>}
            </div>
          </div>

          {/* Scope — editable */}
          <TA value={scopeText} onChange={setScopeText} rows={8} />

          {/* C.O.D. label — editable inline */}
          <div style={{ margin: "12px 0 10px" }}>
            <input value={payLabel} onChange={e => setPayLabel(e.target.value)}
              style={{ display: "inline-block", border: "2px solid #999", padding: "5px 18px", fontSize: 14, fontWeight: 700, fontFamily: "Arial,sans-serif", outline: "none", background: "#fff", minWidth: 80 }} />
          </div>

          {/* Terms — editable */}
          <TA value={termsText} onChange={setTermsText} rows={10} />

          {/* Totals box */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <div style={{ width: 260, border: "1px solid #bbb", fontSize: 12.5 }}>
              <div style={{ background: "#f0f0f0", padding: "7px 12px", fontWeight: 700, textAlign: "center", fontSize: 11.5, borderBottom: "1px solid #bbb" }}>
                Payment Due &nbsp; {fmtDate(inv.invoiceDate)}
              </div>
              {[
                ["Net", `$${fmt(net)}`],
                ["GST  10%", `$${fmt(inv.taxAmount)}`],
                ["Rounding", ""],
                ["Total Charge", `$${fmt(inv.totalAmount)}`],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", borderBottom: "1px solid #f0f0f0", fontWeight: l === "Total Charge" ? 700 : 400 }}>
                  <span>{l}</span><span>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", borderBottom: "1px solid #f0f0f0", color: "#16a34a" }}>
                <span>Paid</span><span>${fmt(paid)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", borderBottom: "1px solid #f0f0f0" }}>
                <span>Retention</span><span></span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", borderBottom: "1px solid #f0f0f0" }}>
                <span>Credit</span><span>{(inv.credit ?? 0) > 0 ? `$${fmt(inv.credit ?? 0)}` : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", fontWeight: 700, background: "#f9f9f9", color: balance <= 0 ? "#16a34a" : "#991b1b" }}>
                <span>Balance Due</span><span>${fmt(Math.max(0, balance))}</span>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 10, padding: 48, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          No invoices found for this job.<br />
          <span style={{ fontSize: 12 }}>Create an invoice in the <strong>Billing</strong> tab first.</span>
        </div>
      )}
    </div>
  );
}
