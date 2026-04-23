import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabase.js";

/* ─── STATUS ───────────────────────── */
const STATUS = {
  proses:   { label:"Sedang Proses", icon:"🔄", color:"#2660A4", bg:"#DEEAF8", border:"#82AAE8" },
  selesai:  { label:"Selesai",        icon:"✅", color:"#3D7A55", bg:"#DCF0E5", border:"#78C090" },
  approved: { label:"Approved",       icon:"👑", color:"#7A4A00", bg:"#FEF0D0", border:"#E8B840" },
};

/* ─── CONSTANTS ────────────────────── */
const TODAY    = new Date().toISOString().split("T")[0];
const MO       = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const fmtDate  = d => { if(!d) return ""; const [y,m,dd]=d.split("-"); return `${+dd} ${MO[+m-1]} ${y}`; };
const fmtNow   = () => new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
const nowStamp = () => new Date().toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});

const STAFF_PIN = "1234";
const OWNER_PIN = "0000";
const SATUAN    = ["gram","kg","ml","liter","pcs","butir","siung","lembar","sdm","sdt","bungkus","porsi","cup","botol","ikat"];

const emptyForm = () => ({
  tanggal:TODAY, waktu:fmtNow(),
  menuId:"", menuNama:"", menuKat:"",
  bahanBaku:[{nama:"",jumlah:"",satuan:"gram"}],
  hasilPcs:"", hasilPorsi:"",
  catatan:"", foto:null,
});

/* ─── TOKENS ───────────────────────── */
const T="#C05A28",TL="#FAE9DC",TM="#E8A882";
const BL="#2660A4",BLL="#DEEAF8";
const GN="#3D7A55",GNL="#DCF0E5";
const AM="#7A4A00",AML="#FEF0D0",AMB="#E8B840";
const INK="#27180A",MID="#75523A",MUTED="#B08868";
const BDR="#ECD9C8",BDR2="#F6E8DA";
const SH="0 2px 14px rgba(160,80,30,.09)";

/* ─── ATOMS ────────────────────────── */
const IS=(ex={})=>({width:"100%",background:"#FBF6F1",border:`1.5px solid ${BDR}`,borderRadius:11,padding:"11px 14px",color:INK,fontSize:14,fontFamily:"Georgia,serif",outline:"none",boxSizing:"border-box",...ex});
const CS=(ex={})=>({background:"#fff",border:`1px solid ${BDR2}`,borderRadius:20,padding:18,marginBottom:14,boxShadow:SH,...ex});
const Inp=({as="input",style={},...p})=>as==="textarea"?<textarea style={{...IS(),resize:"vertical",minHeight:78,...style}} {...p}/>:as==="select"?<select style={{...IS(),cursor:"pointer",...style}} {...p}/>:<input style={{...IS(),...style}} {...p}/>;
const Pill=({c,bg,bd,children,style={}})=><span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,color:c,background:bg,border:bd?`1px solid ${bd}`:"none",...style}}>{children}</span>;
const StatusBadge=({status})=>{const s=STATUS[status]||STATUS.proses;return <Pill c={s.color} bg={s.bg} bd={s.border}>{s.icon} {s.label}</Pill>;};

/* ─── DB HELPERS ───────────────────── */
// Map dari format app ke format DB
const toDb = (form, status, extra={}) => ({
  id:           form.id || Date.now(),
  tanggal:      form.tanggal,
  waktu:        form.waktu || fmtNow(),
  menu_id:      form.menuId,
  menu_nama:    form.menuNama,
  menu_kat:     form.menuKat,
  bahan_baku:   form.bahanBaku,
  hasil_pcs:    form.hasilPcs,
  hasil_porsi:  form.hasilPorsi,
  catatan:      form.catatan,
  foto:         form.foto,
  status:       status,
  ...extra,
});

// Map dari format DB ke format app
const fromDb = r => ({
  id:         r.id,
  tanggal:    r.tanggal,
  waktu:      r.waktu,
  menuId:     r.menu_id,
  menuNama:   r.menu_nama,
  menuKat:    r.menu_kat,
  bahanBaku:  r.bahan_baku || [],
  hasilPcs:   r.hasil_pcs,
  hasilPorsi: r.hasil_porsi,
  catatan:    r.catatan,
  foto:       r.foto,
  status:     r.status || "proses",
  approvedAt: r.approved_at,
  waktuSelesai: r.waktu_selesai,
});

