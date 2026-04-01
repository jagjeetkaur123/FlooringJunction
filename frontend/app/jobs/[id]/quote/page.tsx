"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const fmt = (n: number) => (n ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nv = (v: number | string) => parseFloat(String(v) || "0") || 0;

interface LineItem { description: string; qty: number|string; unitSell: number|string; sellTax: number|string; isHeader: boolean; }
interface Job {
  id: number; title: string; gstRate?: number; description?: string;
  leadNumber?: string; jobCategory?: string; shop?: string; jobRef?: string;
  quoteDate?: string;
  contactName?: string; contactPhone?: string; contactEmail?: string;
  customer?: { name?: string; email?: string; phone?: string; address?: string; city?: string; state?: string; postcode?: string; };
  siteStreet?: string; siteTown?: string; siteState?: string; siteZip?: string; siteCountry?: string;
  billingStreet?: string; billingTown?: string; billingState?: string; billingZip?: string;
}

const DEFAULT_TERMS = `PAYMENT TERMS: Initial deposit 30%. Balance to be paid 3 working day's prior to installation.
All orders that are $1000 or under are to be paid in full upon acceptance of quotation.

Payment can be made with CASH, CHEQUE or CREDIT CARD. Alternatively, payment can be made by
ELECTRONIC TRANSFER [please put job name or number as reference].
BSB 063 237, ACCOUNT NO, 1048 7235`;

