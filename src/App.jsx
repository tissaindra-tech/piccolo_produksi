import { useState, useEffect, useMemo } from 'react'
import { supabase, generateId, formatTanggal, formatTanggalID, formatRupiah, daysFromNow } from './supabase'
import * as XLSX from 'xlsx'

// =====================================================
// PICCOLO CORNER v3 - Aplikasi Produksi & Inventory
// =====================================================
// ─── USERS — login individual per orang ───
const USERS = [
  { id: 'aya',     nama: 'Aya',     role: 'staff', divisi: 'Kitchen', pin: '1234', avatar: '🧑‍🍳' },
  { id: 'petlis',  nama: 'Petlis',  role: 'staff', divisi: 'Kitchen', pin: '2345', avatar: '👨‍🍳' },
  { id: 'vicko',   nama: 'Vicko',   role: 'staff', divisi: 'Bar',     pin: '5678', avatar: '🧑‍🍹' },
  { id: 'abel',    nama: 'Abel',    role: 'staff', divisi: 'Bar',     pin: '8901', avatar: '👤'    },
  { id: 'diandra', nama: 'Diandra', role: 'owner', divisi: 'All',     pin: '0000', avatar: '👩‍💼' },
  { id: 'tissa',   nama: 'Tissa',   role: 'owner', divisi: 'All',     pin: '0000', avatar: '👑'    },
]
const THRESHOLD_KECIL = 100000
const CLOSING_LOCK_DAYS = 4
const NOTA_EDIT_LOCK_DAYS = 30  // nota tidak bisa diedit setelah 30 hari

// Cek apakah nota masih bisa diedit
const isNotaEditable = (tanggal) => {
  const hari = Math.floor((new Date() - new Date(tanggal)) / (1000 * 60 * 60 * 24))
  return hari <= NOTA_EDIT_LOCK_DAYS
}

// Unit konversi otomatis: satuan_dasar → alt unit & rasionya
const UNIT_ALT = { 'liter': 'ml', 'kg': 'gram' }
const UNIT_RATIO = { 'liter': 1000, 'kg': 1000 } // 1 liter = 1000 ml, 1 kg = 1000 gram

const SATUAN_LIST = [
  'gram', 'kg', 'ml', 'liter', 'pcs', 'buah', 'butir',
  'sisir', 'lembar', 'ikat', 'porsi', 'gelas', 'pinch',
  'pack', 'dus', 'jirigen', 'botol', 'kotak'
]

const C = {
  bg: '#f0ede5', panel: '#fdfaf0', panel2: '#ebe6d3',
  text: '#1a1814', text2: '#3d3929', text3: '#7a7560',
  border: '#c8b58c', border2: '#a3845c',
  green: '#085041', greenBg: '#e1f5ee', greenBorder: '#5dcaa5',
  yellow: '#633806', yellowBg: '#faeeda', yellowBorder: '#ef9f27',
  red: '#791f1f', redBg: '#fcebeb', redBorder: '#f09595',
  blue: '#042c53', blueBg: '#e6f1fb', blueBorder: '#7dadeb',
  greenLight: '#3b6d11', greenLightBg: '#eaf3de', greenLightBorder: '#639922',
}

const S = {
  btn: { padding: '10px 14px', fontSize: '13px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 500 },
  btnPrimary: { background: C.text, color: C.panel },
  btnSuccess: { background: C.green, color: C.panel },
  btnDanger: { background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` },
  btnSecondary: { background: 'transparent', color: C.text2, border: `1px solid ${C.border}` },
  input: { width: '100%', padding: '9px 11px', border: `1px solid ${C.border}`, borderRadius: '7px', fontSize: '13px', background: C.panel, fontFamily: 'inherit' },
  label: { display: 'block', fontSize: '11px', color: C.text3, marginBottom: '4px', fontWeight: 500 },
  card: { background: C.panel, borderRadius: '12px', padding: '16px 18px', marginBottom: '12px' },
  badge: (color) => ({ fontSize: '10px', padding: '3px 8px', borderRadius: '99px', fontWeight: 500, display: 'inline-block', background: C[color + 'Bg'], color: C[color] }),
}

// =====================================================
// LOGIN — Pilih nama dulu, lalu PIN
// =====================================================
function Login({ onLogin }) {
  const [selectedUser, setSelectedUser] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handlePinSubmit = (e) => {
    e?.preventDefault()
    if (!selectedUser) return
    if (pin === selectedUser.pin) {
      onLogin(selectedUser.role, selectedUser.nama)
    } else {
      setError('PIN salah. Coba lagi.')
      setPin('')
    }
  }

  // Layar 1: pilih nama
  if (!selectedUser) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: C.panel, borderRadius: '16px', padding: '28px 20px', maxWidth: '380px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '36px' }}>☕</div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: C.text, margin: '8px 0 4px' }}>Piccolo Corner</h1>
            <p style={{ fontSize: '12px', color: C.text3 }}>Pilih namamu untuk masuk</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {USERS.map(u => (
              <button key={u.id} onClick={() => { setSelectedUser(u); setError(''); setPin('') }}
                style={{
                  padding: '14px 10px', cursor: 'pointer', textAlign: 'center',
                  background: u.role === 'owner' ? C.yellowBg : C.panel2,
                  border: `1.5px solid ${u.role === 'owner' ? C.yellowBorder : C.border}`,
                  borderRadius: '10px',
                }}>
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>{u.avatar}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{u.nama}</div>
                <div style={{ fontSize: '10px', color: C.text3, marginTop: '2px' }}>{u.divisi}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Layar 2: input PIN
  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: C.panel, borderRadius: '16px', padding: '32px 24px', maxWidth: '380px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <button onClick={() => { setSelectedUser(null); setPin(''); setError('') }}
          style={{ ...S.btn, ...S.btnSecondary, fontSize: '12px', marginBottom: '20px', padding: '6px 12px' }}>
          ← Ganti nama
        </button>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px' }}>{selectedUser.avatar}</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: C.text, margin: '8px 0 2px' }}>
            Halo, {selectedUser.nama}!
          </h2>
          <p style={{ fontSize: '12px', color: C.text3 }}>{selectedUser.divisi} · Masukkan PIN kamu</p>
        </div>
        <form onSubmit={handlePinSubmit}>
          <input
            type="password" value={pin}
            onChange={e => { setPin(e.target.value); setError('') }}
            placeholder="PIN"
            style={{ ...S.input, padding: '14px 16px', fontSize: '22px', textAlign: 'center', letterSpacing: '10px', marginBottom: '12px' }}
            autoFocus inputMode="numeric" maxLength={4}
          />
          {error && <div style={{ color: C.red, fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</div>}
          <button type="submit" style={{ ...S.btn, ...S.btnPrimary, width: '100%', padding: '14px' }}>Masuk</button>
        </form>
        <div style={{ marginTop: '16px', fontSize: '11px', color: C.text3, textAlign: 'center' }}>
          Hubungi Tissa jika lupa PIN
        </div>
      </div>
    </div>
  )
}

// =====================================================
// MAIN APP
// =====================================================
export default function App() {
  const [role, setRole] = useState(null)
  const [userName, setUserName] = useState('')
  const [view, setView] = useState('home')
  const [bahanBaku, setBahanBaku] = useState([])
  const [produksi, setProduksi] = useState([])
  const [belanja, setBelanja] = useState([])
  const [closing, setClosing] = useState([])
  const [waste, setWaste] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [loading, setLoading] = useState(false)  // false dulu — true hanya setelah login
  const [toast, setToast] = useState('')
  const [lazyLoaded, setLazyLoaded] = useState({})

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2400) }

  const loadDataCritical = async () => {
    setLoading(true)
    try {
      const [b, p, bl, c] = await Promise.all([
        supabase.from('bahan_baku').select('*').eq('is_active', true).order('nama'),
        supabase.from('produksi').select('*').order('created_at', { ascending: false }).limit(60),
        supabase.from('belanja').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('closing_stok').select('*').order('created_at', { ascending: false }).limit(60),
      ])
      setBahanBaku(b.data || [])
      setProduksi(p.data || [])
      setBelanja(bl.data || [])
      setClosing(c.data || [])
    } catch (err) {
      console.error('loadDataCritical error:', err)
    } finally {
      setLoading(false)  // selalu jalan, bahkan jika error
    }
  }

  const loadLazy = async (type, currentView) => {
    try {
      if (type === 'waste') {
        const { data } = await supabase.from('waste').select('*').order('created_at', { ascending: false }).limit(100)
        setWaste(data || [])
        setLazyLoaded(prev => ({ ...prev, waste: true, [currentView]: true }))
      } else if (type === 'belanja_full') {
        const { data } = await supabase.from('belanja').select('*').order('created_at', { ascending: false }).limit(200)
        setBelanja(data || [])
        setLazyLoaded(prev => ({ ...prev, historybelanja: true }))
      } else if (type === 'audit') {
        const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(30)
        setAuditLog(data || [])
        setLazyLoaded(prev => ({ ...prev, audit: true, auditlog: true, dashboard: true }))
      }
    } catch (err) { console.error('Lazy load error:', err) }
  }

  const loadData = async () => {
    await loadDataCritical()
    if (lazyLoaded.waste) {
      const { data } = await supabase.from('waste').select('*').order('created_at', { ascending: false }).limit(100)
      setWaste(data || [])
    }
    if (lazyLoaded.audit) {
      const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(30)
      setAuditLog(data || [])
    }
  }

  useEffect(() => {
    if (!role) return
    loadDataCritical()
    const channels = ['bahan_baku', 'produksi', 'belanja', 'closing_stok'].map(t =>
      supabase.channel(`ch-${t}`).on('postgres_changes', { event: '*', schema: 'public', table: t }, () => loadDataCritical()).subscribe()
    )
    return () => channels.forEach(c => supabase.removeChannel(c))
  }, [role])

  useEffect(() => {
    if (!role) return
    const lazyMap = {
      waste:          'waste',
      historybelanja: 'belanja_full',
      auditlog:       'audit',
      dashboard:      'audit',
    }
    const type = lazyMap[view]
    if (type && !lazyLoaded[view === 'dashboard' ? 'dashboard' : view]) {
      loadLazy(type, view)
    }
  }, [view, role])

  const logAudit = async (tabel, recordId, aksi, bahanId, bahanNama, detail) => {
    try {
      await supabase.from('audit_log').insert({
        id: generateId(), tabel, record_id: recordId, aksi,
        bahan_id: bahanId, bahan_nama: bahanNama,
        detail, yang_melakukan: userName || role, role_user: role,
      })
    } catch (e) { console.error(e) }
  }

  const lastClosingDate = closing[0]?.tanggal || null
  const daysSinceClosing = useMemo(() => {
    if (!lastClosingDate) return 0
    return Math.floor((new Date() - new Date(lastClosingDate)) / (1000 * 60 * 60 * 24))
  }, [lastClosingDate])

  const isLocked = daysSinceClosing >= CLOSING_LOCK_DAYS && role !== 'owner'

  if (!role) return <Login onLogin={(r, name) => { setRole(r); setUserName(name) }} />

  const props = {
    role, userName, setUserName, view, setView,
    bahanBaku, produksi, belanja, closing, waste, auditLog,
    loadData, showToast, logAudit, lazyLoaded,
    daysSinceClosing, isLocked,
    handleLogout: () => { setRole(null); setUserName(''); setView('home'); setLazyLoaded({}) }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#c9bfa8',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: C.text2,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        minHeight: '100vh',
        background: C.bg,
        boxShadow: '0 0 60px rgba(26,24,20,0.18)',
        position: 'relative',
      }}>
        {loading && <LoadingScreen />}
        <AppShell {...props} />
        {toast && <Toast msg={toast} />}
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, display: 'flex', flexDirection: 'column', zIndex: 999, padding: '0' }}>
      {/* Header skeleton */}
      <div style={{ background: '#1a1a1a', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ width: '130px', height: '14px', background: '#333', borderRadius: '6px', marginBottom: '6px' }} />
          <div style={{ width: '90px', height: '10px', background: '#2a2a2a', borderRadius: '4px' }} />
        </div>
        <div style={{ width: '72px', height: '28px', background: '#2a2a2a', borderRadius: '7px' }} />
      </div>
      {/* Tab bar skeleton */}
      <div style={{ display: 'flex', gap: '6px', padding: '10px 12px', background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
        {[60, 70, 80, 65, 75].map((w, i) => (
          <div key={i} style={{ width: `${w}px`, height: '28px', background: i === 0 ? C.panel : 'transparent', borderRadius: '6px', border: i === 0 ? 'none' : `1px solid ${C.border}` }} />
        ))}
      </div>
      {/* Content skeleton */}
      <div style={{ padding: '18px 20px', flex: 1 }}>
        {/* Checklist card skeleton */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ width: '160px', height: '14px', background: C.panel2, borderRadius: '6px' }} />
            <div style={{ width: '60px', height: '5px', background: C.panel2, borderRadius: '3px', marginTop: '5px' }} />
          </div>
          {[1,2,3].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', marginBottom: i < 3 ? '12px' : 0, borderBottom: i < 3 ? `1px solid ${C.panel2}` : 'none' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: C.panel2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: `${[140, 120, 160][i-1]}px`, height: '13px', background: C.panel2, borderRadius: '5px', marginBottom: '5px' }} />
                <div style={{ width: '100px', height: '10px', background: C.panel2, borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
        {/* Quick buttons skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '13px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '24px', height: '24px', background: C.panel2, borderRadius: '6px' }} />
              <div style={{ width: '80px', height: '11px', background: C.panel2, borderRadius: '4px' }} />
            </div>
          ))}
        </div>
        {/* Shimmer animation */}
        <style>{`
          @keyframes shimmer {
            0%{opacity:.5} 50%{opacity:.9} 100%{opacity:.5}
          }
          .skeleton-item { animation: shimmer 0.9s ease-in-out infinite; }
        `}</style>
        <div className="skeleton-item" style={{ textAlign: 'center', paddingTop: '8px' }}>
          <span style={{ fontSize: '11px', color: C.text3 }}>☕ Piccolo Corner siap sebentar...</span>
        </div>
      </div>
    </div>
  )
}

// Skeleton untuk tab yang sedang dimuat lazy
function TabSkeleton({ label }) {
  const labels = {
    waste:   'Memuat data waste...',
    belanja: 'Memuat history belanja...',
    audit:   'Memuat audit log...',
  }
  return (
    <div>
      <style>{`@keyframes shimmer{0%{opacity:.35}50%{opacity:.7}100%{opacity:.35}}.sk{animation:shimmer 1.3s ease-in-out infinite;background:var(--sk-bg,#E8E4DC);border-radius:7px;}`}</style>
      {/* 3 baris skeleton */}
      {[90, 75, 85].map((w, i) => (
        <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="sk" style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="sk" style={{ width: `${w}%`, height: '13px', marginBottom: '6px' }} />
            <div className="sk" style={{ width: '50%', height: '10px' }} />
          </div>
          <div className="sk" style={{ width: '60px', height: '13px' }} />
        </div>
      ))}
      <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: C.text3 }}>
        {labels[label] || 'Memuat...'}
      </div>
    </div>
  )
}

function Toast({ msg }) {
  return (
    <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: C.green, color: C.panel, padding: '12px 20px', borderRadius: '8px', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 1000, maxWidth: '90%' }}>{msg}</div>
  )
}

