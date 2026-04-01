"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";
const today = () => new Date().toISOString().split("T")[0];
const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); } catch { return s; } };
const fmtTime = (t?: string) => { if (!t) return ""; try { const [h, m] = t.split(":"); const hr = parseInt(h); return `${hr % 12 || 12}:${m} ${hr < 12 ? "AM" : "PM"}`; } catch { return t; } };

interface ScheduleEntry {
  id: number;
  date: string;
  time?: string;
  representative: string;
  details: string;
}
interface Job {
  id: number; title: string;
  customer?: { name?: string; };
  customerName?: string;
  startDate?: string;
}

const INP: React.CSSProperties = {
  width: "100%", padding: "9px 11px", fontSize: 13,
  border: "1.5px solid #e5e7eb", borderRadius: 7, outline: "none",
  fontFamily: "'DM Sans',sans-serif",
};
const LBL: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
};

export default function SchedulePage() {
  const params = useParams();
  const jobId = params?.id as string;

  const [job,     setJob]     = useState<Job | null>(null);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [editId,  setEditId]  = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Partial<ScheduleEntry>>({});

  const [form, setForm] = useState({
    date: today(), time: "", representative: "", details: "",
  });

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [jr, sr] = await Promise.all([
        fetch(`${API}/jobs/${jobId}`),
        fetch(`${API}/jobs/${jobId}/schedule`),
      ]);
      const jd: Job = await jr.json();
      setJob(jd);

      const startDate = jd.startDate ? jd.startDate.split("T")[0] : today();
      setForm(f => ({
        ...f,
        date: f.date === today() ? startDate : f.date,
      }));

      if (sr.ok) {
        const sd = await sr.json();
        setEntries(Array.isArray(sd) ? sd : []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const addEntry = async () => {
    if (!form.date || !form.representative) {
      showToast("Date and Representative are required", false); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/jobs/${jobId}/schedule`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date:           form.date,
          time:           form.time || null,
          representative: form.representative,
          details:        form.details || "",
          type:           "other",
          status:         "open",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setForm(f => ({ ...f, time: "", details: "" }));
      showToast("Entry added", true);
      load();
    } catch (e) { showToast((e as Error).message || "Failed", false); }
    finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await fetch(`${API}/jobs/${jobId}/schedule/${editId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editRow),
      });
      setEditId(null);
      setEditRow({});
      showToast("Entry updated", true);
      load();
    } catch { showToast("Failed to update", false); }
  };

  const deleteEntry = async (id: number) => {
    try {
      await fetch(`${API}/jobs/${jobId}/schedule/${id}`, { method: "DELETE" });
      showToast("Entry removed", true);
      load();
    } catch { showToast("Failed to delete", false); }
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#9ca3af", fontFamily: "'DM Sans',sans-serif" }}>Loading…</div>;

  const clientName = job?.customer?.name ?? job?.customerName ?? "";

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", maxWidth: 860, margin: "0 auto", padding: "24px" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: toast.ok ? "#16a34a" : "#dc2626", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontFamily: "'DM Mono',monospace" }}>
          Job #{jobId}{clientName ? ` · ${clientName}` : ""}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Schedule</div>
      </div>

      {/* Add Entry form */}
      <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 16 }}>New Schedule Entry</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={LBL}>Date</label>
            <input type="date" value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              style={INP} />
          </div>
          <div>
            <label style={LBL}>Time (optional)</label>
            <input type="time" value={form.time}
              onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
              style={INP} />
          </div>
          <div>
            <label style={LBL}>Representative</label>
            <input type="text" value={form.representative}
              placeholder="e.g. Sam, Installer name…"
              onChange={e => setForm(p => ({ ...p, representative: e.target.value }))}
              style={INP} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "flex-end" }}>
          <div>
            <label style={LBL}>Notes (optional)</label>
            <input type="text" value={form.details}
              placeholder="e.g. Measure bedroom, Install carpet lounge…"
              onChange={e => setForm(p => ({ ...p, details: e.target.value }))}
              style={INP} />
          </div>
          <button onClick={addEntry} disabled={saving}
            style={{ padding: "9px 24px", fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap" }}>
            {saving ? "Saving…" : "+ Add Entry"}
          </button>
        </div>
      </div>

      {/* Entries table */}
      <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "13px 20px", borderBottom: "1px solid #f3f4f6" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
            Entries ({entries.length})
          </span>
        </div>

        {entries.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            No schedule entries yet — add one above
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["Job ID", "Date", "Time", "Representative", "Notes", ""].map(h => (
                  <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280", borderBottom: "1.5px solid #e5e7eb" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((e, i) => {
                const isEdit = editId === e.id;
                return (
                  <tr key={e.id} style={{ borderBottom: i < entries.length - 1 ? "1px solid #f3f4f6" : "none", background: isEdit ? "#fafbff" : undefined }}>

                    {/* Job ID */}
                    <td style={{ padding: "11px 16px", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#2563eb", fontWeight: 600 }}>
                      #{jobId}
                    </td>

                    {/* Date */}
                    <td style={{ padding: "11px 16px", fontSize: 13, color: "#111827", whiteSpace: "nowrap" }}>
                      {isEdit
                        ? <input type="date" defaultValue={e.date.split("T")[0]}
                            onChange={ev => setEditRow(r => ({ ...r, date: ev.target.value }))}
                            style={{ ...INP, width: 150 }} />
                        : fmtDate(e.date)}
                    </td>

                    {/* Time */}
                    <td style={{ padding: "11px 16px", fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}>
                      {isEdit
                        ? <input type="time" defaultValue={e.time ?? ""}
                            onChange={ev => setEditRow(r => ({ ...r, time: ev.target.value }))}
                            style={{ ...INP, width: 120 }} />
                        : fmtTime(e.time) || <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>

                    {/* Representative */}
                    <td style={{ padding: "11px 16px", fontSize: 13, color: "#374151" }}>
                      {isEdit
                        ? <input type="text" defaultValue={e.representative}
                            onChange={ev => setEditRow(r => ({ ...r, representative: ev.target.value }))}
                            style={{ ...INP, width: 160 }} />
                        : e.representative}
                    </td>

                    {/* Notes */}
                    <td style={{ padding: "11px 16px", fontSize: 13, color: "#6b7280", maxWidth: 260 }}>
                      {isEdit
                        ? <input type="text" defaultValue={e.details}
                            onChange={ev => setEditRow(r => ({ ...r, details: ev.target.value }))}
                            style={INP} />
                        : e.details || <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {isEdit ? (
                          <>
                            <button onClick={saveEdit}
                              style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>
                              Save
                            </button>
                            <button onClick={() => { setEditId(null); setEditRow({}); }}
                              style={{ fontSize: 12, padding: "4px 10px", background: "none", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 5, cursor: "pointer" }}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditId(e.id); setEditRow({ date: e.date, time: e.time, representative: e.representative, details: e.details }); }}
                              style={{ fontSize: 12, padding: "4px 10px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 5, cursor: "pointer" }}>
                              ✎ Edit
                            </button>
                            <button onClick={() => deleteEntry(e.id)}
                              style={{ fontSize: 12, padding: "4px 10px", background: "none", color: "#d1d5db", border: "1px solid #f0f0f0", borderRadius: 5, cursor: "pointer" }}
                              onMouseEnter={ev => { ev.currentTarget.style.background = "#fef2f2"; ev.currentTarget.style.color = "#dc2626"; }}
                              onMouseLeave={ev => { ev.currentTarget.style.background = "none"; ev.currentTarget.style.color = "#d1d5db"; }}>
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