export default function QuotePage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params?.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [gstRate, setGstRate] = useState(10);
  const [quoteFields, setQuoteFields] = useState({
    supplyInstall: "",
    rooms: "",
    inclusions: "TAKE UP AND DISPOSAL OF EXISTING CARPET.\nBASIC FURNITURE HANDLING.\nPlease remove all personal items from movable wardrobes, dressers and the like. Ensure that computers and stereos are disconnected and removed.",
    exclusions: "Any unforeseen floor preparation will be quoted separately.",
  });
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_TERMS);
  const [saving, setSaving] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [email, setEmail] = useState({ to: "", subject: "", body: "" });

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    Promise.all([fetch(`${API}/jobs/${jobId}`), fetch(`${API}/jobs/${jobId}/line-items`)])
      .then(async ([jr, lr]) => {
        const jd: Job = await jr.json();
        const ld: LineItem[] = await lr.json();
        setJob(jd);
        setGstRate(jd.gstRate ?? 10);
        setItems(ld);
        try {
          const saved = JSON.parse(jd.description ?? "{}");
          if (typeof saved === "object" && saved !== null) setQuoteFields(f => ({ ...f, ...saved }));
        } catch { /* plain text fallback — leave defaults */ }
        setLoading(false);
        setEmail({
          to: jd.customer?.email ?? jd.contactEmail ?? "",
          subject: `Quote Q-${String(jd.id).padStart(5, "0")} — Flooring Junction`,
          body: `Dear ${jd.customer?.name ?? ""},\n\nPlease find your quote attached.\n\nThank you for considering Flooring Junction.\n\nKind regards,\nKamal Hira\nFlooring Junction`,
        });
      })
      .catch(() => setLoading(false));
  }, [jobId]);

  const dataRows = items.filter(li => !li.isHeader);
  const grossSell = dataRows.reduce((s, li) => s + nv(li.qty) * nv(li.unitSell), 0);
  const gstAmt = grossSell * (gstRate / 100);
  const total = grossSell + gstAmt;

  const handleSaveText = async () => {
    if (!jobId) return;
    setSaving(true);
    try {
      await fetch(`${API}/jobs/${jobId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: JSON.stringify(quoteFields) }),
      });
      showToast("Quote text saved", true);
    } catch { showToast("Save failed", false); }
    finally { setSaving(false); }
  };

  const doPrint = () => {
    if (!job) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
    const siteAddrHtml = [job.siteStreet, job.siteTown && `${job.siteTown} ${job.siteState ?? ""}`.trim(), job.siteCountry].filter((s): s is string => !!s).map(esc).join("<br>");
    w.document.write(`<!DOCTYPE html><html><head><title>Quote ${qNum}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 32px 40px; color: #1a1a2e; font-size: 12px; margin: 0; }
      @media print { body { padding: 18px 24px; } }
      .hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; border-bottom:2px solid #1e3a8a; padding-bottom:14px; }
      .logo { font-size:22px; font-weight:900; letter-spacing:1px; color:#1e3a8a; }
      .co { font-size:10px; color:#555; line-height:1.7; margin-top:6px; }
      .doc-label { font-size:28px; font-weight:700; color:#1e3a8a; text-align:right; }
      .doc-num { font-size:16px; font-weight:700; color:#222; text-align:right; }
      .doc-date { font-size:11px; color:#555; text-align:right; margin-top:3px; }
      .parties { display:flex; justify-content:space-between; margin-bottom:16px; }
      .party { width:48%; }
      .party-name { font-size:14px; font-weight:700; color:#111; margin-bottom:3px; }
      .party-line { font-size:11px; color:#444; line-height:1.7; }
      .party-lbl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#999; margin-bottom:3px; }
      .scope { border:1px solid #ccc; border-radius:4px; margin-bottom:14px; overflow:hidden; }
      .scope-row { display:flex; border-bottom:1px solid #eee; }
      .scope-row:last-child { border-bottom:none; }
      .scope-key { font-size:10px; font-weight:700; text-transform:uppercase; color:#666; padding:9px 10px; width:200px; flex-shrink:0; background:#f9f9f9; border-right:1px solid #eee; }
      .scope-val { font-size:11px; color:#222; padding:9px 12px; line-height:1.7; }
      .cod { border:1px solid #ccc; border-radius:4px; padding:8px 14px; font-size:13px; font-weight:700; color:#111; margin-bottom:10px; }
      .terms { border:1px solid #ccc; border-radius:4px; padding:12px 14px; font-size:11px; color:#333; line-height:1.8; margin-bottom:16px; white-space:pre-wrap; }
      .totals { display:flex; justify-content:flex-end; margin-bottom:20px; }
      table.t { width:240px; border-collapse:collapse; }
      table.t td { padding:5px 10px; font-size:12px; }
      .tl { color:#555; text-align:right; }
      .tv { font-weight:600; text-align:right; font-family:monospace; }
      .grand { font-size:15px; font-weight:700; color:#1e3a8a; border-top:2px solid #1e3a8a; }
      .footer { display:flex; justify-content:space-between; margin-top:24px; font-size:11px; color:#555; border-top:1px solid #eee; padding-top:16px; }
      .sig-name { font-weight:700; color:#111; font-size:13px; }
      .sig-box { border:1px solid #ccc; border-radius:4px; padding:10px 60px; color:#aaa; text-align:center; margin-bottom:4px; font-size:12px; }
    </style></head><body>
    <div class="hdr">
      <div><div class="logo">FLOORING JUNCTION</div><div class="co">Flooring Junction Pty Ltd &nbsp;T/A Carpet World Hallam<br>3/2-10 Hallam South Road, HALLAM VIC 3803<br>P 03 9796 3255 &nbsp;·&nbsp; info@carpetworldhallam.com.au<br>ABN 96 661 948 456</div></div>
      <div><div class="doc-label">Quote</div><div class="doc-num">${esc(String(job.leadNumber ?? job.id))}</div><div class="doc-date">${esc(today)}</div></div>
    </div>
    <div class="parties">
      <div class="party">
        <div class="party-name">${esc(clientName)}</div>
        ${clientState ? `<div class="party-line">${esc(clientState)}</div>` : ""}
        ${clientEmail ? `<div class="party-line">${esc(clientEmail)}</div>` : ""}
        ${clientPhone ? `<div class="party-line">${esc(clientPhone)}</div>` : ""}
      </div>
      ${siteAddrHtml ? `<div class="party" style="text-align:right"><div class="party-lbl">Installation Site</div><div class="party-line">${siteAddrHtml}</div></div>` : ""}
    </div>
    <div class="scope">
      ${quoteFields.supplyInstall ? `<div class="scope-row"><div class="scope-key">To Supply &amp; Install</div><div class="scope-val">${esc(quoteFields.supplyInstall)}</div></div>` : ""}
      ${quoteFields.rooms ? `<div class="scope-row"><div class="scope-key">To</div><div class="scope-val">${esc(quoteFields.rooms)}</div></div>` : ""}
      ${quoteFields.inclusions ? `<div class="scope-row"><div class="scope-key">This Quotation Includes</div><div class="scope-val">${esc(quoteFields.inclusions)}</div></div>` : ""}
      ${quoteFields.exclusions ? `<div class="scope-row"><div class="scope-key">Does Not Include</div><div class="scope-val">${esc(quoteFields.exclusions)}</div></div>` : ""}
    </div>
    <div class="cod">C.O.D.</div>
    <div class="terms">${esc(paymentTerms)}</div>
    <div class="totals"><table class="t"><tr><td class="tl">Net</td><td class="tv">$${fmt(grossSell)}</td></tr><tr><td class="tl">GST ${gstRate}%</td><td class="tv">$${fmt(gstAmt)}</td></tr><tr class="grand"><td class="tl grand">Total</td><td class="tv grand">$${fmt(total)}</td></tr></table></div>
    <div class="footer"><div><div class="sig-name">Kamal Hira</div><div>Carpet World Hallam</div></div><div style="text-align:right"><div class="sig-box">Customer Signature</div><div>Date: ___________________</div></div></div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const handleSend = async () => {
    if (!job) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/jobs/${job.id}/quote/email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setShowEmail(false);
      showToast(`Quote emailed to ${d.sentTo}`, true);
    } catch (e) {
      showToast((e as Error).message || "Email failed", false);
    } finally { setSending(false); }
  };

  if (loading) return <div className="loading">Loading…</div>;
  if (!job) return <div className="loading" style={{ color: "#dc2626" }}>Job not found.</div>;

  const qNum = `Q-${String(job.id).padStart(5, "0")}`;
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  const siteAddr = [job.siteStreet, job.siteTown && `${job.siteTown} ${job.siteState ?? ""}`.trim(), job.siteCountry].filter(Boolean).join(", ");
  const clientName = job.customer?.name ?? job.contactName ?? "—";
  const clientEmail = job.customer?.email ?? job.contactEmail ?? "";
  const clientPhone = job.customer?.phone ?? job.contactPhone ?? "";
  const clientState = [job.customer?.state, job.customer?.postcode].filter(Boolean).join(" ");

  return (
    <div className="page">
      {toast && <div className={`toast ${toast.ok ? "toast-ok" : "toast-err"}`}>{toast.ok ? "✓" : "✕"} {toast.msg}</div>}

      {/* Email Modal */}
      {showEmail && (
        <div className="modal-bg" onClick={() => setShowEmail(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">✉ Email Quote to Customer</span>
              <button className="modal-close" onClick={() => setShowEmail(false)}>✕</button>
            </div>
            <div className="modal-body">
              {[{label:"To",key:"to",type:"email"},{label:"Subject",key:"subject",type:"text"}].map(({label,key,type})=>(
                <div className="field" key={key}>
                  <label>{label}</label>
                  <input className="inp" type={type} value={email[key as keyof typeof email]} onChange={e=>setEmail(p=>({...p,[key]:e.target.value}))} />
                </div>
              ))}
              <div className="field">
                <label>Message</label>
                <textarea className="inp" rows={6} value={email.body} onChange={e=>setEmail(p=>({...p,body:e.target.value}))} />
              </div>
              <div className="modal-footer">
                <button className="btn-ghost" onClick={() => setShowEmail(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleSend} disabled={sending}>{sending ? "Sending…" : "Send Quote ✉"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <span onClick={() => router.push("/jobs")}>Jobs</span> ›{" "}
            <span onClick={() => router.push(`/jobs/${job.id}`)}>#{job.id} {job.title}</span> › Quote
          </div>
          <h1 className="page-title">Quote {qNum}</h1>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => router.push(`/jobs/${job.id}/cost-sell`)}>← Cost & Sell</button>
          <button className="btn-ghost" onClick={handleSaveText} disabled={saving}>{saving ? "Saving…" : "Save Text"}</button>
          <button className="btn-ghost" onClick={() => setShowEmail(true)}>✉ Email Quote</button>
          <button className="btn-primary" onClick={doPrint}>🖨 Print / PDF</button>
        </div>
      </div>

      {/* Quote document */}
      <div className="quote-card">
        <div id="quote-print-area">

          {/* ── Document header ── */}
          <div className="doc-header">
            <div>
              <div className="doc-logo">FLOORING JUNCTION</div>
              <div className="doc-co-detail">
                Flooring Junction Pty Ltd &nbsp;T/A Carpet World Hallam<br />
                3/2-10 Hallam South Road, HALLAM VIC 3803<br />
                P 03 9796 3255 &nbsp;·&nbsp; info@carpetworldhallam.com.au<br />
                ABN 96 661 948 456
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="doc-label">Quote</div>
              <div className="doc-num">{job.leadNumber ?? job.id}</div>
              <div className="doc-date">{today}</div>
            </div>
          </div>

          {/* ── Client + Site ── */}
          <div className="doc-parties">
            <div className="party-block">
              <div className="party-name">{clientName}</div>
              {clientState && <div className="party-line">{clientState}</div>}
              {job.customer?.address && <div className="party-line">{job.customer.address}</div>}
              {(job.customer?.city) && <div className="party-line">{job.customer.city}</div>}
              {clientEmail && <div className="party-line">{clientEmail}</div>}
              {clientPhone && <div className="party-line">{clientPhone}</div>}
            </div>
            {siteAddr && (
              <div className="party-block" style={{ textAlign: "right" }}>
                <div className="party-label">Installation Site</div>
                <div className="party-line">{job.siteStreet}</div>
                {job.siteTown && <div className="party-line">{job.siteTown} {job.siteState ?? ""} {job.siteZip ?? ""}</div>}
                <div className="party-line">{job.siteCountry ?? "Australia"}</div>
              </div>
            )}
          </div>

          {/* ── Scope fields (structured, editable) ── */}
          <div className="scope-box">
            <div className="scope-row">
              <div className="scope-field-label">TO SUPPLY AND INSTALL :</div>
              <input
                className="scope-inp"
                value={quoteFields.supplyInstall}
                onChange={e => setQuoteFields(f => ({ ...f, supplyInstall: e.target.value }))}
                placeholder="e.g. light breeze carpet with 10mm dunlop foam underlay"
              />
            </div>
            <div className="scope-row">
              <div className="scope-field-label">TO :</div>
              <input
                className="scope-inp"
                value={quoteFields.rooms}
                onChange={e => setQuoteFields(f => ({ ...f, rooms: e.target.value }))}
                placeholder="e.g. 1 bedroom, lounge, hallway"
              />
            </div>
            <div className="scope-row">
              <div className="scope-field-label">THIS QUOTATION INCLUDES :</div>
              <textarea
                className="scope-inp scope-ta"
                value={quoteFields.inclusions}
                onChange={e => setQuoteFields(f => ({ ...f, inclusions: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="scope-row">
              <div className="scope-field-label">DOES NOT INCLUDE :</div>
              <input
                className="scope-inp"
                value={quoteFields.exclusions}
                onChange={e => setQuoteFields(f => ({ ...f, exclusions: e.target.value }))}
                placeholder="e.g. furniture moving, floor preparation"
              />
            </div>
          </div>

          {/* ── C.O.D. ── */}
          <div className="cod-box">C.O.D.</div>

          {/* ── Payment Terms (editable) ── */}
          <textarea
            className="terms-textarea"
            value={paymentTerms}
            onChange={e => setPaymentTerms(e.target.value)}
            rows={6}
          />

          {/* ── Totals ── */}
          <div className="totals-wrap">
            <table className="totals-table">
              <tbody>
                <tr>
                  <td className="tot-label">Net</td>
                  <td className="tot-val">${fmt(grossSell)}</td>
                </tr>
                <tr>
                  <td className="tot-label">GST &nbsp;{gstRate}%</td>
                  <td className="tot-val">${fmt(gstAmt)}</td>
                </tr>
                <tr className="grand-row">
                  <td className="tot-label grand">Total</td>
                  <td className="tot-val grand">${fmt(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Footer / Signatures ── */}
          <div className="doc-footer">
            <div>
              <div className="sig-name">Kamal Hira</div>
              <div className="sig-role">Carpet World Hallam</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="sig-box">Customer Signature</div>
              <div className="sig-role">Date: ___________________</div>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .page { font-family: 'DM Sans', sans-serif; padding: 28px 32px; max-width: 900px; margin: 0 auto; }
        .loading { display:flex;align-items:center;justify-content:center;height:50vh;font-family:'DM Sans',sans-serif;color:#9ca3af; }
        .breadcrumb { font-size:12.5px;color:#9ca3af;margin-bottom:6px; }
        .breadcrumb span { color:#1a56db;cursor:pointer; }
        .breadcrumb span:hover { text-decoration:underline; }
        .page-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:16px; }
        .page-title { font-size:22px;font-weight:700;color:#111827;margin:0; }
        .header-actions { display:flex;gap:8px;align-items:center;flex-shrink:0; }
        .btn-primary { background:#1a56db;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif; }
        .btn-primary:disabled { opacity:0.6;cursor:not-allowed; }
        .btn-ghost { background:#fff;color:#374151;border:1.5px solid #e5e7eb;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif; }
        .btn-ghost:hover { background:#f9fafb; }
        .btn-ghost:disabled { opacity:0.6;cursor:not-allowed; }

        /* Quote card */
        .quote-card { background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;padding:40px 48px; }

        /* Document header */
        .doc-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:18px;border-bottom:2px solid #1e3a8a; }
        .doc-logo { font-size:18px;font-weight:900;color:#1e3a8a;letter-spacing:1px;margin-bottom:6px; }
        .doc-co-detail { font-size:11px;color:#6b7280;line-height:1.8; }
        .doc-label { font-size:28px;font-weight:700;color:#1e3a8a; }
        .doc-num { font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:#111827;margin-top:2px; }
        .doc-date { font-size:12px;color:#6b7280;margin-top:3px; }

        /* Parties */
        .doc-parties { display:flex;justify-content:space-between;margin-bottom:20px; }
        .party-block { max-width:48%; }
        .party-label { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#9ca3af;margin-bottom:4px; }
        .party-name { font-size:15px;font-weight:700;color:#111827;margin-bottom:3px; }
        .party-line { font-size:12px;color:#4b5563;line-height:1.8; }

        /* Scope text */
        .scope-label { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#9ca3af;margin-bottom:6px; }
        .scope-box { border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:14px; }
        .scope-row { display:flex;align-items:flex-start;border-bottom:1px solid #f3f4f6; }
        .scope-row:last-child { border-bottom:none; }
        .scope-field-label { font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#6b7280;padding:10px 12px;width:210px;flex-shrink:0;background:#f9fafb;border-right:1px solid #f3f4f6;line-height:1.6;padding-top:12px; }
        .scope-inp { flex:1;border:none;outline:none;padding:10px 12px;font-family:'DM Sans',sans-serif;font-size:12.5px;color:#374151;line-height:1.7;background:transparent;resize:none; }
        .scope-inp:focus { background:#fafbff; }
        .scope-inp::placeholder { color:#d1d5db; }
        .scope-ta { resize:vertical; }

        /* C.O.D. */
        .cod-box { border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;font-size:14px;font-weight:700;color:#111827;margin-bottom:10px; }

        /* Terms */
        .terms-textarea { width:100%;border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;font-family:'DM Sans',sans-serif;font-size:12px;color:#374151;line-height:1.8;resize:vertical;outline:none;margin-bottom:18px; }
        .terms-textarea:focus { border-color:#1a56db; }

        /* Totals */
        .totals-wrap { display:flex;justify-content:flex-end;margin-bottom:28px; }
        .totals-table { width:240px;border-collapse:collapse; }
        .totals-table td { padding:5px 10px;font-size:13px; }
        .tot-label { color:#6b7280;text-align:right; }
        .tot-val { font-family:'DM Mono',monospace;font-weight:600;text-align:right;color:#111827; }
        .grand-row td { border-top:2px solid #1e3a8a;padding-top:8px; }
        .grand { font-size:15px;font-weight:700;color:#1e3a8a; }

        /* Footer */
        .doc-footer { display:flex;justify-content:space-between;align-items:flex-end;padding-top:16px;border-top:1px solid #e5e7eb; }
        .sig-name { font-size:14px;font-weight:700;color:#111827; }
        .sig-role { font-size:11.5px;color:#6b7280;margin-top:2px; }
        .sig-box { border:1px solid #e5e7eb;border-radius:6px;padding:10px 60px;color:#9ca3af;font-size:12px;margin-bottom:4px; }

        /* Modal */
        .modal-bg { position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center; }
        .modal { background:#fff;border-radius:12px;width:480px;max-width:95vw;box-shadow:0 20px 50px rgba(0,0,0,0.2);font-family:'DM Sans',sans-serif; }
        .modal-header { display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid #f3f4f6; }
        .modal-title { font-size:15px;font-weight:700;color:#111827; }
        .modal-close { background:none;border:none;font-size:18px;cursor:pointer;color:#9ca3af; }
        .modal-body { padding:20px 22px; }
        .modal-footer { display:flex;justify-content:flex-end;gap:8px;margin-top:16px; }
        .field { display:flex;flex-direction:column;gap:5px;margin-bottom:14px; }
        label { font-size:12.5px;font-weight:600;color:#374151; }
        .inp { font-family:'DM Sans',sans-serif;font-size:13.5px;color:#111827;border:1.5px solid #e5e7eb;border-radius:7px;padding:9px 12px;outline:none;width:100%; }
        .inp:focus { border-color:#1a56db; }
        textarea.inp { resize:vertical; }
        .toast { position:fixed;bottom:24px;right:24px;z-index:9999;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;color:#fff; }
        .toast-ok { background:#15803d; }
        .toast-err { background:#b91c1c; }
      `}</style>
    </div>
  );
}