// =====================================================
// APP SHELL (Header + Tabs + Content)
// =====================================================
function AppShell(props) {
  const { role, userName, view, setView, handleLogout, daysSinceClosing, isLocked } = props

  const tabs = {
    staff: [
      { id: 'home', label: '🏠 Home' },
      { id: 'produksi', label: '📝 Produksi' },
      { id: 'histproduksi', label: '📋 Lap.Produksi' },
      { id: 'inputnota', label: '🧾 Nota' },
      { id: 'closing', label: '📋 Update Stok' },
      { id: 'stoklist', label: '📦 Stok' },
      { id: 'waste', label: '🗑️ Waste' },
      { id: 'historybelanja', label: '🛒 Belanja' },
      { id: 'resep', label: '📖 Resep' },
    ],
    owner: [
      { id: 'home', label: '🏠 Home' },
      { id: 'dashboard', label: '👑 Dashboard' },
      { id: 'resep', label: '📖 Resep' },
      { id: 'upload', label: '📤 Master' },
      { id: 'stoklist', label: '📦 Stok' },
      { id: 'auditlog', label: '📜 Audit' },
    ],
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh' }}>
      <div style={{ padding: '14px 20px', background: C.text, color: C.panel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>☕ Piccolo Corner</div>
          <div style={{ fontSize: '11px', opacity: 0.7 }}>
            {userName || (role === 'owner' ? 'Owner' : 'Staff')} · {role === 'owner' ? 'Owner' : 'Staff'} · {formatTanggalID(new Date())}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => { handleLogout() }} style={{ ...S.btn, background: 'transparent', color: C.panel, border: '1px solid rgba(255,255,255,0.25)', padding: '6px 12px', fontSize: '11px' }}>
            Ganti User
          </button>
        </div>
      </div>

      {isLocked && (
        <div style={{ background: C.redBg, padding: '10px 20px', borderBottom: `1px solid ${C.redBorder}` }}>
          <div style={{ fontSize: '12px', color: C.red, fontWeight: 500 }}>🔒 App terkunci — closing terlewat {daysSinceClosing} hari</div>
          <div style={{ fontSize: '11px', color: C.red }}>Hubungi owner atau lakukan closing untuk membuka akses</div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '10px 12px', background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
        {tabs[role].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: '7px 12px', fontSize: '11px', border: 'none',
            background: view === t.id ? C.panel : 'transparent',
            color: C.text2, borderRadius: '6px', cursor: 'pointer',
            fontWeight: view === t.id ? 600 : 400,
            boxShadow: view === t.id ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '18px 20px 32px' }}>
        {view === 'home' && <HomeView {...props} />}
        {view === 'produksi' && <ProduksiView {...props} />}
        {view === 'histproduksi' && <HistoryProduksiView {...props} />}
        {view === 'inputnota' && <InputNotaView {...props} />}
        {view === 'closing' && <ClosingView {...props} />}
        {view === 'stoklist' && <StokListView {...props} />}
        {view === 'waste' && (
          props.lazyLoaded?.waste
            ? <WasteView {...props} />
            : <TabSkeleton label="waste" />
        )}
        {view === 'historybelanja' && (
          props.lazyLoaded?.historybelanja
            ? <HistoryBelanjaView {...props} />
            : <TabSkeleton label="belanja" />
        )}
        {view === 'dashboard' && <OwnerDashboardView {...props} />}
        {view === 'upload' && <UploadMasterView {...props} />}
        {view === 'resep' && <ResepView {...props} />}
        {view === 'auditlog' && (
          props.lazyLoaded?.auditlog
            ? <AuditLogView {...props} />
            : <TabSkeleton label="audit" />
        )}
      </div>
    </div>
  )
}

// =====================================================
// HOME VIEW
// =====================================================
function HomeView(props) {
  const { role, bahanBaku, produksi, belanja, closing, daysSinceClosing, setView, userName } = props

  if (role === 'owner') return <OwnerHome {...props} />
  return <StaffHome {...props} />
}

function StaffHome({ bahanBaku, produksi, belanja, closing, daysSinceClosing, setView, userName }) {
  const today = formatTanggal()
  const totalBahan = bahanBaku.filter(b => b.is_active).length

  // Hitung update stok hari ini
  const updatedToday = new Set(closing.filter(c => c.tanggal === today).map(c => c.bahan_id))
  const stokProgress = totalBahan > 0 ? Math.round((updatedToday.size / totalBahan) * 100) : 0
  const stokSelesai = stokProgress === 100

  // Produksi hari ini
  const produksiHariIni = produksi.filter(p => p.tanggal === today)
  const produksiSelesai = produksiHariIni.length > 0

  // Nota hari ini
  const notaHariIni = belanja.filter(b => b.tanggal === today)
  const adaNota = notaHariIni.length > 0

  // Stok rendah
  const stokRendah = bahanBaku.filter(b => b.stok_saat_ini < b.stok_minimum && b.is_active)

  // Aktivitas hari ini untuk feed — gabung produksi + belanja + closing, urutkan terbaru
  const activities = [
    ...produksiHariIni.map(p => ({
      id: p.id, type: 'produksi', who: p.yang_masak,
      text: `input produksi — ${p.menu_nama} ${p.hasil_pcs} pcs`,
      time: p.created_at,
    })),
    ...notaHariIni.map(b => ({
      id: b.id, type: 'nota', who: b.yang_belanja,
      text: `catat nota — ${b.items?.map(i => i.nama).join(', ').slice(0, 40)}`,
      time: b.created_at,
    })),
    ...(() => {
      // 1 entry per staff yang sudah update stok hari ini
      const staffMap = {}
      closing.filter(c => c.tanggal === today).forEach(c => {
        if (!staffMap[c.yang_closing]) staffMap[c.yang_closing] = { count: 0, time: c.created_at }
        staffMap[c.yang_closing].count++
        if (c.created_at > staffMap[c.yang_closing].time) staffMap[c.yang_closing].time = c.created_at
      })
      return Object.entries(staffMap).map(([who, v]) => ({
        id: 'stok-' + who, type: 'stok', who,
        text: `update stok — ${v.count} item`,
        time: v.time,
      }))
    })(),
  ].sort((a, b) => (b.time || '').localeCompare(a.time || '')).slice(0, 6)

  const misiDone = (produksiSelesai ? 1 : 0) + (stokSelesai ? 1 : 0) + (adaNota ? 1 : 0)
  const misiPct  = Math.round((misiDone / 3) * 100)

  const avatarInitial = (name) => (name || '?').slice(0, 2).toUpperCase()
  const avatarColor = (name) => {
    const colors = [
      { bg: '#9FE1CB', fg: '#085041' }, { bg: '#B5D4F4', fg: '#0C447C' },
      { bg: '#CECBF6', fg: '#3C3489' }, { bg: '#FAC775', fg: '#633806' },
    ]
    return colors[(name || '').charCodeAt(0) % colors.length]
  }
  const fmtTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      {/* Lock warning */}
      {daysSinceClosing >= 3 && (
        <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, color: C.red, padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
          🔒 <strong>Stok belum diupdate {daysSinceClosing} hari!</strong> Segera update sebelum app terkunci.
        </div>
      )}

      {/* Misi Harian Card */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>

        {/* Header misi */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>
            {misiDone === 3 ? '🎉 Semua misi selesai!' : `📋 Misi harian — ${misiDone}/3`}
          </div>
          {/* Progress bar keseluruhan */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '64px', height: '5px', background: C.panel2, borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ width: `${misiPct}%`, height: '100%', background: misiDone === 3 ? C.green : C.yellow, borderRadius: '99px', transition: 'width 0.4s' }} />
            </div>
            <span style={{ fontSize: '11px', color: C.text3 }}>{misiPct}%</span>
          </div>
        </div>

        {/* Task 1 — Produksi */}
        <div onClick={() => setView('produksi')} style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0',
          borderBottom: `1px solid ${C.panel2}`, cursor: 'pointer',
        }}>
          <div style={{
            width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
            background: produksiSelesai ? C.green : 'transparent',
            border: `2px solid ${produksiSelesai ? C.green : C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {produksiSelesai && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: produksiSelesai ? C.text3 : C.text, textDecoration: produksiSelesai ? 'line-through' : 'none' }}>
              Input produksi pagi
            </div>
            {produksiSelesai ? (
              <div style={{ fontSize: '11px', color: C.green, marginTop: '1px' }}>
                ✓ {produksiHariIni.length} batch · oleh {produksiHariIni.map(p => p.yang_masak).filter((v,i,a) => a.indexOf(v)===i).join(', ')}
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: C.text3, marginTop: '1px' }}>Belum ada input hari ini</div>
            )}
          </div>
          <span style={{ fontSize: '11px', color: C.text3 }}>→</span>
        </div>

        {/* Task 2 — Update Stok dengan mini progress */}
        <div onClick={() => setView('closing')} style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0',
          borderBottom: `1px solid ${C.panel2}`, cursor: 'pointer',
        }}>
          <div style={{
            width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
            background: stokSelesai ? C.green : 'transparent',
            border: `2px solid ${stokSelesai ? C.green : (updatedToday.size > 0 ? C.yellowBorder : C.border)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {stokSelesai && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: stokSelesai ? C.text3 : C.text, textDecoration: stokSelesai ? 'line-through' : 'none' }}>
              Update stok harian
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <div style={{ flex: 1, height: '3px', background: C.panel2, borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ width: `${stokProgress}%`, height: '100%', background: stokSelesai ? C.green : C.yellowBorder, borderRadius: '99px' }} />
              </div>
              <span style={{ fontSize: '11px', color: stokSelesai ? C.green : C.text3, whiteSpace: 'nowrap' }}>
                {updatedToday.size} / {totalBahan}
              </span>
            </div>
            {!stokSelesai && updatedToday.size === 0 && (
              <div style={{ fontSize: '11px', color: C.yellow, marginTop: '2px' }}>⏰ Deadline jam 19:00</div>
            )}
          </div>
          <span style={{ fontSize: '11px', color: C.text3 }}>→</span>
        </div>

        {/* Task 3 — Nota */}
        <div onClick={() => setView('inputnota')} style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0 0',
          cursor: 'pointer',
        }}>
          <div style={{
            width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
            background: adaNota ? C.green : 'transparent',
            border: `2px solid ${adaNota ? C.green : C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {adaNota && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: adaNota ? C.text3 : C.text, textDecoration: adaNota ? 'line-through' : 'none' }}>
              Ada barang masuk? Catat nota
            </div>
            {adaNota ? (
              <div style={{ fontSize: '11px', color: C.green, marginTop: '1px' }}>
                ✓ {notaHariIni.length} nota hari ini · {formatRupiah(notaHariIni.reduce((s, b) => s + (b.total_harga || 0), 0))}
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: C.text3, marginTop: '1px' }}>Belum ada input hari ini</div>
            )}
          </div>
          <span style={{ fontSize: '11px', color: C.text3 }}>→</span>
        </div>
      </div>

      {/* Alert stok rendah */}
      {stokRendah.length > 0 && (
        <div onClick={() => setView('stoklist')} style={{
          background: C.redBg, border: `1px solid ${C.redBorder}`,
          borderRadius: '8px', padding: '10px 12px', marginBottom: '12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
        }}>
          <span style={{ fontSize: '12px', color: C.red }}>
            🔴 <strong>{stokRendah.length} bahan stok rendah</strong> — perlu segera dibeli
          </span>
          <span style={{ fontSize: '11px', color: C.red }}>Lihat →</span>
        </div>
      )}

      {/* Aksi cepat */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        <button onClick={() => setView('closing')} style={{
          padding: '13px 10px', fontSize: '12px', fontWeight: 600, textAlign: 'center',
          background: C.blueBg, color: C.blue, border: `1.5px solid ${C.blueBorder}`,
          borderRadius: '10px', cursor: 'pointer', lineHeight: 1.3,
        }}>
          <div style={{ fontSize: '18px', marginBottom: '3px' }}>📋</div>
          Lanjut update stok
        </button>
        <button onClick={() => setView('produksi')} style={{
          padding: '13px 10px', fontSize: '12px', fontWeight: 600, textAlign: 'center',
          background: C.greenBg, color: C.green, border: `1.5px solid ${C.greenBorder}`,
          borderRadius: '10px', cursor: 'pointer', lineHeight: 1.3,
        }}>
          <div style={{ fontSize: '18px', marginBottom: '3px' }}>📝</div>
          Input produksi
        </button>
        <button onClick={() => setView('inputnota')} style={{
          padding: '13px 10px', fontSize: '12px', fontWeight: 600, textAlign: 'center',
          background: C.yellowBg, color: C.yellow, border: `1.5px solid ${C.yellowBorder}`,
          borderRadius: '10px', cursor: 'pointer', lineHeight: 1.3,
        }}>
          <div style={{ fontSize: '18px', marginBottom: '3px' }}>🧾</div>
          Input nota belanja
        </button>
        <button onClick={() => setView('waste')} style={{
          padding: '13px 10px', fontSize: '12px', fontWeight: 600, textAlign: 'center',
          background: C.redBg, color: C.red, border: `1.5px solid ${C.redBorder}`,
          borderRadius: '10px', cursor: 'pointer', lineHeight: 1.3,
        }}>
          <div style={{ fontSize: '18px', marginBottom: '3px' }}>🗑️</div>
          Catat waste
        </button>
      </div>

      {/* Activity feed — siapa sudah ngapain hari ini */}
      {activities.length > 0 && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: C.text3, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Aktivitas hari ini
          </div>
          {activities.map(a => {
            const av = avatarColor(a.who)
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', paddingBottom: '9px', marginBottom: '9px', borderBottom: `1px solid ${C.panel2}` }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  background: av.bg, color: av.fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 600,
                }}>
                  {avatarInitial(a.who)}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{a.who || '-'}</span>
                  <span style={{ fontSize: '12px', color: C.text2 }}> {a.text}</span>
                  <div style={{ fontSize: '10px', color: C.text3, marginTop: '1px' }}>{fmtTime(a.time)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activities.length === 0 && (
        <div style={{ background: C.panel2, borderRadius: '8px', padding: '16px', textAlign: 'center', fontSize: '12px', color: C.text3 }}>
          Belum ada aktivitas hari ini — jadilah yang pertama! 💪
        </div>
      )}
    </div>
  )
}

function BigBtn({ color, icon, label, onClick }) {
  const styles = {
    green: { bg: C.greenBg, fg: C.green, border: C.greenBorder },
    yellow: { bg: C.yellowBg, fg: C.yellow, border: C.yellowBorder },
    blue: { bg: C.blueBg, fg: C.blue, border: C.blueBorder },
    red: { bg: C.redBg, fg: C.red, border: C.redBorder },
    default: { bg: C.panel2, fg: C.text2, border: C.border },
  }[color]

  return (
    <button onClick={onClick} style={{
      padding: '16px 10px', fontSize: '13px', fontWeight: 600,
      background: styles.bg, color: styles.fg, border: `1.5px solid ${styles.border}`,
      borderRadius: '10px', cursor: 'pointer', textAlign: 'center', lineHeight: 1.3,
    }}>
      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
      {label}
    </button>
  )
}

function OwnerHome(props) {
  const { bahanBaku, produksi, belanja, setView } = props
  const [showStokLow, setShowStokLow] = useState(false)
  const stokRendah = bahanBaku.filter(b => b.stok_saat_ini < b.stok_minimum)
  const expiring = bahanBaku.filter(b => {
    const d = daysFromNow(b.expired_terdekat)
    return d !== null && d <= 2 && d >= 0
  })
  const totalProduksiHariIni = produksi.filter(p => p.tanggal === formatTanggal()).length
  const totalBelanjaHariIni = belanja.filter(b => b.tanggal === formatTanggal()).length

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '14px' }}>
        <StatCard color="default" label="Produksi" value={totalProduksiHariIni} onClick={() => setView('dashboard')} />
        <StatCard color="blue" label="Belanja" value={totalBelanjaHariIni} onClick={() => setView('dashboard')} />
        <StatCard color="red" label="Stok Low" value={stokRendah.length} onClick={() => setShowStokLow(true)} />
        <StatCard color="red" label="Expiring" value={expiring.length} />
      </div>

      {showStokLow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowStokLow(false)}>
          <div style={{ background: C.panel, borderRadius: '16px 16px 0 0', padding: '20px', width: '100%', maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>🔴 Stok Rendah</div>
                <div style={{ fontSize: '11px', color: C.text3 }}>{stokRendah.length} bahan di bawah minimum</div>
              </div>
              <button onClick={() => setShowStokLow(false)}
                style={{ ...S.btn, ...S.btnSecondary, fontSize: '12px', padding: '6px 12px' }}>Tutup</button>
            </div>
            {stokRendah.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: C.text3 }}>✅ Semua stok aman</div>
            ) : (
              stokRendah.sort((a, b) => (a.stok_saat_ini / a.stok_minimum) - (b.stok_saat_ini / b.stok_minimum))
                .map(b => {
                  const pct = b.stok_minimum > 0 ? Math.round((b.stok_saat_ini / b.stok_minimum) * 100) : 0
                  return (
                    <div key={b.id} style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.nama}</div>
                          <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>
                            {b.kategori} · {b.divisi}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '10px' }}>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: C.red }}>{b.stok_saat_ini} {b.satuan_dasar}</div>
                          <div style={{ fontSize: '10px', color: C.text3 }}>min {b.stok_minimum} {b.satuan_dasar}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: '8px', background: C.redBorder, borderRadius: '99px', height: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: C.red, borderRadius: '99px' }} />
                      </div>
                      <div style={{ fontSize: '10px', color: C.red, marginTop: '3px' }}>{pct}% dari minimum</div>
                    </div>
                  )
                })
            )}
            <button onClick={() => { setShowStokLow(false); setView('stoklist') }}
              style={{ ...S.btn, ...S.btnPrimary, width: '100%', padding: '11px', marginTop: '8px', fontSize: '12px' }}>
              📦 Buka Daftar Stok Lengkap
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize: '12px', color: C.text3, marginBottom: '8px', fontWeight: 500 }}>⚡ Yang perlu kamu cek:</div>
      {stokRendah.slice(0, 3).map(b => (
        <div key={b.id} style={{ background: C.redBg, borderLeft: `3px solid ${C.redBorder}`, padding: '11px 12px', borderRadius: '8px', marginBottom: '6px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.nama} stok rendah</div>
          <div style={{ fontSize: '11px', color: C.red, marginTop: '2px' }}>{b.stok_saat_ini} {b.satuan_dasar} (min {b.stok_minimum})</div>
        </div>
      ))}
      {stokRendah.length > 3 && (
        <div onClick={() => setShowStokLow(true)} style={{ fontSize: '12px', color: C.red, textAlign: 'center', cursor: 'pointer', padding: '6px', marginBottom: '6px' }}>
          +{stokRendah.length - 3} bahan lainnya → tap untuk lihat semua
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
        <BigBtn color="default" icon="👑" label="Dashboard Lengkap" onClick={() => setView('dashboard')} />
        <BigBtn color="blue" icon="📤" label="Upload Master" onClick={() => setView('upload')} />
      </div>
    </div>
  )
}

function StatCard({ color, label, value, onClick }) {
  const colorMap = {
    default: { bg: C.panel2, fg: C.text3 },
    blue: { bg: C.blueBg, fg: C.blue },
    yellow: { bg: C.yellowBg, fg: C.yellow },
    red: { bg: C.redBg, fg: C.red },
    green: { bg: C.greenLightBg, fg: C.greenLight },
  }
  const clr = colorMap[color]
  return (
    <div onClick={onClick} style={{
      padding: '10px 8px', background: clr.bg, borderRadius: '8px',
      cursor: onClick ? 'pointer' : 'default',
      border: onClick ? `1px solid ${clr.fg}33` : 'none',
    }}>
      <div style={{ fontSize: '10px', color: clr.fg }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px', color: clr.fg }}>{value}</div>
      {onClick && <div style={{ fontSize: '9px', color: clr.fg, opacity: 0.7, marginTop: '1px' }}>tap →</div>}
    </div>
  )
}

// =====================================================
// PRODUKSI VIEW
// =====================================================
// SEARCHABLE SELECT COMPONENT
// =====================================================
function SearchableSelect({ options, value, onChange, placeholder, showStock = false }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find(o => String(o.value) === String(value))

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const handleSelect = (val) => { onChange(val); setOpen(false); setSearch('') }
  const handleFocus = () => { setOpen(true); setSearch('') }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={open ? search : (selected ? selected.label : '')}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={placeholder || 'Ketik untuk cari...'}
        style={{ ...S.input, cursor: 'pointer' }}
        autoComplete="off"
      />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: '8px',
          maxHeight: '200px', overflowY: 'auto', zIndex: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: '12px', fontSize: '12px', color: C.text3, textAlign: 'center' }}>Tidak ditemukan</div>
          )}
          {filtered.map(o => (
            <div key={o.value} onMouseDown={() => handleSelect(o.value)} style={{
              padding: '10px 12px', cursor: 'pointer', fontSize: '13px',
              borderBottom: `1px solid ${C.panel2}`,
              background: String(o.value) === String(value) ? C.panel2 : 'transparent',
            }}>
              <div style={{ fontWeight: String(o.value) === String(value) ? 600 : 400 }}>{o.label}</div>
              {showStock && o.stock != null && (
                <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>
                  Stok: {o.stock} {o.satuan}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =====================================================
// PRODUKSI VIEW — Mentah → Prepack
// =====================================================
function ProduksiView({ bahanBaku, showToast, loadData, logAudit, setView, userName, setUserName, isLocked }) {
  const [tanggal, setTanggal] = useState(formatTanggal())
  const [divisi, setDivisi] = useState('Kitchen')
  const [menuId, setMenuId] = useState('')
  const [bahanList, setBahanList] = useState([{ bahan_id: '', jumlah: '', satuan: '', inputUnit: '' }])
  const [hasilSatuan, setHasilSatuan] = useState('')
  const [hasilPorsi, setHasilPorsi] = useState('')
  const [status, setStatus] = useState('selesai')
  const [yangMasak, setYangMasak] = useState(userName)
  const [catatan, setCatatan] = useState('')
  const [foto, setFoto] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const menuOptions = bahanBaku.filter(b =>
    b.kategori === 'prepack' && (b.divisi === divisi || b.divisi === 'Both') && b.is_active
  ).map(b => ({ value: b.id, label: b.nama }))

  const bahanOptions = bahanBaku.filter(b => b.kategori === 'mentah' && b.is_active)
    .map(b => ({ value: b.id, label: b.nama, stock: b.stok_saat_ini, satuan: b.satuan_dasar }))

  const selectedMenu = bahanBaku.find(b => b.id == menuId)
  const satuanMenu = selectedMenu?.satuan_dasar || ''
  const isSimple = satuanMenu === 'porsi' || satuanMenu === 'gelas' || !selectedMenu

  // COGS calculation preview
  const cogsTotal = bahanList.reduce((sum, b) => {
    if (!b.bahan_id || !b.jumlah) return sum
    const ba = bahanBaku.find(x => x.id == b.bahan_id)
    if (!ba) return sum
    let jumlahSD = Number(b.jumlah) || 0
    const inputU = b.inputUnit || ba.satuan_dasar
    if (inputU && ba.satuan_dasar && inputU !== ba.satuan_dasar) {
      if (UNIT_ALT[ba.satuan_dasar] === inputU) jumlahSD = jumlahSD / UNIT_RATIO[ba.satuan_dasar]
      else if (UNIT_ALT[inputU] === ba.satuan_dasar) jumlahSD = jumlahSD * UNIT_RATIO[inputU]
    }
    return sum + jumlahSD * (ba.harga_per_satuan || 0)
  }, 0)
  const cogsPorsi = isSimple
    ? (hasilSatuan > 0 ? cogsTotal / Number(hasilSatuan) : 0)
    : (hasilPorsi > 0 ? cogsTotal / Number(hasilPorsi) : 0)

  const handleDivisiChange = (val) => { setDivisi(val); setMenuId('') }

  const updateBahan = (idx, field, val) => {
    const newList = [...bahanList]
    newList[idx][field] = val
    if (field === 'bahan_id') {
      const b = bahanBaku.find(x => x.id == val)
      newList[idx].satuan = b ? b.satuan_dasar : ''
      newList[idx].inputUnit = b ? b.satuan_dasar : '' // default ke satuan_dasar
    }
    setBahanList(newList)
  }

  const addBahan = () => setBahanList([...bahanList, { bahan_id: '', jumlah: '', satuan: '', inputUnit: '' }])
  const removeBahan = (idx) => setBahanList(bahanList.filter((_, i) => i !== idx))

  const handleFoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { showToast('❌ Foto max 3MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setFoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!menuId) { showToast('❌ Pilih produk yang dibuat'); return }
    if (!hasilSatuan || Number(hasilSatuan) <= 0) { showToast('❌ Isi jumlah hasil produksi'); return }
    if (!isSimple && (!hasilPorsi || Number(hasilPorsi) <= 0)) { showToast('❌ Isi jumlah porsi'); return }
    if (!yangMasak.trim()) { showToast('❌ Isi nama yang masak/prep'); return }
    const validBahan = bahanList.filter(b => b.bahan_id && b.jumlah)
    if (validBahan.length === 0) { showToast('❌ Minimal 1 bahan mentah'); return }

    setSubmitting(true)
    setUserName(yangMasak)
    try {
      const menu = bahanBaku.find(b => b.id == menuId)
      const finalHasilSatuan = Number(hasilSatuan)
      const finalHasilPorsi = isSimple ? finalHasilSatuan : Number(hasilPorsi)

      const bahanWithCOGS = validBahan.map(b => {
        const ba = bahanBaku.find(x => x.id == b.bahan_id)
        // Konversi jumlah ke satuan_dasar jika user input dalam alt unit
        let jumlahSatuanDasar = Number(b.jumlah) || 0
        const inputU = b.inputUnit || ba?.satuan_dasar
        if (inputU && ba?.satuan_dasar && inputU !== ba.satuan_dasar) {
          // misal: inputUnit=ml, satuan_dasar=liter → jumlah / 1000
          if (UNIT_ALT[ba.satuan_dasar] === inputU) {
            jumlahSatuanDasar = jumlahSatuanDasar / UNIT_RATIO[ba.satuan_dasar]
          } else if (UNIT_ALT[inputU] === ba.satuan_dasar) {
            jumlahSatuanDasar = jumlahSatuanDasar * UNIT_RATIO[inputU]
          }
        }
        const cogs_bahan = jumlahSatuanDasar * (ba?.harga_per_satuan || 0)
        return {
          bahan_id: ba.id, nama: ba.nama,
          jumlah: Number(b.jumlah), jumlah_satuan_dasar: jumlahSatuanDasar,
          satuan_input: inputU, satuan: ba?.satuan_dasar,
          harga_per_satuan: ba?.harga_per_satuan || 0, cogs_bahan
        }
      })
      const total_cogs = bahanWithCOGS.reduce((sum, b) => sum + b.cogs_bahan, 0)
      const cogs_per_porsi = finalHasilPorsi > 0 ? total_cogs / finalHasilPorsi : 0

      const newId = generateId()
      await supabase.from('produksi').insert({
        id: newId, tanggal,
        menu_id: menu.id, menu_nama: menu.nama, menu_kategori: divisi,
        bahan_baku: bahanWithCOGS,
        hasil_pcs: finalHasilSatuan, hasil_porsi: finalHasilPorsi,
        total_cogs, cogs_per_porsi,
        foto, status, yang_masak: yangMasak, catatan,
      })

      for (const b of bahanWithCOGS) {
        const ba = bahanBaku.find(x => x.id === b.bahan_id)
        if (ba) await supabase.from('bahan_baku').update({
          stok_saat_ini: Math.max(0, ba.stok_saat_ini - b.jumlah_satuan_dasar)
        }).eq('id', ba.id)
      }

      if (status === 'selesai') {
        await supabase.from('bahan_baku').update({
          stok_saat_ini: (menu.stok_saat_ini || 0) + finalHasilSatuan
        }).eq('id', menu.id)
      }

      await logAudit('produksi', newId, 'create', menu.id, menu.nama, { total_cogs, cogs_per_porsi, hasil: finalHasilSatuan })
      showToast(`✅ ${menu.nama} +${finalHasilSatuan} ${menu.satuan_dasar} · COGS ${formatRupiah(total_cogs)}`)
      loadData()
      setView('histproduksi')
    } catch (e) { showToast('❌ ' + e.message) }
    setSubmitting(false)
  }

  if (isLocked) return <LockedScreen />

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>📝 Input Produksi</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>Mentah → Prepack · stok & COGS otomatis</p>

      <FormRow label="Tanggal">
        <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} style={S.input} />
      </FormRow>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <FormRow label="Divisi">
          <select value={divisi} onChange={e => handleDivisiChange(e.target.value)} style={S.input}>
            <option value="Kitchen">Kitchen</option>
            <option value="Bar">Bar</option>
          </select>
        </FormRow>
        <FormRow label="Produk yang dibuat">
          <SearchableSelect
            options={menuOptions}
            value={menuId}
            onChange={setMenuId}
            placeholder="Cari prepack..."
          />
        </FormRow>
      </div>

      {menuOptions.length === 0 && (
        <div style={{ background: C.yellowBg, padding: '10px 12px', borderRadius: '7px', fontSize: '12px', color: C.yellow, marginBottom: '12px' }}>
          ⚠️ Belum ada prepack untuk divisi {divisi}. Tambah di master (kategori = prepack).
        </div>
      )}

      <hr style={{ border: 'none', borderTop: `1px solid ${C.panel2}`, margin: '14px 0' }} />
      <div style={{ fontSize: '12px', color: C.text3, fontWeight: 500, marginBottom: '8px' }}>🥬 Bahan mentah dipakai:</div>

      {bahanList.map((b, idx) => {
        const ba = bahanBaku.find(x => x.id == b.bahan_id)
        const altUnit = ba?.satuan_dasar ? UNIT_ALT[ba.satuan_dasar] : null
        const currentUnit = b.inputUnit || ba?.satuan_dasar || ''
        return (
          <div key={idx} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px auto auto', gap: '6px', alignItems: 'end' }}>
              <SearchableSelect
                options={bahanOptions} value={b.bahan_id}
                onChange={val => updateBahan(idx, 'bahan_id', val)}
                placeholder="Cari bahan mentah..." showStock={true}
              />
              <input type="number" placeholder="Qty" value={b.jumlah}
                onChange={e => updateBahan(idx, 'jumlah', e.target.value)} style={S.input} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '11px', color: C.text3 }}>Satuan</span>
                {altUnit ? (
                  <div style={{ display: 'flex', borderRadius: '6px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    {[ba.satuan_dasar, altUnit].map(u => (
                      <button key={u} onClick={() => updateBahan(idx, 'inputUnit', u)} style={{
                        flex: 1, padding: '8px 4px', fontSize: '10px', border: 'none', cursor: 'pointer',
                        background: currentUnit === u ? C.text : 'transparent',
                        color: currentUnit === u ? C.panel : C.text2, fontWeight: currentUnit === u ? 600 : 400,
                      }}>{u}</button>
                    ))}
                  </div>
                ) : (
                  <input type="text" value={b.satuan} readOnly
                    style={{ ...S.input, background: C.panel2, fontSize: '11px' }} />
                )}
              </div>
              <button onClick={() => removeBahan(idx)} style={{ ...S.btn, ...S.btnDanger, padding: '9px 8px', alignSelf: 'flex-end' }}>✕</button>
            </div>
            {ba && b.jumlah && altUnit && currentUnit !== ba.satuan_dasar && (
              <div style={{ fontSize: '11px', color: C.text3, marginTop: '4px', paddingLeft: '2px' }}>
                = {currentUnit === altUnit
                    ? `${(Number(b.jumlah) / UNIT_RATIO[ba.satuan_dasar]).toFixed(3)} ${ba.satuan_dasar}`
                    : `${(Number(b.jumlah) * UNIT_RATIO[currentUnit]).toFixed(0)} ${altUnit}`
                  } (satuan dasar)
              </div>
            )}
          </div>
        )
      })}

      <button onClick={addBahan} style={{ ...S.btn, background: 'transparent', border: `1px dashed ${C.border}`, color: C.text2, width: '100%', marginBottom: '12px' }}>
        + Tambah bahan
      </button>

      {cogsTotal > 0 && (
        <div style={{ background: C.greenBg, padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' }}>
          <strong style={{ color: C.green }}>💰 Estimasi COGS: {formatRupiah(cogsTotal)}</strong>
          {cogsPorsi > 0 && <span style={{ color: C.text3 }}> · {formatRupiah(Math.round(cogsPorsi))}/porsi</span>}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: `1px solid ${C.panel2}`, margin: '14px 0' }} />
      <div style={{ fontSize: '12px', color: C.text3, fontWeight: 500, marginBottom: '8px' }}>📦 Hasil produksi:</div>

      {!selectedMenu ? (
        <div style={{ background: C.panel2, padding: '12px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px', color: C.text3, textAlign: 'center' }}>
          Pilih produk yang dibuat dulu
        </div>
      ) : isSimple ? (
        <div style={{ background: C.panel2, padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="number" placeholder="0" value={hasilSatuan} onChange={e => setHasilSatuan(e.target.value)}
              style={{ ...S.input, width: '100px', textAlign: 'center', fontSize: '16px', fontWeight: 600 }} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{satuanMenu}</span>
          </div>
          <p style={{ fontSize: '11px', color: C.text3, marginTop: '6px', marginBottom: 0 }}>
            Stok {selectedMenu.nama} bertambah {hasilSatuan || '...'} {satuanMenu}
          </p>
        </div>
      ) : (
        <div style={{ background: C.panel2, padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input type="number" placeholder="0" value={hasilSatuan} onChange={e => setHasilSatuan(e.target.value)}
              style={{ ...S.input, width: '80px', textAlign: 'center', fontSize: '15px', fontWeight: 600 }} />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>{satuanMenu}</span>
            <span style={{ fontSize: '13px', color: C.text3 }}>=</span>
            <input type="number" placeholder="0" value={hasilPorsi} onChange={e => setHasilPorsi(e.target.value)}
              style={{ ...S.input, width: '80px', textAlign: 'center', fontSize: '15px', fontWeight: 600 }} />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>porsi</span>
          </div>
          <p style={{ fontSize: '11px', color: C.text3, marginTop: '6px', marginBottom: 0 }}>
            Stok {selectedMenu.nama} bertambah {hasilSatuan || '...'} {satuanMenu}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <FormRow label="Status">
          <select value={status} onChange={e => setStatus(e.target.value)} style={S.input}>
            <option value="proses">🔄 Proses</option>
            <option value="selesai">✅ Selesai</option>
          </select>
        </FormRow>
        <FormRow label="Yang masak/prep">
          <input type="text" value={yangMasak} onChange={e => setYangMasak(e.target.value)} placeholder="Nama..." style={S.input} />
        </FormRow>
      </div>

      <FormRow label={status === 'selesai' ? 'Foto hasil (opsional)' : 'Foto progress (opsional)'}>
        <input type="file" accept="image/*" onChange={handleFoto} style={{ ...S.input, padding: '8px' }} />
        {foto && <img src={foto} alt="foto" style={{ maxWidth: '160px', marginTop: '8px', borderRadius: '8px' }} />}
      </FormRow>

      <FormRow label="Catatan">
        <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} style={S.input} />
      </FormRow>

      <button onClick={handleSubmit} disabled={submitting} style={{ ...S.btn, ...S.btnPrimary, width: '100%', padding: '13px', opacity: submitting ? 0.6 : 1 }}>
        {submitting ? 'Menyimpan...' : '💾 Simpan Produksi'}
      </button>
    </div>
  )
}

function FormRow({ label, children }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  )
}

function LockedScreen() {
  return (
    <div style={{ background: C.redBg, padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '8px' }}>🔒</div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: C.red }}>App Terkunci</div>
      <div style={{ fontSize: '12px', color: C.red, marginTop: '4px' }}>Lakukan closing stok untuk membuka akses</div>
    </div>
  )
}

// =====================================================
// HISTORY PRODUKSI VIEW (read-only + COGS detail)
// =====================================================
function HistoryProduksiView({ produksi, bahanBaku, showToast, loadData, logAudit, userName }) {
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState('view') // 'view' | 'edit'
  const [filterDiv, setFilterDiv] = useState('all')
  const [submitting, setSubmitting] = useState(false)

  // Edit state
  const [editTanggal, setEditTanggal] = useState('')
  const [editBahanList, setEditBahanList] = useState([])
  const [editHasilSatuan, setEditHasilSatuan] = useState('')
  const [editHasilPorsi, setEditHasilPorsi] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editYangMasak, setEditYangMasak] = useState('')
  const [editCatatan, setEditCatatan] = useState('')
  const [editFoto, setEditFoto] = useState('')

  const filtered = produksi.filter(p => filterDiv === 'all' || p.menu_kategori === filterDiv)
  const totalCOGS = filtered.reduce((s, p) => s + (p.total_cogs || 0), 0)

  const startEdit = (p) => {
    const bahanArr = Array.isArray(p.bahan_baku) ? p.bahan_baku : []
    setEditTanggal(p.tanggal || formatTanggal())
    setEditBahanList(bahanArr.map(b => ({
      bahan_id: b.bahan_id, jumlah: b.jumlah, satuan: b.satuan, inputUnit: b.satuan_input || b.satuan
    })))
    setEditHasilSatuan(p.hasil_pcs || '')
    setEditHasilPorsi(p.hasil_porsi || '')
    setEditStatus(p.status || 'proses')
    setEditYangMasak(p.yang_masak || userName)
    setEditCatatan(p.catatan || '')
    setEditFoto(p.foto || '')
    setMode('edit')
  }

  const handleFotoEdit = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { showToast('❌ Foto max 3MB'); return }
    const reader = new FileReader()
    reader.onload = ev => setEditFoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSaveEdit = async () => {
    if (!editYangMasak.trim()) { showToast('❌ Isi nama yang masak'); return }
    const validBahan = editBahanList.filter(b => b.bahan_id && b.jumlah)
    if (validBahan.length === 0) { showToast('❌ Minimal 1 bahan'); return }
    if (!editHasilSatuan || Number(editHasilSatuan) <= 0) { showToast('❌ Isi hasil produksi'); return }

    setSubmitting(true)
    const p = selected
    try {
      const bahanWithCOGS = validBahan.map(b => {
        const ba = bahanBaku.find(x => x.id == b.bahan_id)
        let jumlahSD = Number(b.jumlah) || 0
        const inputU = b.inputUnit || ba?.satuan_dasar
        if (inputU && ba?.satuan_dasar && inputU !== ba.satuan_dasar) {
          if (UNIT_ALT[ba.satuan_dasar] === inputU) jumlahSD = jumlahSD / UNIT_RATIO[ba.satuan_dasar]
          else if (UNIT_ALT[inputU] === ba.satuan_dasar) jumlahSD = jumlahSD * UNIT_RATIO[inputU]
        }
        const cogs_bahan = jumlahSD * (ba?.harga_per_satuan || 0)
        return { bahan_id: ba?.id, nama: ba?.nama, jumlah: Number(b.jumlah), jumlah_satuan_dasar: jumlahSD, satuan_input: inputU, satuan: ba?.satuan_dasar, harga_per_satuan: ba?.harga_per_satuan || 0, cogs_bahan }
      })
      const total_cogs = bahanWithCOGS.reduce((s, b) => s + b.cogs_bahan, 0)
      const hasilPorsiNum = (editStatus !== 'selesai' || !editHasilPorsi) ? Number(editHasilSatuan) : Number(editHasilPorsi)
      const cogs_per_porsi = hasilPorsiNum > 0 ? total_cogs / hasilPorsiNum : 0

      // Kalau status berubah dari proses → selesai, terapkan perubahan stok sekarang
      const wasProses = p.status === 'proses'
      const nowSelesai = editStatus === 'selesai'

      await supabase.from('produksi').update({
        tanggal: editTanggal, bahan_baku: bahanWithCOGS,
        hasil_pcs: Number(editHasilSatuan), hasil_porsi: hasilPorsiNum,
        total_cogs, cogs_per_porsi, status: editStatus,
        yang_masak: editYangMasak, catatan: editCatatan,
        foto: editFoto || p.foto,
      }).eq('id', p.id)

      if (wasProses && nowSelesai) {
        // Kurangi stok bahan mentah
        const oldBahan = Array.isArray(p.bahan_baku) ? p.bahan_baku : []
        for (const b of bahanWithCOGS) {
          const ba = bahanBaku.find(x => x.id === b.bahan_id)
          if (ba) await supabase.from('bahan_baku').update({
            stok_saat_ini: Math.max(0, ba.stok_saat_ini - b.jumlah_satuan_dasar)
          }).eq('id', ba.id)
        }
        // Tambah stok prepack
        const menu = bahanBaku.find(x => x.id === p.menu_id)
        if (menu) await supabase.from('bahan_baku').update({
          stok_saat_ini: (menu.stok_saat_ini || 0) + Number(editHasilSatuan)
        }).eq('id', menu.id)
      }

      await logAudit('produksi', p.id, 'update', p.status, editStatus, { yang_catat: editYangMasak })
      showToast(nowSelesai && wasProses ? `✅ Produksi selesai! Stok diupdate.` : `✅ Produksi diperbarui`)
      loadData()
      setSelected(null)
      setMode('view')
    } catch (e) { showToast('❌ ' + e.message) }
    setSubmitting(false)
  }

  const handleDelete = async (p) => {
    if (!window.confirm(`Hapus produksi "${p.menu_nama}"?\n\nCatatan: stok tidak akan di-rollback otomatis.`)) return
    setSubmitting(true)
    try {
      await supabase.from('produksi').delete().eq('id', p.id)
      await logAudit('produksi', p.id, 'delete', p.menu_nama, null, { yang_catat: userName })
      showToast(`🗑️ ${p.menu_nama} dihapus`)
      loadData()
      setSelected(null)
      setMode('view')
    } catch (e) { showToast('❌ ' + e.message) }
    setSubmitting(false)
  }

  // ===== EDIT VIEW =====
  if (selected && mode === 'edit') {
    const p = selected
    const menuBahan = bahanBaku.find(b => b.id === p.menu_id)
    const satuanMenu = menuBahan?.satuan_dasar || ''
    const isSimple = ['porsi', 'gelas'].includes(satuanMenu)
    const bahanOptions = bahanBaku.filter(b => b.kategori === 'mentah' && b.is_active)
      .map(b => ({ value: b.id, label: b.nama, stock: b.stok_saat_ini, satuan: b.satuan_dasar }))

    const updateBahan = (idx, field, val) => {
      const newList = [...editBahanList]
      newList[idx][field] = val
      if (field === 'bahan_id') {
        const ba = bahanBaku.find(x => x.id == val)
        newList[idx].satuan = ba?.satuan_dasar || ''
        newList[idx].inputUnit = ba?.satuan_dasar || ''
      }
      setEditBahanList(newList)
    }

    return (
      <div>
        <button onClick={() => setMode('view')} style={{ ...S.btn, ...S.btnSecondary, marginBottom: '14px', fontSize: '12px' }}>← Batal Edit</button>
        <div style={{ background: p.status === 'proses' ? C.yellowBg : C.greenBg, padding: '8px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '12px' }}>
          {p.status === 'proses' ? '🔄 Status: Proses — ubah ke "Selesai" untuk finalisasi & update stok' : '✅ Status: Selesai'}
        </div>

        <FormRow label="Tanggal (bisa backdated)">
          <input type="date" value={editTanggal} onChange={e => setEditTanggal(e.target.value)} style={S.input} />
        </FormRow>

        <div style={{ fontSize: '12px', color: C.text3, fontWeight: 500, marginBottom: '8px' }}>🥬 Bahan mentah:</div>
        {editBahanList.map((b, idx) => {
          const ba = bahanBaku.find(x => x.id == b.bahan_id)
          const altUnit = ba?.satuan_dasar ? UNIT_ALT[ba.satuan_dasar] : null
          const currentUnit = b.inputUnit || ba?.satuan_dasar || ''
          return (
            <div key={idx} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 70px auto auto', gap: '5px', alignItems: 'end' }}>
                <SearchableSelect options={bahanOptions} value={b.bahan_id}
                  onChange={val => updateBahan(idx, 'bahan_id', val)}
                  placeholder="Cari bahan..." showStock={true} />
                <input type="number" placeholder="Qty" value={b.jumlah}
                  onChange={e => updateBahan(idx, 'jumlah', e.target.value)} style={S.input} />
                {altUnit ? (
                  <div style={{ display: 'flex', borderRadius: '6px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    {[ba.satuan_dasar, altUnit].map(u => (
                      <button key={u} onClick={() => updateBahan(idx, 'inputUnit', u)} style={{
                        flex: 1, padding: '8px 4px', fontSize: '10px', border: 'none', cursor: 'pointer',
                        background: currentUnit === u ? C.text : 'transparent',
                        color: currentUnit === u ? C.panel : C.text2, fontWeight: currentUnit === u ? 600 : 400,
                      }}>{u}</button>
                    ))}
                  </div>
                ) : (
                  <input type="text" value={b.satuan} readOnly style={{ ...S.input, background: C.panel2, fontSize: '11px', width: '50px' }} />
                )}
                <button onClick={() => setEditBahanList(editBahanList.filter((_, i) => i !== idx))}
                  style={{ ...S.btn, ...S.btnDanger, padding: '9px 8px' }}>✕</button>
              </div>
            </div>
          )
        })}
        <button onClick={() => setEditBahanList([...editBahanList, { bahan_id: '', jumlah: '', satuan: '', inputUnit: '' }])}
          style={{ ...S.btn, background: 'transparent', border: `1px dashed ${C.border}`, color: C.text2, width: '100%', marginBottom: '12px' }}>
          + Tambah bahan
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: isSimple ? '1fr' : '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <FormRow label={`Hasil (${satuanMenu})`}>
            <input type="number" value={editHasilSatuan} onChange={e => setEditHasilSatuan(e.target.value)} style={S.input} />
          </FormRow>
          {!isSimple && (
            <FormRow label="Hasil (porsi)">
              <input type="number" value={editHasilPorsi} onChange={e => setEditHasilPorsi(e.target.value)} style={S.input} />
            </FormRow>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <FormRow label="Status">
            <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={S.input}>
              <option value="proses">🔄 Proses</option>
              <option value="selesai">✅ Selesai</option>
            </select>
          </FormRow>
          <FormRow label="Yang masak/prep">
            <input type="text" value={editYangMasak} onChange={e => setEditYangMasak(e.target.value)} style={S.input} />
          </FormRow>
        </div>

        <FormRow label="Foto (opsional)">
          <input type="file" accept="image/*" onChange={handleFotoEdit} style={{ ...S.input, padding: '8px' }} />
          {editFoto && <img src={editFoto} alt="foto" style={{ maxWidth: '160px', marginTop: '8px', borderRadius: '8px' }} />}
        </FormRow>

        <FormRow label="Catatan">
          <textarea rows={2} value={editCatatan} onChange={e => setEditCatatan(e.target.value)} style={S.input} />
        </FormRow>

        {editStatus === 'selesai' && p.status === 'proses' && (
          <div style={{ background: C.yellowBg, border: `1px solid ${C.yellowBorder}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', color: C.yellow }}>
            ⚠️ Mengubah ke "Selesai" akan langsung mengurangi stok bahan mentah dan menambah stok prepack. Pastikan data sudah benar.
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => handleDelete(p)} disabled={submitting}
            style={{ ...S.btn, ...S.btnDanger, flex: 1, opacity: submitting ? 0.6 : 1 }}>
            🗑️ Hapus
          </button>
          <button onClick={handleSaveEdit} disabled={submitting}
            style={{ ...S.btn, ...S.btnPrimary, flex: 3, padding: '13px', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Menyimpan...' : editStatus === 'selesai' && p.status === 'proses' ? '✅ Selesaikan & Update Stok' : '💾 Simpan Perubahan'}
          </button>
        </div>
      </div>
    )
  }

  // ===== DETAIL VIEW =====
  if (selected && mode === 'view') {
    const p = selected
    const bahanArr = Array.isArray(p.bahan_baku) ? p.bahan_baku : []
    const totalCogs = p.total_cogs || bahanArr.reduce((s, b) => s + (b.cogs_bahan || 0), 0)
    const cogsPorsi = p.cogs_per_porsi || (p.hasil_porsi > 0 ? totalCogs / p.hasil_porsi : 0)
    const satuan = bahanBaku.find(b => b.id === p.menu_id)?.satuan_dasar || 'satuan'

    return (
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button onClick={() => setSelected(null)} style={{ ...S.btn, ...S.btnSecondary, fontSize: '12px', flex: 1 }}>← Kembali</button>
          <button onClick={() => startEdit(p)} style={{ ...S.btn, background: C.yellowBg, color: C.yellow, border: `1px solid ${C.yellowBorder}`, fontSize: '12px', flex: 1, fontWeight: 500 }}>
            ✏️ Edit / Lanjutkan
          </button>
        </div>

        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>{p.menu_nama}</h2>
        <p style={{ fontSize: '12px', color: C.text3, marginBottom: '12px' }}>
          {formatTanggalID(p.tanggal)} · {p.menu_kategori} · oleh {p.yang_masak}
        </p>

        <div style={{ padding: '8px 12px', background: p.status === 'selesai' ? C.greenBg : C.yellowBg, borderRadius: '8px', marginBottom: '12px', fontSize: '12px', fontWeight: 500, color: p.status === 'selesai' ? C.green : C.yellow }}>
          {p.status === 'selesai' ? '✅ Selesai — stok sudah diupdate' : '🔄 Proses — stok belum diupdate, tap Edit untuk lanjutkan'}
        </div>

        <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', color: C.text3, marginBottom: '8px', fontWeight: 600 }}>💰 COGS Batch Ini</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '11px', color: C.text3 }}>Total COGS</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: C.green }}>{formatRupiah(totalCogs)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: C.text3 }}>Per Porsi</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: C.green }}>{formatRupiah(Math.round(cogsPorsi))}</div>
            </div>
            <div><div style={{ fontSize: '11px', color: C.text3 }}>Hasil</div><div style={{ fontSize: '14px', fontWeight: 600 }}>{p.hasil_pcs} {satuan}</div></div>
            <div><div style={{ fontSize: '11px', color: C.text3 }}>Porsi</div><div style={{ fontSize: '14px', fontWeight: 600 }}>{p.hasil_porsi} porsi</div></div>
          </div>
        </div>

        <div style={{ fontSize: '12px', fontWeight: 600, color: C.text3, marginBottom: '8px' }}>🥬 Bahan yang dipakai:</div>
        {bahanArr.map((b, i) => (
          <div key={i} style={{ background: C.panel2, padding: '10px 12px', borderRadius: '8px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{b.nama}</div>
              <div style={{ fontSize: '11px', color: C.text3 }}>{b.jumlah_satuan_dasar || b.jumlah} {b.satuan} × {formatRupiah(b.harga_per_satuan || 0)}</div>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: C.green }}>{formatRupiah(b.cogs_bahan || 0)}</div>
          </div>
        ))}

        {p.foto && <img src={p.foto} alt="foto" style={{ width: '100%', maxWidth: '320px', borderRadius: '10px', marginTop: '12px', border: `1px solid ${C.border}` }} />}
        {p.catatan && <div style={{ marginTop: '10px', background: C.panel2, padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}><span style={{ fontSize: '11px', color: C.text3 }}>Catatan: </span>{p.catatan}</div>}
      </div>
    )
  }

  // ===== LIST VIEW =====
  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>📋 Laporan Produksi</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '12px' }}>Tap item untuk lihat detail, edit, atau hapus</p>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {[['all', 'Semua'], ['Kitchen', 'Kitchen'], ['Bar', 'Bar']].map(([k, l]) => (
          <button key={k} onClick={() => setFilterDiv(k)} style={{
            padding: '5px 12px', fontSize: '11px', borderRadius: '99px',
            border: `1px solid ${C.border}`, cursor: 'pointer',
            background: filterDiv === k ? C.text : 'transparent',
            color: filterDiv === k ? C.panel : C.text2, fontWeight: filterDiv === k ? 600 : 400,
          }}>{l}</button>
        ))}
      </div>

      {filtered.length > 0 && (
        <div style={{ background: C.greenBg, padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' }}>
          <span style={{ color: C.text3 }}>{filtered.length} batch · Total COGS: </span>
          <strong style={{ color: C.green }}>{formatRupiah(totalCOGS)}</strong>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: C.text3, fontSize: '13px' }}>
          Belum ada data produksi.
        </div>
      )}

      {filtered.map(p => (
        <div key={p.id} onClick={() => { setSelected(p); setMode('view') }} style={{
          background: p.status === 'proses' ? C.yellowBg : C.panel,
          border: `1px solid ${p.status === 'proses' ? C.yellowBorder : C.border}`,
          borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{p.menu_nama}</span>
              {p.status === 'proses' && <span style={{ fontSize: '10px', background: C.yellow, color: '#fff', padding: '1px 6px', borderRadius: '99px', fontWeight: 500 }}>PROSES</span>}
            </div>
            <div style={{ fontSize: '11px', color: C.text3, marginTop: '3px' }}>
              {formatTanggalID(p.tanggal)} · {p.menu_kategori} · {p.yang_masak}
            </div>
            <div style={{ fontSize: '11px', color: C.text3 }}>Hasil: {p.hasil_pcs} sat · {p.hasil_porsi} porsi</div>
          </div>
          <div style={{ textAlign: 'right', marginLeft: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: p.total_cogs > 0 ? C.green : C.text3 }}>
              {formatRupiah(p.total_cogs || 0)}
            </div>
            <div style={{ fontSize: '10px', color: C.text3 }}>COGS</div>
            <div style={{ fontSize: '11px', marginTop: '3px' }}>→ tap detail</div>
          </div>
        </div>
      ))}
    </div>
  )
}
function InputNotaView({ bahanBaku, showToast, loadData, logAudit, setView, userName, setUserName, isLocked }) {
  const [tanggal, setTanggal] = useState(formatTanggal())
  const [jalur, setJalur] = useState('kecil')
  const [sumberDana, setSumberDana] = useState('kas_kasir')
  const [yangBelanja, setYangBelanja] = useState(userName)
  const [items, setItems] = useState([{ bahan_id: '', jumlah: '', harga: '', satuan: '', tanggal_expired: '' }])
  const [foto, setFoto] = useState('')
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [aiScanning, setAiScanning] = useState(false)
  const [aiResult, setAiResult] = useState(null) // hasil scan mentah dari AI

  // ─── AI Scan Nota ───
  const scanNotaWithAI = async (base64ImageFull) => {
    setAiScanning(true)
    setAiResult(null)
    try {
      // Ambil hanya data base64 tanpa prefix
      const base64Data = base64ImageFull.split(',')[1]
      const mediaType  = base64ImageFull.split(';')[0].split(':')[1] || 'image/jpeg'

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data }
              },
              {
                type: 'text',
                text: `Baca nota belanja ini. Ekstrak semua item yang dibeli.
Balas HANYA dengan JSON array, tanpa teks lain, tanpa markdown, tanpa backtick.
Format tiap item: {"nama": "nama bahan", "jumlah": angka, "satuan": "satuan", "harga": angka_total_item}
Contoh: [{"nama":"Bawang putih","jumlah":1,"satuan":"kg","harga":28000},{"nama":"Ayam","jumlah":2,"satuan":"kg","harga":84000}]
Aturan:
- nama: tulis lengkap, perbaiki singkatan (bwg putih → Bawang putih)
- jumlah: angka saja
- satuan: kg / gram / liter / ml / pcs / ikat / buah / botol
- harga: total harga item itu (bukan harga satuan)
- Jika tidak bisa baca, kembalikan array kosong []`
              }
            ]
          }]
        })
      })

      const data = await response.json()
      const text = data.content?.find(c => c.type === 'text')?.text || '[]'
      const parsed = JSON.parse(text.trim())

      if (!Array.isArray(parsed) || parsed.length === 0) {
        showToast('⚠️ AI tidak bisa baca nota ini. Isi manual ya.')
        setAiScanning(false)
        return
      }

      // Cocokkan nama bahan dari AI dengan master bahan_baku
      const newItems = parsed.map(item => {
        const nameLower = item.nama.toLowerCase()
        // Cari exact match dulu, lalu partial match
        const match = bahanBaku.find(b =>
          b.kategori === 'mentah' && (
            b.nama.toLowerCase() === nameLower ||
            b.nama.toLowerCase().includes(nameLower) ||
            nameLower.includes(b.nama.toLowerCase())
          )
        )
        return {
          bahan_id:         match ? match.id : '',
          namaAI:           item.nama,       // simpan nama dari AI untuk tampilkan jika tidak match
          jumlah:           String(item.jumlah || ''),
          satuan:           match ? match.satuan_dasar : (item.satuan || ''),
          harga:            String(item.harga || ''),
          tanggal_expired:  match?.is_perishable && match?.umur_simpan_hari
            ? (() => { const d = new Date(); d.setDate(d.getDate() + match.umur_simpan_hari); return d.toISOString().split('T')[0] })()
            : '',
        }
      })

      setItems(newItems)
      setAiResult(parsed)

      const cocok   = newItems.filter(i => i.bahan_id).length
      const tidakCocok = newItems.filter(i => !i.bahan_id).length
      showToast(`✅ AI baca ${parsed.length} item · ${cocok} cocok · ${tidakCocok} perlu pilih manual`)
    } catch (err) {
      showToast('❌ Scan gagal: ' + err.message)
    }
    setAiScanning(false)
  }

  const addItem = () => setItems([...items, { bahan_id: '', jumlah: '', harga: '', satuan: '', tanggal_expired: '' }])
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx))
  const updateItem = (idx, field, val) => {
    const newItems = [...items]
    newItems[idx][field] = val
    if (field === 'bahan_id') {
      const b = bahanBaku.find(x => x.id == val)
      if (b) {
        newItems[idx].satuan = b.satuan_dasar
        if (b.is_perishable && b.umur_simpan_hari) {
          const exp = new Date()
          exp.setDate(exp.getDate() + b.umur_simpan_hari)
          newItems[idx].tanggal_expired = exp.toISOString().split('T')[0]
        }
      }
    }
    setItems(newItems)
  }

  const totalHarga = items.reduce((s, i) => s + (Number(i.harga) || 0), 0)

  const handleFoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showToast('❌ Foto max 5MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const b64 = ev.target.result
      setFoto(b64)
      scanNotaWithAI(b64)   // langsung scan setelah foto dipilih
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!yangBelanja) { showToast('❌ Isi nama'); return }
    if (!foto) { showToast('❌ Foto nota wajib'); return }
    const validItems = items.filter(i => i.bahan_id && i.jumlah && i.harga)
    if (validItems.length === 0) { showToast('❌ Minimal 1 item'); return }
    if (jalur === 'kecil' && totalHarga >= THRESHOLD_KECIL) {
      showToast(`❌ Belanja ≥ Rp ${THRESHOLD_KECIL.toLocaleString('id-ID')} pakai jalur Normal`); return
    }

    setSubmitting(true)
    setUserName(yangBelanja)

    try {
      const itemsWithName = validItems.map(i => {
        const b = bahanBaku.find(x => x.id == i.bahan_id)
        return {
          bahan_id: b.id, nama: b.nama, jumlah: Number(i.jumlah),
          harga: Number(i.harga), satuan: i.satuan,
          tanggal_expired: i.tanggal_expired || null,
        }
      })

      const newId = generateId()
      await supabase.from('belanja').insert({
        id: newId, tanggal, jalur, sumber_dana: sumberDana,
        total_harga: totalHarga, yang_belanja: yangBelanja,
        foto_nota: foto, catatan, items: itemsWithName, created_by: yangBelanja,
      })

      // Update stok + create batch (kemasan-aware)
      for (const item of itemsWithName) {
        const b = bahanBaku.find(x => x.id === item.bahan_id)
        if (!b) continue

        // Cek apakah item dibeli dalam kemasan atau satuan_dasar
        const isKemasan = b.qty_per_kemasan && b.kemasan &&
          item.satuan && item.satuan.toLowerCase().includes(b.kemasan.toLowerCase())

        let stokTambah, hargaPerSatuan
        if (isKemasan) {
          // Beli dalam kemasan → konversi ke satuan_dasar
          stokTambah = Number(item.jumlah) * b.qty_per_kemasan
          hargaPerSatuan = Number(item.harga) / stokTambah
        } else {
          // Beli dalam satuan_dasar langsung
          stokTambah = Number(item.jumlah)
          hargaPerSatuan = Number(item.harga) / stokTambah
        }

        await supabase.from('stok_batch').insert({
          id: generateId(), bahan_id: b.id,
          jumlah_awal: stokTambah, jumlah_sisa: stokTambah,
          tanggal_masuk: tanggal, tanggal_expired: item.tanggal_expired,
          harga_per_satuan: hargaPerSatuan, belanja_id: newId,
        })
        await supabase.from('bahan_baku').update({
          stok_saat_ini: (b.stok_saat_ini || 0) + stokTambah,
          harga_per_satuan: hargaPerSatuan,
        }).eq('id', b.id)
        await logAudit('belanja', newId, 'create', b.id, b.nama, {
          jumlah_input: item.jumlah, satuan_input: item.satuan,
          stok_tambah: stokTambah, satuan_dasar: b.satuan_dasar,
          harga_per_satuan: hargaPerSatuan, jalur, sumber: sumberDana,
          mode: isKemasan ? 'kemasan' : 'satuan_dasar'
        })
      }

      // Petty cash tracking jika sumber petty
      if (sumberDana === 'petty_cash') {
        await supabase.from('petty_cash').insert({
          id: generateId(), tanggal, jenis: 'pengeluaran',
          jumlah: -totalHarga, saldo_setelah: 0,
          pemegang: 'staff', belanja_id: newId, yang_input: yangBelanja,
        })
      }

      showToast('✅ Nota tersimpan, stok auto-update')
      loadData()
      setView('home')
    } catch (e) { showToast('❌ ' + e.message) }
    setSubmitting(false)
  }

  if (isLocked) return <LockedScreen />

  const jalurInfo = {
    kecil: { color: 'greenLight', text: '🟢 Belanja Kecil: Nominal < Rp 100rb. Siapa saja boleh beli pakai kas kasir. Approval via WA.' },
    normal: { color: 'blue', text: '🔵 Belanja Normal: Nominal ≥ Rp 100rb. Transfer atau petty cash. WA owner untuk konfirmasi.' },
    darurat: { color: 'red', text: '🔴 Belanja Darurat: Untuk situasi mendesak. WA owner dulu, lalu beli pakai kas kasir.' }
  }[jalur]

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>🧾 Input Nota Belanja</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>Setelah belanja, input nota di sini · stok auto-update</p>

      <FormRow label="Jalur belanja">
        <select value={jalur} onChange={e => setJalur(e.target.value)} style={S.input}>
          <option value="kecil">🟢 Kecil (&lt; Rp 100rb · kas kasir)</option>
          <option value="normal">🔵 Normal (≥ Rp 100rb · transfer/petty)</option>
          <option value="darurat">🔴 Darurat (kapan saja · kas kasir)</option>
        </select>
      </FormRow>

      <div style={{ background: C[jalurInfo.color + 'Bg'], color: C[jalurInfo.color], padding: '10px 12px', borderRadius: '7px', fontSize: '12px', marginBottom: '12px', lineHeight: 1.4 }}>
        {jalurInfo.text}
      </div>

      <FormRow label="Tanggal pembelian"><input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} style={S.input} /></FormRow>

      <FormRow label="Sumber dana">
        <select value={sumberDana} onChange={e => setSumberDana(e.target.value)} style={S.input}>
          <option value="kas_kasir">🏪 Kas kasir</option>
          <option value="petty_cash">💵 Petty cash</option>
          <option value="transfer_owner">💸 Owner transfer</option>
        </select>
      </FormRow>

      <FormRow label="Yang belanja"><input type="text" value={yangBelanja} onChange={e => setYangBelanja(e.target.value)} placeholder="Nama..." style={S.input} /></FormRow>

      <hr style={{ border: 'none', borderTop: `1px solid ${C.panel2}`, margin: '14px 0' }} />
      <div style={{ fontSize: '12px', color: C.text3, fontWeight: 500, marginBottom: '8px' }}>🛍️ Detail barang yang dibeli:</div>

      {items.map((item, idx) => {
        const ba = bahanBaku.find(x => x.id === item.bahan_id)
        const hasKemasan = ba?.qty_per_kemasan && ba?.kemasan
        const stokTambahPreview = hasKemasan && item.jumlah
          ? Number(item.jumlah) * ba.qty_per_kemasan : null
        const hargaPerSatuanPreview = stokTambahPreview && item.harga
          ? (Number(item.harga) / stokTambahPreview) : null

        return (
          <div key={idx} style={{ background: C.panel2, padding: '10px', borderRadius: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr auto', gap: '6px', marginBottom: '6px', alignItems: 'end' }}>
              <SearchableSelect
                options={bahanBaku.filter(b => b.kategori === 'mentah').map(b => ({ value: b.id, label: b.nama, stock: b.stok_saat_ini, satuan: b.satuan_dasar }))}
                value={item.bahan_id}
                onChange={val => updateItem(idx, 'bahan_id', val)}
                placeholder={item.namaAI ? `AI: "${item.namaAI}" — pilih yang cocok` : 'Cari bahan mentah...'}
                showStock={true}
              />
              <button onClick={() => removeItem(idx)} style={{ ...S.btn, ...S.btnDanger, padding: '9px 10px' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '4px' }}>
              <input type="number" placeholder="Jumlah" value={item.jumlah}
                onChange={e => updateItem(idx, 'jumlah', e.target.value)} style={S.input} />
              <input type="text" placeholder="Satuan" value={item.satuan}
                onChange={e => updateItem(idx, 'satuan', e.target.value)}
                style={{ ...S.input, background: hasKemasan ? C.greenBg : undefined }}
              />
              <input type="number" placeholder="Harga (Rp)" value={item.harga}
                onChange={e => updateItem(idx, 'harga', e.target.value)} style={S.input} />
            </div>
            {hasKemasan && (
              <div style={{ fontSize: '11px', color: C.text3, marginBottom: '4px' }}>
                💡 Satuan kemasan: <strong>{ba.kemasan}</strong> (1 {ba.kemasan} = {ba.qty_per_kemasan} {ba.satuan_dasar})
              </div>
            )}
            {stokTambahPreview && hargaPerSatuanPreview && (
              <div style={{ background: C.greenBg, padding: '6px 10px', borderRadius: '6px', fontSize: '11px', color: C.green }}>
                ✅ Stok +{stokTambahPreview} {ba.satuan_dasar} · Harga {formatRupiah(Math.round(hargaPerSatuanPreview))}/{ba.satuan_dasar}
              </div>
            )}
            {item.tanggal_expired && (
              <div style={{ marginTop: '6px' }}>
                <label style={S.label}>⏰ Tanggal expired</label>
                <input type="date" value={item.tanggal_expired}
                  onChange={e => updateItem(idx, 'tanggal_expired', e.target.value)} style={S.input} />
              </div>
            )}
          </div>
        )
      })}

      <button onClick={addItem} style={{ ...S.btn, background: 'transparent', border: `1px dashed ${C.border}`, color: C.text2, width: '100%', marginBottom: '14px' }}>+ Tambah barang</button>

      <div style={{ background: C.greenBg, color: C.green, padding: '10px 12px', borderRadius: '7px', fontSize: '12px', marginBottom: '12px' }}>
        💰 Total: <strong>{formatRupiah(totalHarga)}</strong>
      </div>

      <FormRow label="Foto nota (wajib) — AI akan scan otomatis">
        <input type="file" accept="image/*" onChange={handleFoto}
          style={{ ...S.input, padding: '8px' }}
          capture={undefined}
        />
        <div style={{ fontSize: '11px', color: C.text3, marginTop: '4px' }}>
          📸 Ambil foto langsung, atau upload dari galeri / WhatsApp
        </div>
        {aiScanning && (
          <div style={{ background: C.blueBg, color: C.blue, padding: '10px 12px', borderRadius: '7px', marginTop: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>🤖</span>
            <span>AI sedang membaca nota... sebentar ya</span>
          </div>
        )}
        {aiResult && !aiScanning && (
          <div style={{ background: C.greenBg, color: C.green, padding: '8px 12px', borderRadius: '7px', marginTop: '8px', fontSize: '11px' }}>
            ✅ AI selesai scan · {aiResult.length} item terbaca · Cek form di atas, koreksi jika ada yang salah
          </div>
        )}
        {/* Tampilkan item yang tidak cocok dengan master — perlu dipilih manual */}
        {items.some(i => !i.bahan_id && i.namaAI) && (
          <div style={{ background: C.yellowBg, color: C.yellow, padding: '8px 12px', borderRadius: '7px', marginTop: '6px', fontSize: '11px' }}>
            ⚠️ {items.filter(i => !i.bahan_id && i.namaAI).map(i => i.namaAI).join(', ')} — tidak ada di master. Pilih manual dari dropdown.
          </div>
        )}
        {foto && <img src={foto} alt="" style={{ maxWidth: '140px', marginTop: '8px', borderRadius: '6px' }} />}
      </FormRow>

      <FormRow label="Catatan"><textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} style={S.input} /></FormRow>

      <button onClick={handleSubmit} disabled={submitting} style={{ ...S.btn, ...S.btnSuccess, width: '100%', padding: '13px', opacity: submitting ? 0.6 : 1 }}>
        {submitting ? 'Menyimpan...' : '💾 Submit Nota'}
      </button>
    </div>
  )
}

// =====================================================
// CLOSING VIEW
// =====================================================
// =====================================================
// UPDATE STOK HARIAN (menggantikan Closing lama)
// =====================================================
function ClosingView({ bahanBaku, closing, showToast, loadData, logAudit, userName, setUserName }) {
  const [search, setSearch] = useState('')
  const [filterDiv, setFilterDiv] = useState('all')
  const [filterKat, setFilterKat] = useState('all')
  const [showHistory, setShowHistory] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('today')
  const [saving, setSaving] = useState({}) // { [id]: true/false }
  const [inputs, setInputs] = useState({}) // { [id]: value }
  const [names, setNames] = useState({})   // { [id]: yangCatat }

  // Cek last update per bahan dari closing history
  const todayStr = formatTanggal()
  const lastUpdateMap = {}
  closing.forEach(c => {
    if (!lastUpdateMap[c.bahan_id] || c.created_at > lastUpdateMap[c.bahan_id].created_at) {
      lastUpdateMap[c.bahan_id] = c
    }
  })

  const filtered = bahanBaku.filter(b => {
    if (!b.is_active) return false
    const divOk = filterDiv === 'all' || b.divisi === filterDiv || b.divisi === 'Both'
    const katOk = filterKat === 'all' || b.kategori === filterKat
    const searchOk = !search.trim() || b.nama.toLowerCase().includes(search.toLowerCase())
    return divOk && katOk && searchOk
  })

  const belumUpdateHariIni = filtered.filter(b => {
    const last = lastUpdateMap[b.id]
    return !last || last.tanggal !== todayStr
  })

  // Kalau filter "belum update" aktif
  const [onlyPending, setOnlyPending] = useState(false)
  const displayList = onlyPending ? belumUpdateHariIni : filtered

  const handleSave = async (b) => {
    const val = inputs[b.id]
    const who = names[b.id] || userName
    if (val === undefined || val === '') { showToast('❌ Isi angka stok aktual dulu'); return }
    if (!who.trim()) { showToast('❌ Isi nama yang update'); return }
    const aktual = Number(val)
    const sebelum = b.stok_saat_ini || 0
    const selisih = aktual - sebelum

    setSaving(s => ({ ...s, [b.id]: true }))
    setUserName(who)
    try {
      await supabase.from('closing_stok').insert({
        id: generateId(),
        tanggal: todayStr,
        bahan_id: b.id,
        prediksi_sistem: sebelum,
        sisa_aktual: aktual,
        selisih,
        yang_closing: who,
        catatan: selisih > 0 ? 'stok naik' : selisih < 0 ? 'koreksi stok' : 'tidak ada perubahan',
        // kolom lama diset 0 supaya tidak null
        qty_bumbu: 0, qty_terjual: 0, qty_staff: 0,
        qty_wasted_kadaluarsa: 0, qty_wasted_busuk: 0,
      })
      await supabase.from('bahan_baku').update({ stok_saat_ini: aktual }).eq('id', b.id)
      await logAudit('closing_stok', b.id, 'update_stok', sebelum, aktual, { yang_catat: who, selisih })
      showToast(`✅ ${b.nama}: ${sebelum} → ${aktual} ${b.satuan_dasar}`)
      // Clear input setelah berhasil
      setInputs(i => ({ ...i, [b.id]: '' }))
      loadData()
    } catch (e) { showToast('❌ ' + e.message) }
    setSaving(s => ({ ...s, [b.id]: false }))
  }

  // ===== HISTORY VIEW =====
  if (showHistory) {
    const now = new Date()
    const histClosing = closing.filter(c => {
      const d = new Date(c.tanggal || c.created_at)
      if (historyFilter === 'today') return c.tanggal === todayStr
      if (historyFilter === 'yesterday') {
        const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
        return c.tanggal === formatTanggal(yesterday)
      }
      if (historyFilter === 'week') {
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
        return d >= weekAgo
      }
      return true
    }).sort((a, b) => (b.created_at || '') > (a.created_at || '') ? 1 : -1)

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 600 }}>📊 History Update Stok</h2>
          <button onClick={() => setShowHistory(false)} style={{ ...S.btn, ...S.btnSecondary, fontSize: '12px' }}>← Kembali</button>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {[['today', 'Hari ini'], ['yesterday', 'Kemarin'], ['week', '7 hari'], ['all', 'Semua']].map(([k, l]) => (
            <button key={k} onClick={() => setHistoryFilter(k)} style={{
              padding: '5px 12px', fontSize: '11px', borderRadius: '99px',
              border: `1px solid ${C.border}`, cursor: 'pointer',
              background: historyFilter === k ? C.text : 'transparent',
              color: historyFilter === k ? C.panel : C.text2,
              fontWeight: historyFilter === k ? 600 : 400,
            }}>{l}</button>
          ))}
        </div>

        {histClosing.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px', color: C.text3, fontSize: '13px' }}>
            Belum ada update stok untuk periode ini.
          </div>
        )}

        {histClosing.map((c, i) => {
          const bahan = bahanBaku.find(b => b.id === c.bahan_id)
          const selisih = c.sisa_aktual - c.prediksi_sistem
          const waktu = c.created_at ? new Date(c.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''
          return (
            <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '11px 14px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{bahan?.nama || c.bahan_id}</div>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: C.text3, marginTop: '4px', flexWrap: 'wrap' }}>
                    <span>Sebelum: <strong>{c.prediksi_sistem} {bahan?.satuan_dasar}</strong></span>
                    <span>→</span>
                    <span>Sesudah: <strong style={{ color: C.green }}>{c.sisa_aktual} {bahan?.satuan_dasar}</strong></span>
                  </div>
                  <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>
                    oleh {c.yang_closing} · {formatTanggalID(c.tanggal)} {waktu}
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: selisih >= 0 ? C.green : C.red }}>
                    {selisih >= 0 ? '+' : ''}{selisih} {bahan?.satuan_dasar}
                  </div>
                  <div style={{ fontSize: '10px', color: C.text3 }}>selisih</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ===== MAIN LIST VIEW =====
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600 }}>📋 Update Stok Harian</h2>
        <button onClick={() => setShowHistory(true)}
          style={{ ...S.btn, background: C.panel2, color: C.text2, border: `1px solid ${C.border}`, fontSize: '11px', padding: '6px 10px' }}>
          📊 History
        </button>
      </div>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '12px' }}>
        Isi stok fisik aktual → tap Simpan per item
      </p>

      {/* Info belum update */}
      {belumUpdateHariIni.length > 0 && (
        <div style={{ background: C.yellowBg, border: `1px solid ${C.yellowBorder}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: C.yellow }}>
            ⚠️ <strong>{belumUpdateHariIni.length} bahan</strong> belum diupdate hari ini
          </div>
          <button onClick={() => setOnlyPending(!onlyPending)} style={{
            fontSize: '11px', padding: '4px 10px', borderRadius: '99px',
            background: onlyPending ? C.yellow : 'transparent',
            color: onlyPending ? '#fff' : C.yellow,
            border: `1px solid ${C.yellow}`, cursor: 'pointer',
          }}>{onlyPending ? 'Lihat semua' : 'Filter'}</button>
        </div>
      )}

      {belumUpdateHariIni.length === 0 && (
        <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', color: C.green }}>
          ✅ Semua bahan sudah diupdate hari ini!
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Cari nama bahan..." style={{ ...S.input, marginBottom: '8px' }} />

      <div style={{ display: 'flex', gap: '5px', marginBottom: '6px', flexWrap: 'wrap' }}>
        {[['all', '🏠 Semua'], ['Kitchen', '🍳 Kitchen'], ['Bar', '🥤 Bar']].map(([k, l]) => (
          <button key={k} onClick={() => setFilterDiv(k)} style={{
            padding: '5px 10px', fontSize: '11px', borderRadius: '99px', border: `1px solid ${C.border}`, cursor: 'pointer',
            background: filterDiv === k ? C.blue : 'transparent',
            color: filterDiv === k ? '#fff' : C.text2, fontWeight: filterDiv === k ? 600 : 400,
          }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '5px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {[['all', 'Semua'], ['mentah', 'Mentah'], ['prepack', 'Prepack'], ['jadi', 'Jadi']].map(([k, l]) => (
          <button key={k} onClick={() => setFilterKat(k)} style={{
            padding: '5px 10px', fontSize: '11px', borderRadius: '99px', border: `1px solid ${C.border}`, cursor: 'pointer',
            background: filterKat === k ? C.text : 'transparent',
            color: filterKat === k ? C.panel : C.text2, fontWeight: filterKat === k ? 600 : 400,
          }}>{l}</button>
        ))}
      </div>

      {displayList.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: C.text3, fontSize: '13px' }}>
          {search ? `Tidak ditemukan "${search}"` : onlyPending ? '✅ Semua sudah diupdate!' : 'Belum ada bahan'}
        </div>
      )}

      {displayList.map(b => {
        const last = lastUpdateMap[b.id]
        const sudahHariIni = last?.tanggal === todayStr
        const statusColor = b.stok_saat_ini < b.stok_minimum ? 'red' : 'greenLight'
        const isSaving = saving[b.id]
        const inputVal = inputs[b.id] ?? ''
        const whoVal = names[b.id] ?? userName

        return (
          <div key={b.id} style={{
            background: sudahHariIni ? C.panel : C.yellowBg,
            border: `1px solid ${sudahHariIni ? C.border : C.yellowBorder}`,
            borderRadius: '10px', padding: '12px 14px', marginBottom: '8px',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.nama}</div>
                <div style={{ fontSize: '11px', color: C.text3, marginTop: '1px' }}>{b.kategori} · {b.divisi}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: C.text3 }}>Stok sistem</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: b.stok_saat_ini < b.stok_minimum ? C.red : C.text }}>
                  {b.stok_saat_ini} {b.satuan_dasar}
                </div>
                {b.stok_saat_ini < b.stok_minimum && (
                  <div style={{ fontSize: '10px', color: C.red }}>⚠ rendah</div>
                )}
              </div>
            </div>

            {/* Input aktual */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '6px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: C.text3, marginBottom: '3px' }}>
                  Stok aktual sekarang ({b.satuan_dasar}):
                </div>
                <input type="number" value={inputVal}
                  onChange={e => setInputs(i => ({ ...i, [b.id]: e.target.value }))}
                  placeholder={`${b.stok_saat_ini}`}
                  style={{ ...S.input, fontSize: '16px', fontWeight: 600, textAlign: 'center' }} />
              </div>
              <button onClick={() => handleSave(b)} disabled={isSaving || inputVal === ''}
                style={{
                  ...S.btn, background: inputVal !== '' ? C.green : C.border,
                  color: '#fff', padding: '10px 16px', fontSize: '12px', fontWeight: 600,
                  opacity: isSaving ? 0.6 : 1, alignSelf: 'flex-end',
                }}>
                {isSaving ? '...' : 'Simpan'}
              </button>
            </div>

            {/* Preview selisih */}
            {inputVal !== '' && !isNaN(inputVal) && (
              <div style={{ fontSize: '11px', color: C.text3, marginBottom: '6px', padding: '5px 8px', background: C.panel, borderRadius: '6px' }}>
                {Number(inputVal) === b.stok_saat_ini
                  ? '= Tidak ada perubahan'
                  : Number(inputVal) > b.stok_saat_ini
                    ? `↑ Stok naik ${Number(inputVal) - b.stok_saat_ini} ${b.satuan_dasar} dari sistem`
                    : `↓ Koreksi -${b.stok_saat_ini - Number(inputVal)} ${b.satuan_dasar} dari sistem`
                }
              </div>
            )}

            {/* Yang catat */}
            {inputVal !== '' && (
              <input type="text" value={whoVal}
                onChange={e => setNames(n => ({ ...n, [b.id]: e.target.value }))}
                placeholder="Yang update (nama)..."
                style={{ ...S.input, fontSize: '12px' }} />
            )}

            {/* Last update info */}
            <div style={{ fontSize: '10px', color: sudahHariIni ? C.green : C.yellow, marginTop: '6px' }}>
              {sudahHariIni
                ? `✅ Diupdate ${new Date(last.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} oleh ${last.yang_closing}`
                : last
                  ? `⚠️ Terakhir: ${formatTanggalID(last.tanggal)} oleh ${last.yang_closing}`
                  : '⚠️ Belum pernah diupdate'
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}


// =====================================================
// STOK LIST VIEW
// =====================================================
// =====================================================
// BAHAN FORM MODAL (Tambah/Edit Bahan Baku)
// =====================================================
function BahanFormModal({ mode, initial, onClose, showToast, loadData, logAudit, bahanBaku, userName }) {
  const [nama, setNama] = useState(initial?.nama || '')
  const [kategori, setKategori] = useState(initial?.kategori || 'mentah')
  const [divisi, setDivisi] = useState(initial?.divisi || 'Kitchen')
  const [satuan, setSatuan] = useState(initial?.satuan_dasar || 'gram')
  const [kemasan, setKemasan] = useState(initial?.kemasan || '')
  const [qtyPerKemasan, setQtyPerKemasan] = useState(initial?.qty_per_kemasan ?? '')
  const [hargaPerKemasan, setHargaPerKemasan] = useState(initial?.harga_per_kemasan ?? '')
  const [stokMin, setStokMin] = useState(initial?.stok_minimum ?? 0)
  const [stokAwal, setStokAwal] = useState(0)
  const [harga, setHarga] = useState(initial?.harga_per_satuan ?? 0)

  // Auto-hitung harga_per_satuan dari kemasan
  const hargaAutoCalc = qtyPerKemasan > 0 && hargaPerKemasan > 0
    ? (Number(hargaPerKemasan) / Number(qtyPerKemasan)).toFixed(2)
    : null
  const [perishable, setPerishable] = useState(initial?.is_perishable || false)
  const [umurSimpan, setUmurSimpan] = useState(initial?.umur_simpan_hari || '')
  const [catatan, setCatatan] = useState(initial?.catatan || '')
  const [yangCatat, setYangCatat] = useState(userName || '')
  const [submitting, setSubmitting] = useState(false)

  const isEdit = mode === 'edit'

  const handleSubmit = async () => {
    if (!nama.trim()) { showToast('❌ Nama harus diisi'); return }
    if (!yangCatat.trim()) { showToast('❌ Yang catat harus diisi'); return }

    // Cek duplikat nama (kecuali edit dirinya sendiri)
    const dup = bahanBaku.find(b =>
      b.nama.toLowerCase() === nama.trim().toLowerCase() &&
      (!isEdit || b.id !== initial.id)
    )
    if (dup) { showToast('❌ Nama bahan sudah ada di master'); return }

    setSubmitting(true)
    try {
      const finalHargaPerSatuan = hargaAutoCalc ? Number(hargaAutoCalc) : (Number(harga) || 0)
      const payload = {
        nama: nama.trim(),
        kategori, divisi,
        satuan_dasar: satuan,
        kemasan: kemasan.trim() || null,
        qty_per_kemasan: qtyPerKemasan ? Number(qtyPerKemasan) : null,
        harga_per_kemasan: hargaPerKemasan ? Number(hargaPerKemasan) : null,
        stok_minimum: Number(stokMin) || 0,
        harga_per_satuan: finalHargaPerSatuan,
        is_perishable: perishable,
        umur_simpan_hari: perishable ? (Number(umurSimpan) || null) : null,
        catatan: catatan.trim() || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }

      if (isEdit) {
        const { error } = await supabase.from('bahan_baku').update(payload).eq('id', initial.id)
        if (error) throw error
        await logAudit('bahan_baku', initial.id, 'update', initial, payload, { yang_catat: yangCatat })
        showToast(`✅ ${nama} ter-update`)
      } else {
        const newId = generateId()
        const { error } = await supabase.from('bahan_baku').insert({
          id: newId, ...payload,
          stok_saat_ini: Number(stokAwal) || 0,
        })
        if (error) throw error
        await logAudit('bahan_baku', newId, 'create', null, payload, { yang_catat: yangCatat })
        showToast(`✅ ${nama} ditambah ke master`)
      }

      loadData()
      onClose()
    } catch (e) { showToast('❌ ' + e.message) }
    setSubmitting(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 1000, padding: '20px', overflowY: 'auto',
    }} onClick={onClose}>
      <div style={{
        background: C.panel, borderRadius: '12px', padding: '20px',
        width: '100%', maxWidth: '420px', marginTop: '20px',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
          {isEdit ? '✏️ Edit Bahan' : '➕ Tambah Bahan Baru'}
        </h3>
        <p style={{ fontSize: '11px', color: C.text3, marginBottom: '14px' }}>
          {isEdit ? `${initial.nama} · stok saat ini: ${initial.stok_saat_ini} ${initial.satuan_dasar}` : 'Isi data bahan baru'}
        </p>

        <label style={S.label}>Nama Bahan *</label>
        <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Misal: Ayam Fillet" style={{ ...S.input, marginBottom: '8px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div>
            <label style={S.label}>Kategori *</label>
            <select value={kategori} onChange={e => setKategori(e.target.value)} style={S.input}>
              <option value="mentah">Mentah</option>
              <option value="prepack">Pre-pack</option>
              <option value="jadi">Jadi</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Divisi *</label>
            <select value={divisi} onChange={e => setDivisi(e.target.value)} style={S.input}>
              <option value="Kitchen">Kitchen</option>
              <option value="Bar">Bar</option>
              <option value="Both">Both</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div>
            <label style={S.label}>Satuan Dasar *</label>
            <select value={satuan} onChange={e => setSatuan(e.target.value)} style={S.input}>
              <option value="gram">gram</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="liter">liter</option>
              <option value="pcs">pcs</option>
              <option value="buah">buah</option>
              <option value="butir">butir</option>
              <option value="porsi">porsi</option>
              <option value="gelas">gelas</option>
              <option value="lembar">lembar</option>
              <option value="ikat">ikat</option>
              <option value="sisir">sisir</option>
              <option value="pinch">pinch</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Kemasan (nama)</label>
            <input value={kemasan} onChange={e => setKemasan(e.target.value)} placeholder="galon / jirigen / karung" style={S.input} />
          </div>
        </div>

        {/* Kemasan konversi section */}
        <div style={{ background: C.panel2, padding: '10px 12px', borderRadius: '8px', marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', color: C.text3, fontWeight: 500, marginBottom: '8px' }}>
            📦 Konversi kemasan → satuan dasar (opsional tapi penting untuk COGS akurat)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={S.label}>Isi per kemasan ({satuan})</label>
              <input type="number" value={qtyPerKemasan} onChange={e => setQtyPerKemasan(e.target.value)}
                placeholder={`misal: 19 (galon=19L)`} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Harga per kemasan (Rp)</label>
              <input type="number" value={hargaPerKemasan} onChange={e => setHargaPerKemasan(e.target.value)}
                placeholder="misal: 13000" style={S.input} />
            </div>
          </div>
          {hargaAutoCalc ? (
            <div style={{ marginTop: '8px', background: C.greenBg, padding: '7px 10px', borderRadius: '6px', fontSize: '11px', color: C.green }}>
              ✅ Harga per {satuan} = {formatRupiah(Number(hargaAutoCalc))} (auto-hitung)
            </div>
          ) : (
            <p style={{ fontSize: '10px', color: C.text3, marginTop: '6px', marginBottom: 0 }}>
              Contoh: Air galon 19L Rp 13.000 → isi 19 dan 13000 → sistem hitung Rp 684/liter
            </p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div>
            <label style={S.label}>Stok Minimum</label>
            <input type="number" value={stokMin} onChange={e => setStokMin(e.target.value)} style={S.input} />
          </div>
          <div>
            <label style={S.label}>Harga / {satuan} (Rp) {hargaAutoCalc ? '(auto)' : ''}</label>
            <input type="number" value={hargaAutoCalc || harga}
              onChange={e => { setHarga(e.target.value); setHargaPerKemasan('') }}
              readOnly={!!hargaAutoCalc}
              style={{ ...S.input, background: hargaAutoCalc ? C.greenBg : undefined }} />
          </div>
        </div>

        {!isEdit && (
          <div style={{ marginBottom: '8px' }}>
            <label style={S.label}>Stok Awal (opsional)</label>
            <input type="number" value={stokAwal} onChange={e => setStokAwal(e.target.value)} placeholder="0" style={S.input} />
            <p style={{ fontSize: '10px', color: C.text3, marginTop: '2px' }}>Kosongkan kalau belum ada stok fisik. Bisa input nanti via Belanja.</p>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0' }}>
          <input type="checkbox" checked={perishable} onChange={e => setPerishable(e.target.checked)} id="perishable-check" />
          <label htmlFor="perishable-check" style={{ fontSize: '12px', cursor: 'pointer' }}>Cepat busuk (perishable)</label>
        </div>


        {perishable && (
          <div style={{ marginBottom: '8px' }}>
            <label style={S.label}>Umur Simpan (hari) *</label>
            <input type="number" value={umurSimpan} onChange={e => setUmurSimpan(e.target.value)} placeholder="Misal: 3" style={S.input} />
          </div>
        )}

        <label style={S.label}>Catatan</label>
        <textarea value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Optional: supplier, tips, dll" rows={2} style={{ ...S.input, resize: 'vertical', marginBottom: '8px' }} />

        <label style={S.label}>Yang Catat *</label>
        <input value={yangCatat} onChange={e => setYangCatat(e.target.value)} placeholder="Nama kamu" style={S.input} />

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <button onClick={onClose} style={{ ...S.btn, ...S.btnSecondary, flex: 1 }}>Batal</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ ...S.btn, ...S.btnPrimary, flex: 2, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Menyimpan...' : isEdit ? '💾 Update' : '➕ Tambah'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// STOK LIST VIEW (with Tambah/Edit Bahan)
// =====================================================
function StokListView({ bahanBaku, showToast, loadData, logAudit, userName }) {
  const [filterKat, setFilterKat] = useState('all')
  const [filterDiv, setFilterDiv] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | { mode: 'edit'|'add'|'stok', initial }

  const filtered = bahanBaku.filter(b => {
    const katOk = filterKat === 'all' || b.kategori === filterKat
    const divOk = filterDiv === 'all' || b.divisi === filterDiv || b.divisi === 'Both'
    const searchOk = !search.trim() || b.nama.toLowerCase().includes(search.toLowerCase())
    return katOk && divOk && searchOk
  })

  const stats = {
    total: bahanBaku.length,
    rendah: bahanBaku.filter(b => b.stok_saat_ini < b.stok_minimum).length,
    sedang: bahanBaku.filter(b => b.stok_saat_ini >= b.stok_minimum && b.stok_saat_ini < b.stok_minimum * 1.5).length,
    expiring: bahanBaku.filter(b => { const d = daysFromNow(b.expired_terdekat); return d !== null && d <= 2 && d >= 0 }).length,
  }

  // Modal tambah stok (ADD mode)
  const UpdateStokModal = ({ item, onClose }) => {
    const [tambah, setTambah] = useState('')
    const [yangCatat, setYangCatat] = useState(userName)
    const [submitting, setSubmitting] = useState(false)

    const handleSave = async () => {
      if (!tambah || Number(tambah) <= 0) { showToast('❌ Isi jumlah yang ditambahkan'); return }
      if (!yangCatat.trim()) { showToast('❌ Isi nama yang catat'); return }
      setSubmitting(true)
      try {
        const newStok = (item.stok_saat_ini || 0) + Number(tambah)
        await supabase.from('bahan_baku').update({ stok_saat_ini: newStok }).eq('id', item.id)
        await logAudit('bahan_baku', item.id, 'update_stok', item.stok_saat_ini, newStok, { yang_catat: yangCatat, tambah: Number(tambah) })
        showToast(`✅ Stok ${item.nama} +${tambah} → ${newStok} ${item.satuan_dasar}`)
        loadData()
        onClose()
      } catch (e) { showToast('❌ ' + e.message) }
      setSubmitting(false)
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
        <div style={{ background: C.panel, borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '340px' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>📦 Tambah Stok</h3>
          <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>
            {item.nama} · Stok saat ini: <strong>{item.stok_saat_ini} {item.satuan_dasar}</strong>
          </p>
          <label style={S.label}>Tambah berapa {item.satuan_dasar}?</label>
          <input type="number" value={tambah} onChange={e => setTambah(e.target.value)}
            placeholder="0" style={{ ...S.input, fontSize: '20px', textAlign: 'center', marginBottom: '10px' }} autoFocus />
          {tambah > 0 && (
            <div style={{ background: C.greenBg, padding: '8px 12px', borderRadius: '8px', marginBottom: '10px', fontSize: '12px', color: C.green }}>
              Stok baru: <strong>{(item.stok_saat_ini || 0) + Number(tambah)} {item.satuan_dasar}</strong>
            </div>
          )}
          <label style={S.label}>Yang catat</label>
          <input type="text" value={yangCatat} onChange={e => setYangCatat(e.target.value)} style={{ ...S.input, marginBottom: '14px' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ ...S.btn, ...S.btnSecondary, flex: 1 }}>Batal</button>
            <button onClick={handleSave} disabled={submitting} style={{ ...S.btn, ...S.btnPrimary, flex: 2, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Menyimpan...' : '✅ Simpan'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600 }}>📦 Daftar Stok</h2>
        <button onClick={() => setModal({ mode: 'add', initial: null })}
          style={{ background: C.text, color: C.panel, border: 'none', borderRadius: '7px', padding: '7px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          ➕ Tambah Bahan
        </button>
      </div>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '12px' }}>Tap bahan → update stok atau edit data</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' }}>
        <StatCard color="default" label="Total" value={stats.total} />
        <StatCard color="red" label="Rendah" value={stats.rendah} />
        <StatCard color="yellow" label="Sedang" value={stats.sedang} />
        <StatCard color="red" label="Expiring" value={stats.expiring} />
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Cari nama bahan..." style={{ ...S.input, marginBottom: '8px' }} />

      {/* Filter Divisi */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '6px', flexWrap: 'wrap' }}>
        {[['all', '🏠 Semua'], ['Kitchen', '🍳 Kitchen'], ['Bar', '🥤 Bar']].map(([k, l]) => (
          <button key={k} onClick={() => setFilterDiv(k)} style={{
            padding: '5px 11px', fontSize: '11px', borderRadius: '99px', border: `1px solid ${C.border}`, cursor: 'pointer',
            background: filterDiv === k ? C.blue : 'transparent',
            color: filterDiv === k ? '#fff' : C.text2, fontWeight: filterDiv === k ? 600 : 400,
          }}>{l}</button>
        ))}
      </div>

      {/* Filter Kategori */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {[['all', 'Semua'], ['mentah', 'Mentah'], ['prepack', 'Prepack'], ['jadi', 'Jadi']].map(([k, l]) => (
          <button key={k} onClick={() => setFilterKat(k)} style={{
            padding: '5px 11px', fontSize: '11px', borderRadius: '99px', border: `1px solid ${C.border}`, cursor: 'pointer',
            background: filterKat === k ? C.text : 'transparent',
            color: filterKat === k ? C.panel : C.text2, fontWeight: filterKat === k ? 600 : 400,
          }}>{l}</button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: C.text3, fontSize: '13px' }}>
          {search ? `Tidak ada bahan "${search}"` : 'Belum ada bahan. Klik ➕ Tambah Bahan.'}
        </div>
      )}

      {filtered.map(b => {
        const statusColor = b.stok_saat_ini < b.stok_minimum ? 'red' : b.stok_saat_ini < b.stok_minimum * 1.5 ? 'yellow' : 'greenLight'
        return (
          <div key={b.id} style={{
            background: C[statusColor + 'Bg'], borderLeft: `3px solid ${C[statusColor + 'Border']}`,
            padding: '11px 12px', borderRadius: '8px', marginBottom: '6px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.nama}
                  <span style={{ fontSize: '10px', color: C.text3, fontWeight: 400, marginLeft: '5px' }}>({b.kategori} · {b.divisi})</span>
                </div>
                <div style={{ fontSize: '11px', color: C[statusColor], marginTop: '2px' }}>
                  Min {b.stok_minimum} {b.satuan_dasar}{b.harga_per_satuan > 0 ? ` · ${formatRupiah(b.harga_per_satuan)}/${b.satuan_dasar}` : ''}
                </div>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: C[statusColor] }}>{b.stok_saat_ini} {b.satuan_dasar}</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button onClick={() => setModal({ mode: 'stok', initial: b })} style={{
                flex: 2, padding: '6px', fontSize: '11px', fontWeight: 600, borderRadius: '6px',
                background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`, cursor: 'pointer',
              }}>📦 + Tambah Stok</button>
              <button onClick={() => setModal({ mode: 'edit', initial: b })} style={{
                flex: 1, padding: '6px', fontSize: '11px', borderRadius: '6px',
                background: 'transparent', color: C.text3, border: `1px solid ${C.border}`, cursor: 'pointer',
              }}>✏️ Edit</button>
              <button onClick={() => setModal({ mode: 'hapus', initial: b })} style={{
                padding: '6px 8px', fontSize: '11px', borderRadius: '6px',
                background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, cursor: 'pointer',
              }}>🗑️</button>
            </div>
          </div>
        )
      })}

      {modal?.mode === 'stok' && (
        <UpdateStokModal item={modal.initial} onClose={() => setModal(null)} />
      )}
      {(modal?.mode === 'add' || modal?.mode === 'edit') && (
        <BahanFormModal
          mode={modal.mode} initial={modal.initial}
          onClose={() => setModal(null)}
          showToast={showToast} loadData={loadData} logAudit={logAudit}
          bahanBaku={bahanBaku} userName={userName}
        />
      )}
      {modal?.mode === 'hapus' && (
        <HapusBahanModal
          item={modal.initial}
          onClose={() => setModal(null)}
          showToast={showToast} loadData={loadData} logAudit={logAudit}
        />
      )}
    </div>
  )
}

