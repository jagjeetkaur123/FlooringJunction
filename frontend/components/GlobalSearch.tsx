"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const RECENT_KEY = "fm_recent_jobs";
const MAX_RECENT = 8;

interface Job {
  id: number;
  title: string;
  status: string;
  jobCategory?: string;
  shop?: string;
  leadNumber?: string;
  customer?: { name?: string; phone?: string; email?: string };
  siteStreet?: string;
  siteTown?: string;
  siteState?: string;
  finalQuote?: number;
  sellPrice?: number;
}

interface RecentEntry { id: number; title: string; customerName?: string; }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:     { bg: "#fffbeb", color: "#d97706" },
  active:      { bg: "#dcfce7", color: "#166534" },
  scheduled:   { bg: "#eff6ff", color: "#2563eb" },
  in_progress: { bg: "#f5f3ff", color: "#7c3aed" },
  completed:   { bg: "#dbeafe", color: "#1e40af" },
  cancelled:   { bg: "#fee2e2", color: "#991b1b" },
  quoted:      { bg: "#f3e8ff", color: "#6b21a8" },
  invoiced:    { bg: "#e0f2fe", color: "#075985" },
};

function getRecent(): RecentEntry[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}

export function saveRecent(job: RecentEntry) {
  try {
    const list = getRecent().filter(r => r.id !== job.id);
    list.unshift(job);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all jobs once when overlay opens
  useEffect(() => {
    if (!open) return;
    setRecent(getRecent());
    if (jobs.length === 0) {
      fetch(`${API}/jobs`).then(r => r.json()).then(setJobs).catch(() => {});
    }
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  // Global keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
        setQuery("");
        setSelected(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const q = query.toLowerCase().trim();
  const results: Job[] = q.length >= 1
    ? jobs.filter(j =>
        j.title?.toLowerCase().includes(q) ||
        String(j.id).includes(q) ||
        j.customer?.name?.toLowerCase().includes(q) ||
        j.customer?.phone?.includes(q) ||
        j.customer?.email?.toLowerCase().includes(q) ||
        j.leadNumber?.toLowerCase().includes(q) ||
        j.shop?.toLowerCase().includes(q) ||
        j.siteStreet?.toLowerCase().includes(q) ||
        j.siteTown?.toLowerCase().includes(q)
      ).slice(0, 10)
    : [];

  const navigate = useCallback((id: number, title: string, customerName?: string, tab?: string) => {
    saveRecent({ id, title, customerName });
    setOpen(false);
    setQuery("");
    router.push(tab ? `/jobs/${id}/${tab}` : `/jobs/${id}`);
  }, [router]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const list = q ? results : recent;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, list.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === "Enter") {
        e.preventDefault();
        if (q && results[selected]) navigate(results[selected].id, results[selected].title, results[selected].customer?.name);
        else if (!q && recent[selected]) navigate(recent[selected].id, recent[selected].title, recent[selected].customerName);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, q, results, recent, selected, navigate]);

  useEffect(() => { setSelected(0); }, [query]);

  const fmtAUD = (v?: number) => v != null ? `$${v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
  const btnStyle = (bg: string, color: string): React.CSSProperties => ({
    fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 5,
    background: bg, color, border: "none", cursor: "pointer", whiteSpace: "nowrap",
  });

  if (!open) return (
    <button
      onClick={() => { setOpen(true); setQuery(""); }}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8,
        padding: "6px 12px", cursor: "pointer", fontSize: 12.5, color: "#9ca3af",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      🔍 Search jobs…
      <span style={{ fontSize: 10, background: "#e5e7eb", borderRadius: 4, padding: "1px 5px", color: "#6b7280", marginLeft: 4 }}>
        Ctrl+K
      </span>
    </button>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80 }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{ background: "#fff", borderRadius: 14, width: 620, maxWidth: "94vw", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", overflow: "hidden", fontFamily: "'DM Sans', sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #f3f4f6", gap: 10 }}>
          <span style={{ fontSize: 16, color: "#9ca3af" }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, customer, phone, address, lead #…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 15, color: "#111827", fontFamily: "'DM Sans', sans-serif", background: "transparent" }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14 }}>✕</button>
          )}
          <kbd style={{ fontSize: 11, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 4, padding: "2px 6px", color: "#9ca3af" }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {!q && recent.length === 0 && (
            <div style={{ padding: "28px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              No recent jobs. Start typing to search.
            </div>
          )}

          {!q && recent.length > 0 && (
            <>
              <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "#9ca3af" }}>
                Recently Viewed
              </div>
              {recent.map((r, i) => (
                <div
                  key={r.id}
                  onClick={() => navigate(r.id, r.title, r.customerName)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                    cursor: "pointer", background: selected === i ? "#f0f7ff" : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={() => setSelected(i)}
                >
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#9ca3af", width: 36, flexShrink: 0 }}>#{r.id}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                    {r.customerName && <div style={{ fontSize: 11.5, color: "#6b7280" }}>{r.customerName}</div>}
                  </div>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>🕐</span>
                </div>
              ))}
            </>
          )}

          {q && results.length === 0 && (
            <div style={{ padding: "28px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              No jobs match &ldquo;{query}&rdquo;
            </div>
          )}

          {q && results.length > 0 && (
            <>
              <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "#9ca3af" }}>
                Results ({results.length})
              </div>
              {results.map((job, i) => {
                const sc = STATUS_COLORS[job.status?.toLowerCase() ?? ""] ?? { bg: "#f3f4f6", color: "#374151" };
                const addr = [job.siteStreet, job.siteTown, job.siteState].filter(Boolean).join(", ");
                const price = fmtAUD(job.finalQuote ?? job.sellPrice);
                return (
                  <div
                    key={job.id}
                    style={{
                      padding: "11px 16px",
                      background: selected === i ? "#f0f7ff" : "transparent",
                      borderBottom: i < results.length - 1 ? "1px solid #f9fafb" : "none",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={() => setSelected(i)}
                  >
                    {/* Top row — job info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 8 }}
                      onClick={() => navigate(job.id, job.title, job.customer?.name)}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#9ca3af", width: 36, flexShrink: 0 }}>#{job.id}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", marginBottom: 2 }}>{job.title}</div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {job.customer?.name && <span style={{ fontSize: 11.5, color: "#6b7280" }}>{job.customer.name}</span>}
                          {job.customer?.phone && <span style={{ fontSize: 11.5, color: "#9ca3af" }}>{job.customer.phone}</span>}
                          {addr && <span style={{ fontSize: 11.5, color: "#9ca3af" }}>{addr}</span>}
                          {job.leadNumber && <span style={{ fontSize: 11.5, color: "#9ca3af" }}>Lead #{job.leadNumber}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: 12, background: sc.bg, color: sc.color }}>
                          {job.status}
                        </span>
                        {price && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, color: "#374151", fontWeight: 600 }}>{price}</span>}
                      </div>
                    </div>
                    {/* Bottom row — quick action buttons */}
                    <div style={{ display: "flex", gap: 6, paddingLeft: 48 }}>
                      <button onClick={() => navigate(job.id, job.title, job.customer?.name)}
                        style={btnStyle("#eff6ff","#2563eb")}>View</button>
                      <button onClick={() => navigate(job.id, job.title, job.customer?.name, "edit")}
                        style={btnStyle("#f9fafb","#374151")}>✏️ Edit</button>
                      <button onClick={() => navigate(job.id, job.title, job.customer?.name, "billing")}
                        style={btnStyle("#f0fdf4","#166534")}>💰 Billing</button>
                      <button onClick={() => navigate(job.id, job.title, job.customer?.name, "media")}
                        style={btnStyle("#fdf4ff","#7e22ce")}>📁 Media</button>
                      <button onClick={() => navigate(job.id, job.title, job.customer?.name, "schedule")}
                        style={btnStyle("#fff7ed","#c2410c")}>📅 Schedule</button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 14, fontSize: 11, color: "#9ca3af" }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>ESC close</span>
        </div>
      </div>
    </div>
  );
}
