"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const fmt = (n: number) => (n ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (v: number | string) => parseFloat(String(v) || "0") || 0;

interface LineItem { id?: number; tag: string; description: string; qty: number | string; unitCost: number | string; costTax: number | string; type: string; unitSell: number | string; sellTax: number | string; actOn: boolean; isHeader: boolean; sortOrder: number; }
interface Job {
  id: number; title: string; status: string; gstRate?: number; costPrice?: number; sellPrice?: number;
  leadNumber?: string; jobCategory?: string; shop?: string; jobSource?: string; jobReference?: string;
  customer?: { name: string; email?: string; phone?: string; };
  siteStreet?: string; siteTown?: string; siteState?: string; siteZip?: string; siteCountry?: string;
  billingStreet?: string; billingTown?: string; billingState?: string; billingZip?: string; billingCountry?: string;
}

const CARPET: LineItem[] = [
  { tag:"",description:"Select Carpet",qty:1,unitCost:0,costTax:10,type:"M",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:0 },
  { tag:"",description:"Select Underlay",qty:1,unitCost:0,costTax:10,type:"M",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:1 },
  { tag:"",description:"Disposal",qty:1,unitCost:0,costTax:10,type:"O",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:2 },
  { tag:"",description:"City Measure fee - tolls/parking/time",qty:1,unitCost:0,costTax:10,type:"L",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:3 },
  { tag:"",description:"LABOUR",qty:0,unitCost:0,costTax:10,type:"M",unitSell:0,sellTax:10,actOn:false,isHeader:true,sortOrder:4 },
  { tag:"",description:"Install carpet 3.66m",qty:1,unitCost:0,costTax:10,type:"L",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:5 },
  { tag:"",description:"Take up",qty:1,unitCost:0,costTax:10,type:"L",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:6 },
  { tag:"",description:"Admin Charges",qty:1,unitCost:0,costTax:10,type:"L",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:7 },
  { tag:"",description:"Freight Charges",qty:1,unitCost:0,costTax:10,type:"L",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:8 },
];

const HARD: LineItem[] = [
  { tag:"",description:"Select Hard Flooring",qty:1,unitCost:0,costTax:10,type:"M",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:0 },
  { tag:"",description:"Select Underlay",qty:1,unitCost:0,costTax:10,type:"M",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:1 },
  { tag:"",description:"Select Trims",qty:1,unitCost:0,costTax:10,type:"M",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:2 },
  { tag:"",description:"Disposal",qty:1,unitCost:0,costTax:10,type:"O",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:3 },
  { tag:"",description:"City Measure fee",qty:1,unitCost:0,costTax:10,type:"L",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:4 },
  { tag:"",description:"LABOUR",qty:0,unitCost:0,costTax:10,type:"M",unitSell:0,sellTax:10,actOn:false,isHeader:true,sortOrder:5 },
  { tag:"",description:"Install hard floor 3.66m",qty:1,unitCost:0,costTax:10,type:"L",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:6 },
  { tag:"",description:"Install hard floor 4.0m",qty:1,unitCost:0,costTax:10,type:"L",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:7 },
  { tag:"",description:"Take up",qty:1,unitCost:0,costTax:10,type:"L",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:8 },
  { tag:"",description:"Admin Charges",qty:1,unitCost:0,costTax:10,type:"L",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:9 },
  { tag:"",description:"Freight Charges",qty:1,unitCost:0,costTax:10,type:"L",unitSell:0,sellTax:10,actOn:false,isHeader:false,sortOrder:10 },
];