// Modal konfirmasi hapus bahan (set is_active = false, data tetap ada)
function HapusBahanModal({ item, onClose, showToast, loadData, logAudit }) {
  const [confirm, setConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleHapus = async () => {
    if (confirm.toLowerCase() !== 'hapus') { showToast('❌ Ketik "hapus" untuk konfirmasi'); return }
    setDeleting(true)
    try {
      await supabase.from('bahan_baku').update({ is_active: false }).eq('id', item.id)
      await logAudit('bahan_baku', item.id, 'deactivate', item, null, { alasan: 'Dihapus manual oleh user' })
      showToast(`✅ ${item.nama} dinonaktifkan`)
      loadData()
      onClose()
    } catch (e) { showToast('❌ ' + e.message) }
    setDeleting(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ background: C.panel, borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '340px' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '28px', textAlign: 'center', marginBottom: '8px' }}>🗑️</div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, textAlign: 'center', marginBottom: '6px' }}>Nonaktifkan bahan ini?</h3>
        <p style={{ fontSize: '12px', color: C.text3, textAlign: 'center', marginBottom: '14px', lineHeight: 1.5 }}>
          <strong>{item.nama}</strong> akan disembunyikan dari daftar stok. Data histori tetap tersimpan dan bisa diaktifkan kembali kapan saja.
        </p>
        <div style={{ background: C.yellowBg, border: `1px solid ${C.yellowBorder}`, borderRadius: '8px', padding: '8px 12px', marginBottom: '14px', fontSize: '11px', color: C.yellow }}>
          ⚠️ Ini tidak menghapus data permanen — hanya menyembunyikan dari tampilan
        </div>
        <label style={S.label}>Ketik <strong>hapus</strong> untuk konfirmasi</label>
        <input
          value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder="hapus" autoFocus
          style={{ ...S.input, marginBottom: '14px', textAlign: 'center', fontWeight: 600 }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{ ...S.btn, ...S.btnSecondary, flex: 1 }}>Batal</button>
          <button onClick={handleHapus} disabled={deleting || confirm.toLowerCase() !== 'hapus'}
            style={{ ...S.btn, ...S.btnDanger, flex: 1, opacity: (deleting || confirm.toLowerCase() !== 'hapus') ? 0.4 : 1 }}>
            {deleting ? 'Proses...' : 'Nonaktifkan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// WASTE VIEW
// =====================================================
function WasteView({ bahanBaku, waste, showToast, loadData, logAudit, setView, userName, setUserName }) {
  const [tab, setTab] = useState('catat')
  const [bahanId, setBahanId] = useState('')
  const [jumlah, setJumlah] = useState('')
  const [alasan, setAlasan] = useState('Gosong')
  const [yangCatat, setYangCatat] = useState(userName)
  const [catatan, setCatatan] = useState('')
  const [foto, setFoto] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [filterWaste, setFilterWaste] = useState('month')
  const [fotoModal, setFotoModal] = useState(null)

  const bahan = bahanBaku.find(b => b.id == bahanId)

  const handleFoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { showToast('❌ Foto max 2MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setFoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!bahanId) { showToast('❌ Pilih bahan'); return }
    if (!jumlah) { showToast('❌ Isi jumlah'); return }
    if (!yangCatat) { showToast('❌ Isi nama'); return }
    setSubmitting(true)
    setUserName(yangCatat)
    try {
      const newId = generateId()
      await supabase.from('waste').insert({
        id: newId, tanggal: formatTanggal(), bahan_id: bahan.id,
        jumlah: Number(jumlah), alasan, catatan, foto,
        yang_catat: yangCatat,
      })
      await supabase.from('bahan_baku').update({
        stok_saat_ini: Math.max(0, bahan.stok_saat_ini - Number(jumlah))
      }).eq('id', bahan.id)
      await logAudit('waste', newId, 'create', bahan.id, bahan.nama, { jumlah: Number(jumlah), alasan })
      showToast('✅ Waste tercatat')
      loadData()
      // Reset form dan pindah ke history
      setBahanId(''); setJumlah(''); setAlasan('Gosong'); setCatatan(''); setFoto('')
      setTab('history')
    } catch (e) { showToast('❌ ' + e.message) }
    setSubmitting(false)
  }

  // Filter history waste
  const now = new Date()
  const wasteFiltered = (waste || []).filter(w => {
    const d = new Date(w.tanggal)
    if (filterWaste === 'today') return w.tanggal === formatTanggal()
    if (filterWaste === 'week')  return d >= new Date(now - 7 * 86400000)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const totalNilai = wasteFiltered.reduce((s, w) => {
    const b = bahanBaku.find(x => x.id === w.bahan_id)
    return s + (w.jumlah || 0) * (b?.harga_per_satuan || 0)
  }, 0)

  // Rekap per alasan
  const byAlasan = {}
  wasteFiltered.forEach(w => {
    byAlasan[w.alasan] = (byAlasan[w.alasan] || 0) + 1
  })

  const alasanColor = { Gosong: 'red', 'Tumpah/jatuh': 'yellow', 'Rusak/bau': 'yellow', 'Salah masak': 'red', Lainnya: 'default' }

  return (
    <div>
      {/* Tab header */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', borderBottom: `1px solid ${C.border}`, paddingBottom: '0' }}>
        {[['catat', '🗑️ Catat Waste'], ['history', '📋 History Waste']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 14px', fontSize: '12px', fontWeight: tab === k ? 600 : 400,
            border: 'none', borderBottom: tab === k ? `2px solid ${C.text}` : '2px solid transparent',
            background: 'transparent', color: tab === k ? C.text : C.text3, cursor: 'pointer',
            marginBottom: '-1px',
          }}>{l}</button>
        ))}
      </div>

      {/* ── TAB: CATAT WASTE ── */}
      {tab === 'catat' && (
        <div>
          <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>Untuk waste mendadak (jatuh, gosong) — busuk/expired biasanya tercatat saat closing</p>

          <FormRow label="Bahan">
            <SearchableSelect
              options={bahanBaku.map(b => ({ value: b.id, label: b.nama, stock: b.stok_saat_ini, satuan: b.satuan_dasar }))}
              value={bahanId} onChange={setBahanId} placeholder="Cari bahan..." showStock={true}
            />
          </FormRow>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <FormRow label="Jumlah"><input type="number" value={jumlah} onChange={e => setJumlah(e.target.value)} step="0.01" style={S.input} /></FormRow>
            <FormRow label="Satuan"><input type="text" value={bahan?.satuan_dasar || ''} readOnly style={{ ...S.input, background: C.panel2 }} /></FormRow>
          </div>

          {/* Preview nilai yang akan terbuang */}
          {bahan && jumlah && bahan.harga_per_satuan > 0 && (
            <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: '8px', padding: '8px 12px', marginBottom: '10px', fontSize: '12px', color: C.red }}>
              💸 Nilai yang terbuang: <strong>{formatRupiah(Math.round(Number(jumlah) * bahan.harga_per_satuan))}</strong>
            </div>
          )}

          <FormRow label="Alasan">
            <select value={alasan} onChange={e => setAlasan(e.target.value)} style={S.input}>
              <option>Gosong</option><option>Tumpah/jatuh</option><option>Rusak/bau</option><option>Salah masak</option><option>Lainnya</option>
            </select>
          </FormRow>

          <FormRow label="Yang catat">
            <input type="text" value={yangCatat} onChange={e => setYangCatat(e.target.value)} placeholder="Nama..." style={S.input} />
          </FormRow>

          <FormRow label="Foto bukti (opsional)">
            <input type="file" accept="image/*" onChange={handleFoto} style={{ ...S.input, padding: '8px' }} />
            {foto && <img src={foto} alt="" style={{ maxWidth: '120px', marginTop: '8px', borderRadius: '6px' }} />}
          </FormRow>

          <FormRow label="Catatan">
            <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} style={S.input} />
          </FormRow>

          <button onClick={handleSubmit} disabled={submitting}
            style={{ ...S.btn, ...S.btnDanger, width: '100%', padding: '13px', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Menyimpan...' : '💾 Simpan Waste'}
          </button>
        </div>
      )}

      {/* ── TAB: HISTORY WASTE ── */}
      {tab === 'history' && (
        <div>
          {/* Filter waktu */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {[['today', 'Hari ini'], ['week', 'Minggu ini'], ['month', 'Bulan ini']].map(([k, l]) => (
              <button key={k} onClick={() => setFilterWaste(k)} style={{
                padding: '5px 11px', fontSize: '11px', borderRadius: '99px', border: `1px solid ${C.border}`,
                cursor: 'pointer', background: filterWaste === k ? C.text : 'transparent',
                color: filterWaste === k ? C.panel : C.text2,
              }}>{l}</button>
            ))}
          </div>

          {/* Ringkasan */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', color: C.text3 }}>Total nilai waste</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: C.red }}>{formatRupiah(Math.round(totalNilai))}</div>
            </div>
            <div style={{ background: C.panel2, borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', color: C.text3 }}>Jumlah kejadian</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: C.text }}>{wasteFiltered.length}x</div>
            </div>
          </div>

          {/* Rekap per alasan */}
          {Object.keys(byAlasan).length > 0 && (
            <div style={{ background: C.panel2, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '12px' }}>
              <div style={{ fontWeight: 600, marginBottom: '6px', color: C.text3 }}>Penyebab waste:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {Object.entries(byAlasan).map(([al, cnt]) => (
                  <span key={al} style={{ ...S.badge(alasanColor[al] || 'default') }}>
                    {al}: {cnt}x
                  </span>
                ))}
              </div>
            </div>
          )}

          {wasteFiltered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: C.text3, fontSize: '13px' }}>
              Tidak ada waste pada periode ini ✅
            </div>
          )}

          {/* Daftar waste */}
          {wasteFiltered.map(w => {
            const b = bahanBaku.find(x => x.id === w.bahan_id)
            const nilaiRp = Math.round((w.jumlah || 0) * (b?.harga_per_satuan || 0))
            return (
              <div key={w.id} style={{
                background: C.panel, border: `1px solid ${C.redBorder}`,
                borderRadius: '10px', padding: '12px 14px', marginBottom: '8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{w.bahan_nama || b?.nama || '-'}</div>
                    <div style={{ fontSize: '12px', color: C.text3, marginTop: '2px' }}>
                      {formatTanggalID(w.tanggal)} · oleh <strong>{w.yang_catat || '-'}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>
                        {w.jumlah} {b?.satuan_dasar || ''}
                      </span>
                      {nilaiRp > 0 && (
                        <span style={{ ...S.badge('red'), fontSize: '11px' }}>
                          💸 {formatRupiah(nilaiRp)}
                        </span>
                      )}
                      <span style={{ ...S.badge(alasanColor[w.alasan] || 'default'), fontSize: '11px' }}>
                        {w.alasan}
                      </span>
                    </div>
                    {w.catatan && (
                      <div style={{ fontSize: '11px', color: C.text3, marginTop: '4px', fontStyle: 'italic' }}>
                        "{w.catatan}"
                      </div>
                    )}
                  </div>
                  {/* Foto thumbnail */}
                  {w.foto && (
                    <img
                      src={w.foto} alt="foto waste"
                      onClick={() => setFotoModal(w.foto)}
                      style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '6px', marginLeft: '10px', cursor: 'pointer', flexShrink: 0 }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal foto besar */}
      {fotoModal && (
        <div onClick={() => setFotoModal(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
        }}>
          <img src={fotoModal} alt="foto" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '10px' }} />
          <div style={{ position: 'absolute', top: '20px', right: '20px', color: '#fff', fontSize: '24px', cursor: 'pointer' }}>✕</div>
        </div>
      )}
    </div>
  )
}

// =====================================================
// HISTORY BELANJA
// =====================================================
function HistoryBelanjaView({ belanja, showToast, loadData }) {
  const [filter, setFilter] = useState('month')
  const [selected, setSelected] = useState(null)
  const [fotoModal, setFotoModal] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editJalur, setEditJalur] = useState('')
  const [editSumber, setEditSumber] = useState('')
  const [editCatatan, setEditCatatan] = useState('')
  const [editItems, setEditItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [confirmHapus, setConfirmHapus] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const now = new Date()

  const deleteNota = async () => {
    setDeleting(true)
    try {
      await supabase.from('belanja').delete().eq('id', selected.id)
      showToast('✅ Nota berhasil dihapus')
      if (loadData) await loadData()
      setSelected(null)
      setConfirmHapus(false)
    } catch (e) { showToast('❌ ' + e.message) }
    setDeleting(false)
  }

  const filtered = belanja.filter(b => {
    const d = new Date(b.tanggal)
    if (filter === 'today') return b.tanggal === formatTanggal()
    if (filter === 'week')  return d >= new Date(now - 7 * 86400000)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const total = filtered.reduce((s, b) => s + (b.total_harga || 0), 0)
  const colorMap = { kecil: 'greenLight', normal: 'blue', darurat: 'red' }

  const startEdit = (nota) => {
    setEditJalur(nota.jalur || 'kecil')
    setEditSumber(nota.sumber_dana || 'kas_kasir')
    setEditCatatan(nota.catatan || '')
    setEditItems((nota.items || []).map(i => ({ ...i })))
    setEditing(true)
  }
  const updateEditItem = (idx, field, val) => setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  const removeEditItem = (idx) => setEditItems(prev => prev.filter((_, i) => i !== idx))
  const addEditItem = () => setEditItems(prev => [...prev, { nama: '', jumlah: '', satuan: '', harga: '' }])
  const totalEdit = editItems.reduce((s, i) => s + (Number(i.harga) || 0), 0)

  const saveEdit = async () => {
    if (editItems.length === 0) { showToast('❌ Minimal 1 item'); return }
    if (editItems.find(i => !i.nama || !i.harga)) { showToast('❌ Lengkapi nama dan harga semua item'); return }
    setSaving(true)
    try {
      const cleanItems = editItems.map(i => ({ nama: i.nama.trim(), jumlah: Number(i.jumlah)||0, satuan: i.satuan||'', harga: Number(i.harga)||0 }))
      await supabase.from('belanja').update({ jalur: editJalur, sumber_dana: editSumber, catatan: editCatatan, items: cleanItems, total_harga: totalEdit }).eq('id', selected.id)
      showToast('✅ Nota berhasil diupdate')
      await loadData()
      setSelected(prev => ({ ...prev, jalur: editJalur, sumber_dana: editSumber, catatan: editCatatan, items: cleanItems, total_harga: totalEdit }))
      setEditing(false)
    } catch (e) { showToast('❌ ' + e.message) }
    setSaving(false)
  }

  if (selected) {
    const items = selected.items || []
    return (
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button onClick={() => { setSelected(null); setEditing(false); setConfirmHapus(false) }}
            style={{ ...S.btn, ...S.btnSecondary, fontSize: '12px', padding: '7px 12px' }}>← Kembali</button>
          {!editing && (
            isNotaEditable(selected.tanggal)
              ? <button onClick={() => startEdit(selected)} style={{ ...S.btn, fontSize: '12px', padding: '7px 12px', background: C.yellowBg, color: C.yellow, border: `1px solid ${C.yellowBorder}` }}>✏️ Edit</button>
              : <div style={{ fontSize: '11px', color: C.text3, padding: '7px 10px', background: C.panel2, borderRadius: '7px' }}>🔒 &gt;30 hari</div>
          )}
          {!editing && (
            <button onClick={() => setConfirmHapus(v => !v)}
              style={{ ...S.btn, fontSize: '12px', padding: '7px 12px', background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, marginLeft: 'auto' }}>
              🗑️ Hapus nota
            </button>
          )}
        </div>

        {confirmHapus && !editing && (
          <div style={{ background: C.panel, border: `1.5px solid ${C.redBorder}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: C.red, marginBottom: '6px' }}>🗑️ Hapus nota ini secara permanen?</div>
            <div style={{ fontSize: '12px', color: C.text3, marginBottom: '12px', lineHeight: 1.5 }}>
              Nota <strong>{selected.yang_belanja}</strong> · <strong>{formatTanggalID(selected.tanggal)}</strong> · <strong>{formatRupiah(selected.total_harga)}</strong> akan dihapus dan <strong style={{ color: C.red }}>tidak bisa dikembalikan</strong>.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setConfirmHapus(false)} style={{ ...S.btn, ...S.btnSecondary, flex: 1 }}>Batal</button>
              <button onClick={deleteNota} disabled={deleting}
                style={{ ...S.btn, ...S.btnDanger, flex: 1, opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Menghapus...' : '✅ Ya, hapus'}
              </button>
            </div>
          </div>
        )}

        {editing ? (
                <option value="darurat">🔴 Darurat</option>
              </select>
              <label style={S.label}>Sumber dana</label>
              <select value={editSumber} onChange={e => setEditSumber(e.target.value)} style={{ ...S.input, marginBottom: '10px' }}>
                <option value="kas_kasir">🏦 Kas kasir</option>
                <option value="kas_bon">📋 Bon / hutang dulu</option>
                <option value="transfer">💳 Transfer</option>
                <option value="pribadi">👤 Dana pribadi</option>
              </select>
              <label style={S.label}>Catatan</label>
              <textarea rows={2} value={editCatatan} onChange={e => setEditCatatan(e.target.value)} style={{ ...S.input, marginBottom: '4px' }} placeholder="Catatan tambahan..." />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: C.text3, marginBottom: '8px' }}>🛍️ Edit item belanja:</div>
              {editItems.map((item, idx) => (
                <div key={idx} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '11px 12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: C.text3 }}>Item {idx + 1}</span>
                    <button onClick={() => removeEditItem(idx)} style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '5px', background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, cursor: 'pointer' }}>✕ Hapus</button>
                  </div>
                  <input type="text" value={item.nama} onChange={e => updateEditItem(idx, 'nama', e.target.value)} placeholder="Nama barang..." style={{ ...S.input, marginBottom: '7px' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    <div><div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Jumlah</div><input type="number" value={item.jumlah} onChange={e => updateEditItem(idx, 'jumlah', e.target.value)} placeholder="0" style={S.input} /></div>
                    <div><div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Satuan</div><input type="text" value={item.satuan} onChange={e => updateEditItem(idx, 'satuan', e.target.value)} placeholder="kg/gram..." style={S.input} /></div>
                    <div><div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Harga (Rp)</div><input type="number" value={item.harga} onChange={e => updateEditItem(idx, 'harga', e.target.value)} placeholder="0" style={S.input} /></div>
                  </div>
                </div>
              ))}
              <button onClick={addEditItem} style={{ width: '100%', padding: '10px', fontSize: '12px', borderRadius: '8px', border: `1.5px dashed ${C.border}`, background: 'transparent', color: C.text3, cursor: 'pointer', marginBottom: '12px' }}>+ Tambah item</button>
              <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: C.text3 }}>Total baru:</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: C.green }}>{formatRupiah(totalEdit)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditing(false)} style={{ ...S.btn, ...S.btnSecondary, flex: 1 }}>Batal</button>
              <button onClick={saveEdit} disabled={saving} style={{ ...S.btn, ...S.btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Menyimpan...' : '✅ Simpan semua perubahan'}</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: C.text }}>🧾 Nota Belanja</div>
                  <div style={{ fontSize: '12px', color: C.text3, marginTop: '2px' }}>{formatTanggalID(selected.tanggal)} · oleh <strong>{selected.yang_belanja || '-'}</strong></div>
                </div>
                <span style={{ ...S.badge(colorMap[selected.jalur] || 'default') }}>{selected.jalur}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: selected.catatan ? '10px' : '0' }}>
                <div style={{ background: C.panel2, borderRadius: '8px', padding: '8px 10px' }}><div style={{ fontSize: '10px', color: C.text3 }}>Total belanja</div><div style={{ fontSize: '16px', fontWeight: 700, color: C.green }}>{formatRupiah(selected.total_harga)}</div></div>
                <div style={{ background: C.panel2, borderRadius: '8px', padding: '8px 10px' }}><div style={{ fontSize: '10px', color: C.text3 }}>Sumber dana</div><div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{selected.sumber_dana?.replace('_', ' ') || '-'}</div></div>
              </div>
              {selected.catatan && <div style={{ fontSize: '12px', color: C.text3, fontStyle: 'italic' }}>📝 {selected.catatan}</div>}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: C.text3, marginBottom: '8px' }}>🛍️ {items.length} item yang dibeli:</div>
            {items.map((item, i) => {
              const h = item.jumlah > 0 ? Math.round(item.harga / item.jumlah) : 0
              return (
                <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '11px 14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{item.nama}</div>
                    <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>
                      {item.jumlah} {item.satuan}
                      {h > 0 && <span style={{ marginLeft: '6px', background: C.greenLightBg, color: C.greenLight, fontSize: '10px', padding: '1px 6px', borderRadius: '99px' }}>{formatRupiah(h)}/{item.satuan}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginLeft: '10px' }}>{formatRupiah(item.harga)}</div>
                </div>
              )
            })}
            {selected.foto_nota && (
              <div style={{ marginTop: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.text3, marginBottom: '8px' }}>📷 Foto nota:</div>
                <img src={selected.foto_nota} alt="foto nota" onClick={() => setFotoModal(selected.foto_nota)} style={{ width: '100%', maxWidth: '300px', borderRadius: '10px', border: `1px solid ${C.border}`, cursor: 'pointer' }} />
              </div>
            )}
          </>
        )}
        {fotoModal && (
          <div onClick={() => setFotoModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <img src={fotoModal} alt="nota" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '10px' }} />
            <div style={{ position: 'absolute', top: '20px', right: '20px', color: '#fff', fontSize: '28px', cursor: 'pointer' }}>✕</div>
          </div>
        )}
      </div>
    )
  }

  // ── List view ──
  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>📜 History Belanja</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>Tap nota untuk lihat & edit detail · {filtered.length} transaksi</p>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {[['today','Hari ini'],['week','Minggu ini'],['month','Bulan ini']].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '5px 11px', fontSize: '11px', borderRadius: '99px', border: `1px solid ${C.border}`, cursor: 'pointer', background: filter === k ? C.text : 'transparent', color: filter === k ? C.panel : C.text2 }}>{l}</button>
        ))}
      </div>
      <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
        💰 Total: <strong style={{ color: C.green }}>{formatRupiah(total)}</strong> · {filtered.length} transaksi
      </div>
      {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: C.text3, fontSize: '13px' }}>Belum ada belanja di periode ini</div>}
      {filtered.map(b => (
        <div key={b.id} onClick={() => setSelected(b)} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.items?.map(i => i.nama).join(', ') || 'Belanja'}</div>
            <div style={{ fontSize: '11px', color: C.text3, marginTop: '3px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={S.badge(colorMap[b.jalur] || 'default')}>{b.jalur}</span>
              <span>{formatTanggalID(b.tanggal)}</span>
              <span>·</span><span>{b.yang_belanja || '-'}</span>
              <span>·</span><span>{b.items?.length || 0} item</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', marginLeft: '12px', flexShrink: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: C.green }}>{formatRupiah(b.total_harga)}</div>
            <div style={{ fontSize: '10px', color: C.text3, marginTop: '2px' }}>tap detail →</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// =====================================================
// RESEP / RECIPE MANAGER
// =====================================================
function ResepView({ role, bahanBaku, showToast, userName }) {
  const [resepList, setResepList] = useState([])
  const [loadingResep, setLoadingResep] = useState(true)
  const [mode, setMode] = useState('list')
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const canEdit = role === 'owner'

  useEffect(() => { fetchResep() }, [])

  const fetchResep = async () => {
    setLoadingResep(true)
    const { data } = await supabase.from('resep').select('*').order('menu_nama')
    setResepList(data || [])
    setLoadingResep(false)
  }

  const filtered = resepList.filter(r => r.menu_nama.toLowerCase().includes(search.toLowerCase()))

  const hitungHPP = (bahanList) =>
    (bahanList || []).reduce((total, item) => {
      const master = bahanBaku.find(b => b.id === item.bahan_id)
      const harga = master?.harga_per_satuan || item.harga_snapshot || 0
      return total + (Number(item.jumlah) || 0) * harga
    }, 0)

  if (mode === 'form') return (
    <ResepForm initial={selected} bahanBaku={bahanBaku} userName={userName} showToast={showToast}
      onSave={async () => { await fetchResep(); setMode('list') }}
      onCancel={() => setMode(selected ? 'view' : 'list')} />
  )

  if (mode === 'view' && selected) {
    const hpp = hitungHPP(selected.bahan_list)
    const margin = selected.harga_jual > 0 ? Math.round(((selected.harga_jual - hpp) / selected.harga_jual) * 100) : null
    const mc = margin === null ? C.text3 : margin >= 60 ? C.green : margin >= 40 ? C.yellow : C.red
    return (
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button onClick={() => setMode('list')} style={{ ...S.btn, ...S.btnSecondary, fontSize: '12px', padding: '7px 12px' }}>← Kembali</button>
          {canEdit && <button onClick={() => setMode('form')} style={{ ...S.btn, fontSize: '12px', padding: '7px 12px', background: C.yellowBg, color: C.yellow, border: `1px solid ${C.yellowBorder}` }}>✏️ Edit resep</button>}
        </div>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '2px' }}>{selected.menu_nama}</div>
          <div style={{ fontSize: '12px', color: C.text3, marginBottom: '12px' }}>Untuk {selected.yield_qty} {selected.yield_satuan}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div style={{ background: C.panel2, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: C.text3 }}>HPP</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: C.red }}>{formatRupiah(Math.round(hpp))}</div>
            </div>
            <div style={{ background: C.panel2, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: C.text3 }}>Harga Jual</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: C.green }}>{selected.harga_jual > 0 ? formatRupiah(selected.harga_jual) : '-'}</div>
            </div>
            <div style={{ background: C.panel2, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: C.text3 }}>Margin</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: mc }}>{margin !== null ? margin + '%' : '-'}</div>
            </div>
          </div>
          {selected.catatan && <div style={{ fontSize: '12px', color: C.text3, marginTop: '10px', fontStyle: 'italic' }}>📝 {selected.catatan}</div>}
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: C.text3, marginBottom: '8px' }}>🥬 Bahan-bahan:</div>
        {(selected.bahan_list || []).map((item, i) => {
          const master = bahanBaku.find(b => b.id === item.bahan_id)
          const harga = master?.harga_per_satuan || item.harga_snapshot || 0
          const subtotal = Math.round((Number(item.jumlah) || 0) * harga)
          return (
            <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '9px', padding: '10px 14px', marginBottom: '7px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{master?.nama || item.nama_snapshot || '-'}</div>
                <div style={{ fontSize: '11px', color: C.text3 }}>{item.jumlah} {item.satuan || master?.satuan_dasar} × {formatRupiah(harga)}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{formatRupiah(subtotal)}</div>
            </div>
          )
        })}
        <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: C.red }}>Total HPP</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: C.red }}>{formatRupiah(Math.round(hpp))}</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 600, margin: '0 0 2px' }}>📖 Standar Resep</h2>
          <p style={{ fontSize: '12px', color: C.text3, margin: 0 }}>{canEdit ? 'Tap resep untuk edit · + untuk tambah baru' : 'Panduan standar dapur Piccolo'}</p>
        </div>
        {canEdit && <button onClick={() => { setSelected(null); setMode('form') }} style={{ ...S.btn, ...S.btnPrimary, padding: '8px 14px', fontSize: '12px' }}>+ Tambah</button>}
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Cari nama menu..." style={{ ...S.input, marginBottom: '12px' }} />
      {loadingResep && <div style={{ textAlign: 'center', padding: '24px', color: C.text3 }}>Memuat resep...</div>}
      {!loadingResep && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 20px', background: C.panel2, borderRadius: '12px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📖</div>
          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>Belum ada resep</div>
          <div style={{ fontSize: '12px', color: C.text3 }}>{canEdit ? 'Tap "+ Tambah" untuk mulai isi standar resep menu Piccolo.' : 'Hubungi Tissa atau Diandra untuk menambahkan resep.'}</div>
        </div>
      )}
      {filtered.map(r => {
        const hpp = hitungHPP(r.bahan_list)
        const margin = r.harga_jual > 0 ? Math.round(((r.harga_jual - hpp) / r.harga_jual) * 100) : null
        return (
          <div key={r.id} onClick={() => { setSelected(r); setMode('view') }}
            style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{r.menu_nama}</div>
              <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>{(r.bahan_list || []).length} bahan · untuk {r.yield_qty} {r.yield_satuan}</div>
            </div>
            <div style={{ textAlign: 'right', marginLeft: '12px', flexShrink: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: C.red }}>HPP {formatRupiah(Math.round(hpp))}</div>
              {margin !== null && <div style={{ fontSize: '11px', color: margin >= 60 ? C.green : margin >= 40 ? C.yellow : C.red }}>Margin {margin}%</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResepForm({ initial, bahanBaku, userName, showToast, onSave, onCancel }) {
  const isEdit = !!initial
  const [menuNama, setMenuNama] = useState(initial?.menu_nama || '')
  const [yieldQty, setYieldQty] = useState(initial?.yield_qty || 1)
  const [yieldSatuan, setYieldSatuan] = useState(initial?.yield_satuan || 'porsi')
  const [hargaJual, setHargaJual] = useState(initial?.harga_jual || '')
  const [catatan, setCatatan] = useState(initial?.catatan || '')
  const [bahanList, setBahanList] = useState(
    initial?.bahan_list?.length > 0 ? initial.bahan_list
      : [{ bahan_id: '', jumlah: '', satuan: '', harga_snapshot: 0, nama_snapshot: '' }]
  )
  const [saving, setSaving] = useState(false)

  const updateBahan = (idx, field, val) => setBahanList(prev => prev.map((b, i) => i === idx ? { ...b, [field]: val } : b))
  const pickBahan = (idx, bahanId) => {
    const master = bahanBaku.find(b => b.id === bahanId)
    setBahanList(prev => prev.map((b, i) => i === idx ? { ...b, bahan_id: bahanId, satuan: master?.satuan_dasar || '', harga_snapshot: master?.harga_per_satuan || 0, nama_snapshot: master?.nama || '' } : b))
  }
  const addBahan = () => setBahanList(prev => [...prev, { bahan_id: '', jumlah: '', satuan: '', harga_snapshot: 0, nama_snapshot: '' }])
  const removeBahan = (idx) => setBahanList(prev => prev.filter((_, i) => i !== idx))

  const totalHPP = bahanList.reduce((s, item) => {
    const master = bahanBaku.find(b => b.id === item.bahan_id)
    return s + (Number(item.jumlah) || 0) * (master?.harga_per_satuan || item.harga_snapshot || 0)
  }, 0)

  const handleSave = async () => {
    if (!menuNama.trim()) { showToast('❌ Isi nama menu'); return }
    if (bahanList.find(b => !b.bahan_id || !b.jumlah)) { showToast('❌ Lengkapi semua bahan'); return }
    setSaving(true)
    try {
      const payload = {
        menu_nama: menuNama.trim(), yield_qty: Number(yieldQty)||1, yield_satuan: yieldSatuan||'porsi',
        harga_jual: Number(hargaJual)||0, catatan: catatan.trim(), created_by: userName, updated_at: new Date().toISOString(),
        bahan_list: bahanList.map(b => {
          const master = bahanBaku.find(x => x.id === b.bahan_id)
          return { bahan_id: b.bahan_id, jumlah: Number(b.jumlah)||0, satuan: b.satuan||master?.satuan_dasar||'', harga_snapshot: master?.harga_per_satuan||0, nama_snapshot: master?.nama||'' }
        }),
      }
      if (isEdit) { await supabase.from('resep').update(payload).eq('id', initial.id) }
      else { await supabase.from('resep').insert({ ...payload, id: generateId() }) }
      showToast(isEdit ? '✅ Resep diupdate' : '✅ Resep disimpan')
      onSave()
    } catch (e) { showToast('❌ ' + e.message) }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!window.confirm('Hapus resep ini?')) return
    await supabase.from('resep').delete().eq('id', initial.id)
    showToast('✅ Resep dihapus')
    onSave()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
        <button onClick={onCancel} style={{ ...S.btn, ...S.btnSecondary, fontSize: '12px', padding: '7px 12px' }}>← Batal</button>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{isEdit ? 'Edit Resep' : 'Resep Baru'}</h2>
      </div>
      <FormRow label="Nama menu"><input value={menuNama} onChange={e => setMenuNama(e.target.value)} placeholder="Contoh: Ayam Bakar Bumbu Rempah" style={S.input} /></FormRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <FormRow label="Untuk berapa"><input type="number" value={yieldQty} onChange={e => setYieldQty(e.target.value)} style={S.input} min="1" /></FormRow>
        <FormRow label="Satuan"><select value={yieldSatuan} onChange={e => setYieldSatuan(e.target.value)} style={S.input}><option>porsi</option><option>pcs</option><option>gram</option><option>liter</option><option>batch</option></select></FormRow>
        <FormRow label="Harga jual (Rp)"><input type="number" value={hargaJual} onChange={e => setHargaJual(e.target.value)} placeholder="0" style={S.input} /></FormRow>
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: C.text3, margin: '12px 0 8px' }}>🥬 Bahan-bahan:</div>
      {bahanList.map((item, idx) => {
        const master = bahanBaku.find(b => b.id === item.bahan_id)
        return (
          <div key={idx} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px 12px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: C.text3 }}>Bahan {idx + 1}</span>
              {bahanList.length > 1 && <button onClick={() => removeBahan(idx)} style={{ padding: '2px 7px', fontSize: '11px', borderRadius: '4px', background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, cursor: 'pointer' }}>✕</button>}
            </div>
            <SearchableSelect
              options={bahanBaku.filter(b => b.kategori === 'mentah').map(b => ({ value: b.id, label: b.nama, stock: b.stok_saat_ini, satuan: b.satuan_dasar }))}
              value={item.bahan_id} onChange={val => pickBahan(idx, val)} placeholder="Pilih bahan mentah..." showStock={false} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '7px' }}>
              <div><div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Jumlah</div><input type="number" value={item.jumlah} onChange={e => updateBahan(idx, 'jumlah', e.target.value)} placeholder="0" style={S.input} step="0.1" /></div>
              <div><div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Satuan</div><input type="text" value={item.satuan || master?.satuan_dasar || ''} onChange={e => updateBahan(idx, 'satuan', e.target.value)} placeholder="gr/ml/pcs" style={S.input} /></div>
            </div>
            {master && item.jumlah && <div style={{ fontSize: '11px', color: C.text3, marginTop: '4px' }}>💰 {formatRupiah(Math.round(Number(item.jumlah) * (master.harga_per_satuan||0)))}</div>}
          </div>
        )
      })}
      <button onClick={addBahan} style={{ width: '100%', padding: '9px', fontSize: '12px', borderRadius: '8px', border: `1.5px dashed ${C.border}`, background: 'transparent', color: C.text3, cursor: 'pointer', marginBottom: '12px' }}>+ Tambah bahan</button>
      <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: C.text3 }}>HPP estimasi:</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: C.red }}>{formatRupiah(Math.round(totalHPP))}</span>
      </div>
      {hargaJual > 0 && totalHPP > 0 && (
        <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: '8px', padding: '8px 14px', marginBottom: '10px', fontSize: '12px', color: C.green }}>
          💚 Margin: {Math.round(((Number(hargaJual)-totalHPP)/Number(hargaJual))*100)}% · Profit: {formatRupiah(Math.round(Number(hargaJual)-totalHPP))} per {yieldSatuan}
        </div>
      )}
      <FormRow label="Catatan / cara masak (opsional)"><textarea rows={3} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Urutan masak, tips, catatan standar..." style={S.input} /></FormRow>
      <button onClick={handleSave} disabled={saving} style={{ ...S.btn, ...S.btnPrimary, width: '100%', padding: '13px', marginBottom: isEdit ? '8px' : '0', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Menyimpan...' : (isEdit ? '✅ Update resep' : '✅ Simpan resep baru')}
      </button>
      {isEdit && <button onClick={handleDelete} style={{ ...S.btn, ...S.btnDanger, width: '100%', padding: '10px' }}>🗑️ Hapus resep ini</button>}
    </div>
  )
}

// Komponen belanja tab untuk Owner Dashboard
function BelanjaTabOwner({ belanja, showToast, loadData }) {
  const [filter, setFilter] = useState('month')
  const [selected, setSelected] = useState(null)
  const [fotoModal, setFotoModal] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editJalur, setEditJalur] = useState('')
  const [editSumber, setEditSumber] = useState('')
  const [editCatatan, setEditCatatan] = useState('')
  const [editItems, setEditItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [confirmHapus, setConfirmHapus] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const now = new Date()

  const deleteNota = async () => {
    setDeleting(true)
    try {
      await supabase.from('belanja').delete().eq('id', selected.id)
      showToast('✅ Nota berhasil dihapus')
      if (loadData) await loadData()
      setSelected(null)
      setConfirmHapus(false)
    } catch (e) { showToast('❌ ' + e.message) }
    setDeleting(false)
  }

  const filtered = belanja.filter(b => {
    const d = new Date(b.tanggal)
    if (filter === 'today') return b.tanggal === formatTanggal()
    if (filter === 'week')  return d >= new Date(now - 7 * 86400000)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const total = filtered.reduce((s, b) => s + (b.total_harga || 0), 0)
  const colorMap = { kecil: 'greenLight', normal: 'blue', darurat: 'red' }

  const startEdit = (nota) => {
    setEditJalur(nota.jalur || 'kecil')
    setEditSumber(nota.sumber_dana || 'kas_kasir')
    setEditCatatan(nota.catatan || '')
    setEditItems((nota.items || []).map(i => ({ ...i })))
    setEditing(true)
  }
  const updateEditItem = (idx, field, val) => setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  const removeEditItem = (idx) => setEditItems(prev => prev.filter((_, i) => i !== idx))
  const addEditItem = () => setEditItems(prev => [...prev, { nama: '', jumlah: '', satuan: '', harga: '' }])
  const totalEdit = editItems.reduce((s, i) => s + (Number(i.harga) || 0), 0)

  const saveEdit = async () => {
    if (editItems.length === 0) { showToast('❌ Minimal 1 item'); return }
    if (editItems.find(i => !i.nama || !i.harga)) { showToast('❌ Lengkapi nama dan harga semua item'); return }
    setSaving(true)
    try {
      const cleanItems = editItems.map(i => ({ nama: i.nama.trim(), jumlah: Number(i.jumlah)||0, satuan: i.satuan||'', harga: Number(i.harga)||0 }))
      await supabase.from('belanja').update({ jalur: editJalur, sumber_dana: editSumber, catatan: editCatatan, items: cleanItems, total_harga: totalEdit }).eq('id', selected.id)
      showToast('✅ Nota berhasil diupdate')
      if (loadData) await loadData()
      setSelected(prev => ({ ...prev, jalur: editJalur, sumber_dana: editSumber, catatan: editCatatan, items: cleanItems, total_harga: totalEdit }))
      setEditing(false)
    } catch (e) { showToast('❌ ' + e.message) }
    setSaving(false)
  }

  if (selected) {
    const items = selected.items || []
    const editable = isNotaEditable(selected.tanggal)
    return (
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button onClick={() => { setSelected(null); setEditing(false); setConfirmHapus(false) }} style={{ ...S.btn, ...S.btnSecondary, fontSize: '12px', padding: '7px 12px' }}>← Kembali</button>
          {!editing && (
            editable
              ? <button onClick={() => startEdit(selected)} style={{ ...S.btn, fontSize: '12px', padding: '7px 12px', background: C.yellowBg, color: C.yellow, border: `1px solid ${C.yellowBorder}` }}>✏️ Edit</button>
              : <div style={{ fontSize: '11px', color: C.text3, padding: '7px 10px', background: C.panel2, borderRadius: '7px' }}>🔒 &gt;30 hari</div>
          )}
          {!editing && (
            <button onClick={() => setConfirmHapus(v => !v)}
              style={{ ...S.btn, fontSize: '12px', padding: '7px 12px', background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, marginLeft: 'auto' }}>
              🗑️ Hapus nota
            </button>
          )}
        </div>

        {confirmHapus && !editing && (
          <div style={{ background: C.panel, border: `1.5px solid ${C.redBorder}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: C.red, marginBottom: '6px' }}>🗑️ Hapus nota ini secara permanen?</div>
            <div style={{ fontSize: '12px', color: C.text3, marginBottom: '12px', lineHeight: 1.5 }}>
              Nota <strong>{selected.yang_belanja}</strong> · <strong>{formatTanggalID(selected.tanggal)}</strong> · <strong>{formatRupiah(selected.total_harga)}</strong> akan dihapus dan tidak bisa dikembalikan.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setConfirmHapus(false)} style={{ ...S.btn, ...S.btnSecondary, flex: 1 }}>Batal</button>
              <button onClick={deleteNota} disabled={deleting} style={{ ...S.btn, ...S.btnDanger, flex: 1, opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Menghapus...' : '✅ Ya, hapus'}
              </button>
            </div>
          </div>
        )}

        {editing ? (
          <div>
            <div style={{ background: C.panel, border: `1.5px solid ${C.yellowBorder}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: C.yellow, marginBottom: '12px' }}>✏️ Edit nota</div>
              <label style={S.label}>Jalur belanja</label>
              <select value={editJalur} onChange={e => setEditJalur(e.target.value)} style={{ ...S.input, marginBottom: '10px' }}>
                <option value="kecil">🟢 Kecil (&lt; Rp 100rb · kas kasir)</option>
                <option value="normal">🔵 Normal (transfer/bon)</option>
                <option value="darurat">🔴 Darurat</option>
              </select>
              <label style={S.label}>Sumber dana</label>
              <select value={editSumber} onChange={e => setEditSumber(e.target.value)} style={{ ...S.input, marginBottom: '10px' }}>
                <option value="kas_kasir">🏦 Kas kasir</option>
                <option value="kas_bon">📋 Bon / hutang dulu</option>
                <option value="transfer">💳 Transfer</option>
                <option value="pribadi">👤 Dana pribadi</option>
              </select>
              <label style={S.label}>Catatan</label>
              <textarea rows={2} value={editCatatan} onChange={e => setEditCatatan(e.target.value)} style={{ ...S.input, marginBottom: '4px' }} placeholder="Catatan tambahan..." />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: C.text3, marginBottom: '8px' }}>🛍️ Edit item belanja:</div>
              {editItems.map((item, idx) => (
                <div key={idx} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '11px 12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: C.text3 }}>Item {idx + 1}</span>
                    <button onClick={() => removeEditItem(idx)} style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '5px', background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, cursor: 'pointer' }}>✕</button>
                  </div>
                  <input type="text" value={item.nama} onChange={e => updateEditItem(idx, 'nama', e.target.value)} placeholder="Nama barang..." style={{ ...S.input, marginBottom: '7px' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    <div><div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Jumlah</div><input type="number" value={item.jumlah} onChange={e => updateEditItem(idx, 'jumlah', e.target.value)} placeholder="0" style={S.input} /></div>
                    <div><div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Satuan</div><input type="text" value={item.satuan} onChange={e => updateEditItem(idx, 'satuan', e.target.value)} placeholder="kg/gram..." style={S.input} /></div>
                    <div><div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Harga (Rp)</div><input type="number" value={item.harga} onChange={e => updateEditItem(idx, 'harga', e.target.value)} placeholder="0" style={S.input} /></div>
                  </div>
                </div>
              ))}
              <button onClick={addEditItem} style={{ width: '100%', padding: '9px', fontSize: '12px', borderRadius: '8px', border: `1.5px dashed ${C.border}`, background: 'transparent', color: C.text3, cursor: 'pointer', marginBottom: '12px' }}>+ Tambah item</button>
              <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: C.text3 }}>Total baru:</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: C.green }}>{formatRupiah(totalEdit)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditing(false)} style={{ ...S.btn, ...S.btnSecondary, flex: 1 }}>Batal</button>
              <button onClick={saveEdit} disabled={saving} style={{ ...S.btn, ...S.btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Menyimpan...' : '✅ Simpan perubahan'}</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>🧾 Nota Belanja</div>
                  <div style={{ fontSize: '12px', color: C.text3, marginTop: '2px' }}>{formatTanggalID(selected.tanggal)} · oleh <strong>{selected.yang_belanja || '-'}</strong></div>
                </div>
                <span style={S.badge(colorMap[selected.jalur] || 'default')}>{selected.jalur}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: selected.catatan ? '8px' : '0' }}>
                <div style={{ background: C.panel2, borderRadius: '7px', padding: '7px 10px' }}><div style={{ fontSize: '10px', color: C.text3 }}>Total</div><div style={{ fontSize: '15px', fontWeight: 700, color: C.green }}>{formatRupiah(selected.total_harga)}</div></div>
                <div style={{ background: C.panel2, borderRadius: '7px', padding: '7px 10px' }}><div style={{ fontSize: '10px', color: C.text3 }}>Sumber dana</div><div style={{ fontSize: '12px', fontWeight: 600 }}>{selected.sumber_dana?.replace('_', ' ') || '-'}</div></div>
              </div>
              {selected.catatan && <div style={{ fontSize: '12px', color: C.text3, fontStyle: 'italic' }}>📝 {selected.catatan}</div>}
            </div>
            {items.map((item, i) => {
              const h = item.jumlah > 0 ? Math.round(item.harga / item.jumlah) : 0
              return (
                <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '11px 14px', marginBottom: '7px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.nama}</div>
                    <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>{item.jumlah} {item.satuan}{h > 0 && <span style={{ marginLeft: '6px', background: C.greenLightBg, color: C.greenLight, fontSize: '10px', padding: '1px 6px', borderRadius: '99px' }}>{formatRupiah(h)}/{item.satuan}</span>}</div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginLeft: '10px' }}>{formatRupiah(item.harga)}</div>
                </div>
              )
            })}
            {selected.foto_nota && (
              <div style={{ marginTop: '8px' }}><div style={{ fontSize: '11px', color: C.text3, marginBottom: '6px' }}>📷 Foto nota:</div>
                <img src={selected.foto_nota} alt="nota" onClick={() => setFotoModal(selected.foto_nota)} style={{ width: '100%', maxWidth: '280px', borderRadius: '8px', border: `1px solid ${C.border}`, cursor: 'pointer' }} />
              </div>
            )}
          </>
        )}
        {fotoModal && (
          <div onClick={() => setFotoModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <img src={fotoModal} alt="nota" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '10px' }} />
            <div style={{ position: 'absolute', top: '20px', right: '20px', color: '#fff', fontSize: '28px', cursor: 'pointer' }}>✕</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {[['today','Hari ini'],['week','Minggu ini'],['month','Bulan ini']].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '99px', border: `1px solid ${C.border}`, cursor: 'pointer', background: filter === k ? C.text : 'transparent', color: filter === k ? C.panel : C.text2 }}>{l}</button>
        ))}
      </div>
      <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, padding: '7px 12px', borderRadius: '7px', fontSize: '12px', marginBottom: '10px' }}>
        💰 <strong style={{ color: C.green }}>{formatRupiah(total)}</strong> · {filtered.length} transaksi · tap untuk detail & edit
      </div>
      {filtered.map(b => {
        const editable = isNotaEditable(b.tanggal)
        return (
          <div key={b.id} onClick={() => setSelected(b)} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '9px', padding: '11px 12px', marginBottom: '7px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.items?.map(i => i.nama).join(', ')}</div>
              <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>
                <span style={{ ...S.badge(colorMap[b.jalur] || 'default'), marginRight: '5px' }}>{b.jalur}</span>
                {formatTanggalID(b.tanggal)} · {b.yang_belanja} · {b.items?.length} item
                {!editable && <span style={{ marginLeft: '5px', fontSize: '10px' }}>🔒</span>}
              </div>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: C.green, marginLeft: '8px', flexShrink: 0 }}>{formatRupiah(b.total_harga)}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── WasteTabOwner — komponen proper, bukan IIFE ───
function WasteTabOwner({ waste, bahanBaku, showToast }) {
  const [wasteFilter, setWasteFilter] = useState('month')
  const [selectedWaste, setSelectedWaste] = useState(null)
  const now = new Date()

  const filteredWaste = (waste || []).filter(w => {
    const d = new Date(w.tanggal)
    if (wasteFilter === 'today') return w.tanggal === formatTanggal()
    if (wasteFilter === 'week')  return d >= new Date(now - 7 * 86400000)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const wasteWithValue = filteredWaste.map(w => {
    const bahan = bahanBaku.find(x => x.id === w.bahan_id)
    const harga = Number(bahan?.harga_per_satuan) || 0
    const nilai = Math.round((Number(w.jumlah) || 0) * harga)
    return { ...w, bahan_nama: w.bahan_nama || bahan?.nama || '-', satuan: w.satuan || bahan?.satuan_dasar || '-', nilai_rp: nilai }
  })

  const totalNilai = wasteWithValue.reduce((s, w) => s + w.nilai_rp, 0)
  const alasanCount = {}
  wasteWithValue.forEach(w => { alasanCount[w.alasan] = (alasanCount[w.alasan] || 0) + 1 })
  const topAlasan = Object.entries(alasanCount).sort((a, b) => b[1] - a[1])

  const exportWaste = () => {
    const data = wasteWithValue.map(w => ({
      Tanggal: w.tanggal, 'Nama Bahan': w.bahan_nama, Jumlah: w.jumlah, Satuan: w.satuan,
      'Harga/Satuan (Rp)': bahanBaku.find(x => x.id === w.bahan_id)?.harga_per_satuan || 0,
      'Nilai Kerugian (Rp)': w.nilai_rp, Alasan: w.alasan,
      'Yang Catat': w.yang_catat || '-', Catatan: w.catatan || '', 'Ada Foto': w.foto ? 'Ya' : 'Tidak',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{wch:14},{wch:24},{wch:8},{wch:8},{wch:18},{wch:20},{wch:16},{wch:14},{wch:24},{wch:10}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Waste Report')
    XLSX.writeFile(wb, `Waste_Piccolo_${formatTanggal()}.xlsx`)
    showToast('✅ Waste report diunduh')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['today','Hari ini'],['week','Minggu ini'],['month','Bulan ini']].map(([k,l]) => (
            <button key={k} onClick={() => setWasteFilter(k)} style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '99px', border: `1px solid ${C.border}`, cursor: 'pointer', background: wasteFilter === k ? C.text : 'transparent', color: wasteFilter === k ? C.panel : C.text2 }}>{l}</button>
          ))}
        </div>
        <button onClick={exportWaste} style={{ ...S.btn, ...S.btnSecondary, fontSize: '11px', padding: '6px 10px' }}>📥 Export</button>
      </div>

      <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: topAlasan.length > 0 ? '8px' : '0' }}>
          <div><div style={{ fontSize: '11px', color: C.text3 }}>Total kejadian</div><div style={{ fontSize: '22px', fontWeight: 700, color: C.red }}>{wasteWithValue.length}</div></div>
          <div><div style={{ fontSize: '11px', color: C.text3 }}>Total nilai kerugian</div><div style={{ fontSize: '22px', fontWeight: 700, color: C.red }}>{formatRupiah(totalNilai)}</div></div>
        </div>
        {topAlasan.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {topAlasan.map(([alasan, count]) => (
              <span key={alasan} style={{ fontSize: '11px', background: C.redBorder, color: C.red, padding: '2px 8px', borderRadius: '99px' }}>{alasan}: {count}×</span>
            ))}
          </div>
        )}
      </div>

      {wasteWithValue.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: C.text3, fontSize: '13px' }}>✅ Tidak ada waste di periode ini</div>}

      {wasteWithValue.map(w => (
        <div key={w.id} onClick={() => setSelectedWaste(selectedWaste?.id === w.id ? null : w)}
          style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '11px 14px', marginBottom: '6px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{w.bahan_nama}</div>
              <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>{formatTanggalID(w.tanggal)} · oleh {w.yang_catat || '-'}</div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', background: C.yellowBg, color: C.yellow, padding: '2px 7px', borderRadius: '99px' }}>{w.alasan}</span>
                {w.foto && <span style={{ fontSize: '11px', background: C.blueBg, color: C.blue, padding: '2px 7px', borderRadius: '99px' }}>📷 Ada foto</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right', marginLeft: '12px', flexShrink: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: C.red }}>{w.jumlah} {w.satuan}</div>
              {w.nilai_rp > 0
                ? <div style={{ fontSize: '12px', color: C.red }}>{formatRupiah(w.nilai_rp)}</div>
                : <div style={{ fontSize: '10px', color: C.text3 }}>Harga belum diset</div>
              }
            </div>
          </div>
          {selectedWaste?.id === w.id && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${C.panel2}` }}>
              {w.catatan && <div style={{ fontSize: '12px', color: C.text2, marginBottom: '8px' }}>📝 <em>{w.catatan}</em></div>}
              {w.foto
                ? <img src={w.foto} alt="bukti waste" style={{ width: '100%', maxWidth: '280px', borderRadius: '8px', border: `1px solid ${C.border}` }} />
                : <div style={{ fontSize: '11px', color: C.text3 }}>Tidak ada foto bukti</div>
              }
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// =====================================================
// OWNER DASHBOARD
// =====================================================
function OwnerDashboardView({ bahanBaku, produksi, belanja, closing, waste, auditLog, showToast, loadData }) {
  const [tab, setTab] = useState('produksi')
  const [searchHPP, setSearchHPP] = useState('')
  const [selectedProduksi, setSelectedProduksi] = useState(null)
  const [showStokLow, setShowStokLow] = useState(false)
  // Filter tanggal untuk export History Stok
  const [exportDateFrom, setExportDateFrom] = useState('')
  const [exportDateTo, setExportDateTo] = useState('')
  const [exportingClosing, setExportingClosing] = useState(false)

  const exportExcel = (type) => {
    let data, filename
    if (type === 'stok') {
      data = bahanBaku.map(b => ({
        Nama: b.nama, Kategori: b.kategori, Divisi: b.divisi,
        'Stok Saat Ini': b.stok_saat_ini, Satuan: b.satuan_dasar,
        'Stok Minimum': b.stok_minimum, 'Harga/Satuan': b.harga_per_satuan,
      }))
      filename = `Stok_Piccolo_${formatTanggal()}.xlsx`
    } else if (type === 'belanja') {
      data = []
      belanja.forEach(bl => {
        bl.items?.forEach((it, idx) => {
          data.push({
            Tanggal: bl.tanggal,
            'Nama Barang': it.nama,
            Jumlah: it.jumlah,
            Satuan: it.satuan,
            'Harga': it.harga,
            Jalur: bl.jalur,
            'Sumber Dana': bl.sumber_dana,
            'Yang Belanja': bl.yang_belanja,
            'Total Nota': idx === 0 ? bl.total_harga : '',
            Catatan: idx === 0 ? bl.catatan : '',
          })
        })
      })
      filename = `Belanja_Piccolo_${formatTanggal()}.xlsx`
    } else if (type === 'produksi') {
      data = []
      produksi.forEach(p => {
        const bahanArr = Array.isArray(p.bahan_baku) ? p.bahan_baku : []
        const totalCogs = p.total_cogs || bahanArr.reduce((s, b) => s + (b.cogs_bahan || 0), 0)
        const cogsPorsi = p.cogs_per_porsi || (p.hasil_porsi > 0 ? totalCogs / p.hasil_porsi : 0)
        if (bahanArr.length === 0) {
          data.push({
            Tanggal: p.tanggal, 'Produk': p.menu_nama, Divisi: p.menu_kategori,
            'Bahan Baku': '-', 'Jumlah': '-', 'Satuan': '-', 'Harga/Sat': '-', 'COGS Bahan': '-',
            'Total COGS': totalCogs, 'Hasil': p.hasil_pcs, 'Satuan Hasil': '',
            'Hasil Porsi': p.hasil_porsi, 'COGS/Porsi': Math.round(cogsPorsi),
            'Yang Masak': p.yang_masak, Status: p.status, Catatan: p.catatan || '',
          })
        } else {
          bahanArr.forEach((b, idx) => {
            data.push({
              Tanggal: idx === 0 ? p.tanggal : '',
              'Produk': idx === 0 ? p.menu_nama : '',
              Divisi: idx === 0 ? p.menu_kategori : '',
              'Bahan Baku': b.nama,
              'Jumlah': b.jumlah,
              'Satuan': b.satuan,
              'Harga/Sat': b.harga_per_satuan || 0,
              'COGS Bahan': b.cogs_bahan || (b.jumlah * (b.harga_per_satuan || 0)),
              'Total COGS': idx === 0 ? totalCogs : '',
              'Hasil': idx === 0 ? p.hasil_pcs : '',
              'Satuan Hasil': idx === 0 ? (bahanBaku.find(x => x.id === p.menu_id)?.satuan_dasar || '') : '',
              'Hasil Porsi': idx === 0 ? p.hasil_porsi : '',
              'COGS/Porsi': idx === 0 ? Math.round(cogsPorsi) : '',
              'Yang Masak': idx === 0 ? p.yang_masak : '',
              Status: idx === 0 ? p.status : '',
              Catatan: idx === 0 ? (p.catatan || '') : '',
            })
          })
        }
      })
      filename = `Produksi_COGS_Piccolo_${formatTanggal()}.xlsx`
    }

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, type)
    XLSX.writeFile(wb, filename)
    showToast('✅ File diunduh')
  }

  // Export History Stok — async, dengan filter tanggal + kolom baru
  const exportHistoryStok = async () => {
    setExportingClosing(true)
    try {
      let query = supabase
        .from('closing_stok')
        .select(`id, tanggal, prediksi_sistem, sisa_aktual, selisih, yang_closing, catatan, bahan_id`)
        .order('tanggal', { ascending: false })
        .order('id', { ascending: false })

      if (exportDateFrom) query = query.gte('tanggal', exportDateFrom)
      if (exportDateTo)   query = query.lte('tanggal', exportDateTo)

      const { data, error } = await query
      if (error || !data) { showToast('❌ Gagal: ' + (error?.message || 'unknown')); return }

      const allRows = data.map(row => {
        const bahan = bahanBaku.find(x => x.id === row.bahan_id)
        const harga   = Number(bahan?.harga_per_satuan) || 0
        const sebelum = Number(row.prediksi_sistem) || 0
        const sesudah = Number(row.sisa_aktual)    || 0
        const selisih = row.selisih !== null ? Number(row.selisih) : (sesudah - sebelum)
        const nilaiRp = Math.round(selisih * harga)
        let ket = 'Aman'
        if (selisih < 0) ket = 'Terpakai (masuk COGS)'
        else if (selisih > 0) ket = 'Perlu cek'
        return {
          'Tanggal Closing':         row.tanggal,
          'Nama Bahan':              bahan?.nama || '-',
          'Satuan':                  bahan?.satuan_dasar || '-',
          'Divisi':                  bahan?.divisi || '-',
          'Stok Sebelum (Sistem)':   sebelum,
          'Stok Sesudah (Aktual)':   sesudah,
          'Selisih':                 selisih,
          'Harga/Satuan (Rp)':       harga,
          'Nilai Selisih (Rp)':      nilaiRp,
          'Keterangan':              ket,
          'Diupdate Oleh':           row.yang_closing || '-',
          'Catatan':                 row.catatan || '',
        }
      })

      // Sheet 2 — hanya baris berselisih, langsung pakai untuk jurnal Accurate
      const accurateRows = allRows.filter(r => r['Selisih'] !== 0)

      const colWidths = [
        {wch:16},{wch:26},{wch:8},{wch:10},
        {wch:22},{wch:22},{wch:10},{wch:20},
        {wch:20},{wch:24},{wch:16},{wch:24}
      ]

      const wb  = XLSX.utils.book_new()
      const ws1 = XLSX.utils.json_to_sheet(allRows)
      ws1['!cols'] = colWidths
      XLSX.utils.book_append_sheet(wb, ws1, 'History Stok')

      if (accurateRows.length > 0) {
        const ws2 = XLSX.utils.json_to_sheet(accurateRows)
        ws2['!cols'] = colWidths
        XLSX.utils.book_append_sheet(wb, ws2, 'Untuk Accurate')
      }

      const rangeLabel = exportDateFrom && exportDateTo
        ? `${exportDateFrom}_sd_${exportDateTo}`
        : formatTanggal()
      XLSX.writeFile(wb, `History_Stok_Piccolo_${rangeLabel}.xlsx`)
      showToast(`✅ ${allRows.length} baris diunduh · sheet "Untuk Accurate" ada ${accurateRows.length} baris`)
    } catch (err) {
      showToast('❌ Error: ' + err.message)
    }
    setExportingClosing(false)
  }

  const totalProduksi = produksi.length
  const totalBelanja = belanja.length
  const stokRendahList = bahanBaku.filter(b => b.stok_saat_ini < b.stok_minimum && b.is_active)
  const stokRendah = stokRendahList.length
  const expiring = bahanBaku.filter(b => {
    const d = daysFromNow(b.expired_terdekat)
    return d !== null && d <= 2 && d >= 0
  }).length

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>👑 Owner Dashboard</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>Real-time monitoring</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '14px' }}>
        <StatCard color="default" label="Produksi" value={totalProduksi} />
        <StatCard color="blue" label="Belanja" value={totalBelanja} />
        <StatCard color="red" label="Stok Low" value={stokRendah} onClick={() => setShowStokLow(true)} />
        <StatCard color="red" label="Expiring" value={expiring} />
      </div>

      {showStokLow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowStokLow(false)}>
          <div style={{ background: C.panel, borderRadius: '16px 16px 0 0', padding: '20px', width: '100%', maxWidth: '520px', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>🔴 Stok Rendah</div>
                <div style={{ fontSize: '11px', color: C.text3 }}>{stokRendah} bahan di bawah minimum · urut dari paling kritis</div>
              </div>
              <button onClick={() => setShowStokLow(false)}
                style={{ ...S.btn, ...S.btnSecondary, fontSize: '12px', padding: '6px 12px' }}>Tutup</button>
            </div>
            {stokRendahList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: C.text3, fontSize: '13px' }}>✅ Semua stok aman!</div>
            ) : stokRendahList
              .sort((a, b) => (a.stok_saat_ini / (a.stok_minimum || 1)) - (b.stok_saat_ini / (b.stok_minimum || 1)))
              .map(b => {
                const pct = b.stok_minimum > 0 ? Math.round((b.stok_saat_ini / b.stok_minimum) * 100) : 0
                return (
                  <div key={b.id} style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.nama}</div>
                        <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>{b.kategori} · {b.divisi}</div>
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: '10px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: C.red }}>{b.stok_saat_ini} {b.satuan_dasar}</div>
                        <div style={{ fontSize: '10px', color: C.text3 }}>min {b.stok_minimum} {b.satuan_dasar}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: '8px', background: C.redBorder, borderRadius: '99px', height: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: C.red, borderRadius: '99px' }} />
                    </div>
                    <div style={{ fontSize: '10px', color: C.red, marginTop: '3px' }}>
                      {pct}% dari minimum {pct === 0 ? '— HABIS!' : pct < 30 ? '— Kritis!' : '— Rendah'}
                    </div>
                  </div>
                )
              })
            }
            <button onClick={() => { setShowStokLow(false) }}
              style={{ ...S.btn, background: C.red, color: '#fff', width: '100%', padding: '11px', marginTop: '8px', fontSize: '12px', fontWeight: 600 }}>
              Tutup
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${C.border}`, marginBottom: '12px', overflowX: 'auto' }}>
        {[['produksi', '📋 Produksi'], ['hpp', 'HPP'], ['belanja', 'Belanja'], ['waste', '🗑️ Waste'], ['closing', 'Closing'], ['audit', 'Audit']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 12px', fontSize: '12px', background: 'transparent', border: 'none',
            cursor: 'pointer', whiteSpace: 'nowrap',
            color: tab === k ? C.text : C.text3,
            borderBottom: tab === k ? `2px solid ${C.text}` : '2px solid transparent',
            fontWeight: tab === k ? 600 : 400, marginBottom: '-1px',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'produksi' && !selectedProduksi && (
        <div>
          {produksi.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: C.text3, fontSize: '13px' }}>Belum ada data produksi</div>}
          {produksi.map(p => {
            const cogs = p.total_cogs || 0
            const cogsPorsi = p.cogs_per_porsi || 0
            return (
              <div key={p.id} onClick={() => setSelectedProduksi(p)} style={{
                background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px',
                padding: '11px 12px', marginBottom: '8px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.menu_nama}</div>
                  <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>
                    {formatTanggalID(p.tanggal)} · {p.menu_kategori} · {p.yang_masak}
                  </div>
                  <div style={{ fontSize: '11px', color: C.text3 }}>Hasil: {p.hasil_pcs} sat · {p.hasil_porsi} porsi</div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.green }}>{formatRupiah(cogs)}</div>
                  {cogsPorsi > 0 && <div style={{ fontSize: '10px', color: C.text3 }}>{formatRupiah(Math.round(cogsPorsi))}/porsi</div>}
                  <div style={{ fontSize: '10px', marginTop: '3px', color: p.status === 'selesai' ? C.green : C.yellow }}>
                    {p.status === 'selesai' ? '✅' : '🔄'} {p.status}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'produksi' && selectedProduksi && (() => {
        const p = selectedProduksi
        const bahanArr = Array.isArray(p.bahan_baku) ? p.bahan_baku : []
        const totalCogs = p.total_cogs || bahanArr.reduce((s, b) => s + (b.cogs_bahan || 0), 0)
        const cogsPorsi = p.cogs_per_porsi || (p.hasil_porsi > 0 ? totalCogs / p.hasil_porsi : 0)
        return (
          <div>
            <button onClick={() => setSelectedProduksi(null)} style={{ ...S.btn, ...S.btnSecondary, marginBottom: '14px', fontSize: '12px' }}>← Kembali</button>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px' }}>{p.menu_nama}</h3>
            <p style={{ fontSize: '12px', color: C.text3, marginBottom: '12px' }}>{formatTanggalID(p.tanggal)} · {p.menu_kategori} · {p.yang_masak}</p>
            <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><div style={{ fontSize: '11px', color: C.text3 }}>Total COGS</div><div style={{ fontSize: '18px', fontWeight: 700, color: C.green }}>{formatRupiah(totalCogs)}</div></div>
                <div><div style={{ fontSize: '11px', color: C.text3 }}>Per Porsi</div><div style={{ fontSize: '18px', fontWeight: 700, color: C.green }}>{formatRupiah(Math.round(cogsPorsi))}</div></div>
                <div><div style={{ fontSize: '11px', color: C.text3 }}>Hasil</div><div style={{ fontSize: '14px', fontWeight: 600 }}>{p.hasil_pcs} satuan</div></div>
                <div><div style={{ fontSize: '11px', color: C.text3 }}>Porsi</div><div style={{ fontSize: '14px', fontWeight: 600 }}>{p.hasil_porsi} porsi</div></div>
              </div>
            </div>
            {bahanArr.map((b, i) => (
              <div key={i} style={{ background: C.panel2, padding: '10px 12px', borderRadius: '8px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{b.nama}</div>
                  <div style={{ fontSize: '11px', color: C.text3 }}>{b.jumlah || b.jumlah_satuan_dasar} {b.satuan} × {formatRupiah(b.harga_per_satuan || 0)}</div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: C.green }}>{formatRupiah(b.cogs_bahan || 0)}</div>
              </div>
            ))}
            {p.foto && <img src={p.foto} alt="foto" style={{ width: '100%', maxWidth: '300px', borderRadius: '10px', marginTop: '12px', border: `1px solid ${C.border}` }} />}
            {p.catatan && <div style={{ marginTop: '10px', background: C.panel2, padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>{p.catatan}</div>}
          </div>
        )
      })()}

      {tab === 'hpp' && (
        <div>
          <input value={searchHPP} onChange={e => setSearchHPP(e.target.value)}
            placeholder="🔍 Cari nama bahan..." style={{ ...S.input, marginBottom: '10px' }} />
          {bahanBaku
            .filter(b => b.kategori !== 'mentah' && (!searchHPP || b.nama.toLowerCase().includes(searchHPP.toLowerCase())))
            .map(b => (
            <div key={b.id} style={{ background: C.panel2, padding: '11px 12px', borderRadius: '8px', marginBottom: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.nama}</div>
              <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>
                {b.kategori} · HPP {formatRupiah(b.harga_per_satuan || 0)} · stok {b.stok_saat_ini} {b.satuan_dasar}
              </div>
            </div>
          ))}
          {bahanBaku.filter(b => b.kategori !== 'mentah' && (!searchHPP || b.nama.toLowerCase().includes(searchHPP.toLowerCase()))).length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: C.text3, fontSize: '13px' }}>
              Tidak ada hasil untuk "{searchHPP}"
            </div>
          )}
        </div>
      )}

      {tab === 'belanja' && <BelanjaTabOwner belanja={belanja} showToast={showToast} loadData={loadData} />}

      {tab === 'waste' && <WasteTabOwner waste={waste} bahanBaku={bahanBaku} showToast={showToast} />}

      {tab === 'closing' && closing.slice(0, 10).map(c => {
        const ba = bahanBaku.find(x => x.id === c.bahan_id)
        const selisih = c.selisih ?? (c.sisa_aktual - c.prediksi_sistem)
        return (
          <div key={c.id} style={{ background: C.panel2, padding: '11px 12px', borderRadius: '8px', marginBottom: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{ba?.nama || '-'}</div>
            <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>
              {formatTanggalID(c.tanggal)} · stok sistem {c.prediksi_sistem} → aktual {c.sisa_aktual} · selisih {selisih > 0 ? '+' : ''}{selisih} · oleh {c.yang_closing || '-'}
            </div>
          </div>
        )
      })}

      {tab === 'audit' && auditLog.slice(0, 30).map(a => (
        <div key={a.id} style={{ background: C.panel2, padding: '8px 12px', borderRadius: '6px', marginBottom: '4px', fontSize: '11px', color: C.text3 }}>
          <strong style={{ color: C.text2 }}>{a.yang_melakukan}</strong> {a.aksi} {a.tabel} {a.bahan_nama || ''} · {formatTanggalID(a.created_at)}
        </div>
      ))}

      <hr style={{ border: 'none', borderTop: `1px solid ${C.panel2}`, margin: '14px 0' }} />

      {/* Export History Stok — dengan filter tanggal */}
      <div style={{ background: C.panel2, borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: C.text2, marginBottom: '8px' }}>
          📥 Export History Stok (untuk Accurate)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
          <div>
            <div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Dari tanggal</div>
            <input type="date" value={exportDateFrom} onChange={e => setExportDateFrom(e.target.value)}
              style={{ ...S.input, fontSize: '12px', padding: '7px 9px' }} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Sampai tanggal</div>
            <input type="date" value={exportDateTo} onChange={e => setExportDateTo(e.target.value)}
              style={{ ...S.input, fontSize: '12px', padding: '7px 9px' }} />
          </div>
        </div>
        <div style={{ fontSize: '11px', color: C.text3, marginBottom: '8px' }}>
          {!exportDateFrom && !exportDateTo ? '📌 Kosongkan untuk export semua data' : `📌 Export ${exportDateFrom || '...'} s/d ${exportDateTo || '...'}`}
        </div>
        <button
          onClick={exportHistoryStok}
          disabled={exportingClosing}
          style={{ ...S.btn, ...S.btnPrimary, width: '100%', padding: '10px', fontSize: '12px', opacity: exportingClosing ? 0.6 : 1 }}>
          {exportingClosing ? '⏳ Mengambil data...' : '📥 Download History Stok + Sheet Accurate'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <button onClick={() => exportExcel('stok')} style={{ ...S.btn, ...S.btnSecondary, fontSize: '11px', padding: '10px' }}>📥 Export Stok</button>
        <button onClick={() => exportExcel('produksi')} style={{ ...S.btn, ...S.btnSecondary, fontSize: '11px', padding: '10px' }}>📥 Export Produksi</button>
        <button onClick={() => exportExcel('belanja')} style={{ ...S.btn, ...S.btnSecondary, fontSize: '11px', padding: '10px' }}>📥 Export Belanja</button>
      </div>
    </div>
  )
}

// =====================================================
// UPLOAD MASTER VIEW (Owner only)
// =====================================================
function UploadMasterView({ showToast, loadData, logAudit, bahanBaku }) {
  const [preview, setPreview] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [lastImport, setLastImport] = useState(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' })
        const ws = wb.Sheets['Master Bahan Baku'] || wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws)
        const cleaned = data.map(row => {
          const qtyPK = Number(row['Isi Kemasan'] || row['Isi Kemasan (satuan dasar per kemasan)'] || row['qty_per_kemasan']) || null
          const hargaPK = Number(row['Harga per Kemasan (Rp)'] || row['harga_per_kemasan']) || null
          const hargaPS = qtyPK && hargaPK
            ? hargaPK / qtyPK
            : (Number(row['Harga per Satuan Dasar (Rp)'] || row['Harga']) || 0)
          const rawStok = row['Stok Saat Ini']
          return {
            nama: (row['Nama Bahan'] || row['Nama'] || '').toString().trim(),
            kategori: (row['Kategori'] || '').toString().trim().toLowerCase(),
            divisi: (row['Divisi'] || '').toString().trim(),
            satuan_dasar: (row['Satuan Dasar'] || row['Satuan'] || '').toString().trim().toLowerCase(),
            kemasan: (row['Kemasan'] || '').toString().trim() || null,
            qty_per_kemasan: qtyPK,
            harga_per_kemasan: hargaPK,
            stok_minimum: Number(row['Stok Minimum']) || 0,
            harga_per_satuan: hargaPS,
            stok_saat_ini: (rawStok !== undefined && rawStok !== null && rawStok !== '') ? Number(rawStok) || 0 : null,
            is_perishable: (row['Perishable?'] || '').toString().trim().toLowerCase() === 'y',
            umur_simpan_hari: Number(row['Umur Simpan (hari)']) || null,
            catatan: (row['Catatan'] || '').toString().trim() || null,
          }
        }).filter(r =>
          r.nama && r.nama.trim() !== '' &&
          ['mentah', 'prepack', 'jadi'].includes(r.kategori) &&
          ['Kitchen', 'Bar', 'Both'].includes(r.divisi)
        )
        setPreview(cleaned)
        setLastImport(null)
        showToast(`✅ ${cleaned.length} bahan terbaca dari Excel`)
      } catch (err) { showToast('❌ Error baca file: ' + err.message) }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    if (preview.length === 0) { showToast('❌ Belum ada data'); return }
    setSubmitting(true)
    try {
      let updated = 0, created = 0, stokSet = 0
      for (const item of preview) {
        const existing = bahanBaku.find(b => b.nama.toLowerCase() === item.nama.toLowerCase())
        if (existing) {
          const updatePayload = {
            kategori: item.kategori, divisi: item.divisi,
            satuan_dasar: item.satuan_dasar, kemasan: item.kemasan,
            qty_per_kemasan: item.qty_per_kemasan, harga_per_kemasan: item.harga_per_kemasan,
            stok_minimum: item.stok_minimum, harga_per_satuan: item.harga_per_satuan,
            is_perishable: item.is_perishable, umur_simpan_hari: item.umur_simpan_hari,
            catatan: item.catatan, is_active: true,
          }
          if (item.stok_saat_ini !== null) {
            updatePayload.stok_saat_ini = item.stok_saat_ini
            stokSet++
          }
          await supabase.from('bahan_baku').update(updatePayload).eq('id', existing.id)
          updated++
        } else {
          await supabase.from('bahan_baku').insert({
            id: generateId(), ...item, stok_saat_ini: item.stok_saat_ini ?? 0, is_active: true,
          })
          created++
          if (item.stok_saat_ini) stokSet++
        }
      }
      await logAudit('bahan_baku', 0, 'bulk_import', null, null, { created, updated, stok_set: stokSet, total: preview.length })
      setLastImport({ created, updated, stokSet, total: preview.length, waktu: new Date() })
      setPreview([])
      loadData()
      showToast(`✅ Import: ${created} baru, ${updated} update, ${stokSet} stok diset`)
    } catch (e) { showToast('❌ ' + e.message) }
    setSubmitting(false)
  }

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>📤 Upload Master Bahan</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>Upload Excel — owner only · Kolom yang dibaca: Nama, Kategori, Divisi, Satuan, Isi Kemasan, <strong>Stok Saat Ini</strong>, Harga</p>

      {lastImport && (
        <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: C.green, marginBottom: '8px' }}>
            ✅ Import berhasil — {lastImport.waktu.toLocaleTimeString('id-ID')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <div style={{ background: C.panel, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: C.green }}>{lastImport.total}</div>
              <div style={{ fontSize: '11px', color: C.text3 }}>Total bahan</div>
            </div>
            <div style={{ background: C.panel, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: C.blue }}>{lastImport.updated}</div>
              <div style={{ fontSize: '11px', color: C.text3 }}>Di-update</div>
            </div>
            <div style={{ background: C.panel, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>{lastImport.stokSet}</div>
              <div style={{ fontSize: '11px', color: C.text3 }}>Stok diset</div>
            </div>
          </div>
          <p style={{ fontSize: '11px', color: C.text3, marginTop: '8px', marginBottom: 0 }}>
            Untuk upload ulang, pilih file baru di bawah.
          </p>
        </div>
      )}

      <div style={{ padding: '18px', background: C.panel2, border: `1.5px dashed ${C.border}`, borderRadius: '8px', textAlign: 'center', marginBottom: '14px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600 }}>📎 Pilih file Excel</p>
        <p style={{ fontSize: '11px', color: C.text3, marginTop: '4px' }}>.xlsx · maks 5MB</p>
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ marginTop: '10px', fontSize: '12px' }} />
      </div>

      {preview.length > 0 && (
        <>
          <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: '7px', marginBottom: '12px' }}>
            <table style={{ fontSize: '11px', width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: C.panel2 }}>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Nama</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Kat</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Stok Saat Ini</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>Harga/Sat</th>
              </tr></thead>
              <tbody>
                {preview.slice(0, 15).map((p, i) => (
                  <tr key={i} style={{ borderTop: `0.5px solid ${C.panel2}` }}>
                    <td style={{ padding: '5px 8px' }}>{p.nama}</td>
                    <td style={{ padding: '5px 8px' }}>{p.kategori}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', color: p.stok_saat_ini > 0 ? C.green : C.text3 }}>
                      {p.stok_saat_ini !== null ? `${p.stok_saat_ini} ${p.satuan_dasar}` : '—'}
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                      {p.harga_per_satuan > 0 ? formatRupiah(p.harga_per_satuan) : '—'}
                    </td>
                  </tr>
                ))}
                {preview.length > 15 && (
                  <tr><td colSpan={4} style={{ padding: '6px 8px', color: C.text3, textAlign: 'center' }}>
                    ...dan {preview.length - 15} bahan lainnya
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ background: C.greenBg, color: C.green, padding: '10px 12px', borderRadius: '7px', fontSize: '12px', marginBottom: '12px' }}>
            ✅ <strong>{preview.length} bahan</strong> siap diimport · <strong>{preview.filter(p => p.stok_saat_ini !== null && p.stok_saat_ini > 0).length} item</strong> akan diset stoknya dari Excel
          </div>

          <button onClick={handleImport} disabled={submitting} style={{ ...S.btn, ...S.btnPrimary, width: '100%', padding: '13px', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Importing...' : '📤 Konfirmasi Import'}
          </button>
        </>
      )}
    </div>
  )
}

// =====================================================
// AUDIT LOG VIEW (Owner only)
// =====================================================
function AuditLogView({ auditLog }) {
  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>📜 Audit Log</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>History semua aktivitas · {auditLog.length} entries</p>

      {auditLog.map(a => (
        <div key={a.id} style={{ background: C.panel2, padding: '10px 12px', borderRadius: '7px', marginBottom: '6px', fontSize: '12px' }}>
          <div style={{ fontWeight: 500 }}>
            <strong>{a.yang_melakukan}</strong> · {a.aksi} {a.tabel} {a.bahan_nama && `→ ${a.bahan_nama}`}
          </div>
          <div style={{ fontSize: '10px', color: C.text3, marginTop: '4px' }}>
            {new Date(a.created_at).toLocaleString('id-ID')} · {a.role_user}
          </div>
          {a.detail && <div style={{ fontSize: '10px', color: C.text3, marginTop: '4px', fontFamily: 'monospace' }}>
            {JSON.stringify(a.detail).slice(0, 100)}
          </div>}
        </div>
      ))}
    </div>
  )
}