/* ════════════════════════════════════════
   LOGIN
════════════════════════════════════════ */
function Login({onLogin}){
  const [pin,setPin]=useState(""); const [role,setRole]=useState("staff"); const [err,setErr]=useState("");
  const go=()=>{
    if(role==="staff"&&pin===STAFF_PIN){onLogin("staff");return;}
    if(role==="owner"&&pin===OWNER_PIN){onLogin("owner");return;}
    setErr("PIN salah"); setPin(""); setTimeout(()=>setErr(""),2000);
  };
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#FFF9F4,#FDE8D0)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"Georgia,serif"}}>
      <div style={{width:"100%",maxWidth:360}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:68,height:68,borderRadius:18,background:`linear-gradient(135deg,${T},#E07340)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 12px",boxShadow:"0 6px 24px rgba(192,90,40,.28)"}}>☕</div>
          <div style={{fontSize:9,letterSpacing:4,color:T,textTransform:"uppercase",marginBottom:5}}>Cafe Piccolo Corner</div>
          <div style={{fontSize:24,fontWeight:800,color:INK}}>Pencatatan Produksi</div>
        </div>
        <div style={{background:"#fff",borderRadius:22,padding:24,boxShadow:SH,border:`1px solid ${BDR2}`}}>
          <div style={{fontSize:11,color:MUTED,marginBottom:10,textAlign:"center",fontStyle:"italic"}}>Masuk sebagai</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {[["staff","👨‍🍳","Staff"],["owner","👑","Owner"]].map(([v,ic,lb])=>(
              <button key={v} onClick={()=>setRole(v)} style={{padding:"12px 8px",borderRadius:13,border:`2px solid ${role===v?T:BDR}`,background:role===v?TL:"#FDFAF7",cursor:"pointer",fontFamily:"Georgia,serif",color:role===v?T:MID,fontWeight:role===v?700:400,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                <span style={{fontSize:24}}>{ic}</span><span style={{fontSize:13}}>{lb}</span>
              </button>
            ))}
          </div>
          <div style={{fontSize:11,color:MUTED,marginBottom:6,fontStyle:"italic"}}>PIN</div>
          <Inp type="password" inputMode="numeric" maxLength={6} placeholder="Masukkan PIN..." value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} style={{fontSize:18,letterSpacing:4,textAlign:"center",marginBottom:10}}/>
          {err&&<div style={{color:"#C02020",fontSize:12,textAlign:"center",marginBottom:8}}>⚠️ {err}</div>}
          <button onClick={go} style={{width:"100%",padding:14,border:"none",borderRadius:13,background:`linear-gradient(135deg,${T},#E0733A)`,color:"#fff",fontSize:15,fontFamily:"Georgia,serif",fontWeight:700,cursor:"pointer",boxShadow:"0 4px 18px rgba(192,90,40,.28)"}}>Masuk →</button>
          <div style={{textAlign:"center",marginTop:12,fontSize:11,color:MUTED,fontStyle:"italic"}}>Staff: 1234 &nbsp;·&nbsp; Owner: 0000</div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   FORM INPUT
════════════════════════════════════════ */
function FormInput({menu,editTarget,onSaved,onEditCancel}){
  const [form,setForm]=useState(editTarget?{...editTarget}:emptyForm());
  const [picking,setPicking]=useState(!editTarget?.menuNama);
  const [activeCat,setActiveCat]=useState("Kitchen");
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState("");
  const fotoRef=useRef();

  useEffect(()=>{
    if(editTarget){setForm({...editTarget});setPicking(false);}
    else{setForm(emptyForm());setPicking(true);}
  },[editTarget]);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),3000);};

  const onFoto=e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();r.onload=ev=>setForm(x=>({...x,foto:ev.target.result}));r.readAsDataURL(f);
  };
  const addBahan=()=>setForm(x=>({...x,bahanBaku:[...x.bahanBaku,{nama:"",jumlah:"",satuan:"gram"}]}));
  const remBahan=i=>setForm(x=>({...x,bahanBaku:x.bahanBaku.filter((_,j)=>j!==i)}));
  const updBahan=(i,k,v)=>setForm(x=>{const b=[...x.bahanBaku];b[i]={...b[i],[k]:v};return{...x,bahanBaku:b};});
  const pickProd=m=>{setForm(x=>({...x,menuId:m.id,menuNama:m.nama,menuKat:m.kat}));setPicking(false);};

  const save=async(statusVal, extra={})=>{
    if(!form.menuNama)return;
    setSaving(true);
    try{
      const row=toDb(form, statusVal, {
        id: editTarget?.id || Date.now(),
        ...extra,
      });
      const {error}=await supabase.from("produksi").upsert(row);
      if(error)throw error;
      showToast(statusVal);
      setForm(emptyForm());
      setPicking(true);
      onSaved&&onSaved();
      if(editTarget)onEditCancel&&onEditCancel();
    }catch(e){
      alert("Gagal simpan: "+e.message);
    }finally{
      setSaving(false);
    }
  };

  const saveProses  = ()=>save("proses");
  const saveSelesai = ()=>{
    if(!form.hasilPcs||!form.foto)return;
    save("selesai",{waktu_selesai:fmtNow()});
  };

  const cats=[...new Set(menu.map(m=>m.kat))];
  const canProses=form.menuNama;
  const canSelesai=form.menuNama&&form.hasilPcs&&form.foto;

  return(
    <div>
      {editTarget&&(
        <div style={{background:BLL,border:`1px solid #82AAE8`,borderRadius:13,padding:"11px 15px",marginBottom:14,fontSize:13,color:BL,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span>✏️ Sedang mengedit — <strong>{editTarget.menuNama}</strong></span>
          <button onClick={onEditCancel} style={{background:"none",border:"none",color:BL,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12,fontWeight:600}}>✕ Batal</button>
        </div>
      )}
      {toast&&(
        <div style={{background:toast==="selesai"?`linear-gradient(135deg,${GN},#52A070)`:`linear-gradient(135deg,${BL},#3A80C8)`,borderRadius:13,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:9,color:"#fff",fontSize:14,boxShadow:"0 4px 18px rgba(0,0,0,.14)"}}>
          {toast==="selesai"?"✅ Produksi selesai disimpan! Owner bisa lihat.":"🔄 Progress disimpan — owner bisa monitor sekarang"}
        </div>
      )}

      {/* Tanggal */}
      <div style={CS()}>
        <div style={{fontSize:11,fontWeight:700,color:T,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📅 Tanggal & Waktu</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 110px",gap:10}}>
          <Inp type="date" value={form.tanggal} onChange={e=>setForm(x=>({...x,tanggal:e.target.value}))}/>
          <Inp value={form.waktu} onChange={e=>setForm(x=>({...x,waktu:e.target.value}))} style={{textAlign:"center"}}/>
        </div>
      </div>

      {/* Produk */}
      <div style={CS()}>
        <div style={{fontSize:11,fontWeight:700,color:T,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>🍽️ Pilih Produk</div>
        {picking?(
          <>
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              {cats.map(c=>{const on=activeCat===c;const col=c==="Kitchen"?{a:T,bg:TL,br:TM}:{a:BL,bg:BLL,br:"#82AAE8"};return(
                <button key={c} onClick={()=>setActiveCat(c)} style={{padding:"7px 16px",borderRadius:20,border:`1.5px solid ${on?col.br:BDR}`,background:on?col.bg:"#FFF",color:on?col.a:MID,fontFamily:"Georgia,serif",fontSize:13,fontWeight:on?700:400,cursor:"pointer"}}>{c==="Kitchen"?"🍳":"🥤"} {c}</button>
              );})}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
              {menu.filter(m=>m.kat===activeCat).map(m=>{const sel=form.menuId===m.id;const col=m.kat==="Kitchen"?{a:T,bg:TL,br:T}:{a:BL,bg:BLL,br:BL};return(
                <button key={m.id} onClick={()=>pickProd(m)} style={{padding:"10px 12px",borderRadius:13,border:`1.5px solid ${sel?col.br:BDR2}`,background:sel?col.bg:"#FDFAF7",color:sel?col.a:INK,fontFamily:"Georgia,serif",fontSize:13,fontWeight:sel?700:500,cursor:"pointer",textAlign:"left",lineHeight:1.35}}>{m.nama}</button>
              );})}
            </div>
          </>
        ):(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 15px",borderRadius:13,background:form.menuKat==="Bar"?BLL:TL,border:`1.5px solid ${form.menuKat==="Bar"?BL:T}`}}>
            <div>
              <div style={{fontSize:10,color:MUTED,marginBottom:3}}>{form.menuKat==="Bar"?"🥤":"🍳"} {form.menuKat}</div>
              <div style={{fontSize:16,fontWeight:700,color:form.menuKat==="Bar"?BL:T}}>{form.menuNama}</div>
            </div>
            <button onClick={()=>{setPicking(true);setForm(x=>({...x,menuId:"",menuNama:"",menuKat:""}));}} style={{background:"#FFF",border:`1.5px solid ${BDR}`,color:MID,borderRadius:9,padding:"5px 12px",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif"}}>Ganti</button>
          </div>
        )}
      </div>

      {/* Bahan */}
      <div style={CS()}>
        <div style={{fontSize:11,fontWeight:700,color:T,textTransform:"uppercase",letterSpacing:1,marginBottom:10,display:"flex",justifyContent:"space-between"}}>
          <span>🧂 Bahan Baku</span>
          <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:MUTED,fontStyle:"italic"}}>{form.bahanBaku.filter(b=>b.nama).length} bahan</span>
        </div>
        {form.bahanBaku.map((b,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 78px 78px 34px",gap:7,marginBottom:8,alignItems:"center"}}>
            <Inp placeholder={`Bahan ${i+1}`} value={b.nama} onChange={e=>updBahan(i,"nama",e.target.value)}/>
            <Inp placeholder="Qty" type="number" value={b.jumlah} onChange={e=>updBahan(i,"jumlah",e.target.value)} style={{textAlign:"right"}}/>
            <Inp as="select" value={b.satuan} onChange={e=>updBahan(i,"satuan",e.target.value)}>{SATUAN.map(s=><option key={s}>{s}</option>)}</Inp>
            {form.bahanBaku.length>1?<button onClick={()=>remBahan(i)} style={{background:"#FFF0EE",border:"1.5px solid #FFCCCC",color:"#C02020",borderRadius:9,width:34,height:38,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>:<div style={{width:34}}/>}
          </div>
        ))}
        <button onClick={addBahan} style={{width:"100%",padding:9,borderRadius:11,border:`1.5px dashed ${TM}`,background:TL,color:T,fontSize:13,fontFamily:"Georgia,serif",fontWeight:600,cursor:"pointer",marginTop:2}}>＋ Tambah Bahan</button>
      </div>

      {/* Hasil */}
      <div style={CS()}>
        <div style={{fontSize:11,fontWeight:700,color:T,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📦 Hasil Produksi</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {[["hasilPcs","Jumlah jadi","pcs"],["hasilPorsi","Cukup untuk (opsional)","porsi"]].map(([k,lb,suf])=>(
            <div key={k}>
              <div style={{fontSize:11,color:MUTED,fontStyle:"italic",marginBottom:7}}>{lb}</div>
              <div style={{position:"relative"}}>
                <Inp type="number" placeholder="0" value={form[k]} onChange={e=>setForm(x=>({...x,[k]:e.target.value}))} style={{paddingRight:48}}/>
                <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:11,fontWeight:700,color:T,pointerEvents:"none"}}>{suf}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Foto */}
      <div style={CS({border:form.foto?`1.5px solid ${GN}`:BDR2})}>
        <div style={{fontSize:11,fontWeight:700,color:form.foto?GN:T,textTransform:"uppercase",letterSpacing:1,marginBottom:4,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span>📸 Foto Hasil Produksi</span>
          <span style={{fontSize:10,fontWeight:700,padding:"2px 9px",borderRadius:20,background:form.foto?GNL:"#FFF5E0",color:form.foto?GN:"#C07010",textTransform:"none",letterSpacing:0}}>
            {form.foto?"✓ Sudah diupload":"Wajib untuk Tandai Selesai"}
          </span>
        </div>
        <div style={{fontSize:11,color:MUTED,fontStyle:"italic",marginBottom:10}}>Bisa diupload belakangan — simpan progress dulu juga boleh</div>
        <input type="file" ref={fotoRef} accept="image/*" onChange={onFoto} style={{display:"none"}}/>
        <div onClick={()=>fotoRef.current.click()} style={{border:`2px dashed ${form.foto?GN:BDR}`,borderRadius:15,padding:form.foto?0:"22px 18px",textAlign:"center",cursor:"pointer",background:form.foto?"transparent":TL,position:"relative",overflow:"hidden",minHeight:form.foto?"auto":88,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          {form.foto?(
            <>
              <img src={form.foto} alt="preview" style={{width:"100%",borderRadius:13,display:"block",maxHeight:210,objectFit:"cover"}}/>
              <div onClick={e=>{e.stopPropagation();setForm(x=>({...x,foto:null}));}} style={{position:"absolute",bottom:9,right:9,background:"rgba(255,255,255,.92)",borderRadius:9,padding:"5px 12px",fontSize:12,color:T,fontWeight:700,cursor:"pointer",border:`1px solid ${BDR}`}}>✕ Ganti</div>
            </>
          ):(
            <>
              <div style={{fontSize:30,marginBottom:7,opacity:.5}}>📷</div>
              <div style={{color:MID,fontSize:13,fontWeight:500,marginBottom:3}}>Tap untuk ambil / upload foto</div>
            </>
          )}
        </div>
      </div>

      {/* Catatan */}
      <div style={CS()}>
        <div style={{fontSize:11,fontWeight:700,color:T,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📝 Catatan <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:MUTED,fontStyle:"italic"}}>— opsional</span></div>
        <Inp as="textarea" placeholder="Batch ke-2, estimasi selesai jam 14.00, simpan di box A..." value={form.catatan} onChange={e=>setForm(x=>({...x,catatan:e.target.value}))}/>
      </div>

      {/* Action buttons */}
      <div style={CS()}>
        <div style={{fontSize:12,color:MUTED,fontStyle:"italic",marginBottom:12,textAlign:"center"}}>Pilih sesuai kondisi produksi sekarang</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button onClick={saveProses} disabled={!canProses||saving}
            style={{width:"100%",padding:"13px 16px",border:`2px solid ${canProses?BL:BDR}`,borderRadius:15,background:canProses?BLL:"#F8F8F8",color:canProses?BL:MUTED,fontSize:14,fontFamily:"Georgia,serif",fontWeight:700,cursor:canProses?"pointer":"not-allowed",display:"flex",alignItems:"center",gap:10,justifyContent:"center",opacity:saving?.6:1}}>
            <span style={{fontSize:18}}>🔄</span>
            <div style={{textAlign:"left"}}>
              <div>{saving?"Menyimpan...":"Simpan Progress"}</div>
              <div style={{fontSize:11,fontWeight:400,fontStyle:"italic",opacity:.8}}>Masih dikerjakan — owner bisa lihat real-time</div>
            </div>
          </button>
          <button onClick={saveSelesai} disabled={!canSelesai||saving}
            style={{width:"100%",padding:"13px 16px",border:"none",borderRadius:15,background:canSelesai?`linear-gradient(135deg,${GN},#52A070)`:"#F0F0F0",color:canSelesai?"#fff":MUTED,fontSize:14,fontFamily:"Georgia,serif",fontWeight:700,cursor:canSelesai?"pointer":"not-allowed",display:"flex",alignItems:"center",gap:10,justifyContent:"center",boxShadow:canSelesai?"0 4px 18px rgba(61,122,85,.28)":"none",opacity:saving?.6:1}}>
            <span style={{fontSize:18}}>✅</span>
            <div style={{textAlign:"left"}}>
              <div>{saving?"Menyimpan...":"Tandai Selesai"}</div>
              <div style={{fontSize:11,fontWeight:400,fontStyle:"italic",opacity:.85}}>Foto wajib — siap di-approve owner</div>
            </div>
          </button>
          {!canSelesai&&canProses&&(
            <div style={{fontSize:11,color:MUTED,textAlign:"center",fontStyle:"italic"}}>
              Untuk selesai: {!form.hasilPcs&&"isi hasil pcs · "}{!form.foto&&"upload foto"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   LAPORAN VIEW
════════════════════════════════════════ */
function LaporanView({records,onRefresh,menu,role,onEdit}){
  const [fDate,setFDate]=useState("");
  const [fKat,setFKat]=useState("Semua");
  const [fStatus,setFStatus]=useState("Semua");
  const [viewMode,setViewMode]=useState("rekap");
  const [expanded,setExpanded]=useState(null);
  const [fotoOf,setFotoOf]=useState(null);
  const [actionLoading,setActionLoading]=useState(null);

  const cats=[...new Set(menu.map(m=>m.kat))];
  let fil=records;
  if(fDate)  fil=fil.filter(r=>r.tanggal===fDate);
  if(fKat!=="Semua") fil=fil.filter(r=>r.menuKat===fKat);
  if(fStatus!=="Semua") fil=fil.filter(r=>r.status===fStatus);

  const prosesN=records.filter(r=>r.status==="proses").length;
  const selesaiN=records.filter(r=>r.status==="selesai").length;
  const approvedN=records.filter(r=>r.status==="approved").length;

  const byDate={};
  fil.forEach(r=>{if(!byDate[r.tanggal])byDate[r.tanggal]=[];byDate[r.tanggal].push(r);});
  const sortedDates=Object.keys(byDate).sort((a,b)=>b.localeCompare(a));

  const byProd={};
  fil.forEach(r=>{
    if(!byProd[r.menuNama])byProd[r.menuNama]={kat:r.menuKat,totalPcs:0,count:0,statuses:{}};
    byProd[r.menuNama].totalPcs+=+r.hasilPcs||0;
    byProd[r.menuNama].count++;
    byProd[r.menuNama].statuses[r.status]=(byProd[r.menuNama].statuses[r.status]||0)+1;
  });
  const prodSummary=Object.entries(byProd).sort((a,b)=>b[1].totalPcs-a[1].totalPcs);

  const doApprove=async(id,action="approve")=>{
    setActionLoading(id);
    try{
      const upd=action==="revoke"
        ?{status:"selesai",approved_at:null}
        :{status:"approved",approved_at:nowStamp()};
      const{error}=await supabase.from("produksi").update(upd).eq("id",id);
      if(error)throw error;
      onRefresh&&onRefresh();
    }catch(e){alert("Gagal: "+e.message);}
    finally{setActionLoading(null);}
  };

  const doApproveAll=async(ids)=>{
    setActionLoading("all");
    try{
      const{error}=await supabase.from("produksi").update({status:"approved",approved_at:nowStamp()}).in("id",ids);
      if(error)throw error;
      onRefresh&&onRefresh();
    }catch(e){alert("Gagal: "+e.message);}
    finally{setActionLoading(null);}
  };

  const doDelete=async(id)=>{
    if(!confirm("Hapus data ini?"))return;
    setActionLoading(id);
    try{
      const{error}=await supabase.from("produksi").delete().eq("id",id);
      if(error)throw error;
      onRefresh&&onRefresh();
    }catch(e){alert("Gagal: "+e.message);}
    finally{setActionLoading(null);}
  };

  return(
    <div>
      {fotoOf&&(
        <div onClick={()=>setFotoOf(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.78)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{maxWidth:520,width:"100%",background:"#fff",borderRadius:20,overflow:"hidden",boxShadow:"0 10px 50px rgba(0,0,0,.45)"}}>
            <img src={fotoOf.foto} alt="" style={{width:"100%",display:"block",maxHeight:"72vh",objectFit:"contain"}}/>
            <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:13,fontWeight:700,color:INK}}>{fotoOf.menuNama}</div><div style={{fontSize:11,color:MUTED}}>{fmtDate(fotoOf.tanggal)}{fotoOf.waktu?` · ${fotoOf.waktu}`:""}</div></div>
              <button onClick={()=>setFotoOf(null)} style={{background:TL,border:`1px solid ${TM}`,color:T,borderRadius:9,padding:"6px 14px",cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif",fontWeight:600}}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
        <Inp type="date" value={fDate} onChange={e=>setFDate(e.target.value)} style={{flex:1,minWidth:130}}/>
        <Inp as="select" value={fKat} onChange={e=>setFKat(e.target.value)} style={{width:"auto"}}>
          <option>Semua</option>{cats.map(c=><option key={c}>{c}</option>)}
        </Inp>
        {(fDate||fKat!=="Semua")&&<button onClick={()=>{setFDate("");setFKat("Semua");}} style={{background:TL,border:`1.5px solid ${TM}`,color:T,borderRadius:11,padding:"9px 12px",cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif",fontWeight:600}}>Reset</button>}
      </div>

      {/* Status tabs */}
      <div style={{display:"flex",gap:7,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
        {[["Semua",`Semua (${fil.length})`,"#888","#F4F4F4"],["proses",`🔄 Proses (${prosesN})`,STATUS.proses.color,STATUS.proses.bg],["selesai",`✅ Selesai (${selesaiN})`,STATUS.selesai.color,STATUS.selesai.bg],["approved",`👑 Approved (${approvedN})`,AM,AML]].map(([v,lb,c,bg])=>(
          <button key={v} onClick={()=>setFStatus(v)} style={{flexShrink:0,padding:"7px 12px",borderRadius:20,border:`1.5px solid ${fStatus===v?c:BDR}`,background:fStatus===v?bg:"#FFF",color:fStatus===v?c:MID,fontFamily:"Georgia,serif",fontSize:12,fontWeight:fStatus===v?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>{lb}</button>
        ))}
      </div>

      {/* View toggle */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[["rekap","📊 Rekap"],["kartu","📋 Per Entri"]].map(([v,lb])=>(
          <button key={v} onClick={()=>setViewMode(v)} style={{flex:1,padding:"9px",borderRadius:12,border:`1.5px solid ${viewMode===v?T:BDR}`,background:viewMode===v?TL:"#FFF",color:viewMode===v?T:MID,fontFamily:"Georgia,serif",fontSize:13,fontWeight:viewMode===v?700:400,cursor:"pointer"}}>{lb}</button>
        ))}
      </div>

      {/* Approve all banner */}
      {role==="owner"&&records.filter(r=>r.status==="selesai").length>0&&(
        <div style={{background:`linear-gradient(135deg,#5A8A00,#78B010)`,borderRadius:16,padding:"14px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>✅ {records.filter(r=>r.status==="selesai").length} produksi selesai menunggu approval</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.78)",marginTop:2}}>Approve semua atau satu per satu di laporan</div>
          </div>
          <button onClick={()=>doApproveAll(records.filter(r=>r.status==="selesai").map(r=>r.id))} disabled={actionLoading==="all"} style={{background:"rgba(255,255,255,.2)",border:"1.5px solid rgba(255,255,255,.4)",borderRadius:11,padding:"8px 14px",color:"#fff",fontFamily:"Georgia,serif",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",opacity:actionLoading==="all"?.5:1}}>
            {actionLoading==="all"?"...":"Approve Semua"}
          </button>
        </div>
      )}

      {fil.length===0?(
        <div style={{textAlign:"center",padding:"52px 20px",color:MUTED}}>
          <div style={{fontSize:46,marginBottom:12,opacity:.6}}>🫙</div>
          <div style={{fontSize:17,fontWeight:700,color:MID,marginBottom:6}}>Belum ada data</div>
          <div style={{fontSize:12,fontStyle:"italic"}}>Coba ubah filter atau tambah produksi baru</div>
        </div>
      ):viewMode==="rekap"?(
        <div>
          {/* Stats */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
            {[{ic:"🔄",val:fil.filter(r=>r.status==="proses").length,lb:"Sedang Proses",c:STATUS.proses.color,bg:STATUS.proses.bg},{ic:"✅",val:fil.filter(r=>r.status==="selesai").length,lb:"Selesai",c:GN,bg:GNL},{ic:"👑",val:fil.filter(r=>r.status==="approved").length,lb:"Approved",c:AM,bg:AML},{ic:"📦",val:fil.reduce((a,r)=>a+(+r.hasilPcs||0),0),lb:"Total pcs",c:T,bg:TL}].map((s,i)=>(
              <div key={i} style={{background:"#FFF",border:`1px solid ${BDR2}`,borderRadius:16,padding:"14px 16px",boxShadow:SH}}>
                <div style={{fontSize:22,marginBottom:5}}>{s.ic}</div>
                <div style={{fontSize:24,fontWeight:800,color:s.c,marginBottom:2}}>{s.val}</div>
                <div style={{fontSize:11,color:MUTED,fontStyle:"italic"}}>{s.lb}</div>
              </div>
            ))}
          </div>

          {/* Rekap per produk */}
          <div style={CS({marginBottom:14})}>
            <div style={{fontSize:14,fontWeight:700,color:INK,marginBottom:12}}>📈 Rekap Per Produk</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:380}}>
                <thead><tr style={{borderBottom:`1.5px solid ${BDR}`}}>{["Produk","Kat.","Total Pcs","Batch","Status"].map(h=><th key={h} style={{padding:"7px 8px",textAlign:"left",fontSize:10,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {prodSummary.map(([nama,d],i)=>{
                    const s=d.statuses;const allApp=s.approved===d.count;const hasP=(s.proses||0)>0;
                    return(
                      <tr key={nama} style={{borderBottom:i<prodSummary.length-1?`1px solid ${BDR2}`:"none"}}>
                        <td style={{padding:"10px 8px",fontWeight:600,color:INK}}>{nama}</td>
                        <td style={{padding:"10px 8px"}}><Pill c={d.kat==="Kitchen"?T:BL} bg={d.kat==="Kitchen"?TL:BLL}>{d.kat==="Kitchen"?"🍳":"🥤"}</Pill></td>
                        <td style={{padding:"10px 8px",fontWeight:700,color:T}}>{d.totalPcs||"-"}</td>
                        <td style={{padding:"10px 8px",color:MUTED}}>{d.count}×</td>
                        <td style={{padding:"10px 8px"}}>{hasP?<Pill c={STATUS.proses.color} bg={STATUS.proses.bg}>🔄</Pill>:allApp?<Pill c={AM} bg={AML}>👑</Pill>:<Pill c={GN} bg={GNL}>✅</Pill>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per tanggal */}
          <div style={{fontSize:14,fontWeight:700,color:INK,marginBottom:10}}>📅 Per Hari</div>
          {sortedDates.map(tgl=>{
            const rows=byDate[tgl];const open=expanded===tgl;
            const hasP=rows.some(r=>r.status==="proses");
            const allApp=rows.every(r=>r.status==="approved");
            const ac=hasP?BL:allApp?AM:GN;const abg=hasP?BLL:allApp?AML:GNL;
            return(
              <div key={tgl} style={{background:"#FFF",border:`1.5px solid ${ac}44`,borderRadius:16,overflow:"hidden",marginBottom:10,boxShadow:SH}}>
                <div onClick={()=>setExpanded(open?null:tgl)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",background:abg+"88",borderBottom:open?`1px solid ${BDR2}`:"none",cursor:"pointer"}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:INK}}>{fmtDate(tgl)}</div>
                    <div style={{fontSize:11,color:MUTED,marginTop:2,fontStyle:"italic"}}>{rows.length} produk · {rows.reduce((a,r)=>a+(+r.hasilPcs||0),0)} pcs</div>
                  </div>
                  <div style={{display:"flex",gap:7,alignItems:"center"}}>
                    {hasP&&<Pill c={STATUS.proses.color} bg={STATUS.proses.bg+"99"}>🔄 On-progress</Pill>}
                    {allApp&&<Pill c={AM} bg={AML+"99"}>👑 All approved</Pill>}
                    <span style={{fontSize:11,color:MUTED,transform:open?"rotate(180deg)":"rotate(0deg)",display:"inline-block",transition:"transform .25s"}}>▼</span>
                  </div>
                </div>
                {open&&(
                  <div style={{padding:12}}>
                    {rows.map((r,i)=>(
                      <MiniRow key={r.id} r={r} role={role} onEdit={onEdit} onApprove={doApprove} onDelete={doDelete} onFoto={()=>r.foto&&setFotoOf(r)} isLast={i===rows.length-1} loading={actionLoading===r.id}/>
                    ))}
                    {role==="owner"&&rows.some(r=>r.status==="selesai")&&(
                      <button onClick={()=>doApproveAll(rows.filter(r=>r.status==="selesai").map(r=>r.id))} disabled={actionLoading==="all"} style={{width:"100%",marginTop:8,padding:"9px",background:`linear-gradient(135deg,${GN},#52A070)`,border:"none",color:"#fff",borderRadius:11,cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif",fontWeight:700}}>✅ Approve Semua Selesai Hari Ini</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ):(
        <div>
          <div style={{fontSize:12,color:MUTED,fontStyle:"italic",marginBottom:12}}>{fil.length} entri</div>
          {fil.map(r=><CardEntri key={r.id} r={r} role={role} onEdit={onEdit} onApprove={doApprove} onDelete={doDelete} onFoto={()=>r.foto&&setFotoOf(r)} loading={actionLoading===r.id}/>)}
        </div>
      )}
    </div>
  );
}

function MiniRow({r,role,onEdit,onApprove,onDelete,onFoto,isLast,loading}){
  const s=STATUS[r.status]||STATUS.proses;const locked=r.status==="approved";
  return(
    <div style={{padding:"10px 12px",borderRadius:12,marginBottom:isLast?0:8,border:`1px solid ${s.border}44`,background:r.status==="proses"?"#F5F9FF":r.status==="approved"?"#FFFBF0":"#F8FBF8",opacity:loading?.6:1}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
        {r.foto?<img src={r.foto} alt="" onClick={onFoto} style={{width:48,height:48,borderRadius:9,objectFit:"cover",flexShrink:0,border:`2px solid ${s.border}`,cursor:"zoom-in"}}/>:<div style={{width:48,height:48,borderRadius:9,background:BLL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,border:`2px dashed ${BDR}`}}>📷</div>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}><span style={{fontSize:13,fontWeight:700,color:INK}}>{r.menuNama}</span><StatusBadge status={r.status}/></div>
          <div style={{fontSize:11,color:MUTED,fontStyle:"italic",marginBottom:3}}>{r.bahanBaku?.filter(b=>b.nama).map(b=>`${b.nama} ${b.jumlah}${b.satuan}`).join(" · ")||"Bahan belum diisi"}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {r.hasilPcs?<span style={{fontSize:12,fontWeight:600,color:T}}>{r.hasilPcs} pcs</span>:<span style={{fontSize:11,color:MUTED,fontStyle:"italic"}}>Hasil belum diisi</span>}
            {r.hasilPorsi&&<span style={{fontSize:12,fontWeight:600,color:GN}}>{r.hasilPorsi} porsi</span>}
            {r.waktu&&<span style={{fontSize:11,color:MUTED}}>⏰ {r.waktu}</span>}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
          {role==="staff"&&!locked&&onEdit&&<button onClick={()=>onEdit(r)} style={{padding:"4px 10px",background:BLL,border:`1px solid #82AAE8`,color:BL,borderRadius:7,cursor:"pointer",fontSize:11,fontFamily:"Georgia,serif",fontWeight:600}}>✏️</button>}
          {role==="staff"&&!locked&&<button onClick={()=>onDelete&&onDelete(r.id)} style={{padding:"4px 8px",background:"#FFF0EE",border:`1px solid #FFCCCC`,color:"#C02020",borderRadius:7,cursor:"pointer",fontSize:11,fontFamily:"Georgia,serif"}}>🗑</button>}
          {role==="owner"&&r.status==="selesai"&&<button onClick={()=>onApprove(r.id)} disabled={loading} style={{padding:"4px 10px",background:GNL,border:`1px solid ${GN}`,color:GN,borderRadius:7,cursor:"pointer",fontSize:11,fontFamily:"Georgia,serif",fontWeight:700}}>✅</button>}
          {role==="owner"&&locked&&<button onClick={()=>onApprove(r.id,"revoke")} disabled={loading} style={{padding:"4px 10px",background:"#FFF",border:`1px solid ${BDR}`,color:MUTED,borderRadius:7,cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif"}}>↩</button>}
        </div>
      </div>
      {r.catatan&&<div style={{marginTop:7,fontSize:11,color:MID,fontStyle:"italic",background:TL,borderRadius:7,padding:"6px 10px",borderLeft:`2px solid ${TM}`}}>📝 {r.catatan}</div>}
    </div>
  );
}

function CardEntri({r,role,onEdit,onApprove,onDelete,onFoto,loading}){
  const [open,setOpen]=useState(false);const s=STATUS[r.status]||STATUS.proses;const locked=r.status==="approved";
  return(
    <div style={{background:"#FFF",border:`1.5px solid ${s.border}`,borderRadius:18,overflow:"hidden",marginBottom:12,boxShadow:SH,opacity:loading?.6:1}}>
      <div style={{display:"flex",gap:12,padding:14,alignItems:"flex-start",cursor:"pointer"}} onClick={()=>setOpen(!open)}>
        {r.foto?<img src={r.foto} alt="" onClick={e=>{e.stopPropagation();onFoto&&onFoto();}} style={{width:64,height:64,borderRadius:12,objectFit:"cover",flexShrink:0,border:`2px solid ${s.border}`,cursor:"zoom-in"}}/>:<div style={{width:64,height:64,borderRadius:12,background:"#EEF4FB",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,border:`2px dashed ${BDR}`,gap:2}}>📷<span style={{fontSize:9,color:MUTED}}>Belum</span></div>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}><Pill c={r.menuKat==="Kitchen"?T:BL} bg={r.menuKat==="Kitchen"?TL:BLL}>{r.menuKat==="Kitchen"?"🍳":"🥤"} {r.menuKat}</Pill><StatusBadge status={r.status}/></div>
          <div style={{fontSize:16,fontWeight:700,color:INK,margin:"3px 0 2px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.menuNama}</div>
          <div style={{fontSize:11,color:MUTED,fontStyle:"italic",marginBottom:6}}>{fmtDate(r.tanggal)}{r.waktu?` · ${r.waktu}`:""}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {r.hasilPcs?<Pill c={T} bg={TL}>{r.hasilPcs} pcs</Pill>:<Pill c={MUTED} bg="#F4F4F4">Hasil belum diisi</Pill>}
            {r.hasilPorsi&&<Pill c={GN} bg={GNL}>{r.hasilPorsi} porsi</Pill>}
          </div>
        </div>
        <span style={{fontSize:11,color:MUTED,flexShrink:0,transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform .25s"}}>▼</span>
      </div>
      {open&&(
        <div style={{borderTop:`1px solid ${BDR2}`,padding:15,background:"#FDFAF7"}}>
          {r.foto?<><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:MUTED,marginBottom:7,fontWeight:700}}>📸 Foto</div><img src={r.foto} alt="" onClick={onFoto} style={{width:"100%",borderRadius:13,marginBottom:13,maxHeight:230,objectFit:"cover",display:"block",border:`1px solid ${BDR}`,cursor:"zoom-in"}}/></>:<div style={{background:"#EEF4FB",borderRadius:11,padding:"10px 14px",marginBottom:13,fontSize:12,color:BL,fontStyle:"italic"}}>📷 Foto belum diupload</div>}
          {r.bahanBaku?.filter(b=>b.nama).length>0&&(
            <>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:MUTED,marginBottom:7,fontWeight:700}}>🧂 Bahan</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
                {r.bahanBaku.filter(b=>b.nama).map((b,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",background:"#FFF",border:`1px solid ${BDR2}`,padding:"8px 12px",borderRadius:9}}><span style={{fontSize:13,color:INK}}>{b.nama}</span><span style={{fontSize:13,fontWeight:700,color:T}}>{b.jumlah} {b.satuan}</span></div>)}
              </div>
            </>
          )}
          {r.catatan&&<div style={{background:TL,borderRadius:9,padding:"9px 13px",fontSize:13,color:MID,fontStyle:"italic",marginBottom:12,borderLeft:`3px solid ${TM}`}}>📝 {r.catatan}</div>}
          {r.approvedAt&&<div style={{fontSize:11,color:AM,marginBottom:10,fontStyle:"italic"}}>👑 Approved: {r.approvedAt}</div>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {role==="staff"&&!locked&&onEdit&&<button onClick={()=>onEdit(r)} style={{flex:1,padding:"9px",background:BLL,border:`1.5px solid #82AAE8`,color:BL,borderRadius:10,cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif",fontWeight:700}}>✏️ Edit / Lanjutkan</button>}
            {role==="staff"&&!locked&&<button onClick={()=>onDelete&&onDelete(r.id)} style={{padding:"9px 14px",background:"#FFF0EE",border:"1.5px solid #FFCCCC",color:"#C02020",borderRadius:10,cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif",fontWeight:600}}>🗑 Hapus</button>}
            {role==="staff"&&locked&&<div style={{flex:1,padding:"9px 12px",background:AML,border:`1.5px solid ${AMB}`,borderRadius:10,fontSize:12,color:AM,fontWeight:600,textAlign:"center"}}>👑 Sudah diapprove — terkunci</div>}
            {role==="owner"&&r.status==="selesai"&&<button onClick={()=>onApprove(r.id)} disabled={loading} style={{flex:1,padding:"10px",background:`linear-gradient(135deg,${GN},#52A070)`,border:"none",color:"#fff",borderRadius:11,cursor:"pointer",fontSize:14,fontFamily:"Georgia,serif",fontWeight:700,boxShadow:"0 3px 14px rgba(61,122,85,.28)"}}>✅ Approve</button>}
            {role==="owner"&&r.status==="proses"&&<div style={{flex:1,padding:"9px 12px",background:BLL,border:`1.5px solid #82AAE8`,borderRadius:10,fontSize:12,color:BL,fontWeight:600,textAlign:"center"}}>🔄 Masih dalam proses</div>}
            {role==="owner"&&locked&&<button onClick={()=>onApprove(r.id,"revoke")} disabled={loading} style={{padding:"9px 16px",background:"#FFF",border:`1.5px solid ${BDR}`,color:MUTED,borderRadius:10,cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif"}}>↩ Batalkan Approval</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   STAFF APP
════════════════════════════════════════ */
function StaffApp({records,menu,setMenu,onLogout,onRefresh}){
  const [page,setPage]=useState("input");
  const [editTarget,setEditTarget]=useState(null);
  const [newMenu,setNewMenu]=useState({nama:"",kat:"Kitchen"});
  const [menuLoading,setMenuLoading]=useState(false);

  const todayN=records.filter(r=>r.tanggal===TODAY).length;
  const prosesN=records.filter(r=>r.status==="proses").length;

  const addMenuFn=async()=>{
    if(!newMenu.nama.trim())return;
    setMenuLoading(true);
    try{
      const m={id:"u_"+Date.now(),kat:newMenu.kat,nama:newMenu.nama.trim(),custom:true};
      const{error}=await supabase.from("menu").insert(m);
      if(error)throw error;
      setMenu(prev=>[...prev,m]);
      setNewMenu({nama:"",kat:"Kitchen"});
    }catch(e){alert("Gagal: "+e.message);}
    finally{setMenuLoading(false);}
  };

  const delMenuFn=async id=>{
    try{
      const{error}=await supabase.from("menu").delete().eq("id",id);
      if(error)throw error;
      setMenu(prev=>prev.filter(m=>m.id!==id));
    }catch(e){alert("Gagal: "+e.message);}
  };

  return(
    <div style={{fontFamily:"Georgia,serif",background:"#F7F3EE",minHeight:"100vh",paddingBottom:72}}>
      <div style={{background:"linear-gradient(160deg,#FFFAF6,#FDF3E8)",borderBottom:`2px solid ${BDR}`,boxShadow:"0 2px 16px rgba(160,80,30,.09)",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:680,margin:"0 auto",padding:"13px 16px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:11}}>
            <div style={{width:42,height:42,borderRadius:13,background:`linear-gradient(135deg,${T},#E07340)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 4px 14px rgba(192,90,40,.28)",flexShrink:0}}>☕</div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,letterSpacing:3,color:T,textTransform:"uppercase"}}>Piccolo Corner · Staff</div>
              <div style={{fontSize:18,fontWeight:800,color:INK,lineHeight:1.1}}>Pencatatan Produksi</div>
            </div>
            <div style={{textAlign:"right"}}>
              {todayN>0&&<div style={{fontSize:11,color:GN,fontWeight:600,marginBottom:1}}>✅ {todayN} hari ini</div>}
              {prosesN>0&&<div style={{fontSize:11,color:BL,fontWeight:600,marginBottom:1}}>🔄 {prosesN} on-progress</div>}
              <button onClick={onLogout} style={{fontSize:11,color:MUTED,background:"none",border:`1px solid ${BDR}`,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontFamily:"Georgia,serif"}}>Keluar</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"18px 14px 14px"}}>
        {page==="input"&&<FormInput menu={menu} editTarget={editTarget} onSaved={()=>{onRefresh();}} onEditDone={()=>setEditTarget(null)} onEditCancel={()=>setEditTarget(null)}/>}
        {page==="laporan"&&<LaporanView records={records} onRefresh={onRefresh} menu={menu} role="staff" onEdit={r=>{if(r.status!=="approved"){setEditTarget(r);setPage("input");}}}/>}
        {page==="menu"&&(
          <div>
            <div style={CS()}>
              <div style={{fontSize:16,fontWeight:800,color:INK,marginBottom:4}}>🍽️ Daftar Menu Produksi</div>
              <div style={{fontSize:12,color:MUTED,fontStyle:"italic",marginBottom:16}}>Menu default tidak bisa dihapus.</div>
              {[...new Set(menu.map(m=>m.kat))].map(cat=>(
                <div key={cat} style={{marginBottom:18}}>
                  <div style={{fontSize:13,fontWeight:700,color:INK,marginBottom:9}}>{cat==="Kitchen"?"🍳":"🥤"} {cat} <span style={{fontSize:11,background:"#F0F0F0",color:"#888",borderRadius:20,padding:"2px 9px",fontWeight:400,marginLeft:4}}>{menu.filter(m=>m.kat===cat).length}</span></div>
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {menu.filter(m=>m.kat===cat).map(m=>(
                      <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#FFF",border:`1px solid ${BDR2}`,borderRadius:12,padding:"10px 14px"}}>
                        <div><div style={{fontSize:13,fontWeight:500,color:INK}}>{m.nama}</div>{m.custom&&<div style={{fontSize:11,color:MUTED,fontStyle:"italic"}}>Menu tambahan</div>}</div>
                        {m.custom?<button onClick={()=>delMenuFn(m.id)} style={{background:"#FFF0EE",border:"1.5px solid #FFCCCC",color:"#C02020",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>:<span style={{fontSize:10,background:"#F0F0F0",color:"#AAA",borderRadius:20,padding:"2px 9px",fontStyle:"italic"}}>default</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={CS()}>
              <div style={{fontSize:15,fontWeight:700,color:INK,marginBottom:12}}>➕ Tambah Menu Baru</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 110px",gap:9,marginBottom:10}}>
                <Inp placeholder="Nama produk baru..." value={newMenu.nama} onChange={e=>setNewMenu(n=>({...n,nama:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addMenuFn()}/>
                <Inp as="select" value={newMenu.kat} onChange={e=>setNewMenu(n=>({...n,kat:e.target.value}))}><option value="Kitchen">🍳 Kitchen</option><option value="Bar">🥤 Bar</option></Inp>
              </div>
              <button onClick={addMenuFn} disabled={!newMenu.nama.trim()||menuLoading} style={{width:"100%",padding:11,border:"none",borderRadius:11,background:newMenu.nama.trim()?`linear-gradient(135deg,${T},#E07340)`:TL,color:newMenu.nama.trim()?"#fff":TM,fontSize:14,fontFamily:"Georgia,serif",fontWeight:700,cursor:"pointer",opacity:menuLoading?.6:1}}>
                {menuLoading?"Menyimpan...":"＋ Tambah ke Daftar"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:"#FFF",borderTop:`2px solid ${BDR}`,boxShadow:"0 -3px 18px rgba(160,80,30,.09)",display:"flex"}}>
        {[["input","✏️","Input"],["laporan","📊","Laporan"],["menu","⚙️","Menu"]].map(([v,ic,lb])=>{
          const on=page===v;
          return<button key={v} onClick={()=>setPage(v)} style={{flex:1,padding:"10px 4px 8px",border:"none",background:on?"rgba(192,90,40,.05)":"none",borderTop:`3px solid ${on?T:"transparent"}`,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:20,lineHeight:1}}>{ic}</span>
            <span style={{fontSize:10,color:on?T:MUTED,fontWeight:on?700:400,fontFamily:"Georgia,serif"}}>{lb}</span>
          </button>;
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   OWNER APP
════════════════════════════════════════ */
function OwnerApp({records,menu,onLogout,onRefresh}){
  const [expFrom,setExpFrom]=useState("");
  const [expTo,setExpTo]=useState("");

  const prosesN=records.filter(r=>r.status==="proses").length;
  const selesaiN=records.filter(r=>r.status==="selesai").length;
  const todayN=records.filter(r=>r.tanggal===TODAY).length;

  const exportXLSX=()=>{
    let rows=records.filter(r=>r.status==="approved");
    if(expFrom)rows=rows.filter(r=>r.tanggal>=expFrom);
    if(expTo)rows=rows.filter(r=>r.tanggal<=expTo);
    const data=rows.map(r=>({
      "Tanggal":r.tanggal,"Nama Produk":r.menuNama,"Kategori":r.menuKat,
      "Bahan Baku":r.bahanBaku?.filter(b=>b.nama).map(b=>`${b.nama} ${b.jumlah}${b.satuan}`).join(" | ")||"",
      "Hasil (pcs)":r.hasilPcs,"Hasil (porsi)":r.hasilPorsi||"-","Catatan":r.catatan||"-","Approved":r.approvedAt||"-",
    }));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data.length?data:[{Info:"Belum ada data approved"}]),"Produksi");
    XLSX.writeFile(wb,`Piccolo_Produksi${expFrom&&expTo?`_${expFrom}_sd_${expTo}`:""}.xlsx`);
  };

  const exportCount=records.filter(r=>r.status==="approved"&&(!expFrom||r.tanggal>=expFrom)&&(!expTo||r.tanggal<=expTo)).length;

  return(
    <div style={{fontFamily:"Georgia,serif",background:"#F7F3EE",minHeight:"100vh",paddingBottom:24}}>
      <div style={{background:"linear-gradient(160deg,#FFFAF6,#FDF3E8)",borderBottom:`2px solid ${BDR}`,boxShadow:"0 2px 16px rgba(160,80,30,.09)",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:680,margin:"0 auto",padding:"13px 16px 13px"}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:42,height:42,borderRadius:13,background:`linear-gradient(135deg,${T},#E07340)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 4px 14px rgba(192,90,40,.28)",flexShrink:0}}>☕</div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,letterSpacing:3,color:T,textTransform:"uppercase"}}>Piccolo Corner · Owner</div>
              <div style={{fontSize:18,fontWeight:800,color:INK,lineHeight:1.1}}>Laporan & Approval</div>
            </div>
            <div style={{textAlign:"right"}}>
              {prosesN>0&&<div style={{fontSize:11,color:BL,fontWeight:600,marginBottom:1}}>🔄 {prosesN} on-progress</div>}
              {selesaiN>0&&<div style={{fontSize:11,color:GN,fontWeight:600,marginBottom:1}}>✅ {selesaiN} menunggu approval</div>}
              {todayN>0&&<div style={{fontSize:11,color:MUTED,marginBottom:2}}>{todayN} entri hari ini</div>}
              <div style={{display:"flex",gap:6,justifyContent:"flex-end",marginTop:3}}>
                <button onClick={onRefresh} style={{fontSize:11,color:BL,background:BLL,border:`1px solid #82AAE8`,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontFamily:"Georgia,serif",fontWeight:600}}>⟳ Refresh</button>
                <button onClick={onLogout} style={{fontSize:11,color:MUTED,background:"none",border:`1px solid ${BDR}`,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontFamily:"Georgia,serif"}}>Keluar</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"18px 14px 14px"}}>
        <div style={{background:"linear-gradient(135deg,#1A4A2E,#2A6E45)",borderRadius:20,padding:20,marginBottom:16,boxShadow:"0 5px 22px rgba(26,74,46,.22)"}}>
          <div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:3}}>📊 Export ke Accurate</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.72)",marginBottom:14,fontStyle:"italic"}}>Hanya data Approved yang diexport</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            {[["expFrom","Dari",expFrom,setExpFrom],["expTo","Sampai",expTo,setExpTo]].map(([k,lb,v,set])=>(
              <div key={k}>
                <div style={{fontSize:11,color:"rgba(255,255,255,.7)",marginBottom:5}}>📅 {lb} tanggal</div>
                <input type="date" value={v} onChange={e=>set(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,.12)",border:"1.5px solid rgba(255,255,255,.28)",borderRadius:11,padding:"10px 12px",color:"#fff",fontSize:13,fontFamily:"Georgia,serif",outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
          </div>
          <button onClick={exportXLSX} style={{width:"100%",padding:"12px 16px",border:"1.5px solid rgba(255,255,255,.3)",borderRadius:13,background:"rgba(255,255,255,.15)",color:"#fff",fontSize:14,fontFamily:"Georgia,serif",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            <span style={{fontSize:20}}>📥</span>
            <div style={{textAlign:"left"}}><div>Download Excel</div><div style={{fontSize:11,opacity:.75,fontWeight:400,fontStyle:"italic"}}>{exportCount} data approved siap diexport</div></div>
            <span style={{marginLeft:"auto",opacity:.8}}>↓ .xlsx</span>
          </button>
        </div>

        <LaporanView records={records} onRefresh={onRefresh} menu={menu} role="owner"/>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   ROOT
════════════════════════════════════════ */
export default function App(){
  const [role,setRole]=useState(null);
  const [records,setRecords]=useState([]);
  const [menu,setMenu]=useState([]);
  const [loading,setLoading]=useState(true);

  const fetchAll=async()=>{
    try{
      const [prodRes,menuRes]=await Promise.all([
        supabase.from("produksi").select("*").order("created_at",{ascending:false}),
        supabase.from("menu").select("*").order("urutan",{ascending:true}),
      ]);
      if(prodRes.data) setRecords(prodRes.data.map(fromDb));
      if(menuRes.data) setMenu(menuRes.data.map(m=>({id:m.id,kat:m.kat,nama:m.nama,custom:m.custom})));
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  };

  useEffect(()=>{
    fetchAll();

    // Realtime subscription — owner langsung lihat update dari staff
    const channel=supabase.channel("produksi_realtime")
      .on("postgres_changes",{event:"*",schema:"public",table:"produksi"},()=>{
        fetchAll();
      })
      .subscribe();

    return()=>supabase.removeChannel(channel);
  },[]);

  if(loading) return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#FFF9F4,#FDE8D0)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}}>☕</div>
        <div style={{fontSize:16,color:"#C05A28",fontStyle:"italic"}}>Menghubungkan ke server...</div>
      </div>
    </div>
  );

  if(!role) return <Login onLogin={setRole}/>;
  if(role==="owner") return <OwnerApp records={records} menu={menu} onLogout={()=>setRole(null)} onRefresh={fetchAll}/>;
  return <StaffApp records={records} menu={menu} setMenu={setMenu} onLogout={()=>setRole(null)} onRefresh={fetchAll}/>;
}
