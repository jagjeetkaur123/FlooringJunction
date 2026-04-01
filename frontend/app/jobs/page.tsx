"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface Job {
  id: number;
  title: string;
  status: string;
  jobCategory?: string;
  shop?: string;
  jobSource?: string;
  leadNumber?: string;
  startDate?: string;
  endDate?: string;
  sellPrice?: number;
  costPrice?: number;
  finalQuote?: number;
  customer?: { id: number; name: string; phone?: string; email?: string };
}

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  active:     { bg: "#dcfce7", color: "#166534", dot: "#16a34a" },
  pending:    { bg: "#fef9c3", color: "#854d0e", dot: "#ca8a04" },
  completed:  { bg: "#dbeafe", color: "#1e40af", dot: "#2563eb" },
  cancelled:  { bg: "#fee2e2", color: "#991b1b", dot: "#dc2626" },
  quoted:     { bg: "#f3e8ff", color: "#6b21a8", dot: "#9333ea" },
  invoiced:   { bg: "#e0f2fe", color: "#075985", dot: "#0284c7" },
};

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("en-AU", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const fmtAUD  = (v?: number) => v != null ? new Intl.NumberFormat("en-AU", { style:"currency", currency:"AUD" }).format(v) : "—";

export default function JobsListPage() {
  const router = useRouter();
  const [jobs, setJobs]         = useState<Job[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/jobs`);
      if (!r.ok) throw new Error();
      const data: Job[] = await r.json();
      setJobs(data);
    } catch {
      showToast("Failed to load jobs", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const filtered = jobs.filter(j => {
    const matchStatus = statusFilter === "all" || j.status?.toLowerCase() === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      j.title?.toLowerCase().includes(q) ||
      String(j.id).includes(q) ||
      j.customer?.name?.toLowerCase().includes(q) ||
      j.leadNumber?.toLowerCase().includes(q) ||
      j.shop?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const allStatuses = ["all", ...Array.from(new Set(jobs.map(j => j.status?.toLowerCase()).filter(Boolean)))];

  const statusCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    const s = j.status?.toLowerCase() || "unknown";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  if (loading) return <div className="loading">Loading jobs…</div>;

  return (
    <div className="page">
      {toast && (
        <div className={`toast ${toast.ok ? "toast-ok" : "toast-err"}`}>
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">FloorManager</div>
          <h1 className="page-title">Jobs</h1>
          <div className="job-count">{jobs.length} total job{jobs.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => router.push("/new")}>
            + New Job
          </button>
        </div>
      </div>

      {/* Status summary pills */}
      <div className="status-bar">
        {allStatuses.map(s => {
          const count = s === "all" ? jobs.length : (statusCounts[s] || 0);
          const style = STATUS_STYLES[s] || { bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" };
          return (
            <button
              key={s}
              className={`status-pill ${statusFilter === s ? "active" : ""}`}
              style={statusFilter === s ? { background: style.bg, color: style.color, borderColor: style.color + "44" } : {}}
              onClick={() => setStatusFilter(s)}
            >
              {s !== "all" && (
                <span className="pill-dot" style={{ background: style.dot }} />
              )}
              {s === "all" ? "All Jobs" : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="pill-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + Table */}
      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-title">
            {statusFilter === "all" ? "All Jobs" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) + " Jobs"}
            {search && <span className="search-hint"> · "{search}"</span>}
          </span>
          <div className="toolbar-right">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                type="text"
                placeholder="Search by name, ID, customer…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="search-clear" onClick={() => setSearch("")}>✕</button>
              )}
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="jobs-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Category</th>
                <th>Shop</th>
                <th>Start Date</th>
                <th>Final Quote</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-row">
                    {search ? `No jobs match "${search}"` : "No jobs found"}
                  </td>
                </tr>
              ) : (
                filtered.map(job => {
                  const s = job.status?.toLowerCase() || "";
                  const style = STATUS_STYLES[s] || { bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" };
                  return (
                    <tr
                      key={job.id}
                      className="job-row"
                      onClick={() => router.push(`/jobs/${job.id}`)}
                    >
                      <td className="id-cell">#{job.id}</td>
                      <td className="title-cell">
                        <div className="job-title">{job.title || "Untitled"}</div>
                        {job.leadNumber && <div className="job-lead">Lead #{job.leadNumber}</div>}
                      </td>
                      <td className="customer-cell">
                        {job.customer ? (
                          <>
                            <div className="cust-name">{job.customer.name}</div>
                            {job.customer.phone && <div className="cust-sub">{job.customer.phone}</div>}
                          </>
                        ) : <span className="na">—</span>}
                      </td>
                      <td>
                        <span className="status-badge" style={{ background: style.bg, color: style.color }}>
                          <span className="badge-dot" style={{ background: style.dot }} />
                          {job.status || "—"}
                        </span>
                      </td>
                      <td className="meta-cell">{job.jobCategory || <span className="na">—</span>}</td>
                      <td className="meta-cell">{job.shop || <span className="na">—</span>}</td>
                      <td className="meta-cell mono">{fmtDate(job.startDate)}</td>
                      <td className="price-cell mono">{fmtAUD(job.finalQuote ?? job.sellPrice)}</td>
                      <td className="actions-cell" onClick={e => e.stopPropagation()}>
                        <button className="act-btn" onClick={() => router.push(`/jobs/${job.id}`)}>View</button>
                        <button className="act-btn sec" onClick={() => router.push(`/jobs/${job.id}/cost-sell`)}>Cost</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="table-footer-info">
            Showing {filtered.length} of {jobs.length} job{jobs.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .page { font-family: 'DM Sans', sans-serif; padding: 28px 32px; max-width: 1400px; margin: 0 auto; }
        .loading { display:flex;align-items:center;justify-content:center;height:50vh;font-family:'DM Sans',sans-serif;color:#9ca3af; }

        .breadcrumb { font-size:12.5px;color:#9ca3af;margin-bottom:4px; }
        .page-title { font-size:22px;font-weight:700;color:#111827;margin:0 0 2px; }
        .job-count { font-size:12.5px;color:#9ca3af; }
        .page-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;gap:16px; }
        .header-actions { display:flex;gap:8px;align-items:center;padding-top:4px; }

        .btn-primary { background:#1a56db;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background 0.15s; }
        .btn-primary:hover { background:#1648c0; }

        .status-bar { display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px; }
        .status-pill { display:inline-flex;align-items:center;gap:5px;font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:500;color:#6b7280;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:20px;padding:5px 12px;cursor:pointer;transition:all 0.15s; }
        .status-pill:hover { background:#f3f4f6;border-color:#d1d5db; }
        .status-pill.active { font-weight:600; }
        .pill-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0; }
        .pill-count { font-family:'DM Mono',monospace;font-size:11px;font-weight:600;background:rgba(0,0,0,0.07);border-radius:10px;padding:1px 6px;margin-left:2px; }

        .table-card { background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden; }
        .table-toolbar { display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #f3f4f6;gap:12px; }
        .table-title { font-size:13px;font-weight:700;color:#111827; }
        .search-hint { font-weight:400;color:#9ca3af; }
        .toolbar-right { display:flex;gap:8px;align-items:center; }
        .search-wrap { position:relative;display:flex;align-items:center; }
        .search-icon { position:absolute;left:10px;font-size:12px;pointer-events:none; }
        .search-input { font-family:'DM Sans',sans-serif;font-size:13px;color:#111827;border:1.5px solid #e5e7eb;border-radius:8px;padding:7px 32px 7px 30px;outline:none;width:240px;transition:border 0.15s; }
        .search-input:focus { border-color:#1a56db;box-shadow:0 0 0 2px rgba(26,86,219,0.08); }
        .search-input::placeholder { color:#d1d5db; }
        .search-clear { position:absolute;right:8px;background:none;border:none;color:#9ca3af;cursor:pointer;font-size:11px;padding:0;line-height:1; }
        .search-clear:hover { color:#374151; }

        .table-wrap { overflow-x:auto; }
        .jobs-table { width:100%;border-collapse:collapse;font-size:13px; }
        .jobs-table th { background:#f9fafb;color:#9ca3af;font-size:10.5px;text-transform:uppercase;letter-spacing:0.6px;font-weight:700;padding:9px 12px;text-align:left;border-bottom:1.5px solid #e5e7eb;white-space:nowrap; }
        .jobs-table td { padding:10px 12px;border-bottom:1px solid #f5f6f9;vertical-align:middle; }
        .jobs-table tr:last-child td { border-bottom:none; }
        .job-row { cursor:pointer;transition:background 0.1s; }
        .job-row:hover td { background:#fafbff; }

        .id-cell { font-family:'DM Mono',monospace;font-size:12px;color:#9ca3af;font-weight:500;white-space:nowrap; }
        .title-cell { min-width:180px; }
        .job-title { font-weight:600;color:#111827;font-size:13.5px; }
        .job-lead { font-size:11px;color:#9ca3af;margin-top:2px; }
        .customer-cell { min-width:150px; }
        .cust-name { font-weight:500;color:#111827; }
        .cust-sub { font-size:11.5px;color:#9ca3af;margin-top:1px; }
        .na { color:#d1d5db; }

        .status-badge { display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:11.5px;font-weight:600;white-space:nowrap; }
        .badge-dot { width:5px;height:5px;border-radius:50%;flex-shrink:0; }

        .meta-cell { color:#6b7280;font-size:12.5px;white-space:nowrap; }
        .price-cell { font-family:'DM Mono',monospace;font-size:13px;font-weight:600;color:#111827;white-space:nowrap; }
        .mono { font-family:'DM Mono',monospace; }

        .actions-cell { white-space:nowrap; }
        .act-btn { font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;color:#1a56db;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:6px;padding:4px 10px;cursor:pointer;transition:all 0.12s;margin-right:4px; }
        .act-btn:hover { background:#dbeafe; }
        .act-btn.sec { color:#7c3aed;background:#f5f3ff;border-color:#ddd6fe; }
        .act-btn.sec:hover { background:#ede9fe; }

        .empty-row { text-align:center;padding:48px;color:#9ca3af;font-size:13.5px; }
        .table-footer-info { padding:10px 18px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af; }

        .toast { position:fixed;bottom:24px;right:24px;z-index:9999;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;color:#fff; }
        .toast-ok { background:#15803d; }
        .toast-err { background:#b91c1c; }
      `}</style>
    </div>
  );
}

