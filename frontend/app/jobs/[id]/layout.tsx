"use client";
import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { saveRecent } from "../../../components/GlobalSearch";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const TABS = [
  { label: "Cost & Sell", path: "cost-sell"  },
  { label: "Billing",     path: "billing"    },
  { label: "Quote",       path: "quote"      },
  { label: "Tax Invoice", path: "tax-invoice"},
  { label: "Work Order",  path: "work-order" },
  { label: "Schedule",    path: "schedule"   },
  { label: "Media",       path: "media"      },
];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:     { bg: "#fffbeb", color: "#d97706" },
  scheduled:   { bg: "#eff6ff", color: "#2563eb" },
  in_progress: { bg: "#f5f3ff", color: "#7c3aed" },
  completed:   { bg: "#f0fdf4", color: "#16a34a" },
  cancelled:   { bg: "#fef2f2", color: "#dc2626" },
};

export default function JobLayout({ children }: { children: React.ReactNode }) {
  const { id }   = useParams<{ id: string }>();
  const pathname = usePathname();
  const router   = useRouter();
  const [job, setJob] = useState<{ title: string; status: string; customerName?: string } | null>(null);

  useEffect(() => {
    fetch(`${API}/jobs/${id}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setJob(data);
        saveRecent({ id: Number(id), title: data.title, customerName: data.customerName ?? data.customer?.name });
      })
      .catch(() => {});
  }, [id]);

  const sc          = STATUS_COLORS[job?.status ?? "pending"] ?? STATUS_COLORS.pending;
  const statusLabel = (job?.status ?? "pending").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  // The root /jobs/[id] page has its own full header — skip this sub-nav there
  const isRootJobPage = pathname === `/jobs/${id}`;

  if (isRootJobPage) {
    return <>{children}</>;
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#f5f6f8" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8eaed", position: "sticky", top: 56, zIndex: 90 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 24px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.push("/jobs")}
              style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>
              ← Jobs
            </button>
            <span style={{ color: "#d1d5db" }}>›</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#2563eb", fontWeight: 500 }}>#{id}</span>
            {job && (
              <>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{job.title}</span>
                {job.customerName && <span style={{ fontSize: 12, color: "#6b7280" }}>— {job.customerName}</span>}
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: sc.bg, color: sc.color }}>
                  {statusLabel}
                </span>
              </>
            )}
          </div>
          <button onClick={() => router.push(`/jobs/${id}/edit`)}
            style={{ fontSize: 12, fontWeight: 600, color: "#374151", background: "#f9fafb", border: "1px solid #e8eaed", borderRadius: 7, padding: "6px 14px", cursor: "pointer" }}>
            ✏️ Edit Details
          </button>
        </div>
        <div style={{ display: "flex", padding: "0 24px", gap: 2 }}>
          {TABS.map(({ label, path }) => {
            const href   = `/jobs/${id}/${path}`;
            const active = pathname === href;
            return (
              <button key={path} onClick={() => router.push(href)}
                style={{
                  fontSize: 12, fontWeight: active ? 600 : 400,
                  color: active ? "#2563eb" : "#6b7280",
                  background: "none", border: "none",
                  borderBottom: `2px solid ${active ? "#2563eb" : "transparent"}`,
                  padding: "10px 18px", cursor: "pointer", marginBottom: -1,
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}