"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const JOB_CATEGORIES = ["Supply & Install","Supply Only","Install Only","Repair","Measure Only"];
const JOB_SOURCES    = ["Walk In","Phone","Website","Referral","Repeat Client","Other"];
const TERMS          = ["COD","Net 7","Net 14","Net 30","Account"];
const SHOPS          = ["Hallam","Dandenong","Frankston","Moorabbin"];

export default function NewJobPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const [form, setForm] = useState({
    customerName: "", siteStreet: "", siteTown: "", siteState: "VIC", siteZip: "", siteCountry: "Australia", project: "",
    billStreet: "", billTown: "", billState: "VIC", billZip: "", billCountry: "Australia",
    phone: "", contactName: "", email: "", fax: "", jobRef: "",
    jobCategory: "", shop: "", jobSource: "", terms: "",
    quoteDate: new Date().toISOString().slice(0, 10),
    initiatedDate: new Date().toISOString().slice(0, 10),
    completedDate: "", notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const copyBilling = () =>
    setForm(f => ({ ...f, billStreet: f.siteStreet, billTown: f.siteTown, billState: f.siteState, billZip: f.siteZip, billCountry: f.siteCountry }));

  const handleSubmit = async () => {
    if (!form.customerName.trim()) { setError("Customer name is required."); return; }
    if (!form.jobCategory)         { setError("Job category is required."); return; }
    setError(null); setSaving(true);
    try {
      const res = await fetch(`${API}/jobs`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, title: form.project || `Job for ${form.customerName}`, status: "pending" }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      const newId = data.id ?? data.job?.id;
      router.push(newId ? `/jobs/${newId}/cost-sell` : "/jobs");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create job.");
    } finally { setSaving(false); }
  };

  const required = !form.customerName.trim() || !form.jobCategory;

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "28px 24px", fontFamily: "'DM Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push("/jobs")}
            style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>
            ← Jobs
          </button>
          <span style={{ color: "#d1d5db" }}>›</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>New Job</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {required && (
            <span style={{ fontSize: 11, color: "#d97706", background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 6, padding: "4px 10px", fontWeight: 600 }}>
              Data Required
            </span>
          )}
          <button onClick={() => router.push("/jobs")}
            style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, background: "#fff", color: "#6b7280", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || required}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 8, cursor: required ? "not-allowed" : "pointer",
              background: required ? "#e5e7eb" : saving ? "#93c5fd" : "#2563eb",
              color: required ? "#9ca3af" : "#fff" }}>
            {saving ? "Creating…" : "Create Job"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>

        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Sec label="Site" step={1}>
            <Row>
              <Fld label="Customer Name *" flex={2}>
                <input value={form.customerName} onChange={set("customerName")} placeholder="Full name or company"
                  style={{ ...INP, borderColor: !form.customerName.trim() ? "#fca5a5" : "#e8eaed" }} />
              </Fld>
              <Fld label="Project / Description" flex={3}>
                <input value={form.project} onChange={set("project")} placeholder="e.g. Kitchen & Hallway Tiles" style={INP} />
              </Fld>
            </Row>
            <Row>
              <Fld label="Street" flex={3}><input value={form.siteStreet} onChange={set("siteStreet")} style={INP} /></Fld>
            </Row>
            <Row>
              <Fld label="Town / Suburb" flex={2}><input value={form.siteTown}  onChange={set("siteTown")}  style={INP} /></Fld>
              <Fld label="State"         flex={1}><input value={form.siteState} onChange={set("siteState")} style={INP} /></Fld>
              <Fld label="Postcode"      flex={1}><input value={form.siteZip}   onChange={set("siteZip")}   style={INP} /></Fld>
            </Row>
            <Row>
              <Fld label="Country" flex={2}><input value={form.siteCountry} onChange={set("siteCountry")} style={INP} /></Fld>
              <Fld label="" flex={3}>
                <button onClick={copyBilling}
                  style={{ marginTop: 18, fontSize: 12, fontWeight: 600, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
                  Copy to Billing →
                </button>
              </Fld>
            </Row>
          </Sec>

          <Sec label="Billing" step={2}>
            <Row><Fld label="Street" flex={3}><input value={form.billStreet} onChange={set("billStreet")} style={INP} /></Fld></Row>
            <Row>
              <Fld label="Town / Suburb" flex={2}><input value={form.billTown}  onChange={set("billTown")}  style={INP} /></Fld>
              <Fld label="State"         flex={1}><input value={form.billState} onChange={set("billState")} style={INP} /></Fld>
              <Fld label="Postcode"      flex={1}><input value={form.billZip}   onChange={set("billZip")}   style={INP} /></Fld>
            </Row>
            <Row><Fld label="Country" flex={2}><input value={form.billCountry} onChange={set("billCountry")} style={INP} /></Fld></Row>
          </Sec>

          <Sec label="Contact" step={3}>
            <Row>
              <Fld label="Phone" flex={1}><input value={form.phone}       onChange={set("phone")}       style={INP} /></Fld>
              <Fld label="Contact Name" flex={1}><input value={form.contactName} onChange={set("contactName")} style={INP} /></Fld>
              <Fld label="Email" flex={2}><input value={form.email}       onChange={set("email")}       type="email" style={INP} /></Fld>
              <Fld label="Fax"   flex={1}><input value={form.fax}         onChange={set("fax")}         style={INP} /></Fld>
            </Row>
            <Row><Fld label="Job Ref" flex={2}><input value={form.jobRef} onChange={set("jobRef")} style={INP} /></Fld></Row>
          </Sec>

          <Sec label="Notes" step={4}>
            <textarea value={form.notes} onChange={set("notes")} rows={3} placeholder="Any additional notes…"
              style={{ ...INP, resize: "vertical", width: "100%", minHeight: 72 }} />
          </Sec>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Sec label="Job Details" accent="#2563eb">
            <Fld label="Job Category *">
              <select value={form.jobCategory} onChange={set("jobCategory")}
                style={{ ...INP, borderColor: !form.jobCategory ? "#fca5a5" : "#e8eaed" }}>
                <option value="">— Select —</option>
                {JOB_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Fld>
            <Fld label="Shop">
              <select value={form.shop} onChange={set("shop")} style={INP}>
                <option value="">— Select —</option>
                {SHOPS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Fld>
            <Fld label="Job Source">
              <select value={form.jobSource} onChange={set("jobSource")} style={INP}>
                <option value="">— Select —</option>
                {JOB_SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Fld>
            <Fld label="Terms">
              <select value={form.terms} onChange={set("terms")} style={INP}>
                <option value="">— Select —</option>
                {TERMS.map(t => <option key={t}>{t}</option>)}
              </select>
            </Fld>
          </Sec>

          <Sec label="Dates" accent="#7c3aed">
            <Fld label="Quote Date">    <input value={form.quoteDate}     onChange={set("quoteDate")}     type="date" style={INP} /></Fld>
            <Fld label="Initiated Date"><input value={form.initiatedDate} onChange={set("initiatedDate")} type="date" style={INP} /></Fld>
            <Fld label="Completed Date"><input value={form.completedDate} onChange={set("completedDate")} type="date" style={INP} /></Fld>
          </Sec>
        </div>
      </div>
    </div>
  );
}

function Sec({ label, step, accent = "#111827", children }: { label: string; step?: number; accent?: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: "1px solid #e8eaed", borderRadius: 10, padding: "14px 16px", background: "#fff", margin: 0 }}>
      <legend style={{ fontSize: 12, fontWeight: 700, color: accent, padding: "0 8px", display: "flex", alignItems: "center", gap: 7 }}>
        {step && <span style={{ width: 20, height: 20, borderRadius: "50%", background: accent, color: "#fff", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{step}</span>}
        {label}
      </legend>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </fieldset>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10 }}>{children}</div>;
}
function Fld({ label, flex = 1, children }: { label: string; flex?: number; children: React.ReactNode }) {
  return (
    <div style={{ flex, minWidth: 0 }}>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>}
      {children}
    </div>
  );
}
const INP: React.CSSProperties = {
  width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid #e8eaed",
  borderRadius: 7, outline: "none", background: "#fff", color: "#111827", fontFamily: "'DM Sans',sans-serif",
};
