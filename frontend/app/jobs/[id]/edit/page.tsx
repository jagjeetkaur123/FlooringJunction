"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

interface Job {
  id: number; title: string; status: string; jobRef?: string;
  leadNumber?: string; jobCategory?: string; shop?: string; jobSource?: string;
  startDate?: string; endDate?: string;
  contactName?: string; contactPhone?: string; contactEmail?: string;
  siteStreet?: string; siteTown?: string; siteState?: string; siteZip?: string;
  billingStreet?: string; billingTown?: string; billingState?: string; billingZip?: string;
  customer?: { id?: number; name?: string; email?: string; phone?: string; };
  customerName?: string;
  notes?: string; description?: string;
}

const INP: React.CSSProperties = {
  width: "100%", padding: "9px 11px", fontSize: 13,
  border: "1.5px solid #e5e7eb", borderRadius: 7, outline: "none",
  fontFamily: "'DM Sans',sans-serif", background: "#fff",
};
const LBL: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
};
const SECTION: React.CSSProperties = {
  background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12,
  padding: "20px 24px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};
const GRID2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };
const GRID3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 };

export default function EditJobPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const [form, setForm] = useState<Partial<Job>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    fetch(`${API}/jobs/${jobId}`)
      .then(r => r.json())
      .then((jd: Job) => {
        setForm({
          title:         jd.title        ?? "",
          status:        jd.status       ?? "pending",
          jobRef:        jd.jobRef       ?? "",
          leadNumber:    jd.leadNumber   ?? "",
          jobCategory:   jd.jobCategory  ?? "",
          shop:          jd.shop         ?? "",
          jobSource:     jd.jobSource    ?? "",
          startDate:     jd.startDate    ? jd.startDate.split("T")[0] : "",
          endDate:       jd.endDate      ? jd.endDate.split("T")[0]   : "",
          contactName:   jd.contactName  ?? jd.customer?.name  ?? "",
          contactPhone:  jd.contactPhone ?? jd.customer?.phone ?? "",
          contactEmail:  jd.contactEmail ?? jd.customer?.email ?? "",
          siteStreet:    jd.siteStreet   ?? "",
          siteTown:      jd.siteTown     ?? "",
          siteState:     jd.siteState    ?? "",
          siteZip:       jd.siteZip      ?? "",
          billingStreet: jd.billingStreet ?? "",
          billingTown:   jd.billingTown   ?? "",
          billingState:  jd.billingState  ?? "",
          billingZip:    jd.billingZip    ?? "",
        });
      })
      .catch(() => showToast("Failed to load job", false))
      .finally(() => setLoading(false));
  }, [jobId, showToast]);

  const set = (key: keyof Job) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    if (!form.title?.trim()) { showToast("Job title is required", false); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      showToast("Job saved", true);
      setTimeout(() => router.push(`/jobs/${jobId}`), 800);
    } catch (e) { showToast((e as Error).message || "Save failed", false); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#9ca3af", fontFamily: "'DM Sans',sans-serif" }}>Loading…</div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", maxWidth: 860, margin: "0 auto", padding: "24px" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: toast.ok ? "#16a34a" : "#dc2626", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontFamily: "'DM Mono',monospace" }}>Job #{jobId}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Edit Job Details</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => router.back()}
            style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, background: "#fff", color: "#374151", border: "1.5px solid #e5e7eb", borderRadius: 7, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            style={{ padding: "9px 22px", fontSize: 13, fontWeight: 600, background: saving ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 7, cursor: saving ? "default" : "pointer" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Job Info */}
      <div style={SECTION}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.5px" }}>Job Information</div>
        <div style={{ ...GRID2, marginBottom: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={LBL}>Job Title</label>
            <input value={form.title ?? ""} onChange={set("title")} placeholder="e.g. Supply & Install Carpet — Smith Residence" style={INP} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={LBL}>Job Ref</label>
            <input value={form.jobRef ?? ""} onChange={set("jobRef")} placeholder="e.g. JOB-001" style={INP} />
          </div>
          <div>
            <label style={LBL}>Lead Number</label>
            <input value={form.leadNumber ?? ""} onChange={set("leadNumber")} placeholder="Lead #" style={INP} />
          </div>
          <div>
            <label style={LBL}>Status</label>
            <select value={form.status ?? "pending"} onChange={set("status")} style={INP}>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label style={LBL}>Category</label>
            <input value={form.jobCategory ?? ""} onChange={set("jobCategory")} placeholder="e.g. Carpet, Timber" style={INP} />
          </div>
        </div>
        <div style={{ ...GRID3 }}>
          <div>
            <label style={LBL}>Start Date</label>
            <input type="date" value={form.startDate ?? ""} onChange={set("startDate")} style={INP} />
          </div>
          <div>
            <label style={LBL}>End Date</label>
            <input type="date" value={form.endDate ?? ""} onChange={set("endDate")} style={INP} />
          </div>
          <div>
            <label style={LBL}>Shop / Branch</label>
            <input value={form.shop ?? ""} onChange={set("shop")} placeholder="e.g. Hallam" style={INP} />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div style={SECTION}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.5px" }}>Customer / Contact</div>
        <div style={{ ...GRID3 }}>
          <div>
            <label style={LBL}>Contact Name</label>
            <input value={form.contactName ?? ""} onChange={set("contactName")} placeholder="Full name" style={INP} />
          </div>
          <div>
            <label style={LBL}>Phone</label>
            <input value={form.contactPhone ?? ""} onChange={set("contactPhone")} placeholder="04xx xxx xxx" style={INP} />
          </div>
          <div>
            <label style={LBL}>Email</label>
            <input type="email" value={form.contactEmail ?? ""} onChange={set("contactEmail")} placeholder="email@example.com" style={INP} />
          </div>
        </div>
      </div>

      {/* Site Address */}
      <div style={SECTION}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.5px" }}>Site Address (Installation Address)</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={LBL}>Street</label>
            <input value={form.siteStreet ?? ""} onChange={set("siteStreet")} placeholder="123 Example St" style={INP} />
          </div>
          <div>
            <label style={LBL}>Suburb</label>
            <input value={form.siteTown ?? ""} onChange={set("siteTown")} placeholder="Hallam" style={INP} />
          </div>
          <div>
            <label style={LBL}>State</label>
            <input value={form.siteState ?? ""} onChange={set("siteState")} placeholder="VIC" style={INP} />
          </div>
          <div>
            <label style={LBL}>Postcode</label>
            <input value={form.siteZip ?? ""} onChange={set("siteZip")} placeholder="3803" style={INP} />
          </div>
        </div>
      </div>

      {/* Billing Address */}
      <div style={SECTION}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.5px" }}>Billing Address</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label style={LBL}>Street</label>
            <input value={form.billingStreet ?? ""} onChange={set("billingStreet")} placeholder="123 Example St" style={INP} />
          </div>
          <div>
            <label style={LBL}>Suburb</label>
            <input value={form.billingTown ?? ""} onChange={set("billingTown")} placeholder="Hallam" style={INP} />
          </div>
          <div>
            <label style={LBL}>State</label>
            <input value={form.billingState ?? ""} onChange={set("billingState")} placeholder="VIC" style={INP} />
          </div>
          <div>
            <label style={LBL}>Postcode</label>
            <input value={form.billingZip ?? ""} onChange={set("billingZip")} placeholder="3803" style={INP} />
          </div>
        </div>
      </div>

      {/* Save button at bottom too */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={() => router.back()}
          style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, background: "#fff", color: "#374151", border: "1.5px solid #e5e7eb", borderRadius: 7, cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={save} disabled={saving}
          style={{ padding: "9px 22px", fontSize: 13, fontWeight: 600, background: saving ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: 7, cursor: saving ? "default" : "pointer" }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
