"use client";
import React, { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

interface Loan {
  id: number;
  loanedDate: string;
  dueBack?: string | null;
  loanedTo: string;
  description: string;
  returnedDate?: string | null;
  notes?: string | null;
  shop?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (s?: string | null) => s ? new Date(s).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDT    = (s?: string | null) => s ? new Date(s).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

const INP: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: 13, border: "1.5px solid #e5e7eb", borderRadius: 7, outline: "none", fontFamily: "'DM Sans',sans-serif", background: "#fff" };
const LBL: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 };

export default function LoansPage() {
  const [loans,     setLoans]     = useState<Loan[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  // Filters
  const [status,    setStatus]    = useState("outstanding");
  const [fromDate,  setFromDate]  = useState("");
  const [toDate,    setToDate]    = useState("");
  const [shopFilter,setShopFilter]= useState("");

  // Add / Edit modal
  const [modal,     setModal]     = useState(false);
  const [editLoan,  setEditLoan]  = useState<Loan | null>(null);
  const [form, setForm] = useState({ loanedDate: todayStr(), dueBack: "", loanedTo: "", description: "", notes: "", shop: "", createdBy: "" });

  // Return modal
  const [returnModal,   setReturnModal]   = useState(false);
  const [returnLoan,    setReturnLoan]    = useState<Loan | null>(null);
  const [returnDate,    setReturnDate]    = useState(todayStr());
  const [returnNotes,   setReturnNotes]   = useState("");

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status });
      if (fromDate)   params.set("from", fromDate);
      if (toDate)     params.set("to",   toDate);
      if (shopFilter) params.set("shop", shopFilter);
      const r = await fetch(`${API}/loans?${params}`);
      const d = await r.json();
      setLoans(Array.isArray(d) ? d : []);
    } catch { showToast("Failed to load", false); }
    finally { setLoading(false); }
  }, [status, fromDate, toDate, shopFilter, showToast]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditLoan(null);
    setForm({ loanedDate: todayStr(), dueBack: "", loanedTo: "", description: "", notes: "", shop: "", createdBy: "" });
    setModal(true);
  };

  const openEdit = (loan: Loan) => {
    setEditLoan(loan);
    setForm({
      loanedDate:  loan.loanedDate?.slice(0, 10) || todayStr(),
      dueBack:     loan.dueBack?.slice(0, 10) || "",
      loanedTo:    loan.loanedTo,
      description: loan.description,
      notes:       loan.notes || "",
      shop:        loan.shop || "",
      createdBy:   loan.createdBy || "",
    });
    setModal(true);
  };

  const saveLoan = async () => {
    if (!form.loanedTo.trim()) { showToast("Loaned To is required", false); return; }
    try {
      const body = { ...form, dueBack: form.dueBack || null, notes: form.notes || null, shop: form.shop || null, createdBy: form.createdBy || null };
      const url  = editLoan ? `${API}/loans/${editLoan.id}` : `${API}/loans`;
      const meth = editLoan ? "PUT" : "POST";
      const r = await fetch(url, { method: meth, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      showToast(editLoan ? "Entry updated" : "Entry added", true);
      setModal(false);
      load();
    } catch (e) { showToast((e as Error).message, false); }
  };

  const openReturn = (loan: Loan) => {
    setReturnLoan(loan);
    setReturnDate(todayStr());
    setReturnNotes(loan.notes || "");
    setReturnModal(true);
  };

  const markReturned = async () => {
    if (!returnLoan) return;
    try {
      const r = await fetch(`${API}/loans/${returnLoan.id}/return`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnedDate: returnDate, notes: returnNotes || null }),
      });
      if (!r.ok) throw new Error();
      showToast("Marked as returned", true);
      setReturnModal(false);
      load();
    } catch { showToast("Failed to mark returned", false); }
  };

  const deleteLoan = async (id: number) => {
    if (!confirm("Delete this loan entry?")) return;
    try {
      await fetch(`${API}/loans/${id}`, { method: "DELETE" });
      showToast("Deleted", true); load();
    } catch { showToast("Failed to delete", false); }
  };

  const outstanding = loans.filter(l => !l.returnedDate).length;
  const overdue     = loans.filter(l => !l.returnedDate && l.dueBack && new Date(l.dueBack) < new Date()).length;

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
      {toast && <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: toast.ok ? "#16a34a" : "#dc2626", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>{toast.ok ? "✓" : "✕"} {toast.msg}</div>}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Loan Registry</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>
            {outstanding > 0
              ? <><span style={{ color: "#d97706", fontWeight: 600 }}>{outstanding} outstanding</span>{overdue > 0 && <span style={{ color: "#dc2626", fontWeight: 600 }}> · {overdue} overdue</span>}</>
              : "All samples returned"}
          </div>
        </div>
        <button onClick={openAdd} style={{ padding: "9px 20px", fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" }}>
          + New Loan Entry
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "14px 18px", marginBottom: 16, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={LBL}>Show</label>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...INP, width: 150 }}>
            <option value="outstanding">Outstanding</option>
            <option value="returned">Returned</option>
            <option value="all">All</option>
          </select>
        </div>
        <div>
          <label style={LBL}>Loaned From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ ...INP, width: 150 }} />
        </div>
        <div>
          <label style={LBL}>Loaned To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ ...INP, width: 150 }} />
        </div>
        <div>
          <label style={LBL}>Shop</label>
          <input value={shopFilter} onChange={e => setShopFilter(e.target.value)} placeholder="Any shop" style={{ ...INP, width: 130 }} />
        </div>
        <button onClick={() => { setFromDate(""); setToDate(""); setShopFilter(""); }}
          style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 7, cursor: "pointer" }}>
          Clear
        </button>
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setModal(false)}>
          <div style={{ background: "#fff", borderRadius: 12, width: 600, maxWidth: "95vw", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 22px", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{editLoan ? "Edit Loan Entry" : "New Loan Entry"}</span>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <div style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={LBL}>Loaned Date *</label>
                <input type="date" value={form.loanedDate} onChange={e => setForm(p => ({ ...p, loanedDate: e.target.value }))} style={INP} />
              </div>
              <div>
                <label style={LBL}>Due Back</label>
                <input type="date" value={form.dueBack} onChange={e => setForm(p => ({ ...p, dueBack: e.target.value }))} style={INP} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={LBL}>Loaned To (Name / Phone) *</label>
                <input value={form.loanedTo} onChange={e => setForm(p => ({ ...p, loanedTo: e.target.value }))} placeholder="e.g. John Smith 0412 345 678" style={INP} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={LBL}>Description (Samples taken)</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Triextra carpet sample book, Signature And Triextra samples"
                  rows={3} style={{ ...INP, resize: "vertical" }} />
              </div>
              <div>
                <label style={LBL}>Shop</label>
                <input value={form.shop} onChange={e => setForm(p => ({ ...p, shop: e.target.value }))} placeholder="e.g. Hallam" style={INP} />
              </div>
              <div>
                <label style={LBL}>Staff / User</label>
                <input value={form.createdBy} onChange={e => setForm(p => ({ ...p, createdBy: e.target.value }))} placeholder="e.g. Sam, Kamal" style={INP} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={LBL}>Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Will bring back tomorrow" style={INP} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 22px", borderTop: "1px solid #f3f4f6" }}>
              <button onClick={() => setModal(false)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveLoan} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" }}>
                {editLoan ? "Save Changes" : "Add Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnModal && returnLoan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setReturnModal(false)}>
          <div style={{ background: "#fff", borderRadius: 12, width: 460, maxWidth: "95vw", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 22px", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Mark as Returned</span>
              <button onClick={() => setReturnModal(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <div style={{ padding: "20px 22px" }}>
              <div style={{ fontSize: 13, color: "#374151", marginBottom: 16, background: "#f9fafb", borderRadius: 8, padding: "10px 14px" }}>
                <strong>{returnLoan.loanedTo}</strong><br />
                <span style={{ color: "#6b7280", fontSize: 12 }}>{returnLoan.description}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={LBL}>Return Date</label>
                  <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} style={INP} />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={LBL}>Notes (optional)</label>
                  <input value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="e.g. Returned all samples" style={INP} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 22px", borderTop: "1px solid #f3f4f6" }}>
              <button onClick={() => setReturnModal(false)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 7, cursor: "pointer" }}>Cancel</button>
              <button onClick={markReturned} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "#16a34a", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer" }}>
                ✓ Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loans table */}
      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Loading…</div>
      ) : loans.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 48, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          {status === "outstanding" ? "No outstanding loans 🎉" : "No entries found"}
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["Loaned", "Due Back", "Loaned To", "Description", "Returned", "Notes", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280", borderBottom: "1.5px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loans.map((loan, i) => {
                const isOverdue = !loan.returnedDate && loan.dueBack && new Date(loan.dueBack) < new Date();
                const isReturned = !!loan.returnedDate;
                return (
                  <tr key={loan.id} style={{ borderBottom: i < loans.length - 1 ? "1px solid #f3f4f6" : "none", background: isReturned ? "#fafffe" : isOverdue ? "#fffbeb" : "#fff" }}>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{fmtDate(loan.loanedDate)}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{loan.shop || ""}{loan.createdBy ? ` · ${loan.createdBy}` : ""}</div>
                    </td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      {loan.dueBack
                        ? <span style={{ fontSize: 12, fontWeight: 600, color: isOverdue ? "#dc2626" : "#374151" }}>
                            {isOverdue ? "⚠ " : ""}{fmtDate(loan.dueBack)}
                          </span>
                        : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>
                      {loan.loanedTo}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12.5, color: "#374151", maxWidth: 280 }}>
                      {loan.description}
                    </td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      {isReturned
                        ? <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", background: "#f0fdf4", padding: "3px 9px", borderRadius: 20 }}>✓ {fmtDate(loan.returnedDate)}</span>
                        : <button onClick={() => openReturn(loan)}
                            style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>
                            Return
                          </button>}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#6b7280", maxWidth: 200 }}>
                      {loan.notes}
                    </td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEdit(loan)}
                          style={{ fontSize: 11, padding: "4px 10px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 5, cursor: "pointer" }}>
                          ✎ Edit
                        </button>
                        <button onClick={() => deleteLoan(loan.id)}
                          style={{ fontSize: 11, padding: "4px 8px", background: "none", color: "#d1d5db", border: "1px solid #f0f0f0", borderRadius: 5, cursor: "pointer" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#dc2626"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#d1d5db"; }}>
                          ✕
                        </button>
                      </div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{fmtDT(loan.updatedAt)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