export default function CostSellPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params?.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [gstRate, setGstRate] = useState(10);
  const [targetMargin, setTargetMargin] = useState("");
    const [showTemplate, setShowTemplate] = useState(false);

  // Product catalogue lookup
  const [prodModal,   setProdModal]   = useState(false);
  const [prodRowIdx,  setProdRowIdx]  = useState<number | null>(null);
  const [prodQuery,   setProdQuery]   = useState("");
  const [prodResults, setProdResults] = useState<{id:number;supplier:string;name:string;category:string;unit:string;costPrice:number;sellPrice?:number|null;colors:{id:number;code:string;name:string;costPrice?:number|null}[]}[]>([]);
  const [prodLoading, setProdLoading] = useState(false);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [jr, lr] = await Promise.all([fetch(`${API}/jobs/${jobId}`), fetch(`${API}/jobs/${jobId}/line-items`)]);
      if (!jr.ok || !lr.ok) throw new Error();
      const jd: Job = await jr.json();
      const ld: LineItem[] = await lr.json();
      setJob(jd); setGstRate(jd.gstRate ?? 10);
      setItems(ld.map(li => ({ ...li, tag: li.tag ?? "", type: li.type ?? "M", actOn: li.actOn ?? false, isHeader: li.isHeader ?? false, sortOrder: li.sortOrder ?? 0 })));
      setDirty(false);
    } catch { showToast("Failed to load", false); }
    finally { setLoading(false); }
  }, [jobId, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dataRows = items.filter(li => !li.isHeader);
  const grossCost = dataRows.reduce((s, li) => s + n(li.qty) * n(li.unitCost), 0);
  const grossSell = dataRows.reduce((s, li) => s + n(li.qty) * n(li.unitSell), 0);
  const gstAmt = grossSell * (gstRate / 100);
  const margin = grossSell - grossCost;
  const marginPct = grossSell > 0 ? ((margin / grossSell) * 100).toFixed(1) : "0.0";

  const addItem = (isHeader = false) => {
    setItems(p => [...p, { tag:"", description: isHeader ? "NEW SECTION" : "", qty:1, unitCost:0, costTax:10, type:"M", unitSell:0, sellTax:10, actOn:false, isHeader, sortOrder:p.length }]);
    setDirty(true);
  };

  const upd = (i: number, k: keyof LineItem, v: unknown) => {
    setItems(p => { const n=[...p]; n[i]={...n[i],[k]:v}; return n; });
    setDirty(true);
  };

  const del = (i: number) => { setItems(p => p.filter((_,j)=>j!==i)); setDirty(true); };

  const move = (i: number, d: -1|1) => {
    const j=i+d; if(j<0||j>=items.length) return;
    setItems(p => { const a=[...p]; [a[i],a[j]]=[a[j],a[i]]; return a; });
    setDirty(true);
  };

  const loadTemplate = (type: "carpet"|"hard") => {
    setItems((type==="carpet"?CARPET:HARD).map((li,i)=>({...li,sortOrder:i})));
    setDirty(true); setShowTemplate(false);
  };

  const applyMargin = (dm: number) => {
    if(grossCost<=0) return;
    const ratio=(grossCost+dm)/grossCost;
    setItems(p=>p.map(li=>{
      if(li.isHeader) return li;
      const c=n(li.unitCost); if(c<=0) return li;
      return {...li,unitSell:parseFloat((c*ratio).toFixed(2))};
    }));
    setDirty(true);
  };

  const openProdSearch = (rowIdx: number) => {
    setProdRowIdx(rowIdx);
    setProdQuery("");
    setProdResults([]);
    setProdModal(true);
  };

  const searchProducts = useCallback(async (q: string) => {
    setProdQuery(q);
    if (!q.trim()) { setProdResults([]); return; }
    setProdLoading(true);
    try {
      const r = await fetch(`${API}/products/search?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      setProdResults(Array.isArray(d) ? d : []);
    } catch { /* silent */ }
    finally { setProdLoading(false); }
  }, []);

  const pickProduct = (prod: typeof prodResults[0], color?: typeof prodResults[0]['colors'][0]) => {
    if (prodRowIdx === null) return;
    const desc = color
      ? `${prod.supplier ? prod.supplier + " — " : ""}${prod.name} — ${color.name}${color.code ? " (" + color.code + ")" : ""}`
      : `${prod.supplier ? prod.supplier + " — " : ""}${prod.name}`;
    const cost = (color?.costPrice ?? prod.costPrice) || 0;
    const sell = prod.sellPrice || 0;
    setItems(p => {
      const a = [...p];
      a[prodRowIdx] = { ...a[prodRowIdx], description: desc, unitCost: cost, ...(sell > 0 && { unitSell: sell }) };
      return a;
    });
    setDirty(true);
    setProdModal(false);
  };

  const handleSave = useCallback(async () => {
    if(!jobId) return;
    setSaving(true);
    try {
      const lineItems = items.map((li, i) => ({
        ...li,
        qty:      n(li.qty),
        unitCost: n(li.unitCost),
        costTax:  n(li.costTax),
        unitSell: n(li.unitSell),
        sellTax:  n(li.sellTax),
        sortOrder: i,
      }));
      // Backend expects { items, gstRate, finalQuote } — NOT a raw array
      const r = await fetch(`${API}/jobs/${jobId}/line-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lineItems, gstRate, finalQuote: grossSell + (grossSell * gstRate / 100) }),
      });
      if (!r.ok) throw new Error();
      setDirty(false);
      showToast("Saved ✓", true);
      fetchData();
    } catch { showToast("Save failed", false); }
    finally { setSaving(false); }
  }, [jobId, items, gstRate, grossSell, showToast, fetchData]);

  useEffect(() => {
    const h=(e:KeyboardEvent)=>{ if((e.ctrlKey||e.metaKey)&&e.key==="s"){e.preventDefault();handleSave();} };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  }, [handleSave]);

  // Auto-save 2 seconds after any change
  const saveRef = useRef(handleSave);
  useEffect(() => { saveRef.current = handleSave; }, [handleSave]);
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => saveRef.current(), 2000);
    return () => clearTimeout(t);
  }, [dirty, items, gstRate]); // eslint-disable-line react-hooks/exhaustive-deps

  if(loading) return <div className="loading">Loading…</div>;
  if(!job) return <div className="loading" style={{color:"#dc2626"}}>Job not found.</div>;

  const TYPE_COLORS: Record<string,{bg:string;color:string}> = {
    M:{bg:"#dbeafe",color:"#1e40af"},
    L:{bg:"#dcfce7",color:"#166534"},
    O:{bg:"#fef9c3",color:"#854d0e"},
  };
  const NEXT_TYPE: Record<string,string> = {M:"L",L:"O",O:"M"};

  const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    pending:     { bg: "#fffbeb", color: "#d97706" },
    scheduled:   { bg: "#eff6ff", color: "#2563eb" },
    in_progress: { bg: "#f5f3ff", color: "#7c3aed" },
    completed:   { bg: "#f0fdf4", color: "#16a34a" },
    cancelled:   { bg: "#fef2f2", color: "#dc2626" },
  };
  const sc = STATUS_COLORS[job.status ?? "pending"] ?? STATUS_COLORS.pending;
  const statusLabel = (job.status ?? "pending").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="page">
      {toast && <div className={`toast ${toast.ok?"toast-ok":"toast-err"}`}>{toast.ok?"✓":"✕"} {toast.msg}</div>}

      {/* Template Modal */}
      {showTemplate && (
        <div className="modal-bg" onClick={()=>setShowTemplate(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Load Flooring Template</span>
              <button className="modal-close" onClick={()=>setShowTemplate(false)}>✕</button>
            </div>
            <p className="modal-sub">Choose a template to pre-fill line items. This will replace any existing items.</p>
            <div className="template-grid">
              <button className="template-card" onClick={()=>loadTemplate("carpet")}>
                <div className="tc-icon">🏠</div>
                <div className="tc-name">Carpet</div>
                <div className="tc-desc">Carpet, Underlay, Disposal, Labour, Install, Admin, Freight</div>
                <div className="tc-count">9 items</div>
              </button>
              <button className="template-card" onClick={()=>loadTemplate("hard")}>
                <div className="tc-icon">🪵</div>
                <div className="tc-name">Hard Flooring</div>
                <div className="tc-desc">Flooring, Underlay, Trims, Disposal, Labour, Install, Admin</div>
                <div className="tc-count">11 items</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Search Modal */}
      {prodModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:600,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:80}}
          onClick={()=>setProdModal(false)}>
          <div style={{background:"#fff",borderRadius:14,width:640,maxWidth:"95vw",boxShadow:"0 24px 64px rgba(0,0,0,0.2)",fontFamily:"'DM Sans',sans-serif",overflow:"hidden"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",padding:"14px 18px",borderBottom:"1px solid #f3f4f6",gap:10}}>
              <span style={{fontSize:16,color:"#9ca3af"}}>🔍</span>
              <input autoFocus value={prodQuery} onChange={e=>searchProducts(e.target.value)}
                placeholder="Search product name, supplier, colour…"
                style={{flex:1,border:"none",outline:"none",fontSize:14,color:"#111827",fontFamily:"'DM Sans',sans-serif",background:"transparent"}}/>
              <button onClick={()=>setProdModal(false)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#9ca3af"}}>✕</button>
            </div>
            <div style={{maxHeight:420,overflowY:"auto"}}>
              {prodLoading && <div style={{padding:24,textAlign:"center",color:"#9ca3af",fontSize:13}}>Searching…</div>}
              {!prodLoading && prodQuery && prodResults.length === 0 && (
                <div style={{padding:24,textAlign:"center",color:"#9ca3af",fontSize:13}}>No products found for &quot;{prodQuery}&quot;</div>
              )}
              {!prodQuery && <div style={{padding:24,textAlign:"center",color:"#9ca3af",fontSize:13}}>Type a product name, supplier or colour to search</div>}
              {prodResults.map(prod => (
                <div key={prod.id} style={{borderBottom:"1px solid #f3f4f6"}}>
                  {/* Product header — click to pick without a colour */}
                  <div onClick={()=>pickProduct(prod)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 18px",cursor:"pointer",background:"#fafafa"}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#eff6ff";}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#fafafa";}}>
                    <div style={{flex:1}}>
                      <span style={{fontWeight:700,fontSize:13,color:"#111827"}}>{prod.name}</span>
                      {prod.supplier && <span style={{marginLeft:8,fontSize:11,color:"#6b7280",background:"#f3f4f6",padding:"1px 6px",borderRadius:4}}>{prod.supplier}</span>}
                      <span style={{marginLeft:6,fontSize:10,color:"#2563eb",background:"#eff6ff",padding:"1px 6px",borderRadius:4,textTransform:"uppercase"}}>{prod.category}</span>
                    </div>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#374151",fontWeight:600}}>${prod.costPrice.toFixed(2)}/{prod.unit}</span>
                  </div>
                  {/* Colour variants */}
                  {prod.colors.map(c => (
                    <div key={c.id} onClick={()=>pickProduct(prod,c)}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"8px 18px 8px 36px",cursor:"pointer",borderTop:"1px solid #f9fafb"}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#f0fdf4";}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                      <span style={{fontSize:12,color:"#374151",flex:1}}>↳ {c.name}{c.code?` (${c.code})`:""}</span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:c.costPrice!=null?"#2563eb":"#9ca3af"}}>
                        {c.costPrice!=null?`$${c.costPrice.toFixed(2)}`:`$${prod.costPrice.toFixed(2)}`}/{prod.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{padding:"8px 18px",borderTop:"1px solid #f3f4f6",fontSize:11,color:"#9ca3af"}}>
              Click a product or colour to fill in the description and unit cost
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <span onClick={()=>router.push("/jobs")}>Jobs</span> ›{" "}
            <span onClick={()=>router.push(`/jobs/${job.id}`)}>#{job.id} {job.title}</span> › Cost & Sell
          </div>
          <h1 className="page-title">Cost & Sell</h1>
        </div>
        <div className="header-actions">
          {dirty && <span className="unsaved">● Unsaved changes</span>}
          <button className="btn-ghost" onClick={()=>setShowTemplate(true)}>🏠 Load Template</button>
          <button className="btn-ghost" onClick={()=>router.push(`/jobs/${job.id}/quote`)}>📄 Quote</button>
          <button className="btn-ghost" onClick={()=>router.push(`/jobs/${job.id}`)}>← Back</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : dirty ? "Save ✓" : "Saved ✓"}
          </button>
        </div>
      </div>

      <div className="two-col">
        {/* ── LEFT SIDEBAR ── */}
        <div className="sidebar">
          {/* Job card */}
          <div className="sb-card">
            <div className="sb-job-id">JOB #{job.id}</div>
            <div className="sb-job-title">{job.title}</div>
            <span className="sb-status" style={{background:sc.bg,color:sc.color}}>{statusLabel}</span>
          </div>

          {/* Name / Bill To */}
          {job.customer && (
            <div className="sb-section">
              <div className="sb-section-label">Name / Bill To</div>
              <div className="sb-name">{job.customer.name}</div>
              {job.customer.phone && <div className="sb-line">📞 {job.customer.phone}</div>}
              {job.customer.email && <div className="sb-line">✉ {job.customer.email}</div>}
            </div>
          )}

          {/* Site Address */}
          {(job.siteStreet || job.siteTown) && (
            <div className="sb-section">
              <div className="sb-section-label">Site</div>
              {job.siteStreet && <div className="sb-line">{job.siteStreet}</div>}
              {job.siteTown && <div className="sb-line">{[job.siteTown, job.siteState].filter(Boolean).join(" ")} {job.siteZip}</div>}
              {job.siteCountry && <div className="sb-line">{job.siteCountry}</div>}
            </div>
          )}

          {/* Billing Address */}
          {(job.billingStreet || job.billingTown) && (
            <div className="sb-section">
              <div className="sb-section-label">Billing</div>
              {job.billingStreet && <div className="sb-line">{job.billingStreet}</div>}
              {job.billingTown && <div className="sb-line">{[job.billingTown, job.billingState].filter(Boolean).join(" ")} {job.billingZip}</div>}
            </div>
          )}

          {/* Job meta */}
          <div className="sb-section">
            {job.leadNumber && <div className="sb-meta-row"><span className="sb-meta-key">Lead #</span><span className="sb-meta-val">{job.leadNumber}</span></div>}
            {job.jobCategory && <div className="sb-meta-row"><span className="sb-meta-key">Category</span><span className="sb-meta-val">{job.jobCategory}</span></div>}
            {job.shop && <div className="sb-meta-row"><span className="sb-meta-key">Shop</span><span className="sb-meta-val">{job.shop}</span></div>}
            {job.jobSource && <div className="sb-meta-row"><span className="sb-meta-key">Source</span><span className="sb-meta-val">{job.jobSource}</span></div>}
            {job.jobReference && <div className="sb-meta-row"><span className="sb-meta-key">Reference</span><span className="sb-meta-val">{job.jobReference}</span></div>}
          </div>
        </div>

        {/* ── RIGHT MAIN CONTENT ── */}
        <div className="main-content">

      {/* Summary cards */}
      <div className="summary-row">
        <div className="sum-card"><div className="sum-label">Gross Cost</div><div className="sum-val">${fmt(grossCost)}</div></div>
        <div className="sum-card"><div className="sum-label">Gross Sell (ex GST)</div><div className="sum-val blue">${fmt(grossSell)}</div></div>
        <div className="sum-card"><div className="sum-label">GST ({gstRate}%)</div><div className="sum-val">${fmt(gstAmt)}</div></div>
        <div className="sum-card"><div className="sum-label">Total inc. GST</div><div className="sum-val">${fmt(grossSell+gstAmt)}</div></div>
        <div className="sum-card">
          <div className="sum-label">Margin</div>
          <div className="sum-val" style={{color:margin>=0?"#16a34a":"#dc2626"}}>${fmt(margin)} <span className="sum-pct">({marginPct}%)</span></div>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-toolbar">
          <span className="table-title">Line Items ({items.length})</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span className="gst-label">GST Rate:</span>
            <input className="gst-input" type="number" value={gstRate} onChange={e=>{setGstRate(parseFloat(e.target.value)||0);setDirty(true);}} />
            <span className="gst-label">%</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="cs-table">
            <thead>
              <tr>
                <th style={{width:28}}></th>
                <th style={{width:30}}>T</th>
                <th style={{width:52}}>Tag</th>
                <th>Description</th>
                <th style={{width:62}}>Qty</th>
                <th style={{width:100}}>Unit Cost</th>
                <th style={{width:55}}>Tax%</th>
                <th style={{width:100}}>Unit Sell</th>
                <th style={{width:55}}>Tax%</th>
                <th style={{width:100,textAlign:"right"}}>Line Total</th>
                <th style={{width:40,textAlign:"center"}}>Act</th>
                <th style={{width:32}}></th>
              </tr>
            </thead>
            <tbody>
              {items.length===0 && (
                <tr><td colSpan={12} className="empty-row">No line items — click &quot;+ Add Line Item&quot; below or load a template</td></tr>
              )}
              {items.map((li,i)=>{
                if(li.isHeader) return (
                  <tr key={i} className="header-row">
                    <td><div className="move-btns"><button className="mv" onClick={()=>move(i,-1)}>▲</button><button className="mv" onClick={()=>move(i,1)}>▼</button></div></td>
                    <td><span className="type-badge" style={{background:"#f3e8ff",color:"#7c3aed"}}>H</span></td>
                    <td colSpan={8}><input className="inp-cell header-inp" value={li.description} onChange={e=>upd(i,"description",e.target.value)} placeholder="Section header…"/></td>
                    <td></td>
                    <td><button className="del-btn" onClick={()=>del(i)}>✕</button></td>
                  </tr>
                );
                const lt=n(li.qty)*n(li.unitSell);
                const tc=TYPE_COLORS[li.type]??TYPE_COLORS.M;
                return (
                  <tr key={i} className="data-row">
                    <td><div className="move-btns"><button className="mv" onClick={()=>move(i,-1)}>▲</button><button className="mv" onClick={()=>move(i,1)}>▼</button></div></td>
                    <td><span className="type-badge" style={{background:tc.bg,color:tc.color}} onClick={()=>upd(i,"type",NEXT_TYPE[li.type]||"M")} title="Click to cycle type">{li.type}</span></td>
                    <td><input className="inp-cell" value={li.tag} onChange={e=>upd(i,"tag",e.target.value)} style={{width:44}}/></td>
                    <td style={{display:"flex",alignItems:"center",gap:4}}>
                      <input className="inp-cell" value={li.description} onChange={e=>upd(i,"description",e.target.value)} placeholder="Description…" style={{width:"100%",minWidth:140}}/>
                      <button title="Search product catalogue" onClick={()=>openProdSearch(i)}
                        style={{flexShrink:0,padding:"3px 6px",fontSize:13,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:5,cursor:"pointer",lineHeight:1}}>🔍</button>
                    </td>
                    <td><input className="inp-cell mono" type="number" value={li.qty} onChange={e=>upd(i,"qty",e.target.value)} style={{width:54}}/></td>
                    <td><input className="inp-cell mono" type="number" value={li.unitCost} onChange={e=>upd(i,"unitCost",e.target.value)} style={{width:88}}/></td>
                    <td><input className="inp-cell mono" type="number" value={li.costTax} onChange={e=>upd(i,"costTax",e.target.value)} style={{width:46}}/></td>
                    <td><input className="inp-cell mono" type="number" value={li.unitSell} onChange={e=>upd(i,"unitSell",e.target.value)} style={{width:88}}/></td>
                    <td><input className="inp-cell mono" type="number" value={li.sellTax} onChange={e=>upd(i,"sellTax",e.target.value)} style={{width:46}}/></td>
                    <td style={{textAlign:"right",paddingRight:12}}><span className="mono" style={{color:lt>0?"#1a56db":"#9ca3af"}}>${fmt(lt)}</span></td>
                    <td style={{textAlign:"center"}}><input type="checkbox" checked={li.actOn} onChange={e=>upd(i,"actOn",e.target.checked)} style={{accentColor:"#1a56db",cursor:"pointer"}}/></td>
                    <td><button className="del-btn" onClick={()=>del(i)}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <div className="add-btns">
            <button className="add-btn" onClick={()=>addItem(false)}>+ Add Line Item</button>
            <button className="add-btn sec" onClick={()=>addItem(true)}>+ Add Section Header</button>
            <button className="add-btn tpl" onClick={()=>setShowTemplate(true)}>🏠 Load Template</button>
          </div>
        </div>
      </div>

      {/* Target Margin */}
      <div className="margin-box">
        <div>
          <div className="margin-title">Set Target Margin ($)</div>
          <div className="margin-hint">Enter a dollar margin → Unit Sell prices update proportionally across all items</div>
        </div>
        <div className="margin-inputs">
          <span className="margin-dollar">$</span>
          <input className="margin-inp" type="number" placeholder={margin.toFixed(2)} value={targetMargin} onChange={e=>setTargetMargin(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"){const v=parseFloat(targetMargin);if(!isNaN(v))applyMargin(v);}}}/>
          <button className="btn-primary" onClick={()=>{const v=parseFloat(targetMargin);if(!isNaN(v))applyMargin(v);}}>Apply ✓</button>
          {targetMargin&&<button className="btn-ghost" onClick={()=>setTargetMargin("")}>Clear</button>}
        </div>
      </div>

        </div>{/* end main-content */}
      </div>{/* end two-col */}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .page { font-family: 'DM Sans', sans-serif; padding: 28px 32px; max-width: 1500px; margin: 0 auto; }
        .two-col { display: flex; gap: 20px; align-items: flex-start; }
        .sidebar { width: 210px; flex-shrink: 0; display: flex; flex-direction: column; gap: 0; position: sticky; top: 110px; }
        .main-content { flex: 1; min-width: 0; }
        .sb-card { background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 14px 14px 12px; margin-bottom: 2px; }
        .sb-job-id { font-family: 'DM Mono', monospace; font-size: 11px; font-weight: 700; color: #1a56db; letter-spacing: 0.5px; margin-bottom: 4px; }
        .sb-job-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
        .sb-status { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 20px; }
        .sb-section { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; margin-top: 8px; }
        .sb-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #9ca3af; margin-bottom: 7px; }
        .sb-name { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 5px; }
        .sb-line { font-size: 12px; color: #374151; line-height: 1.7; }
        .sb-meta-row { display: flex; justify-content: space-between; gap: 6px; padding: 3px 0; border-bottom: 1px solid #f3f4f6; }
        .sb-meta-row:last-child { border-bottom: none; }
        .sb-meta-key { font-size: 11px; color: #9ca3af; font-weight: 500; }
        .sb-meta-val { font-size: 11px; color: #374151; font-weight: 600; text-align: right; }
        .loading { display:flex;align-items:center;justify-content:center;height:50vh;font-family:'DM Sans',sans-serif;color:#9ca3af; }
        .breadcrumb { font-size:12.5px;color:#9ca3af;margin-bottom:6px; }
        .breadcrumb span { color:#1a56db;cursor:pointer; }
        .breadcrumb span:hover { text-decoration:underline; }
        .page-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;gap:16px; }
        .page-title { font-size:22px;font-weight:700;color:#111827;margin:0; }
        .header-actions { display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap; }
        .unsaved { font-size:12px;font-weight:600;color:#d97706;background:#fef9c3;border:1px solid #fef08a;border-radius:5px;padding:3px 9px; }
        .btn-primary { background:#1a56db;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background 0.15s; }
        .btn-primary:disabled { opacity:0.6;cursor:not-allowed; }
        .btn-ghost { background:#fff;color:#374151;border:1.5px solid #e5e7eb;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s; }
        .btn-ghost:hover { background:#f9fafb; }
        .summary-row { display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px; }
        .sum-card { background:#fff;border:1.5px solid #e5e7eb;border-radius:10px;padding:14px 16px; }
        .sum-label { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#9ca3af;margin-bottom:6px; }
        .sum-val { font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:#111827; }
        .sum-val.blue { color:#1a56db; }
        .sum-pct { font-size:12px;font-weight:500; }
        .table-card { background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:14px; }
        .table-toolbar { display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #f3f4f6; }
        .table-title { font-size:13px;font-weight:700;color:#111827; }
        .gst-label { font-size:12.5px;color:#6b7280;font-weight:500; }
        .gst-input { font-family:'DM Mono',monospace;font-size:13px;width:52px;border:1.5px solid #e5e7eb;border-radius:6px;padding:5px 8px;outline:none;color:#111827;text-align:center; }
        .table-wrap { overflow-x:auto; }
        .cs-table { width:100%;border-collapse:collapse;font-size:13px; }
        .cs-table th { background:#f9fafb;color:#9ca3af;font-size:10.5px;text-transform:uppercase;letter-spacing:0.6px;font-weight:700;padding:9px 8px;text-align:left;border-bottom:1.5px solid #e5e7eb;white-space:nowrap; }
        .cs-table td { padding:4px 5px;border-bottom:1px solid #f5f6f9;vertical-align:middle; }
        .cs-table tr:last-child td { border-bottom:none; }
        .data-row:hover td { background:#fafbff; }
        .header-row td { background:#fafafa; }
        .empty-row { text-align:center;padding:36px;color:#9ca3af;font-size:13.5px; }
        .move-btns { display:flex;flex-direction:column; }
        .mv { background:none;border:none;color:#d1d5db;cursor:pointer;padding:1px 3px;font-size:10px;line-height:1.2; }
        .mv:hover { color:#6b7280; }
        .type-badge { display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0; }
        .inp-cell { font-family:'DM Sans',sans-serif;font-size:12.5px;color:#111827;background:transparent;border:1.5px solid transparent;border-radius:5px;padding:5px 6px;outline:none;transition:all 0.12s; }
        .inp-cell:focus { background:#fff;border-color:#1a56db;box-shadow:0 0 0 2px rgba(26,86,219,0.08); }
        .inp-cell::placeholder { color:#d1d5db; }
        .inp-cell.mono { font-family:'DM Mono',monospace; }
        .inp-cell.header-inp { font-weight:700;font-size:11.5px;text-transform:uppercase;letter-spacing:0.5px;color:#7c3aed; }
        .del-btn { background:none;border:1px solid #f0f0f0;color:#d1d5db;border-radius:4px;cursor:pointer;padding:4px 6px;font-size:11px;transition:all 0.12s; }
        .del-btn:hover { background:#fef2f2;color:#dc2626;border-color:#fecaca; }
        .table-footer { padding:12px 16px;border-top:1px solid #f3f4f6; }
        .add-btns { display:flex;gap:8px; }
        .add-btn { font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:500;color:#1a56db;background:#eff6ff;border:1.5px dashed #bfdbfe;border-radius:7px;padding:7px 14px;cursor:pointer;transition:all 0.15s; }
        .add-btn:hover { background:#dbeafe; }
        .add-btn.sec { color:#7c3aed;background:#f5f3ff;border-color:#ddd6fe; }
        .add-btn.sec:hover { background:#ede9fe; }
        .add-btn.tpl { color:#059669;background:#f0fdf4;border-color:#bbf7d0; }
        .add-btn.tpl:hover { background:#dcfce7; }
        .margin-box { background:#f0f7ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:20px;flex-wrap:wrap; }
        .margin-title { font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1a56db;margin-bottom:2px; }
        .margin-hint { font-size:12px;color:#6b7280; }
        .margin-inputs { display:flex;align-items:center;gap:8px;margin-left:auto; }
        .margin-dollar { font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:#1a56db; }
        .margin-inp { font-family:'DM Mono',monospace;font-size:18px;font-weight:700;width:130px;border:2px solid #1a56db;border-radius:7px;padding:7px 12px;outline:none;color:#111827; }
        .mono { font-family:'DM Mono',monospace;font-size:12.5px; }
        .toast { position:fixed;bottom:24px;right:24px;z-index:9999;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;color:#fff; }
        .toast-ok { background:#15803d; }
        .toast-err { background:#b91c1c; }
        .modal-bg { position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center; }
        .modal { background:#fff;border-radius:14px;width:520px;max-width:95vw;box-shadow:0 20px 50px rgba(0,0,0,0.2);font-family:'DM Sans',sans-serif; }
        .modal-header { display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid #f3f4f6; }
        .modal-title { font-size:15px;font-weight:700;color:#111827; }
        .modal-close { background:none;border:none;font-size:18px;cursor:pointer;color:#9ca3af;padding:0; }
        .modal-sub { padding:14px 22px 4px;font-size:13px;color:#6b7280;margin:0; }
        .template-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px 22px 22px; }
        .template-card { border:1.5px solid #e5e7eb;border-radius:10px;padding:18px;cursor:pointer;background:#fff;text-align:center;transition:all 0.15s;font-family:'DM Sans',sans-serif; }
        .template-card:hover { border-color:#1a56db;background:#f0f7ff; }
        .tc-icon { font-size:32px;margin-bottom:8px; }
        .tc-name { font-size:14px;font-weight:700;color:#111827;margin-bottom:4px; }
        .tc-desc { font-size:11.5px;color:#6b7280;line-height:1.5;margin-bottom:8px; }
        .tc-count { font-size:11px;font-weight:700;color:#1a56db;text-transform:uppercase;letter-spacing:0.5px; }
      `}</style>
    </div>
  );
}
