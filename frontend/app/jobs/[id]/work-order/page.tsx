"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";
const fmtDate = (s?: string) => { try { return s ? new Date(s).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""; } catch { return s ?? ""; } };
const today = () => new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

interface LineItem { description: string; qty: number; unitSell: number; isHeader: boolean; type: string; }
interface ScheduleEntry { id: number; date: string; time?: string; representative: string; details: string; type: string; }
interface Job {
  id: number; title: string; status: string; description?: string;
  customer?: { name?: string; phone?: string; email?: string; };
  customerName?: string; contactName?: string; contactPhone?: string; contactEmail?: string;
  siteStreet?: string; siteTown?: string; siteState?: string; siteZip?: string;
  startDate?: string;
  assignedTo?: { fullName?: string; };
}

export default function WorkOrderPage() {
  const params = useParams();
  const jobId = params?.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [installer, setInstaller] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [installTime, setInstallTime] = useState("");
  const [scopeText, setScopeText] = useState("");
  const [instructions, setInstructions] = useState("• Please ensure all furniture has been moved prior to arrival.\n• Ensure the site is clear and accessible.\n• Customer to remove all breakables from area.");
  const [notes, setNotes] = useState("");
  const [woNumber, setWoNumber] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${API}/jobs/${jobId}`),
      fetch(`${API}/jobs/${jobId}/line-items`),
      fetch(`${API}/jobs/${jobId}/schedule`),
    ]).then(async ([jr, lr, sr]) => {
      const jd: Job = await jr.json();
      const li: LineItem[] = lr.ok ? await lr.json() : [];
      const sc: ScheduleEntry[] = sr.ok ? await sr.json() : [];

      setJob(jd);
      setLineItems(li);
      setScheduleEntries(sc);
      setWoNumber(`WO-${String(jd.id).padStart(5, "0")}`);

      // Pre-fill installer from assigned person or schedule entry
      const rep = sc.find(e => e.type === "installation")?.representative
        ?? jd.assignedTo?.fullName
        ?? jd.contactName
        ?? "";
      setInstaller(rep);

      // Pre-fill install date from schedule or job startDate
      const installEntry = sc.find(e => e.type === "installation");
      if (installEntry) {
        setInstallDate(installEntry.date.split("T")[0]);
        setInstallTime(installEntry.time ?? "");
      } else if (jd.startDate) {
        setInstallDate(jd.startDate.split("T")[0]);
      }

      // Pre-fill scope from quote description
      if (jd.description) {
        try {
          const p = JSON.parse(jd.description);
          const parts: string[] = [];
          if (p.supplyInstall) parts.push(`TO SUPPLY AND INSTALL:\n${p.supplyInstall}`);
          if (p.rooms) parts.push(`ROOMS:\n${p.rooms}`);
          if (p.inclusions) parts.push(`INCLUSIONS:\n${p.inclusions}`);
          setScopeText(parts.join("\n\n") || jd.description);
        } catch { setScopeText(jd.description); }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [jobId]);

  const materials = lineItems.filter(li => !li.isHeader);

  const buildPrintHTML = () => {
    if (!job) return "";
    const clientName = job.customer?.name ?? job.customerName ?? "";
    const phone = job.contactPhone ?? job.customer?.phone ?? "";
    const email = job.contactEmail ?? job.customer?.email ?? "";
    const siteAddr = [job.siteStreet, job.siteTown, job.siteState, job.siteZip].filter(Boolean).join(", ");

    const matRows = materials.map(li => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;">${li.description}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">${li.qty}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">☐</td>
      </tr>`).join("");

    return `<!DOCTYPE html><html><head><title>Work Order ${woNumber}</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:Arial,sans-serif; padding:28px 36px; color:#111; font-size:12.5px; }
.header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1e3a8a; padding-bottom:14px; margin-bottom:18px; }
.co-name { font-size:22px; font-weight:900; color:#1e3a8a; letter-spacing:1px; }
.co-sub { font-size:10px; color:#555; margin-top:3px; letter-spacing:0.5px; }
.wo-title { font-size:20px; font-weight:900; color:#1e3a8a; text-align:right; }
.wo-meta { text-align:right; font-size:11px; color:#444; line-height:1.8; margin-top:4px; }
.grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
.box { border:1px solid #d1d5db; border-radius:5px; padding:10px 14px; }
.box-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#9ca3af; margin-bottom:5px; }
.box-value { font-size:13px; font-weight:700; color:#111; margin-bottom:2px; }
.box-detail { font-size:11.5px; color:#555; line-height:1.7; }
.section-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#9ca3af; margin:14px 0 5px; }
.scope-box { border:1px solid #d1d5db; border-radius:5px; padding:10px 14px; font-size:12px; line-height:1.75; white-space:pre-wrap; min-height:70px; }
table { width:100%; border-collapse:collapse; font-size:12px; }
th { background:#f3f4f6; padding:7px 10px; text-align:left; border-bottom:2px solid #e5e7eb; font-size:10px; text-transform:uppercase; color:#6b7280; font-weight:700; }
.sig-row { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:20px; }
.sig-box { border-top:1.5px solid #111; padding-top:6px; font-size:10px; color:#555; }
@media print { body { padding:16px 24px; } }
</style></head><body>
<div class="header">
  <div>
    <div class="co-name">FLOORING JUNCTION</div>
    <div class="co-sub">T/A Carpet World Hallam &nbsp;·&nbsp; 3/2-10 Hallam South Road, HALLAM VIC 3803 &nbsp;·&nbsp; P 03 9796 3255</div>
  </div>
  <div>
    <div class="wo-title">WORK ORDER</div>
    <div class="wo-meta">${woNumber}<br>Issued: ${today()}</div>
  </div>
</div>
<div class="grid2">
  <div class="box">
    <div class="box-label">Customer</div>
    <div class="box-value">${clientName || "—"}</div>
    <div class="box-detail">${phone ? `Ph: ${phone}<br>` : ""}${email ? email : ""}</div>
  </div>
  <div class="box">
    <div class="box-label">Installation / Site Address</div>
    <div class="box-value">${job.title}</div>
    <div class="box-detail">${siteAddr || "—"}</div>
  </div>
</div>
<div class="grid2">
  <div class="box">
    <div class="box-label">Installer</div>
    <div class="box-value">${installer || "—"}</div>
  </div>
  <div class="box">
    <div class="box-label">Date &amp; Time of Installation</div>
    <div class="box-value">${installDate ? fmtDate(installDate) : "—"}</div>
    <div class="box-detail">${installTime ? `Time: ${installTime}` : ""}</div>
  </div>
</div>
<div class="section-label">Scope of Work</div>
<div class="scope-box">${(scopeText || "—").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>")}</div>
${materials.length > 0 ? `
<div class="section-label">Materials / Items Checklist</div>
<table>
  <thead><tr><th>Description</th><th style="width:80px;text-align:center;">Qty</th><th style="width:80px;text-align:center;">Loaded ✓</th></tr></thead>
  <tbody>${matRows}</tbody>
