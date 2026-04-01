"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const fmt = (n: number) => n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (v: number | string) => parseFloat(String(v) || "0") || 0;
const fmtAUD = (v: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  id?: number; tag: string; description: string;
  qty: number | string; unitCost: number | string; costTax: number | string;
  type: string; unitSell: number | string; sellTax: number | string;
  actOn: boolean; isHeader: boolean; sortOrder: number;
}
interface Job {
  id: number; title: string; status: string; costPrice: number; sellPrice: number;
  gstRate: number; markup: number; finalQuote: number; leadNumber?: string;
  jobCategory?: string; shop?: string; jobSource?: string; terms?: string;
  startDate?: string; endDate?: string; completedDate?: string; completedPercentage?: number;
  customer?: { id: number; name: string; email?: string; phone?: string; address?: string; city?: string; state?: string; postcode?: string; };
}
interface InvPayment { id: number; amount: number; method: string; reference?: string; paidOn: string; }
interface Invoice {
  id: number; invoiceNumber: string; invoiceDate: string; dueDate: string;
  grossAmount: number; taxAmount: number; totalAmount: number;
  credit: number; retentionRelease: number;
  status: string; payments: InvPayment[];
}
interface MiTEntry { id: string; date: string; description: string; amount: number; }

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params?.id as string;

  const [activeTab, setActiveTab] = useState("Details");
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Cost & Sell state ──────────────────────────────────────────────────────
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [gstRate, setGstRate] = useState(10);
  const [targetMargin, setTargetMargin] = useState("");
  const [showFlooringModal, setShowFlooringModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showQuoteEmail, setShowQuoteEmail] = useState(false);
  const [quoteEmail, setQuoteEmail] = useState({ to: "", subject: "", body: "" });
  const [sendingQuote, setSendingQuote] = useState(false);

  // ── Billing state ──────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [mitEntries, setMitEntries] = useState<MiTEntry[]>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ invoiceNumber: "", invoiceDate: new Date().toISOString().split("T")[0], grossAmount: "", credit: "", retentionRelease: "" });
  const [payModalId, setPayModalId] = useState<number | null>(null);
  const [newPay, setNewPay] = useState({ amount: "", method: "EFT", reference: "", paidOn: new Date().toISOString().split("T")[0] });
  const [mitAmount, setMitAmount] = useState(""); const [mitDesc, setMitDesc] = useState(""); const [mitDate, setMitDate] = useState(new Date().toISOString().split("T")[0]);

  // ── Find overlay ───────────────────────────────────────────────────────────
  const [allJobs, setAllJobs] = useState<{ id: number; title: string }[]>([]);
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [jobIdInput, setJobIdInput] = useState("");
  const findRef = useRef<HTMLInputElement>(null);

  // ── Templates ──────────────────────────────────────────────────────────────
  const CARPET_TEMPLATE: LineItem[] = [
    { tag: "", description: "Select Carpet", qty: 1, unitCost: 0, costTax: 10, type: "M", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 0 },
    { tag: "", description: "Select Underlay", qty: 1, unitCost: 0, costTax: 10, type: "M", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 1 },
    { tag: "", description: "Disposal", qty: 1, unitCost: 0, costTax: 10, type: "O", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 2 },
    { tag: "", description: "City Measure fee - tolls/parking/time", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 3 },
    { tag: "", description: "Labour", qty: 0, unitCost: 0, costTax: 10, type: "M", unitSell: 0, sellTax: 10, actOn: false, isHeader: true, sortOrder: 4 },
    { tag: "", description: "Install carpet 3.66", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 5 },
    { tag: "", description: "Take up", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 6 },
    { tag: "", description: "Admin Charges", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 7 },
    { tag: "", description: "Freight Charges", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 8 },
  ];
  const HARD_FLOORING_TEMPLATE: LineItem[] = [
    { tag: "", description: "Select Hard Flooring", qty: 1, unitCost: 0, costTax: 10, type: "M", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 0 },
    { tag: "", description: "Select Underlay", qty: 1, unitCost: 0, costTax: 10, type: "M", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 1 },
    { tag: "", description: "Select Trims", qty: 1, unitCost: 0, costTax: 10, type: "M", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 2 },
    { tag: "", description: "Disposal", qty: 1, unitCost: 0, costTax: 10, type: "O", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 3 },
    { tag: "", description: "City Measure fee - tolls/parking/time", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 4 },
    { tag: "", description: "Labour", qty: 0, unitCost: 0, costTax: 10, type: "M", unitSell: 0, sellTax: 10, actOn: false, isHeader: true, sortOrder: 5 },
    { tag: "", description: "Install carpet 3.66", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 6 },
    { tag: "", description: "Install carpet 4.0m", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 7 },
    { tag: "", description: "Install Carpet Tiles", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 8 },
    { tag: "", description: "Stairs", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 9 },
    { tag: "", description: "Lay direct stick", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 10 },
    { tag: "", description: "Take up", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 11 },
    { tag: "", description: "Take up Direct Stick", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 12 },
    { tag: "", description: "Admin Charges", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 13 },
    { tag: "", description: "Freight Charges", qty: 1, unitCost: 0, costTax: 10, type: "L", unitSell: 0, sellTax: 10, actOn: false, isHeader: false, sortOrder: 14 },
  ];

  const showToast = (msg: string, ok: boolean) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchJob = useCallback(async () => {
    setLoading(true);
    try {
      const [jobRes, liRes] = await Promise.all([
        fetch(`${API}/jobs/${jobId}`),
        fetch(`${API}/jobs/${jobId}/line-items`),
      ]);
      const jobData: Job = await jobRes.json();
      const liData: LineItem[] = await liRes.json();
      setJob(jobData);
      setGstRate(jobData.gstRate ?? 10);
      setLineItems(liData.map(li => ({ ...li, qty: li.qty ?? 1, unitCost: li.unitCost ?? 0, costTax: li.costTax ?? 10, unitSell: li.unitSell ?? 0, sellTax: li.sellTax ?? 10, tag: li.tag ?? "", type: li.type ?? "M", actOn: li.actOn ?? false, isHeader: li.isHeader ?? false, sortOrder: li.sortOrder ?? 0 })));
      setDirty(false);
    } catch { showToast("Failed to load job", false); }
    finally { setLoading(false); }
  }, [jobId]);

  const fetchBilling = useCallback(async () => {
    try {
      const invRes = await fetch(`${API}/billing/jobs/${jobId}/invoices`);
      const inv = await invRes.json();
      setInvoices(Array.isArray(inv) ? inv : []);
      setMitEntries([]);
    } catch { /* silent */ }
  }, [jobId]);

  const fetchAllJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/jobs?limit=1000`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.jobs ?? [];
      setAllJobs([...list].sort((a: Job, b: Job) => b.id - a.id));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (jobId) { fetchJob(); fetchAllJobs(); setJobIdInput(jobId); }
  }, [jobId, fetchJob, fetchAllJobs]);

  useEffect(() => {
    if (activeTab === "Billing" || activeTab === "Tax Invoice") fetchBilling();
  }, [activeTab, fetchBilling]);

  // ── Cost & Sell helpers ────────────────────────────────────────────────────
  const dataRows = lineItems.filter(li => !li.isHeader);
  const grossCost = dataRows.reduce((s, li) => s + n(li.qty) * n(li.unitCost), 0);
  const grossSell = dataRows.reduce((s, li) => s + n(li.qty) * n(li.unitSell), 0);
  const gstAmt = grossSell * (gstRate / 100);
  const margin = grossSell - grossCost;
  const marginPct = grossSell > 0 ? ((margin / grossSell) * 100).toFixed(1) : "0.0";

  const addLineItem = (isHeader = false) => { setLineItems(p => [...p, { tag: "", description: isHeader ? "— New Section —" : "", qty: 1, unitCost: 0, costTax: 10, type: "M", unitSell: 0, sellTax: 10, actOn: false, isHeader, sortOrder: p.length }]); setDirty(true); };
  const updateItem = (i: number, field: keyof LineItem, value: unknown) => { setLineItems(p => { const next = [...p]; next[i] = { ...next[i], [field]: value }; return next; }); setDirty(true); };
  const removeItem = (i: number) => { setLineItems(p => p.filter((_, idx) => idx !== i)); setDirty(true); };
  const moveItem = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= lineItems.length) return; setLineItems(p => { const next = [...p]; [next[i], next[j]] = [next[j], next[i]]; return next; }); setDirty(true); };
  const loadTemplate = (type: "carpet" | "hard") => { setLineItems((type === "carpet" ? CARPET_TEMPLATE : HARD_FLOORING_TEMPLATE).map((li, idx) => ({ ...li, sortOrder: idx }))); setDirty(true); setShowFlooringModal(false); };
  const applyTargetMargin = (dollarMargin: number) => { if (grossCost <= 0) return; const ratio = (grossCost + dollarMargin) / grossCost; setLineItems(p => p.map(li => { if (li.isHeader || n(li.unitCost) <= 0) return li; return { ...li, unitSell: parseFloat((n(li.unitCost) * ratio).toFixed(2)) }; })); setDirty(true); };

  const handleSave = async () => {
    if (!jobId) return; setSaving(true);
    try {
      const payload = lineItems.map((li, idx) => ({ ...li, qty: n(li.qty), unitCost: n(li.unitCost), costTax: n(li.costTax), unitSell: n(li.unitSell), sellTax: n(li.sellTax), sortOrder: idx }));
      const res = await fetch(`${API}/jobs/${jobId}/line-items`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      await fetch(`${API}/jobs/${jobId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gstRate, grossSell, grossCost }) });
      setDirty(false); showToast("Saved successfully", true); fetchJob();
    } catch { showToast("Save failed", false); }
    finally { setSaving(false); }
  };

  // ── Quote helpers ──────────────────────────────────────────────────────────
  const openQuoteEmail = () => { if (!job) return; setQuoteEmail({ to: job.customer?.email || "", subject: `Quote Q-${String(job.id).padStart(5, "0")} — Flooring Junction`, body: `Dear ${job.customer?.name || ""},\n\nPlease find attached your quote.\n\nThank you for considering Flooring Junction.\n\nKind regards` }); setShowQuoteEmail(true); };
  const handleSendQuote = async () => {
    if (!job) return; setSendingQuote(true);
    try {
      const res = await fetch(`${API}/jobs/${job.id}/quote/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(quoteEmail) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setShowQuoteEmail(false); showToast(`Quote emailed to ${data.sentTo}`, true);
    } catch (err: unknown) { showToast((err as Error).message || "Email failed", false); }
    finally { setSendingQuote(false); }
  };
  const doPrint = () => {
    const el = document.getElementById("quote-print-area"); if (!el) return;
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html><head><title>Quote Q-${String(job?.id).padStart(5, "0")}</title><style>body{font-family:Arial,sans-serif;margin:0;padding:32px}@media print{body{padding:0}}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f3f4f6;padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:11px;text-transform:uppercase;color:#6b7280}td{padding:7px 10px;border-bottom:1px solid #f0f2f5}.totals-table td{border:none;padding:5px 10px}</style></head><body>${el.innerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
  };

  // ── Billing helpers ────────────────────────────────────────────────────────
  const createInvoice = async () => {
    try {
      const res = await fetch(`${API}/billing/jobs/${jobId}/invoices`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceNumber: newInvoice.invoiceNumber || undefined, invoiceDate: newInvoice.invoiceDate, grossAmount: parseFloat(newInvoice.grossAmount) || 0, credit: parseFloat(newInvoice.credit) || 0, retentionRelease: parseFloat(newInvoice.retentionRelease) || 0 }) });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setShowInvoiceForm(false); setNewInvoice({ invoiceNumber: "", invoiceDate: new Date().toISOString().split("T")[0], grossAmount: "", credit: "", retentionRelease: "" }); fetchBilling(); showToast("Invoice created", true);
    } catch (e) { showToast((e as Error).message || "Failed to create invoice", false); }
  };
  const recordPayment = async () => {
    if (!payModalId || !newPay.amount) { showToast("Amount required", false); return; }
    try {
      const res = await fetch(`${API}/billing/invoices/${payModalId}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: parseFloat(newPay.amount), method: newPay.method, reference: newPay.reference || null, paidOn: newPay.paidOn }) });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setPayModalId(null); setNewPay({ amount: "", method: "EFT", reference: "", paidOn: new Date().toISOString().split("T")[0] }); fetchBilling(); showToast("Payment recorded", true);
    } catch (e) { showToast((e as Error).message || "Failed to record payment", false); }
  };
  const addMiT = async () => {
    if (!mitAmount) return;
    // MIT (Money in Trust) stored locally only
    setMitEntries(p => [...p, { id: `mit-${Date.now()}`, date: mitDate, description: mitDesc || "Deposit received", amount: parseFloat(mitAmount) }]);
    setMitAmount(""); setMitDesc("");
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const currentIdx = allJobs.findIndex(j => String(j.id) === String(jobId));
  const navTo = (id: number) => router.push(`/jobs/${id}`);
  const filteredJobs = allJobs.filter(j => j.title.toLowerCase().includes(findQuery.toLowerCase()) || String(j.id).includes(findQuery));

  // ── Billing derived ────────────────────────────────────────────────────────
  const totalMiT = mitEntries.reduce((s, e) => s + e.amount, 0);
  const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount ?? 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.payments ?? []).reduce((ps, p) => ps + (p.amount ?? 0), 0), 0);
  const totalBalance = totalInvoiced - totalPaid;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#6b7280", fontSize: 14 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #e2e5ed", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
        Loading job…
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  );
  if (!job) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#dc2626" }}>Job not found.</div>;

  const TABS = ["Details", "Cost & Sell", "Quote", "Billing", "Tax Invoice", "Schedule", "Work Order"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .jd-root { font-family: 'Sora', sans-serif; background: #f8f9fb; min-height: 100vh; color: #1a1d2e; display: flex; flex-direction: column; }
        .jd-header { background: #fff; border-bottom: 1px solid #e2e5ed; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 52px; position: sticky; top: 0; z-index: 200; flex-shrink: 0; }
        .jd-logo { font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 5px; padding: 3px 9px; }
        .jd-breadcrumb { font-size: 12px; color: #9ca3af; margin-left: 14px; }
        .jd-breadcrumb a { color: #2563eb; text-decoration: none; cursor: pointer; }
        .jd-breadcrumb a:hover { text-decoration: underline; }
        .jd-header-right { display: flex; align-items: center; gap: 8px; }
        .jd-tabs { background: #fff; border-bottom: 1px solid #e8eaef; padding: 0 24px; display: flex; gap: 2px; flex-shrink: 0; }
        .jd-tab { font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 500; background: transparent; border: none; border-bottom: 2px solid transparent; color: #6b7280; padding: 10px 16px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .jd-tab:hover { color: #2563eb; }
        .jd-tab.active { color: #2563eb; border-bottom-color: #2563eb; font-weight: 600; }
        .jd-body { display: flex; flex: 1; overflow: hidden; }
        .jd-sidebar { width: 230px; flex-shrink: 0; background: #f1f3f7; border-right: 1px solid #e8eaef; padding: 16px 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        .jd-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .jd-content { flex: 1; overflow-y: auto; padding: 20px 24px; }
        .jd-job-card { background: linear-gradient(135deg, #eff6ff, #bfdbfe); border: 1px solid #3b82f6; border-radius: 10px; padding: 12px; }
        .jd-job-id { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #2563eb; margin-bottom: 2px; }
        .jd-job-title { font-size: 13px; font-weight: 600; color: #1e3a8a; margin-bottom: 6px; line-height: 1.3; }
        .jd-sb-section { background: #fff; border: 1px solid #e8eaef; border-radius: 8px; padding: 10px; }
        .jd-sb-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af; margin-bottom: 7px; }
        .jd-sb-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .jd-sb-key { font-size: 11px; color: #6b7280; }
        .jd-sb-val { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: #1e2540; }
        .jd-sb-val.green { color: #16a34a; } .jd-sb-val.red { color: #dc2626; } .jd-sb-val.blue { color: #2563eb; }
        .jd-status { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; text-transform: capitalize; }
        .status-pending { background: #fffbeb; color: #d97706; } .status-scheduled { background: #eff6ff; color: #2563eb; }
        .status-in_progress { background: #f5f3ff; color: #7c3aed; } .status-completed { background: #f0fdf4; color: #16a34a; }
        .status-cancelled { background: #fef2f2; color: #dc2626; }
        .cs-wrap { border: 1px solid #e8eaef; border-radius: 9px; overflow: hidden; }
        .cs-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .cs-table th { background: #f8f9fb; color: #9ca3af; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; padding: 9px 8px; text-align: left; border-bottom: 1px solid #e8eaef; white-space: nowrap; }
        .cs-table td { padding: 4px 5px; border-bottom: 1px solid #f5f6f9; vertical-align: middle; }
        .cs-table tr:last-child td { border-bottom: none; }
        .cs-table tr.data-row:hover td { background: #fafbfc; }
        .cs-table tr.header-row td { background: #f1f3f7; }
        .cs-inp { font-family: 'Sora', sans-serif; font-size: 12px; color: #1e2540; background: transparent; border: 1px solid transparent; border-radius: 5px; padding: 5px 7px; outline: none; width: 100%; transition: all 0.12s; }
        .cs-inp:focus { background: #fff; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
        .cs-inp.mono { font-family: 'JetBrains Mono', monospace; }
        .cs-type { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer; flex-shrink: 0; }
        .type-M { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
        .type-L { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .type-O { background: #fffbeb; color: #d97706; border: 1px solid #fef3c7; }
        .type-H { background: #f5f3ff; color: #7c3aed; border: 1px solid #ede9fe; }
        .cs-move-btn { background: transparent; border: none; color: #d1d5db; cursor: pointer; padding: 2px 4px; font-size: 11px; }
        .cs-move-btn:hover { color: #6b7280; }
        .cs-del-btn { background: transparent; border: 1px solid #f0f2f5; color: #d1d5db; border-radius: 4px; cursor: pointer; padding: 4px 7px; font-size: 11px; transition: all 0.12s; }
        .cs-del-btn:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
        .cs-totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e8eaef; border: 1px solid #e8eaef; border-radius: 9px; overflow: hidden; margin-top: 10px; }
        .cs-total-cell { background: #fff; padding: 12px 14px; }
        .cs-total-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px; }
        .cs-total-value { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; color: #1e2540; }
        .cs-total-value.green { color: #16a34a; } .cs-total-value.red { color: #dc2626; }
        .cs-total-sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }
        .cs-add-row { display: flex; gap: 8px; margin-top: 10px; }
        .cs-add-btn { font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 500; color: #2563eb; background: #eff6ff; border: 1px dashed #bfdbfe; border-radius: 7px; padding: 8px 16px; cursor: pointer; transition: all 0.15s; }
        .cs-add-btn:hover { background: #dbeafe; border-color: #3b82f6; }
        .cs-add-btn.purple { color: #7c3aed; background: #f5f3ff; border-color: #ddd6fe; }
        .cs-add-btn.purple:hover { background: #ede9fe; }
        .fm-btn { font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; border-radius: 7px; padding: 7px 16px; border: none; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 5px; }
        .btn-ghost { background: transparent; color: #5a6080; border: 1px solid #e2e5ed; }
        .btn-ghost:hover { background: #f9fafb; }
        .btn-primary { background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: #fff; box-shadow: 0 4px 12px rgba(59,130,246,0.3); }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-success { background: #15803d; color: #fff; }
        .btn-success:hover { background: #166534; }
        .jd-footer { background: #fff; border-top: 1px solid #e8eaef; padding: 10px 24px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; gap: 12px; flex-wrap: wrap; }
        .jd-footer-info { font-size: 12px; color: #6b7280; display: flex; align-items: center; gap: 12px; }
        .jd-footer-nav { display: flex; gap: 4px; align-items: center; }
        .jd-nav-btn { font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 600; background: #fff; border: 1px solid #e2e5ed; color: #5a6080; border-radius: 5px; padding: 5px 9px; cursor: pointer; transition: all 0.12s; }
        .jd-nav-btn:hover:not(:disabled) { background: #eff6ff; border-color: #bfdbfe; color: #2563eb; }
        .jd-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .fm-toast { position: fixed; bottom: 22px; right: 22px; z-index: 9999; padding: 10px 18px; border-radius: 8px; font-size: 12px; font-weight: 600; font-family: 'Sora', sans-serif; color: #fff; display: flex; align-items: center; gap: 8px; animation: slideUp 0.2s ease; }
        .toast-ok { background: #15803d; } .toast-err { background: #b91c1c; }
        @keyframes slideUp { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        .dirty-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; color: #d97706; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 4px; padding: 2px 7px; }
        .find-overlay { position: fixed; top: 52px; left: 50%; transform: translateX(-50%); z-index: 300; background: #fff; border: 1px solid #e2e5ed; border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,0.12); width: 400px; padding: 14px; }
        .find-input { font-family: 'Sora', sans-serif; font-size: 13px; width: 100%; border: 1px solid #e2e5ed; border-radius: 7px; padding: 8px 11px; outline: none; color: #1e2540; margin-bottom: 10px; }
        .find-input:focus { border-color: #3b82f6; }
        .find-list { max-height: 220px; overflow-y: auto; }
        .find-item { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 6px; cursor: pointer; font-size: 12px; }
        .find-item:hover { background: #f5f6f9; }
        .find-item-id { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #2563eb; background: #eff6ff; border-radius: 3px; padding: 1px 5px; flex-shrink: 0; }
        .spin { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 5px; height: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #e2e5ed; border-radius: 3px; }
        .bil-card { background: #fff; border: 1px solid #e8eaef; border-radius: 10px; padding: 14px 18px; }
        .bil-card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px; }
        .bil-card-value { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; }
        .bil-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .bil-table th { background: #f8f9fb; padding: 8px 12px; text-align: left; border-bottom: 1px solid #e8eaef; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; font-weight: 700; }
        .bil-table td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
        .bil-table tr:last-child td { border-bottom: none; }
        .bil-badge { padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; }
        .bil-badge-draft { background: #fef9c3; color: #854d0e; }
        .bil-badge-sent { background: #dbeafe; color: #1d4ed8; }
        .bil-badge-paid { background: #dcfce7; color: #16a34a; }
        .bil-badge-overdue { background: #fef2f2; color: #dc2626; }
        .fm-input { font-family: 'Sora', sans-serif; font-size: 13px; color: #1e2540; background: #fff; border: 1px solid #e2e5ed; border-radius: 7px; padding: 8px 11px; outline: none; width: 100%; }
        .fm-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.08); }
        .fm-field { display: flex; flex-direction: column; gap: 5px; }
        .fm-field label { font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; }
        .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .section-title::after { content: ''; flex: 1; height: 1px; background: #e8eaef; }
        .cs-margin-box { margin-top: 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 9px; padding: 14px 18px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .cs-margin-input { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; width: 130px; background: #fff; border: 2px solid #3b82f6; border-radius: 7px; padding: 7px 12px; outline: none; color: #1e2540; }
      `}</style>

      {/* Toast */}
      {toast && <div className={`fm-toast ${toast.ok ? "toast-ok" : "toast-err"}`}>{toast.ok ? "✓" : "✕"} {toast.msg}</div>}

      {/* Find overlay */}
      {showFind && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setShowFind(false)} />
          <div className="find-overlay">
            <input ref={findRef} className="find-input" placeholder="Search jobs…" value={findQuery} onChange={e => setFindQuery(e.target.value)} autoFocus />
            <div className="find-list">
              {filteredJobs.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af", padding: "8px 10px" }}>No jobs found</div>}
              {filteredJobs.map(j => (
                <div key={j.id} className="find-item" onClick={() => { setShowFind(false); setFindQuery(""); navTo(j.id); }}>
                  <span className="find-item-id">#{j.id}</span>
                  <span style={{ color: "#374151" }}>{j.title}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Flooring Modal */}
      {showFlooringModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: 480, maxWidth: "95vw", boxShadow: "0 24px 60px rgba(0,0,0,0.25)", overflow: "hidden", fontFamily: "'Sora',sans-serif" }}>
            <div style={{ background: "linear-gradient(135deg,#1e3a8a,#3b82f6)", padding: "20px 24px" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Load Flooring Template</div>
              <div style={{ color: "#bfdbfe", fontSize: 12, marginTop: 3 }}>Choose type to pre-fill line items</div>
            </div>
            <div style={{ padding: "24px", display: "flex", gap: 16 }}>
              {[{ type: "carpet" as const, icon: "🏠", label: "Carpet", desc: "Carpet + Underlay\nDisposal, Measure fee\nInstall, Take up, Admin", count: 9, color: "#3b82f6", bg: "#eff6ff" },
                { type: "hard" as const, icon: "🪵", label: "Hard Flooring", desc: "Flooring + Underlay + Trims\nDisposal, Measure fee\nInstall, Lay, Stairs", count: 15, color: "#7c3aed", bg: "#f5f3ff" }].map(opt => (
                <button key={opt.type} onClick={() => loadTemplate(opt.type)}
                  style={{ flex: 1, border: `2px solid #e2e5ed`, borderRadius: 12, padding: "18px 14px", cursor: "pointer", background: "#fff", textAlign: "center" as const, fontFamily: "'Sora',sans-serif" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = opt.color; (e.currentTarget as HTMLButtonElement).style.background = opt.bg; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e5ed"; (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>{opt.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e2540", marginBottom: 4 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, whiteSpace: "pre-line" }}>{opt.desc}</div>
                  <div style={{ marginTop: 10, fontSize: 10, color: opt.color, fontWeight: 700, textTransform: "uppercase" as const }}>{opt.count} line items</div>
                </button>
              ))}
            </div>
            <div style={{ padding: "0 24px 20px", display: "flex", justifyContent: "flex-end" }}>
              <button className="fm-btn btn-ghost" onClick={() => setShowFlooringModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Quote Email Modal */}
      {showQuoteEmail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, width: 480, maxWidth: "95vw", boxShadow: "0 24px 60px rgba(0,0,0,0.2)", fontFamily: "'Sora',sans-serif" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #f0f2f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#1e2540" }}>Email Quote to Customer</span>
              <button onClick={() => setShowQuoteEmail(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ padding: "20px 22px" }}>
              {[{ label: "To", key: "to", type: "email" }, { label: "Subject", key: "subject", type: "text" }].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "1px", color: "#9ca3af", marginBottom: 5 }}>{f.label}</label>
                  <input className="fm-input" type={f.type} value={quoteEmail[f.key as keyof typeof quoteEmail]} onChange={e => setQuoteEmail(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "1px", color: "#9ca3af", marginBottom: 5 }}>Message</label>
                <textarea className="fm-input" style={{ minHeight: 90, resize: "vertical" }} value={quoteEmail.body} onChange={e => setQuoteEmail(p => ({ ...p, body: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="fm-btn btn-ghost" onClick={() => setShowQuoteEmail(false)}>Cancel</button>
                <button className="fm-btn btn-primary" onClick={handleSendQuote} disabled={sendingQuote}>{sendingQuote ? "Sending…" : "Send Quote ✉"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && job && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: 780, maxWidth: "98vw", maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", fontFamily: "'Sora',sans-serif" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e5ed", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#1e2540" }}>Quote Preview — Q-{String(job.id).padStart(5, "0")}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="fm-btn btn-ghost" onClick={() => { openQuoteEmail(); setShowPrintPreview(false); }}>✉ Email</button>
                <button className="fm-btn btn-primary" onClick={doPrint}>🖨 Print / Save PDF</button>
                <button onClick={() => setShowPrintPreview(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af" }}>×</button>
              </div>
            </div>
            <div style={{ overflow: "auto", padding: "24px 32px", flex: 1 }}>
              <div id="quote-print-area">
                <table style={{ width: "100%", marginBottom: 20, borderCollapse: "collapse" }}><tbody><tr>
                  <td style={{ verticalAlign: "top", width: "55%" }}>
                    <div style={{ fontWeight: 800, fontSize: 20, color: "#1e3a8a" }}>FLOORING JUNCTION</div>
                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4, lineHeight: 1.7 }}>Flooring Junction Pty Ltd · ABN: 9661948456<br />3/2-10 Hallam South Road, HALLAM VIC 3803<br />Ph: +03 9796 3255</div>
                  </td>
                  <td style={{ verticalAlign: "top", textAlign: "right" }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: "#1e3a8a" }}>Quote</div>
                    <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700 }}>Q-{String(job.id).padStart(5, "0")}</div>
                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>Date: {new Date().toLocaleDateString("en-AU")}<br />Sales Rep: Kamal Hira</div>
                  </td>
                </tr></tbody></table>
                <div style={{ background: "#f8f9fb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#9ca3af", marginBottom: 4 }}>Bill To</div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#1e2540" }}>{job.customer?.name || "—"}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.8 }}>
                    {job.customer?.address && <span>{job.customer.address}<br /></span>}
                    {job.customer?.city && <span>{job.customer.city} {job.customer.state} {job.customer.postcode}<br /></span>}
                    {job.customer?.email && <span>{job.customer.email}</span>}
                  </div>
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 10, color: "#374151", lineHeight: 1.8 }}>
                  <strong>TO SUPPLY AND INSTALL:</strong> As per line items below.<br />
                  <strong>INCLUDES:</strong> TAKE UP AND DISPOSAL OF EXISTING CARPET.<br />
                  <strong>DOES NOT INCLUDE:</strong> FURNITURE HANDLING. Any unforeseen floor preparation will be quoted separately.
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 16 }}>
                  <thead><tr>{["Description","Qty","Unit Sell","Tax","Total"].map((h, i) => (
                    <th key={h} style={{ background: "#f3f4f6", padding: "7px 9px", textAlign: i > 0 ? "right" : "left", borderBottom: "2px solid #e5e7eb", fontSize: 10, color: "#6b7280" }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>{lineItems.map((li, i) => li.isHeader ? (
                    <tr key={i}><td colSpan={5} style={{ background: "#f9fafb", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", fontSize: 10, letterSpacing: "1px", padding: "7px 9px", borderBottom: "1px solid #f0f2f5" }}>{li.description}</td></tr>
                  ) : (
                    <tr key={i}>
                      <td style={{ padding: "6px 9px", borderBottom: "1px solid #f5f6f9" }}>{li.description}</td>
                      <td style={{ padding: "6px 9px", borderBottom: "1px solid #f5f6f9", textAlign: "right" }}>{n(li.qty)}</td>
                      <td style={{ padding: "6px 9px", borderBottom: "1px solid #f5f6f9", textAlign: "right" }}>${fmt(n(li.unitSell))}</td>
                      <td style={{ padding: "6px 9px", borderBottom: "1px solid #f5f6f9", textAlign: "right", color: "#9ca3af" }}>{n(li.sellTax)}%</td>
                      <td style={{ padding: "6px 9px", borderBottom: "1px solid #f5f6f9", textAlign: "right", fontWeight: 600 }}>${fmt(n(li.qty) * n(li.unitSell))}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}><tbody>
                  {[["Net", fmt(grossSell)], [`GST ${gstRate}%`, fmt(gstAmt)]].map(([l, v]) => (
                    <tr key={l}><td style={{ width: "60%" }}></td><td style={{ textAlign: "right", padding: "4px 9px", fontSize: 11, color: "#6b7280" }}>{l}</td><td style={{ textAlign: "right", padding: "4px 9px", fontSize: 11, fontWeight: 600, width: 100 }}>${v}</td></tr>
                  ))}
                  <tr><td></td><td style={{ textAlign: "right", padding: "8px 9px", fontSize: 14, fontWeight: 700, color: "#1e3a8a", borderTop: "2px solid #e5e7eb" }}>TOTAL</td><td style={{ textAlign: "right", padding: "8px 9px", fontSize: 14, fontWeight: 700, color: "#1e3a8a", borderTop: "2px solid #e5e7eb" }}>${fmt(grossSell + gstAmt)}</td></tr>
                </tbody></table>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", fontSize: 10, color: "#374151", lineHeight: 1.8 }}>
                  <strong>C.O.D. PAYMENT TERMS:</strong> Initial deposit 50%. Balance 3 working days prior to installation.<br />
                  <strong>BSB 063 237 · ACCOUNT NO. 1048 7235 · Flooring Junction Pty. Ltd.</strong><br />
                  Deposit 50% = ${fmt((grossSell + gstAmt) * 0.5)} · Balance = ${fmt((grossSell + gstAmt) * 0.5)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="jd-root">
        {/* Header */}
        <div className="jd-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="jd-logo">FloorManager</div>
            <div className="jd-breadcrumb">
              <a onClick={() => router.push("/jobs")}>Jobs</a> {" › "} #{job.id}
            </div>
          </div>
          <div className="jd-header-right">
            {dirty && <span className="dirty-badge">● Unsaved</span>}
            {activeTab === "Cost & Sell" && <>
              <button className="fm-btn btn-ghost" style={{ borderStyle: "dashed" }} onClick={() => setShowFlooringModal(true)}>🏠 Template</button>
              <button className="fm-btn btn-ghost" onClick={handleSave} disabled={saving}>{saving ? <><span className="spin" /> Saving…</> : dirty ? "Save* ✓" : "Saved ✓"}</button>
            </>}
            {(activeTab === "Quote") && <>
              <button className="fm-btn btn-ghost" onClick={() => setShowPrintPreview(true)}>🖨 Print Quote</button>
              <button className="fm-btn btn-ghost" onClick={openQuoteEmail}>✉ Email Quote</button>
            </>}
            {activeTab === "Billing" && <button className="fm-btn btn-primary" onClick={() => { setNewInvoice(p => ({ ...p, grossAmount: p.grossAmount || String(job?.finalQuote || job?.sellPrice || "") })); setShowInvoiceForm(true); }}>+ New Invoice</button>}
            <button className="fm-btn btn-ghost" onClick={() => router.push("/jobs")}>← Jobs</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="jd-tabs">
          {TABS.map(t => (
            <button key={t} className={`jd-tab${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)}>{t}</button>
          ))}
        </div>

        <div className="jd-body">
          {/* Sidebar */}
          <div className="jd-sidebar">
            <div className="jd-job-card">
              <div className="jd-job-id">JOB #{job.id}</div>
              <div className="jd-job-title">{job.title}</div>
              <span className={`jd-status status-${job.status ?? "pending"}`}>{(job.status ?? "pending").replace("_", " ")}</span>
            </div>
            {job.customer && (
              <div className="jd-sb-section">
                <div className="jd-sb-label">Client</div>
                <div style={{ fontWeight: 600, fontSize: 12, color: "#1e2540", marginBottom: 3 }}>{job.customer.name}</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.7 }}>
                  {job.customer.address && <span>{job.customer.address}<br /></span>}
                  {job.customer.city && <span>{job.customer.city} {job.customer.state} {job.customer.postcode}<br /></span>}
                  {job.customer.phone && <span>📞 {job.customer.phone}<br /></span>}
                  {job.customer.email && <span>✉ {job.customer.email}</span>}
                </div>
              </div>
            )}
            <div className="jd-sb-section">
              <div className="jd-sb-label">Financials</div>
              {[["Gross Cost", `$${fmt(grossCost)}`, ""], ["Gross Sell", `$${fmt(grossSell)}`, "blue"], [`GST (${gstRate}%)`, `$${fmt(gstAmt)}`, ""], ["Margin", `$${fmt(margin)} (${marginPct}%)`, margin >= 0 ? "green" : "red"]].map(([k, v, c]) => (
                <div key={k} className="jd-sb-row"><span className="jd-sb-key">{k}</span><span className={`jd-sb-val${c ? ` ${c}` : ""}`}>{v}</span></div>
              ))}
            </div>
            <div className="jd-sb-section">
              <div className="jd-sb-label">GST Rate</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="number" value={gstRate} onChange={e => { setGstRate(parseFloat(e.target.value) || 0); setDirty(true); }} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, width: 55, border: "1px solid #e2e5ed", borderRadius: 6, padding: "4px 7px", color: "#1e2540", outline: "none" }} />
                <span style={{ fontSize: 12, color: "#6b7280" }}>%</span>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="jd-main">
            <div className="jd-content">

              {/* ── DETAILS TAB ── */}
              {activeTab === "Details" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: "4px 0" }}>
                  {/* Client Details */}
                  <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 10, padding: "20px 24px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Client Details</div>
                    {job.customer ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Name</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{job.customer.name}</div>
                        </div>
                        {job.customer.address && (
                          <div>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Address</div>
                            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                              {job.customer.address}<br />
                              {[job.customer.city, job.customer.state, job.customer.postcode].filter(Boolean).join(" ")}
                            </div>
                          </div>
                        )}
                        {job.customer.phone && (
                          <div>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Phone</div>
                            <div style={{ fontSize: 13, color: "#374151" }}>{job.customer.phone}</div>
                          </div>
                        )}
                        {job.customer.email && (
                          <div>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Email</div>
                            <div style={{ fontSize: 13, color: "#2563eb" }}>{job.customer.email}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "#9ca3af" }}>No client linked to this job.</div>
                    )}
                  </div>

                  {/* Job Details */}
                  <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 10, padding: "20px 24px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Job Details</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {job.leadNumber && (
                        <div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Lead Number</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", fontFamily: "'DM Mono', monospace" }}>{job.leadNumber}</div>
                        </div>
                      )}
                      {job.jobCategory && (
                        <div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Category</div>
                          <div style={{ fontSize: 13, color: "#374151" }}>{job.jobCategory}</div>
                        </div>
                      )}
                      {job.shop && (
                        <div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Shop</div>
                          <div style={{ fontSize: 13, color: "#374151" }}>{job.shop}</div>
                        </div>
                      )}
                      {job.jobSource && (
                        <div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Source</div>
                          <div style={{ fontSize: 13, color: "#374151" }}>{job.jobSource}</div>
                        </div>
                      )}
                      {job.terms && (
                        <div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Terms</div>
                          <div style={{ fontSize: 13, color: "#374151" }}>{job.terms}</div>
                        </div>
                      )}
                      {job.startDate && (
                        <div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Start Date</div>
                          <div style={{ fontSize: 13, color: "#374151" }}>{new Date(job.startDate).toLocaleDateString("en-AU")}</div>
                        </div>
                      )}
                      {job.endDate && (
                        <div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>End Date</div>
                          <div style={{ fontSize: 13, color: "#374151" }}>{new Date(job.endDate).toLocaleDateString("en-AU")}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── COST & SELL TAB ── */}
              {activeTab === "Cost & Sell" && (
                <div>
                  <div className="section-title">Line Items</div>
                  <div className="cs-wrap">
                    <table className="cs-table">
                      <thead><tr>
                        <th style={{ width: 30 }}></th><th style={{ width: 28 }}>T</th><th style={{ width: 55 }}>Tag</th>
                        <th style={{ minWidth: 200 }}>Description</th><th style={{ width: 60 }}>Qty</th>
                        <th style={{ width: 90 }}>Unit Cost</th><th style={{ width: 55 }}>Tax%</th>
                        <th style={{ width: 90 }}>Unit Sell</th><th style={{ width: 55 }}>Tax%</th>
                        <th style={{ width: 90, textAlign: "right" }}>Line Total</th>
                        <th style={{ width: 46 }}>Act</th><th style={{ width: 30 }}></th>
                      </tr></thead>
                      <tbody>
                        {lineItems.length === 0 && <tr><td colSpan={12} style={{ textAlign: "center", padding: "36px", color: "#9ca3af", fontSize: 13 }}>No line items — click &quot;+ Add Line Item&quot; or &quot;🏠 Template&quot;</td></tr>}
                        {lineItems.map((li, i) => {
                          if (li.isHeader) return (
                            <tr key={i} className="header-row">
                              <td><div style={{ display: "flex", flexDirection: "column" }}><button className="cs-move-btn" onClick={() => moveItem(i, -1)}>▲</button><button className="cs-move-btn" onClick={() => moveItem(i, 1)}>▼</button></div></td>
                              <td><span className="cs-type type-H">H</span></td>
                              <td colSpan={8}><input className="cs-inp" value={li.description} onChange={e => updateItem(i, "description", e.target.value)} style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "#7c3aed" }} placeholder="Section header…" /></td>
                              <td></td><td><button className="cs-del-btn" onClick={() => removeItem(i)}>✕</button></td>
                            </tr>
                          );
                          const lineTotal = n(li.qty) * n(li.unitSell);
                          const typeMap: Record<string, string> = { M: "type-M", L: "type-L", O: "type-O" };
                          const nextType: Record<string, string> = { M: "L", L: "O", O: "M" };
                          return (
                            <tr key={i} className="data-row">
                              <td><div style={{ display: "flex", flexDirection: "column" }}><button className="cs-move-btn" onClick={() => moveItem(i, -1)}>▲</button><button className="cs-move-btn" onClick={() => moveItem(i, 1)}>▼</button></div></td>
                              <td><span className={`cs-type ${typeMap[li.type] || "type-M"}`} onClick={() => updateItem(i, "type", nextType[li.type] || "M")} title="Click to cycle">{li.type}</span></td>
                              <td><input className="cs-inp" value={li.tag} onChange={e => updateItem(i, "tag", e.target.value)} style={{ width: 50 }} /></td>
                              <td><input className="cs-inp" value={li.description} onChange={e => updateItem(i, "description", e.target.value)} placeholder="Description…" style={{ minWidth: 180 }} /></td>
                              <td><input className="cs-inp mono" type="number" value={li.qty} onChange={e => updateItem(i, "qty", e.target.value)} style={{ width: 52 }} /></td>
                              <td><input className="cs-inp mono" type="number" value={li.unitCost} onChange={e => updateItem(i, "unitCost", e.target.value)} style={{ width: 80 }} /></td>
                              <td><input className="cs-inp mono" type="number" value={li.costTax} onChange={e => updateItem(i, "costTax", e.target.value)} style={{ width: 46 }} /></td>
                              <td><input className="cs-inp mono" type="number" value={li.unitSell} onChange={e => updateItem(i, "unitSell", e.target.value)} style={{ width: 80 }} /></td>
                              <td><input className="cs-inp mono" type="number" value={li.sellTax} onChange={e => updateItem(i, "sellTax", e.target.value)} style={{ width: 46 }} /></td>
                              <td style={{ textAlign: "right", paddingRight: 10 }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: lineTotal > 0 ? "#2563eb" : "#9ca3af" }}>${fmt(lineTotal)}</span></td>
                              <td style={{ textAlign: "center" }}><input type="checkbox" checked={li.actOn} onChange={e => updateItem(i, "actOn", e.target.checked)} style={{ accentColor: "#2563eb", cursor: "pointer" }} /></td>
                              <td><button className="cs-del-btn" onClick={() => removeItem(i)}>✕</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="cs-add-row">
                    <button className="cs-add-btn" onClick={() => addLineItem(false)}>+ Add Line Item</button>
                    <button className="cs-add-btn" onClick={() => addLineItem(true)} style={{ color: "#7c3aed", background: "#f5f3ff", borderColor: "#ddd6fe" }}>+ Add Section Header</button>
                    <button className="cs-add-btn purple" onClick={() => setShowFlooringModal(true)}>🏠 Load Flooring Template</button>
                  </div>
                  <div className="cs-totals">
                    {[{ label: "Gross Cost", value: `$${fmt(grossCost)}`, sub: `${dataRows.length} items`, cls: "" }, { label: "Gross Sell (ex GST)", value: `$${fmt(grossSell)}`, sub: `GST: $${fmt(gstAmt)}`, cls: "" }, { label: "Total inc. GST", value: `$${fmt(grossSell + gstAmt)}`, sub: `at ${gstRate}% GST`, cls: "" }, { label: "Margin", value: `$${fmt(margin)}`, sub: `${marginPct}% of sell`, cls: margin >= 0 ? "green" : "red" }].map(c => (
                      <div key={c.label} className="cs-total-cell"><div className="cs-total-label">{c.label}</div><div className={`cs-total-value${c.cls ? ` ${c.cls}` : ""}`}>{c.value}</div><div className="cs-total-sub">{c.sub}</div></div>
                    ))}
                  </div>
                  <div className="cs-margin-box">
                    <div><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#2563eb", marginBottom: 2 }}>Set Target Margin $</div><div style={{ fontSize: 11, color: "#6b7280" }}>Enter $ margin → Unit Sell prices update proportionally</div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: "#2563eb", fontFamily: "'JetBrains Mono',monospace" }}>$</span>
                      <input className="cs-margin-input" type="number" value={targetMargin} placeholder={margin.toFixed(2)} onChange={e => setTargetMargin(e.target.value)} onBlur={() => { const v = parseFloat(targetMargin); if (!isNaN(v)) applyTargetMargin(v); }} onKeyDown={e => { if (e.key === "Enter") { const v = parseFloat(targetMargin); if (!isNaN(v)) applyTargetMargin(v); } }} />
                      <button className="fm-btn btn-primary" onClick={() => { const v = parseFloat(targetMargin); if (!isNaN(v)) applyTargetMargin(v); }}>Apply ✓</button>
                      {targetMargin !== "" && <button className="fm-btn btn-ghost" onClick={() => setTargetMargin("")}>Clear</button>}
                    </div>
                  </div>
                </div>
              )}

              {/* ── QUOTE TAB ── */}
              {activeTab === "Quote" && (
                <div>
                  <div className="section-title">Quote</div>
                  <div style={{ background: "#fff", border: "1px solid #e8eaef", borderRadius: 12, padding: "24px", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "#1e3a8a" }}>Q-{String(job.id).padStart(5, "0")}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Date: {new Date().toLocaleDateString("en-AU")} · {job.customer?.name || "No client"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button className="fm-btn btn-ghost" onClick={() => setShowPrintPreview(true)}>🖨 Print / Save PDF</button>
                        <button className="fm-btn btn-primary" onClick={openQuoteEmail}>✉ Email to Customer</button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                      {[{ label: "Net Amount", value: `$${fmt(grossSell)}`, color: "#2563eb" }, { label: `GST (${gstRate}%)`, value: `$${fmt(gstAmt)}`, color: "#6b7280" }, { label: "Total inc. GST", value: `$${fmt(grossSell + gstAmt)}`, color: "#16a34a" }].map(c => (
                        <div key={c.label} style={{ background: "#f8f9fb", border: "1px solid #e8eaef", borderRadius: 8, padding: "12px 16px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#9ca3af", marginBottom: 4 }}>{c.label}</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 700, color: c.color }}>{c.value}</div>
                        </div>
                      ))}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead><tr>{["Description", "Qty", "Unit Sell", "Total"].map((h, i) => (
                        <th key={h} style={{ background: "#f8f9fb", padding: "8px 12px", textAlign: i > 0 ? "right" : "left", borderBottom: "1px solid #e8eaef", fontSize: 10, textTransform: "uppercase", color: "#9ca3af", fontWeight: 700 }}>{h}</th>
                      ))}</tr></thead>
                      <tbody>
                        {lineItems.length === 0 && <tr><td colSpan={4} style={{ padding: 20, color: "#9ca3af", textAlign: "center" }}>No line items — go to Cost &amp; Sell tab to add items</td></tr>}
                        {lineItems.map((li, i) => li.isHeader ? (
                          <tr key={i}><td colSpan={4} style={{ background: "#f5f3ff", color: "#7c3aed", fontWeight: 700, textTransform: "uppercase", fontSize: 10, padding: "8px 12px", letterSpacing: "1px" }}>{li.description}</td></tr>
                        ) : (
                          <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "9px 12px" }}>{li.description}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: "#6b7280" }}>{n(li.qty)}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: "#6b7280" }}>${fmt(n(li.unitSell))}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: "#1e2540" }}>${fmt(n(li.qty) * n(li.unitSell))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 12, padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 11, color: "#374151", lineHeight: 1.8 }}>
                      <strong>Payment Terms:</strong> Initial deposit 50% = ${fmt((grossSell + gstAmt) * 0.5)} · Balance 3 working days prior to installation<br />
                      <strong>BSB 063 237 · Account No. 1048 7235 · Flooring Junction Pty. Ltd.</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* ── BILLING TAB ── */}
              {activeTab === "Billing" && (
                <div>
                  <div className="section-title">Billing</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                    {[{ label: "Total Invoiced", value: fmtAUD(totalInvoiced), color: "#2563eb" }, { label: "Received", value: fmtAUD(totalPaid), color: "#16a34a" }, { label: "Balance Due", value: fmtAUD(totalBalance), color: "#dc2626" }, { label: "Money in Trust", value: fmtAUD(totalMiT), color: "#9333ea" }].map(c => (
                      <div key={c.label} className="bil-card"><div className="bil-card-label">{c.label}</div><div className="bil-card-value" style={{ color: c.color }}>{c.value}</div></div>
                    ))}
                  </div>
                  {showInvoiceForm && (
                    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 18, marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>New Invoice</div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {[{ key: "invoiceNumber", label: "Invoice No (auto if blank)", type: "text" }, { key: "invoiceDate", label: "Date", type: "date" }, { key: "grossAmount", label: "Gross Amount ($)", type: "number" }, { key: "credit", label: "Credit ($)", type: "number" }, { key: "retentionRelease", label: "Retention Release ($)", type: "number" }].map(f => (
                          <div key={f.key} className="fm-field" style={{ minWidth: 140 }}>
                            <label>{f.label}</label>
                            <input className="fm-input" type={f.type} value={newInvoice[f.key as keyof typeof newInvoice]} onChange={e => setNewInvoice(p => ({ ...p, [f.key]: e.target.value }))} />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button className="fm-btn btn-primary" onClick={createInvoice}>Create Invoice</button>
                        <button className="fm-btn btn-ghost" onClick={() => setShowInvoiceForm(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                  <div style={{ background: "#fff", border: "1px solid #e8eaef", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
                    <table className="bil-table">
                      <thead><tr>{["Invoice #", "Date", "Gross", "Payments", "Balance", "Status", ""].map(h => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {invoices.length === 0 && <tr><td colSpan={7} style={{ padding: 20, color: "#9ca3af", textAlign: "center" }}>No invoices yet — click &quot;+ New Invoice&quot;</td></tr>}
                        {invoices.map(inv => {
                          const invPaid = (inv.payments ?? []).reduce((s, p) => s + p.amount, 0);
                          const invBal  = (inv.totalAmount ?? 0) - invPaid;
                          return (
                            <React.Fragment key={inv.id}>
                              <tr>
                                <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                                <td>{new Date(inv.invoiceDate).toLocaleDateString("en-AU")}</td>
                                <td>{fmtAUD(inv.totalAmount)}</td>
                                <td style={{ color: "#16a34a" }}>{fmtAUD(invPaid)}</td>
                                <td style={{ color: invBal > 0 ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{fmtAUD(invBal)}</td>
                                <td><span className={`bil-badge bil-badge-${inv.status}`}>{inv.status}</span></td>
                                <td><button className="fm-btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => { setPayModalId(inv.id); setNewPay({ amount: "", method: "EFT", reference: "", paidOn: new Date().toISOString().split("T")[0] }); }}>Record Payment</button></td>
                              </tr>
                              {payModalId === inv.id && (
                                <tr key={`pay-${inv.id}`}>
                                  <td colSpan={7} style={{ background: "#f9fafb", padding: "12px 16px" }}>
                                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                                      <div className="fm-field"><label>Date</label><input className="fm-input" type="date" value={newPay.paidOn} onChange={e => setNewPay(p => ({ ...p, paidOn: e.target.value }))} style={{ width: 140 }} /></div>
                                      <div className="fm-field"><label>Amount ($)</label><input className="fm-input" type="number" placeholder="0.00" value={newPay.amount} onChange={e => setNewPay(p => ({ ...p, amount: e.target.value }))} style={{ width: 120 }} /></div>
                                      <div className="fm-field"><label>Method</label>
                                        <select className="fm-input" value={newPay.method} onChange={e => setNewPay(p => ({ ...p, method: e.target.value }))}>
                                          {["EFT","Cash","Cheque","Credit Card","EFTPOS","Other"].map(m => <option key={m}>{m}</option>)}
                                        </select>
                                      </div>
                                      <div className="fm-field" style={{ flex: 1 }}><label>Reference</label><input className="fm-input" placeholder="Optional" value={newPay.reference} onChange={e => setNewPay(p => ({ ...p, reference: e.target.value }))} /></div>
                                      <button className="fm-btn btn-primary" onClick={recordPayment}>Save Payment</button>
                                      <button className="fm-btn btn-ghost" onClick={() => setPayModalId(null)}>Cancel</button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="section-title">Money in Trust</div>
                  <div style={{ background: "#fff", border: "1px solid #e8eaef", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                      {[{ label: "Date", el: <input className="fm-input" type="date" value={mitDate} onChange={e => setMitDate(e.target.value)} style={{ width: 140 }} /> }, { label: "Description", el: <input className="fm-input" value={mitDesc} onChange={e => setMitDesc(e.target.value)} placeholder="Deposit received" style={{ width: 200 }} /> }, { label: "Amount ($)", el: <input className="fm-input" type="number" value={mitAmount} onChange={e => setMitAmount(e.target.value)} placeholder="0.00" style={{ width: 120 }} /> }].map(f => (
                        <div key={f.label} className="fm-field">{<label>{f.label}</label>}{f.el}</div>
                      ))}
                      <div style={{ alignSelf: "flex-end" }}><button className="fm-btn btn-success" onClick={addMiT}>+ Add MiT</button></div>
                    </div>
                    {mitEntries.length > 0 && mitEntries.map(e => (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid #f3f4f6", fontSize: 12 }}>
                        <span style={{ color: "#6b7280" }}>{e.date} · {e.description}</span>
                        <span style={{ fontWeight: 600, color: "#9333ea" }}>{fmtAUD(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── TAX INVOICE TAB ── */}
              {activeTab === "Tax Invoice" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 16 }}>
                  <div style={{ fontSize: 40 }}>🧾</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Tax Invoice</div>
                  <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", maxWidth: 340 }}>
                    View, print and email professional tax invoices for this job — including scope of work, payment terms and balance due.
                  </div>
                  {invoices.length === 0 && (
                    <div style={{ fontSize: 12, color: "#f59e0b", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 7, padding: "8px 14px" }}>
                      Create an invoice in the Billing tab first
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    {invoices.length === 0 && (
                      <button className="fm-btn btn-ghost" onClick={() => setActiveTab("Billing")}>← Go to Billing</button>
                    )}
                    <button className="fm-btn btn-primary" onClick={() => router.push(`/jobs/${jobId}/tax-invoice`)}>
                      Open Tax Invoice →
                    </button>
                  </div>
                </div>
              )}

              {/* ── SCHEDULE TAB ── */}
              {activeTab === "Schedule" && (
                <div>
                  <div className="section-title">Schedule</div>
                  <div style={{ background: "#fff", border: "1px solid #e8eaef", borderRadius: 12, padding: "24px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                      {[{ label: "Start Date", key: "startDate" }, { label: "End Date", key: "endDate" }, { label: "Completed Date", key: "completedDate" }].map(f => (
                        <div key={f.key} className="fm-field">
                          <label>{f.label}</label>
                          <input className="fm-input" type="date" value={(job[f.key as keyof Job] as string) || ""} readOnly style={{ background: "#f9fafb" }} />
                        </div>
                      ))}
                      <div className="fm-field">
                        <label>Completed %</label>
                        <input className="fm-input" type="number" value={job.completedPercentage || 0} readOnly style={{ background: "#f9fafb" }} />
                      </div>
                    </div>
                    <button className="fm-btn btn-primary" onClick={() => router.push(`/jobs/${jobId}/schedule`)}>Open Full Schedule →</button>
                  </div>
                </div>
              )}

              {/* ── WORK ORDER TAB ── */}
              {activeTab === "Work Order" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 16 }}>
                  <div style={{ fontSize: 40 }}>📋</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Work Order</div>
                  <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", maxWidth: 360 }}>
                    Generate a printable work order to hand to the installer — includes scope of work, materials checklist, site address and signature area.
                  </div>
                  <button className="fm-btn btn-primary" onClick={() => router.push(`/jobs/${jobId}/work-order`)}>
                    Open Work Order →
                  </button>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="jd-footer">
              <div className="jd-footer-info">
                {job.customer?.name && <strong style={{ color: "#1e2540" }}>{job.customer.name}</strong>}
                <span>Sell: <strong style={{ color: "#2563eb" }}>${fmt(grossSell)}</strong></span>
                <span style={{ color: margin >= 0 ? "#16a34a" : "#dc2626" }}>Margin: <strong>${fmt(margin)}</strong> ({marginPct}%)</span>
              </div>
              <div className="jd-footer-nav">
                <button className="jd-nav-btn" onClick={() => router.push("/jobs")}>Me</button>
                <button className="jd-nav-btn" onClick={() => router.push("/")}>Menu</button>
                <button className="jd-nav-btn" onClick={() => { setShowFind(v => !v); setTimeout(() => findRef.current?.focus(), 50); }}>Find</button>
                <span style={{ width: 1, height: 18, background: "#e2e5ed", margin: "0 4px" }} />
                <button className="jd-nav-btn" onClick={() => allJobs.length > 0 && navTo(allJobs[0].id)} disabled={currentIdx <= 0}>⟪ First</button>
                <button className="jd-nav-btn" onClick={() => currentIdx > 0 && navTo(allJobs[currentIdx - 1].id)} disabled={currentIdx <= 0}>← Back</button>
                <input value={jobIdInput} onChange={e => setJobIdInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { const id = parseInt(jobIdInput); if (!isNaN(id)) router.push(`/jobs/${id}`); } }} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, width: 58, textAlign: "center", color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 5, padding: "4px 6px", outline: "none" }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#9ca3af" }}>/{allJobs.length}</span>
                <button className="jd-nav-btn" onClick={() => currentIdx < allJobs.length - 1 && navTo(allJobs[currentIdx + 1].id)} disabled={currentIdx >= allJobs.length - 1}>Next →</button>
                <button className="jd-nav-btn" onClick={() => allJobs.length > 0 && navTo(allJobs[allJobs.length - 1].id)} disabled={currentIdx >= allJobs.length - 1}>Last ⟫</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
