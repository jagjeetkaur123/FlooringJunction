"use client";

interface Props {
  jobId:     number | string;
  jobTitle:  string;
  jobStatus: string;
  dirty?:    boolean;
  saving?:   boolean;
  onSave?:   () => void;
  actions?:  React.ReactNode; // extra buttons / elements on the right
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:     { bg: "#fffbeb", color: "#d97706" },
  scheduled:   { bg: "#eff6ff", color: "#2563eb" },
  in_progress: { bg: "#f5f3ff", color: "#7c3aed" },
  completed:   { bg: "#f0fdf4", color: "#16a34a" },
  cancelled:   { bg: "#fef2f2", color: "#dc2626" },
};

export default function JobSubNav({ jobId, jobTitle, jobStatus, dirty, saving, onSave, actions }: Props) {
  const sc    = STATUS_COLORS[jobStatus] ?? STATUS_COLORS.pending;
  const label = jobStatus.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div style={{
      background: "#fff",
      borderBottom: "1px solid #e8eaed",
      padding: "10px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    }}>
      {/* Left — job identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#2563eb", fontWeight: 500 }}>
          #{jobId}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{jobTitle}</span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          padding: "2px 9px", borderRadius: 20,
          background: sc.bg, color: sc.color,
        }}>
          {label}
        </span>
        {dirty && (
          <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 500 }}>● Unsaved changes</span>
        )}
      </div>

      {/* Right — save button + any extra actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {actions}
        {onSave && (
          <button
            onClick={onSave}
            disabled={saving || !dirty}
            style={{
              fontSize: 12, fontWeight: 600,
              padding: "7px 16px", borderRadius: 7, border: "none",
              background: dirty ? "#2563eb" : "#e8eaed",
              color: dirty ? "#fff" : "#9ca3af",
              cursor: dirty && !saving ? "pointer" : "default",
              transition: "background 0.15s",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}
