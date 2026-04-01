"use client";
import React, { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

interface ProductColor { id: number; code: string; name: string; costPrice?: number | null; isActive: boolean; }
interface Product {
  id: number; supplier: string; name: string; category: string;
  unit: string; width?: number | null; costPrice: number; sellPrice?: number | null;
  taxPercent: number; notes?: string | null; isActive: boolean;
  colors: ProductColor[];
}

const CATEGORIES = ["carpet","timber","underlay","adhesive","trim","vinyl","other"];
const UNITS = ["M","SQM","EA","LM","BOX"];

const INP: React.CSSProperties = { width:"100%", padding:"8px 10px", fontSize:13, border:"1.5px solid #e5e7eb", borderRadius:7, outline:"none", fontFamily:"'DM Sans',sans-serif", background:"#fff" };
const LBL: React.CSSProperties = { display:"block", fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 };

const fmt = (n?: number | null) => n != null ? `$${n.toFixed(2)}` : "—";

export default function ProductsPage() {
  const [products,    setProducts]    = useState<Product[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [catFilter,   setCatFilter]   = useState("all");
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [expandId,    setExpandId]    = useState<number | null>(null);

  // Product form
  const [showForm,    setShowForm]    = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ supplier:"", name:"", category:"carpet", unit:"M", width:"", costPrice:"", sellPrice:"", taxPercent:"10", notes:"" });

  // Colour form (per product)
  const [colorForms,  setColorForms]  = useState<Record<number,{ code:string; name:string; costPrice:string }>>({});

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/products?active=false`);
      const d = await r.json();
      setProducts(Array.isArray(d) ? d : []);
    } catch { showToast("Failed to load products", false); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditProduct(null);
    setForm({ supplier:"", name:"", category:"carpet", unit:"M", width:"", costPrice:"", sellPrice:"", taxPercent:"10", notes:"" });
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({ supplier:p.supplier, name:p.name, category:p.category, unit:p.unit, width:p.width?.toString()||"", costPrice:p.costPrice.toString(), sellPrice:p.sellPrice?.toString()||"", taxPercent:p.taxPercent.toString(), notes:p.notes||"" });
    setShowForm(true);
    setExpandId(p.id);
  };

  const saveProduct = async () => {
    if (!form.name.trim()) { showToast("Product name is required", false); return; }
    try {
      const body = { ...form, width: form.width||null, costPrice: parseFloat(form.costPrice)||0, sellPrice: form.sellPrice ? parseFloat(form.sellPrice) : null, taxPercent: parseFloat(form.taxPercent)||10 };
      const url  = editProduct ? `${API}/products/${editProduct.id}` : `${API}/products`;
      const meth = editProduct ? "PUT" : "POST";
      const r = await fetch(url, { method:meth, headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      showToast(editProduct ? "Product updated" : "Product added", true);
      setShowForm(false);
      load();
    } catch (e) { showToast((e as Error).message, false); }
  };

  const deleteProduct = async (id: number) => {
    if (!confirm("Delete this product and all its colours?")) return;
    try {
      await fetch(`${API}/products/${id}`, { method:"DELETE" });
      showToast("Deleted", true); load();
    } catch { showToast("Failed to delete", false); }
  };

  const toggleActive = async (p: Product) => {
    try {
      await fetch(`${API}/products/${p.id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ isActive:!p.isActive }) });
      load();
    } catch { showToast("Failed", false); }
  };

  const addColor = async (productId: number) => {
    const cf = colorForms[productId] || { code:"", name:"", costPrice:"" };
    if (!cf.name.trim()) { showToast("Colour name is required", false); return; }
    try {
      await fetch(`${API}/products/${productId}/colors`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ code:cf.code, name:cf.name, costPrice:cf.costPrice?parseFloat(cf.costPrice):null }) });
      setColorForms(p => ({ ...p, [productId]:{ code:"", name:"", costPrice:"" } }));
      showToast("Colour added", true); load();
    } catch { showToast("Failed to add colour", false); }
  };

  const deleteColor = async (productId: number, colorId: number) => {
    try {
      await fetch(`${API}/products/${productId}/colors/${colorId}`, { method:"DELETE" });
      load();
    } catch { showToast("Failed", false); }
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchCat = catFilter === "all" || p.category === catFilter;
    const matchQ   = !q || p.name.toLowerCase().includes(q) || p.supplier.toLowerCase().includes(q) || p.colors.some(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  if (loading) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", color:"#9ca3af", fontFamily:"'DM Sans',sans-serif" }}>Loading…</div>;

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", maxWidth:1100, margin:"0 auto", padding:"24px" }}>
      {toast && <div style={{ position:"fixed", bottom:20, right:20, zIndex:9999, padding:"10px 18px", borderRadius:8, fontSize:13, fontWeight:600, color:"#fff", background:toast.ok?"#16a34a":"#dc2626", boxShadow:"0 4px 16px rgba(0,0,0,0.15)" }}>{toast.ok?"✓":"✕"} {toast.msg}</div>}

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:"#111827" }}>Product Catalogue</div>
          <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>{products.length} products · {products.reduce((s,p)=>s+p.colors.length,0)} colours</div>
        </div>
        <button onClick={openNew} style={{ padding:"9px 20px", fontSize:13, fontWeight:600, background:"#2563eb", color:"#fff", border:"none", borderRadius:7, cursor:"pointer" }}>
          + Add Product
        </button>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product, supplier, colour…"
          style={{ ...INP, width:280, flex:"none" }} />
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{ ...INP, width:160, flex:"none" }}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
        </select>
      </div>

      {/* Product form modal */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setShowForm(false)}>
          <div style={{ background:"#fff", borderRadius:12, width:640, maxWidth:"95vw", boxShadow:"0 20px 50px rgba(0,0,0,0.2)", fontFamily:"'DM Sans',sans-serif" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 22px", borderBottom:"1px solid #f3f4f6" }}>
              <span style={{ fontSize:15, fontWeight:700, color:"#111827" }}>{editProduct?"Edit Product":"Add Product"}</span>
              <button onClick={()=>setShowForm(false)} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#9ca3af" }}>✕</button>
            </div>
            <div style={{ padding:"20px 22px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={LBL}>Product / Range Name *</label>
                <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Greenridge 100% Solution Dyed Nylon" style={INP} />
              </div>
              <div>
                <label style={LBL}>Supplier</label>
                <input value={form.supplier} onChange={e=>setForm(p=>({...p,supplier:e.target.value}))} placeholder="e.g. Godfrey, Feltex" style={INP} />
              </div>
              <div>
                <label style={LBL}>Category</label>
                <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={INP}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={LBL}>Unit</label>
                <select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))} style={INP}>
                  {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={LBL}>Width (m)</label>
                <input type="number" step="0.01" value={form.width} onChange={e=>setForm(p=>({...p,width:e.target.value}))} placeholder="e.g. 3.66" style={INP} />
              </div>
              <div>
                <label style={LBL}>Cost Price (ex GST)</label>
                <input type="number" step="0.01" value={form.costPrice} onChange={e=>setForm(p=>({...p,costPrice:e.target.value}))} placeholder="$0.00" style={INP} />
              </div>
              <div>
                <label style={LBL}>Default Sell Price (optional)</label>
                <input type="number" step="0.01" value={form.sellPrice} onChange={e=>setForm(p=>({...p,sellPrice:e.target.value}))} placeholder="$0.00" style={INP} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={LBL}>Notes</label>
                <input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Optional notes" style={INP} />
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8, padding:"14px 22px", borderTop:"1px solid #f3f4f6" }}>
              <button onClick={()=>setShowForm(false)} style={{ padding:"8px 16px", fontSize:13, fontWeight:600, background:"#fff", color:"#374151", border:"1px solid #e5e7eb", borderRadius:7, cursor:"pointer" }}>Cancel</button>
              <button onClick={saveProduct} style={{ padding:"8px 20px", fontSize:13, fontWeight:600, background:"#2563eb", color:"#fff", border:"none", borderRadius:7, cursor:"pointer" }}>{editProduct?"Save Changes":"Add Product"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Products list */}
      {filtered.length === 0 ? (
        <div style={{ background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:12, padding:48, textAlign:"center", color:"#9ca3af", fontSize:13 }}>
          {search || catFilter!=="all" ? "No products match your search" : "No products yet — click + Add Product to get started"}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filtered.map(p => {
            const isOpen = expandId === p.id;
            const cf = colorForms[p.id] || { code:"", name:"", costPrice:"" };
            const setCF = (key: string, val: string) => setColorForms(prev => ({ ...prev, [p.id]:{ ...cf, [key]:val } }));
            return (
              <div key={p.id} style={{ background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:10, overflow:"hidden", opacity:p.isActive?1:0.6 }}>
                {/* Product row */}
                <div style={{ display:"flex", alignItems:"center", padding:"14px 18px", gap:14, cursor:"pointer" }} onClick={()=>setExpandId(isOpen?null:p.id)}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:"#111827" }}>{p.name}</span>
                      {p.supplier && <span style={{ fontSize:11, color:"#6b7280", background:"#f3f4f6", padding:"1px 7px", borderRadius:4 }}>{p.supplier}</span>}
                      <span style={{ fontSize:10, fontWeight:600, padding:"1px 7px", borderRadius:4, background:"#eff6ff", color:"#2563eb", textTransform:"uppercase" }}>{p.category}</span>
                      {!p.isActive && <span style={{ fontSize:10, fontWeight:600, padding:"1px 7px", borderRadius:4, background:"#fee2e2", color:"#991b1b" }}>Inactive</span>}
                    </div>
                    <div style={{ fontSize:11, color:"#9ca3af" }}>
                      Cost: <strong style={{ color:"#374151" }}>{fmt(p.costPrice)}</strong> / {p.unit}
                      {p.width ? ` · Width: ${p.width}m` : ""}
                      {p.sellPrice ? ` · Sell: ${fmt(p.sellPrice)}` : ""}
                      {" · "}<span style={{ color:"#6b7280" }}>{p.colors.length} colour{p.colors.length!==1?"s":""}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    <button onClick={e=>{e.stopPropagation();openEdit(p);}} style={{ fontSize:11, padding:"4px 10px", background:"#f3f4f6", color:"#374151", border:"none", borderRadius:5, cursor:"pointer" }}>✎ Edit</button>
                    <button onClick={e=>{e.stopPropagation();toggleActive(p);}} style={{ fontSize:11, padding:"4px 10px", background:p.isActive?"#fff7ed":"#f0fdf4", color:p.isActive?"#c2410c":"#16a34a", border:"none", borderRadius:5, cursor:"pointer" }}>{p.isActive?"Deactivate":"Activate"}</button>
                    <button onClick={e=>{e.stopPropagation();deleteProduct(p.id);}} style={{ fontSize:11, padding:"4px 10px", background:"none", color:"#d1d5db", border:"1px solid #f0f0f0", borderRadius:5, cursor:"pointer" }}
                      onMouseEnter={e=>{e.currentTarget.style.background="#fef2f2";e.currentTarget.style.color="#dc2626";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="#d1d5db";}}>✕</button>
                    <span style={{ color:"#9ca3af", fontSize:14 }}>{isOpen?"▲":"▼"}</span>
                  </div>
                </div>

                {/* Colours panel */}
                {isOpen && (
                  <div style={{ borderTop:"1px solid #f3f4f6", padding:"14px 18px", background:"#fafbff" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:10 }}>Colours / Variants</div>

                    {p.colors.length === 0 && <div style={{ fontSize:12, color:"#9ca3af", marginBottom:12 }}>No colours yet — add one below</div>}

                    {p.colors.map(c => (
                      <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom:"1px solid #f0f0f0" }}>
                        {c.code && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#9ca3af", width:60, flexShrink:0 }}>{c.code}</span>}
                        <span style={{ fontSize:13, color:"#111827", flex:1 }}>{c.name}</span>
                        {c.costPrice != null && <span style={{ fontSize:11, color:"#2563eb", fontFamily:"'DM Mono',monospace" }}>{fmt(c.costPrice)}</span>}
                        <span style={{ fontSize:11, color:"#9ca3af" }}>override</span>
                        <button onClick={()=>deleteColor(p.id,c.id)} style={{ fontSize:11, padding:"2px 8px", background:"none", color:"#d1d5db", border:"1px solid #f0f0f0", borderRadius:4, cursor:"pointer" }}
                          onMouseEnter={e=>{e.currentTarget.style.color="#dc2626";}}
                          onMouseLeave={e=>{e.currentTarget.style.color="#d1d5db";}}>✕</button>
                      </div>
                    ))}

                    {/* Add colour form */}
                    <div style={{ display:"flex", gap:8, marginTop:12, alignItems:"flex-end" }}>
                      <div>
                        <label style={LBL}>Code</label>
                        <input value={cf.code} onChange={e=>setCF("code",e.target.value)} placeholder="P5911" style={{ ...INP, width:80 }} />
                      </div>
                      <div style={{ flex:1 }}>
                        <label style={LBL}>Colour Name *</label>
                        <input value={cf.name} onChange={e=>setCF("name",e.target.value)} placeholder="e.g. 11 Quartz" style={INP} />
                      </div>
                      <div>
                        <label style={LBL}>Cost Override ($)</label>
                        <input type="number" step="0.01" value={cf.costPrice} onChange={e=>setCF("costPrice",e.target.value)} placeholder={p.costPrice.toString()} style={{ ...INP, width:110 }} />
                      </div>
                      <button onClick={()=>addColor(p.id)} style={{ padding:"8px 16px", fontSize:12, fontWeight:600, background:"#2563eb", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", whiteSpace:"nowrap" }}>
                        + Add Colour
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
