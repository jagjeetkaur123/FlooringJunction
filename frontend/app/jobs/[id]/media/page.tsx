"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

interface MediaFile {
  id: number; fileName: string; originalName: string;
  mimeType: string; size: number; category: string;
  notes?: string; createdAt: string;
}
interface Job {
  id: number; title: string; status: string; jobRef?: string;
  customerName?: string;
  customer?: { name?: string; email?: string; phone?: string; };
  siteStreet?: string; siteTown?: string; siteState?: string; siteZip?: string;
  description?: string;
}

const CATEGORIES = [
  { value: "floor-plan",  label: "Floor Plan",  icon: "📐" },
  { value: "photo",       label: "Photo",        icon: "📷" },
  { value: "document",    label: "Document",     icon: "📄" },
  { value: "general",     label: "General",      icon: "📎" },
];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:     { bg: "#fffbeb", color: "#d97706" },
  scheduled:   { bg: "#eff6ff", color: "#2563eb" },
  in_progress: { bg: "#f5f3ff", color: "#7c3aed" },
  completed:   { bg: "#f0fdf4", color: "#16a34a" },
  cancelled:   { bg: "#fef2f2", color: "#dc2626" },
};

const fmtSize = (b: number) => b > 1048576 ? `${(b/1048576).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
const isImage = (mime: string) => mime.startsWith("image/");
const isPDF   = (mime: string) => mime === "application/pdf";

export default function MediaPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const [job,      setJob]      = useState<Job | null>(null);
  const [files,    setFiles]    = useState<MediaFile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [uploading,setUploading]= useState(false);
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);
  const [filter,   setFilter]   = useState("all");
  const [category, setCategory] = useState("general");
  const [notes,    setNotes]    = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [jr, mr] = await Promise.all([
        fetch(`${API}/jobs/${jobId}`),
        fetch(`${API}/jobs/${jobId}/media`),
      ]);
      const jd: Job = await jr.json();
      setJob(jd);
      if (mr.ok) {
        const md = await mr.json();
        setFiles(Array.isArray(md) ? md : []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      Array.from(fileList).forEach(f => form.append("files", f));
      form.append("category", category);
      if (notes) form.append("notes", notes);
      const res = await fetch(`${API}/jobs/${jobId}/media`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      setNotes("");
      showToast(`${fileList.length} file(s) uploaded`, true);
      load();
    } catch (e) { showToast((e as Error).message || "Upload failed", false); }
    finally { setUploading(false); }
  };

  const deleteFile = async (id: number) => {
    try {
      await fetch(`${API}/jobs/${jobId}/media/${id}`, { method: "DELETE" });
      showToast("File deleted", true);
      load();
    } catch { showToast("Failed to delete", false); }
  };

  const updateCategory = async (id: number, newCat: string) => {
    try {
      await fetch(`${API}/jobs/${jobId}/media/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCat }),
      });
      load();
    } catch { /* silent */ }
  };

  const displayed = filter === "all" ? files : files.filter(f => f.category === filter);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#9ca3af", fontFamily: "'DM Sans',sans-serif" }}>Loading…</div>
  );

  const clientName = job?.customer?.name ?? job?.customerName ?? "";
  const siteAddr   = [job?.siteStreet, job?.siteTown, job?.siteState, job?.siteZip].filter(Boolean).join(", ");
  const sc         = STATUS_COLORS[job?.status ?? "pending"] ?? STATUS_COLORS.pending;
  const statusLabel = (job?.status ?? "pending").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const INP: React.CSSProperties = { padding: "8px 10px", fontSize: 13, border: "1.5px solid #e5e7eb", borderRadius: 7, outline: "none", fontFamily: "'DM Sans',sans-serif" };

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", maxWidth: 960, margin: "0 auto", padding: "24px" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: toast.ok ? "#16a34a" : "#dc2626", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {/* ── Job info header ──────────────────────────────────────────────── */}
      {job && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontFamily: "'DM Mono',monospace" }}>
              Job #{job.id}{job.jobRef ? ` · Ref: ${job.jobRef}` : ""} &nbsp;·&nbsp; {clientName}{siteAddr ? ` — ${siteAddr}` : ""}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
              {job.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: sc.bg, color: sc.color }}>
                {statusLabel}
              </span>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {files.length} file{files.length !== 1 ? "s" : ""} uploaded
              </span>
            </div>
          </div>
          <button onClick={() => router.push(`/jobs/${jobId}/edit`)}
            style={{ fontSize: 12, fontWeight: 600, color: "#374151", background: "#f9fafb", border: "1px solid #e8eaed", borderRadius: 7, padding: "6px 14px", cursor: "pointer" }}>
            ✏️ Edit Job Details
          </button>
        </div>
      )}

      {/* ── Upload zone ──────────────────────────────────────────────────── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "#2563eb" : "#d1d5db"}`,
          borderRadius: 12, padding: "28px 24px", textAlign: "center",
          background: dragOver ? "#eff6ff" : "#fafafa",
          cursor: "pointer", marginBottom: 16, transition: "all 0.15s",
        }}>
        <input ref={fileInputRef} type="file" multiple style={{ display: "none" }}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={e => uploadFiles(e.target.files)} />
        <div style={{ fontSize: 32, marginBottom: 8 }}>{uploading ? "⏳" : "📁"}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
          {uploading ? "Uploading…" : "Drag & drop files here, or click to browse"}
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
          Images, PDFs, Word, Excel — up to 20 MB each
        </div>
      </div>

      {/* ── Upload options ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...INP }}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Notes (optional)</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Bedroom floor plan, site photos…" style={{ ...INP, width: "100%" }} />
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          style={{ padding: "9px 20px", fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap" }}>
          + Upload Files
        </button>
      </div>

      {/* ── Filter tabs ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #e8eaed", marginBottom: 20 }}>
        {[{ value: "all", label: `All (${files.length})`, icon: "📂" }, ...CATEGORIES.map(c => ({ ...c, label: `${c.label} (${files.filter(f => f.category === c.value).length})` }))].map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            style={{ padding: "8px 14px", fontSize: 12, fontWeight: filter === tab.value ? 700 : 400, color: filter === tab.value ? "#2563eb" : "#6b7280", background: "none", border: "none", borderBottom: `2px solid ${filter === tab.value ? "#2563eb" : "transparent"}`, cursor: "pointer", marginBottom: -1 }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Files grid ───────────────────────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: 48, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          No files yet — drag & drop or click to upload
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          {displayed.map(file => {
            const fileUrl = `${API}/jobs/${jobId}/media/${file.id}/file`;
            return (
              <div key={file.id} style={{ background: "#fff", border: "1.5px solid #e8eaed", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                {/* Preview */}
                <a href={fileUrl} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none" }}>
                  {isImage(file.mimeType) ? (
                    <img src={fileUrl} alt={file.originalName}
                      style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", background: isPDF(file.mimeType) ? "#fef2f2" : "#f0f9ff", fontSize: 40 }}>
                      {isPDF(file.mimeType) ? "📕" : "📄"}
                    </div>
                  )}
                </a>

                {/* Info */}
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.originalName}>
                    {file.originalName}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>
                    {fmtSize(file.size)} &nbsp;·&nbsp; {fmtDate(file.createdAt)}
                  </div>
                  {file.notes && (
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, fontStyle: "italic" }}>{file.notes}</div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <select value={file.category} onChange={e => updateCategory(file.id, e.target.value)}
                      style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 5, border: "1px solid #e5e7eb", outline: "none", color: "#374151", background: "#f9fafb" }}>
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                    </select>
                    <button onClick={() => deleteFile(file.id)}
                      style={{ background: "none", border: "1px solid #f0f0f0", color: "#d1d5db", borderRadius: 4, cursor: "pointer", padding: "2px 7px", fontSize: 11 }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#dc2626"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#d1d5db"; }}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