</table>` : ""}
<div class="section-label">Special Instructions</div>
<div class="scope-box">${(instructions || "—").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>")}</div>
${notes ? `<div class="section-label">Additional Notes</div><div class="scope-box">${notes.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>")}</div>` : ""}
<div class="sig-row">
  <div class="sig-box">Customer Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: __________</div>
  <div class="sig-box">Installer Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: __________</div>
</div>
</body></html>`;
  };

  const doPrint = () => {
    const html = buildPrintHTML();
    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  const INP: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #e8eaed", borderRadius: 7, outline: "none", fontFamily: "Arial, sans-serif" };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#9ca3af", fontFamily: "'DM Sans',sans-serif" }}>Loading…</div>;
  if (!job) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#dc2626" }}>Job not found</div>;

  const clientName = job.customer?.name ?? job.customerName ?? "";
  const phone = job.contactPhone ?? job.customer?.phone ?? "";
  const siteAddr = [job.siteStreet, job.siteTown, job.siteState, job.siteZip].filter(Boolean).join(", ");

  const Label = ({ text }: { text: string }) => (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: "#9ca3af", marginBottom: 5 }}>{text}</div>
  );

  const TA = ({ value, onChange, rows = 4, placeholder = "" }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) => (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
      style={{ ...INP, resize: "vertical", lineHeight: 1.75 }} />
  );

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", maxWidth: 900, margin: "0 auto", padding: "24px" }}>

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#2563eb", background: "#eff6ff", padding: "4px 12px", borderRadius: 6 }}>{woNumber}</div>
          <span style={{ fontSize: 13, color: "#6b7280" }}>Work Order — {job.title}</span>
        </div>
        <button onClick={doPrint}
          style={{ padding: "9px 22px", fontSize: 13, fontWeight: 600, background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" }}>
          🖨 Print Work Order
        </button>
      </div>

      {/* Document preview */}
      <div style={{ background: "#fff", border: "1px solid #d1d5db", padding: "32px 40px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #1e3a8a", paddingBottom: 14, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#1e3a8a", letterSpacing: 1 }}>FLOORING JUNCTION</div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 3, letterSpacing: 0.5 }}>T/A Carpet World Hallam &nbsp;·&nbsp; 3/2-10 Hallam South Road, HALLAM VIC 3803 &nbsp;·&nbsp; P 03 9796 3255</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#1e3a8a" }}>WORK ORDER</div>
            <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "#374151", marginTop: 3 }}>{woNumber}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Issued: {today()}</div>
          </div>
        </div>

        {/* Customer + Site */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "11px 15px" }}>
            <Label text="Customer" />
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "#111", marginBottom: 2 }}>{clientName || "—"}</div>
            <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.8 }}>
              {phone && <>{phone}<br /></>}
              {job.customer?.email && <>{job.customer.email}</>}
            </div>
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "11px 15px" }}>
            <Label text="Installation / Site Address" />
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "#111", marginBottom: 2 }}>{job.title}</div>
            <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.8 }}>{siteAddr || "—"}</div>
          </div>
        </div>

        {/* Installer + Date */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <Label text="Installer Name" />
            <input style={INP} value={installer} placeholder="e.g. Sam, Kamal" onChange={e => setInstaller(e.target.value)} />
          </div>
          <div>
            <Label text="Date of Installation" />
            <input type="date" style={INP} value={installDate} onChange={e => setInstallDate(e.target.value)} />
          </div>
          <div>
            <Label text="Time" />
            <input type="time" style={INP} value={installTime} onChange={e => setInstallTime(e.target.value)} />
          </div>
        </div>

        {/* Scope */}
        <div style={{ marginBottom: 16 }}>
          <Label text="Scope of Work" />
          <TA value={scopeText} onChange={setScopeText} rows={6} placeholder="TO SUPPLY AND INSTALL:&#10;&#10;TO:&#10;&#10;INCLUSIONS:" />
        </div>

        {/* Materials checklist */}
        {materials.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Label text="Materials / Items Checklist" />
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={{ padding: "7px 10px", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontSize: 10, textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Description</th>
                  <th style={{ padding: "7px 10px", textAlign: "center", borderBottom: "2px solid #e5e7eb", fontSize: 10, textTransform: "uppercase", color: "#6b7280", fontWeight: 700, width: 80 }}>Qty</th>
                  <th style={{ padding: "7px 10px", textAlign: "center", borderBottom: "2px solid #e5e7eb", fontSize: 10, textTransform: "uppercase", color: "#6b7280", fontWeight: 700, width: 80 }}>Loaded ✓</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((li, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "6px 10px", fontSize: 12.5 }}>{li.description}</td>
                    <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 12.5 }}>{li.qty}</td>
                    <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 16, color: "#d1d5db" }}>☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Special instructions */}
        <div style={{ marginBottom: 16 }}>
          <Label text="Special Instructions" />
          <TA value={instructions} onChange={setInstructions} rows={4} />
        </div>

        {/* Additional notes */}
        <div style={{ marginBottom: 24 }}>
          <Label text="Additional Notes (optional)" />
          <TA value={notes} onChange={setNotes} rows={2} placeholder="Any other information for the installer…" />
        </div>

        {/* Signature area */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 8 }}>
          {["Customer Signature", "Installer Signature"].map(label => (
            <div key={label} style={{ borderTop: "1.5px solid #374151", paddingTop: 6 }}>
              <span style={{ fontSize: 10.5, color: "#6b7280" }}>{label} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: __________</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
