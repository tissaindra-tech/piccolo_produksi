import { useState, useEffect, useMemo } from 'react'
import { supabase, generateId, formatTanggal, formatTanggalID, formatRupiah, daysFromNow } from './supabase'
import * as XLSX from 'xlsx'

// =====================================================
// PICCOLO CORNER v3 - Aplikasi Produksi & Inventory
// =====================================================
const PIN_STAFF = '1234'
const PIN_OWNER = '0000'
// PIN 5678 (Purchasing) sudah dihapus — disederhanakan jadi 2 role
const THRESHOLD_KECIL = 100000
const CLOSING_LOCK_DAYS = 4

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
// LOGIN
// =====================================================
function Login({ onLogin }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (pin === PIN_STAFF) onLogin('staff')
    else if (pin === PIN_OWNER) onLogin('owner')
    else { setError('PIN salah. Coba lagi.'); setPin('') }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: C.panel, borderRadius: '16px', padding: '32px 24px', maxWidth: '380px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px' }}>☕</div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: C.text, margin: '8px 0 4px' }}>Piccolo Corner</h1>
          <p style={{ fontSize: '13px', color: C.text3 }}>Aplikasi Produksi & Inventory</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input type="password" value={pin} onChange={(e) => { setPin(e.target.value); setError('') }} placeholder="Masukkan PIN" style={{ ...S.input, padding: '14px 16px', fontSize: '18px', textAlign: 'center', letterSpacing: '8px', marginBottom: '12px' }} autoFocus inputMode="numeric" />
          {error && <div style={{ color: C.red, fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</div>}
          <button type="submit" style={{ ...S.btn, ...S.btnPrimary, width: '100%', padding: '14px' }}>Masuk</button>
        </form>
        <div style={{ marginTop: '20px', fontSize: '11px', color: C.text3, textAlign: 'center', lineHeight: 1.6 }}>
          PIN Staff · Owner<br />Hubungi owner jika lupa PIN
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
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!role) return
    loadData()
    const channels = ['bahan_baku', 'produksi', 'belanja', 'closing_stok', 'waste'].map(t =>
      supabase.channel(`ch-${t}`).on('postgres_changes', { event: '*', schema: 'public', table: t }, () => loadData()).subscribe()
    )
    return () => channels.forEach(c => supabase.removeChannel(c))
  }, [role])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2400) }

  const loadData = async () => {
    setLoading(true)
    try {
      const [b, p, bl, c, w, a] = await Promise.all([
        supabase.from('bahan_baku').select('*').eq('is_active', true).order('nama'),
        supabase.from('produksi').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('belanja').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('closing_stok').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('waste').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200),
      ])
      setBahanBaku(b.data || [])
      setProduksi(p.data || [])
      setBelanja(bl.data || [])
      setClosing(c.data || [])
      setWaste(w.data || [])
      setAuditLog(a.data || [])
    } catch (err) { showToast('❌ Error: ' + err.message) }
    setLoading(false)
  }

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

  if (!role) return <Login onLogin={setRole} />

  const props = {
    role, userName, setUserName, view, setView,
    bahanBaku, produksi, belanja, closing, waste, auditLog,
    loadData, showToast, logAudit,
    daysSinceClosing, isLocked,
    handleLogout: () => { setRole(null); setUserName(''); setView('home') }
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
    <div style={{ position: 'fixed', inset: 0, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>☕</div>
        <p style={{ fontSize: '13px', color: C.text3 }}>Memuat data...</p>
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
  const { role, view, setView, handleLogout, daysSinceClosing, isLocked } = props

  const tabs = {
    staff: [
      { id: 'home', label: '🏠 Home' },
      { id: 'produksi', label: '📝 Produksi' },
      { id: 'histproduksi', label: '📋 Lap.Produksi' },
      { id: 'inputnota', label: '🧾 Nota' },
      { id: 'closing', label: '🔍 Closing' },
      { id: 'stoklist', label: '📦 Stok' },
      { id: 'waste', label: '🗑️ Waste' },
      { id: 'historybelanja', label: '🛒 Belanja' },
    ],
    owner: [
      { id: 'home', label: '🏠 Home' },
      { id: 'dashboard', label: '👑 Dashboard' },
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
          <div style={{ fontSize: '11px', opacity: 0.7 }}>{role === 'owner' ? 'Owner' : 'Staff Kitchen/Bar'} · {formatTanggalID(new Date())}</div>
        </div>
        <button onClick={handleLogout} style={{ ...S.btn, background: C.text2, color: C.panel, padding: '6px 14px', fontSize: '11px' }}>Logout</button>
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
        {view === 'waste' && <WasteView {...props} />}
        {view === 'historybelanja' && <HistoryBelanjaView {...props} />}
        {view === 'dashboard' && <OwnerDashboardView {...props} />}
        {view === 'upload' && <UploadMasterView {...props} />}
        {view === 'auditlog' && <AuditLogView {...props} />}
      </div>
    </div>
  )
}

// =====================================================
// HOME VIEW
// =====================================================
function HomeView(props) {
  const { role, bahanBaku, produksi, belanja, daysSinceClosing, setView } = props

  const stokRendah = bahanBaku.filter(b => b.stok_saat_ini < b.stok_minimum && b.is_active).length
  const aktivitasHariIni = [
    ...produksi.filter(p => p.tanggal === formatTanggal()).slice(0, 3),
    ...belanja.filter(b => b.tanggal === formatTanggal()).slice(0, 3)
  ].slice(0, 5)

  if (role === 'owner') return <OwnerHome {...props} />

  return (
    <div>
      {daysSinceClosing >= 3 && (
        <div style={{ background: C.yellowBg, color: C.yellow, padding: '10px 12px', borderRadius: '7px', fontSize: '12px', marginBottom: '12px' }}>
          ⚠️ <strong>Closing terlewat {daysSinceClosing} hari.</strong> Mohon segera closing.
        </div>
      )}

      <div style={{ fontSize: '12px', color: C.text3, marginBottom: '8px', fontWeight: 500 }}>Pilih aksi:</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <BigBtn color="green" icon="📝" label="Input Produksi" onClick={() => setView('produksi')} />
        <BigBtn color="yellow" icon="🧾" label="Input Nota" onClick={() => setView('inputnota')} />
        <BigBtn color="blue" icon="🔍" label="Closing Stok" onClick={() => setView('closing')} />
        <BigBtn color="default" icon="📦" label="Lihat Stok" onClick={() => setView('stoklist')} />
        <BigBtn color="red" icon="🗑️" label="Waste" onClick={() => setView('waste')} />
        <BigBtn color="default" icon="📜" label="History Belanja" onClick={() => setView('historybelanja')} />
      </div>

      <div style={{ background: C.panel2, padding: '8px 12px', borderRadius: '7px', fontSize: '12px', marginBottom: '12px' }}>
        📌 {stokRendah > 0 ? <><strong>{stokRendah} bahan stok rendah</strong> · perlu beli</> : <>Stok aman semua ✓</>}
      </div>

      {aktivitasHariIni.length > 0 && (
        <>
          <div style={{ fontSize: '12px', color: C.text3, marginBottom: '8px', fontWeight: 500 }}>Aktivitas hari ini:</div>
          {aktivitasHariIni.map(a => (
            <div key={a.id} style={{ background: C.panel2, padding: '11px 12px', borderRadius: '8px', marginBottom: '6px', fontSize: '12px' }}>
              {a.menu_nama ? (
                <><strong>{a.menu_nama}</strong> · {a.menu_kategori} · {a.hasil_pcs || 0} pcs · oleh {a.yang_masak || '-'}</>
              ) : (
                <><strong>Belanja:</strong> {a.items?.length || 0} item · <span style={S.badge(a.jalur === 'kecil' ? 'greenLight' : a.jalur === 'normal' ? 'blue' : 'red')}>{a.jalur}</span> · {formatRupiah(a.total_harga)}</>
              )}
            </div>
          ))}
        </>
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
  const stokRendah = bahanBaku.filter(b => b.stok_saat_ini < b.stok_minimum).length
  const expiring = bahanBaku.filter(b => {
    const d = daysFromNow(b.expired_terdekat)
    return d !== null && d <= 2 && d >= 0
  }).length
  const totalProduksiHariIni = produksi.filter(p => p.tanggal === formatTanggal()).length
  const totalBelanjaHariIni = belanja.filter(b => b.tanggal === formatTanggal()).length

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '14px' }}>
        <StatCard color="default" label="Produksi" value={totalProduksiHariIni} />
        <StatCard color="blue" label="Belanja" value={totalBelanjaHariIni} />
        <StatCard color="red" label="Stok Low" value={stokRendah} />
        <StatCard color="red" label="Expiring" value={expiring} />
      </div>

      <div style={{ fontSize: '12px', color: C.text3, marginBottom: '8px', fontWeight: 500 }}>⚡ Yang perlu kamu cek:</div>
      {bahanBaku.filter(b => b.stok_saat_ini < b.stok_minimum).slice(0, 3).map(b => (
        <div key={b.id} style={{ background: C.redBg, borderLeft: `3px solid ${C.redBorder}`, padding: '11px 12px', borderRadius: '8px', marginBottom: '6px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.nama} stok rendah</div>
          <div style={{ fontSize: '11px', color: C.red, marginTop: '2px' }}>{b.stok_saat_ini} {b.satuan_dasar} (min {b.stok_minimum})</div>
        </div>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
        <BigBtn color="default" icon="👑" label="Dashboard Lengkap" onClick={() => setView('dashboard')} />
        <BigBtn color="blue" icon="📤" label="Upload Master" onClick={() => setView('upload')} />
      </div>
    </div>
  )
}

function StatCard({ color, label, value }) {
  const colors = {
    default: { bg: C.panel2, fg: C.text3 },
    blue: { bg: C.blueBg, fg: C.blue },
    yellow: { bg: C.yellowBg, fg: C.yellow },
    red: { bg: C.redBg, fg: C.red },
    green: { bg: C.greenLightBg, fg: C.greenLight },
  }[color]

  return (
    <div style={{ padding: '10px 8px', background: colors.bg, borderRadius: '8px' }}>
      <div style={{ fontSize: '10px', color: colors.fg }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px', color: colors.fg }}>{value}</div>
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
function HistoryProduksiView({ produksi, bahanBaku }) {
  const [selected, setSelected] = useState(null)
  const [filterDiv, setFilterDiv] = useState('all')

  const filtered = produksi.filter(p => filterDiv === 'all' || p.menu_kategori === filterDiv)
  const totalCOGS = filtered.reduce((s, p) => s + (p.total_cogs || 0), 0)

  if (selected) {
    const p = selected
    const bahanArr = Array.isArray(p.bahan_baku) ? p.bahan_baku : []
    const totalCogs = p.total_cogs || bahanArr.reduce((s, b) => s + (b.cogs_bahan || 0), 0)
    const cogsPorsi = p.cogs_per_porsi || (p.hasil_porsi > 0 ? totalCogs / p.hasil_porsi : 0)
    const satuan = bahanBaku.find(b => b.id === p.menu_id)?.satuan_dasar || 'satuan'

    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ ...S.btn, ...S.btnSecondary, marginBottom: '14px', fontSize: '12px' }}>
          ← Kembali
        </button>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>{p.menu_nama}</h2>
        <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>
          {formatTanggalID(p.tanggal)} · {p.menu_kategori} · oleh {p.yang_masak}
        </p>

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
            <div>
              <div style={{ fontSize: '11px', color: C.text3 }}>Hasil</div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.hasil_pcs} {satuan}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: C.text3 }}>Porsi</div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.hasil_porsi} porsi</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '12px', fontWeight: 600, color: C.text3, marginBottom: '8px' }}>🥬 Bahan yang dipakai:</div>
        {bahanArr.map((b, i) => (
          <div key={i} style={{ background: C.panel2, padding: '10px 12px', borderRadius: '8px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>{b.nama}</div>
              <div style={{ fontSize: '11px', color: C.text3 }}>{b.jumlah} {b.satuan} × {formatRupiah(b.harga_per_satuan || 0)}/{b.satuan}</div>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: C.green }}>{formatRupiah(b.cogs_bahan || 0)}</div>
          </div>
        ))}

        {p.foto && (
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '12px', color: C.text3, marginBottom: '6px', fontWeight: 500 }}>📸 Foto:</div>
            <img src={p.foto} alt="foto" style={{ width: '100%', maxWidth: '320px', borderRadius: '10px', border: `1px solid ${C.border}` }} />
          </div>
        )}

        {p.catatan && (
          <div style={{ marginTop: '12px', background: C.panel2, padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>
            <span style={{ fontSize: '11px', color: C.text3 }}>Catatan: </span>{p.catatan}
          </div>
        )}
        <div style={{ marginTop: '10px', padding: '10px 12px', background: p.status === 'selesai' ? C.greenBg : C.yellowBg, borderRadius: '8px', fontSize: '12px', fontWeight: 500 }}>
          {p.status === 'selesai' ? '✅ Selesai' : '🔄 Proses'}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>📋 Laporan Produksi</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '12px' }}>Tap untuk lihat detail & COGS</p>

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
        <div key={p.id} onClick={() => setSelected(p)} style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px',
          padding: '12px 14px', marginBottom: '8px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.menu_nama}</div>
            <div style={{ fontSize: '11px', color: C.text3, marginTop: '3px' }}>
              {formatTanggalID(p.tanggal)} · {p.menu_kategori} · {p.yang_masak}
            </div>
            <div style={{ fontSize: '11px', color: C.text3 }}>Hasil: {p.hasil_pcs} sat · {p.hasil_porsi} porsi</div>
          </div>
          <div style={{ textAlign: 'right', marginLeft: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: C.green }}>{formatRupiah(p.total_cogs || 0)}</div>
            <div style={{ fontSize: '10px', color: C.text3 }}>COGS</div>
            <div style={{ fontSize: '10px', marginTop: '3px', color: p.status === 'selesai' ? C.green : C.yellow }}>
              {p.status === 'selesai' ? '✅' : '🔄'} {p.status}
            </div>
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
    if (file.size > 2 * 1024 * 1024) { showToast('❌ Foto max 2MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setFoto(ev.target.result)
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
                placeholder="Cari bahan mentah..."
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

      <FormRow label="Foto nota (wajib)">
        <input type="file" accept="image/*" onChange={handleFoto} style={{ ...S.input, padding: '8px' }} />
        {foto && <img src={foto} alt="" style={{ maxWidth: '120px', marginTop: '8px', borderRadius: '6px' }} />}
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
function ClosingView({ bahanBaku, showToast, loadData, logAudit, setView, userName, setUserName }) {
  const [yangClosing, setYangClosing] = useState(userName)
  const [activeBahan, setActiveBahan] = useState(null)

  const bahanForClosing = bahanBaku.filter(b => b.is_active && (b.kategori === 'mentah' || b.kategori === 'jadi' || b.kategori === 'prepack'))

  if (activeBahan) {
    return <ClosingDetail bahan={activeBahan} yangClosing={yangClosing} setYangClosing={setYangClosing} onBack={() => setActiveBahan(null)} showToast={showToast} loadData={loadData} logAudit={logAudit} setUserName={setUserName} />
  }

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>🔍 Closing Stok</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>Update stok aktual + kategorikan keluar untuk laporan akuntansi</p>

      <FormRow label="Yang closing"><input type="text" value={yangClosing} onChange={e => setYangClosing(e.target.value)} placeholder="Nama..." style={S.input} /></FormRow>

      <div style={{ fontSize: '12px', color: C.text3, fontWeight: 500, marginBottom: '8px' }}>Tap "Closing" untuk update per item:</div>

      {bahanForClosing.map(b => (
        <div key={b.id} style={{ background: C.panel2, padding: '11px 12px', borderRadius: '8px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.nama} <span style={{ fontSize: '10px', color: C.text3, fontWeight: 400 }}>({b.kategori})</span></div>
            <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>Prediksi sistem: <strong>{b.stok_saat_ini} {b.satuan_dasar}</strong></div>
          </div>
          <button onClick={() => setActiveBahan(b)} style={{ ...S.btn, ...S.btnPrimary, padding: '5px 12px', fontSize: '11px' }}>Closing</button>
        </div>
      ))}
    </div>
  )
}

function ClosingDetail({ bahan, yangClosing, setYangClosing, onBack, showToast, loadData, logAudit, setUserName }) {
  const [sisaAktual, setSisaAktual] = useState('')
  const [qty, setQty] = useState({ bumbu: 0, terjual: 0, staff: 0, kadaluarsa: 0, busuk: 0 })
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selisih = bahan.stok_saat_ini - (Number(sisaAktual) || 0)
  const totalKategori = Object.values(qty).reduce((s, v) => s + (Number(v) || 0), 0)
  const isMatch = Math.abs(totalKategori - selisih) < 0.01

  const handleSubmit = async () => {
    if (sisaAktual === '') { showToast('❌ Isi sisa aktual'); return }
    if (!yangClosing) { showToast('❌ Isi nama'); return }
    if (!isMatch) { showToast(`❌ Total kategori tidak match selisih (${selisih})`); return }

    setSubmitting(true)
    setUserName(yangClosing)
    try {
      const newId = generateId()
      await supabase.from('closing_stok').insert({
        id: newId, tanggal: formatTanggal(), bahan_id: bahan.id,
        prediksi_sistem: bahan.stok_saat_ini, sisa_aktual: Number(sisaAktual), selisih,
        qty_bumbu: Number(qty.bumbu) || 0, qty_terjual: Number(qty.terjual) || 0,
        qty_staff: Number(qty.staff) || 0, qty_wasted_kadaluarsa: Number(qty.kadaluarsa) || 0,
        qty_wasted_busuk: Number(qty.busuk) || 0, catatan, yang_closing: yangClosing,
      })
      await supabase.from('bahan_baku').update({ stok_saat_ini: Number(sisaAktual) }).eq('id', bahan.id)
      await logAudit('closing_stok', newId, 'create', bahan.id, bahan.nama, { prediksi: bahan.stok_saat_ini, aktual: Number(sisaAktual), selisih, kategori: qty })
      showToast(`✅ Closing ${bahan.nama} tersimpan`)
      loadData()
      onBack()
    } catch (e) { showToast('❌ ' + e.message) }
    setSubmitting(false)
  }

  return (
    <div>
      <button onClick={onBack} style={{ ...S.btn, ...S.btnSecondary, marginBottom: '12px', fontSize: '12px' }}>← Kembali</button>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>📊 Closing: {bahan.nama}</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>{bahan.kategori} · {bahan.divisi}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <FormRow label="Prediksi sistem"><input type="text" value={`${bahan.stok_saat_ini} ${bahan.satuan_dasar}`} readOnly style={{ ...S.input, background: C.panel2 }} /></FormRow>
        <FormRow label="Sisa fisik aktual"><input type="number" value={sisaAktual} onChange={e => setSisaAktual(e.target.value)} step="0.01" style={S.input} /></FormRow>
      </div>

      <div style={{ background: C.blueBg, color: C.blue, padding: '10px 12px', borderRadius: '7px', fontSize: '12px', marginBottom: '12px' }}>
        📐 <strong>Selisih: {selisih.toFixed(2)} {bahan.satuan_dasar}</strong> · distribusikan ke kategori:
      </div>

      <div style={{ background: C.panel2, padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
        {[
          { key: 'bumbu', label: '🍴 Terpakai untuk bumbu' },
          { key: 'terjual', label: '💰 Terjual (dipakai langsung)' },
          { key: 'staff', label: '🍽️ Staff consumption' },
          { key: 'kadaluarsa', label: '🗑️ Wasted: kadaluarsa' },
          { key: 'busuk', label: '🤢 Wasted: busuk/rusak' },
        ].map(k => (
          <div key={k.key} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '8px', alignItems: 'center', padding: '6px 0', borderBottom: `1px dashed ${C.border}` }}>
            <span style={{ fontSize: '12px' }}>{k.label}</span>
            <input type="number" value={qty[k.key]} onChange={e => setQty({ ...qty, [k.key]: e.target.value })} step="0.01" style={{ ...S.input, padding: '6px 8px', fontSize: '12px' }} />
          </div>
        ))}
        <div style={{ marginTop: '8px', padding: '8px 12px', background: isMatch ? C.greenBg : C.redBg, color: isMatch ? C.green : C.red, borderRadius: '6px', fontSize: '12px', fontWeight: 600, textAlign: 'right' }}>
          Total: {totalKategori.toFixed(2)} {isMatch ? '✓ match' : `✗ harus ${selisih.toFixed(2)}`}
        </div>
      </div>

      <FormRow label="Catatan"><textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} style={S.input} /></FormRow>

      <button onClick={handleSubmit} disabled={submitting || !isMatch} style={{ ...S.btn, ...S.btnSuccess, width: '100%', padding: '13px', opacity: (submitting || !isMatch) ? 0.6 : 1 }}>
        {submitting ? 'Menyimpan...' : '💾 Simpan Closing'}
      </button>
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
    </div>
  )
}

// =====================================================
// WASTE VIEW
// =====================================================
function WasteView({ bahanBaku, showToast, loadData, logAudit, setView, userName, setUserName }) {
  const [bahanId, setBahanId] = useState('')
  const [jumlah, setJumlah] = useState('')
  const [alasan, setAlasan] = useState('Gosong')
  const [yangCatat, setYangCatat] = useState(userName)
  const [catatan, setCatatan] = useState('')
  const [foto, setFoto] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
      setView('home')
    } catch (e) { showToast('❌ ' + e.message) }
    setSubmitting(false)
  }

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>🗑️ Catat Waste Spontan</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>Untuk waste mendadak (jatuh, gosong) — busuk/expired biasanya tercatat saat closing</p>

      <FormRow label="Bahan">
        <SearchableSelect
          options={bahanBaku.map(b => ({ value: b.id, label: b.nama, stock: b.stok_saat_ini, satuan: b.satuan_dasar }))}
          value={bahanId}
          onChange={setBahanId}
          placeholder="Cari bahan..."
          showStock={true}
        />
      </FormRow>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <FormRow label="Jumlah"><input type="number" value={jumlah} onChange={e => setJumlah(e.target.value)} step="0.01" style={S.input} /></FormRow>
        <FormRow label="Satuan"><input type="text" value={bahan?.satuan_dasar || ''} readOnly style={{ ...S.input, background: C.panel2 }} /></FormRow>
      </div>

      <FormRow label="Alasan">
        <select value={alasan} onChange={e => setAlasan(e.target.value)} style={S.input}>
          <option>Gosong</option><option>Tumpah/jatuh</option><option>Rusak/bau</option><option>Salah masak</option><option>Lainnya</option>
        </select>
      </FormRow>

      <FormRow label="Yang catat"><input type="text" value={yangCatat} onChange={e => setYangCatat(e.target.value)} placeholder="Nama..." style={S.input} /></FormRow>

      <FormRow label="Foto bukti (opsional)">
        <input type="file" accept="image/*" onChange={handleFoto} style={{ ...S.input, padding: '8px' }} />
        {foto && <img src={foto} alt="" style={{ maxWidth: '120px', marginTop: '8px', borderRadius: '6px' }} />}
      </FormRow>

      <FormRow label="Catatan"><textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} style={S.input} /></FormRow>

      <button onClick={handleSubmit} disabled={submitting} style={{ ...S.btn, ...S.btnDanger, width: '100%', padding: '13px', opacity: submitting ? 0.6 : 1 }}>
        {submitting ? 'Menyimpan...' : '💾 Simpan Waste'}
      </button>
    </div>
  )
}

// =====================================================
// HISTORY BELANJA
// =====================================================
function HistoryBelanjaView({ belanja }) {
  const [filter, setFilter] = useState('month')
  const now = new Date()
  const filtered = belanja.filter(b => {
    const d = new Date(b.tanggal)
    if (filter === 'today') return b.tanggal === formatTanggal()
    if (filter === 'week') return d >= new Date(now - 7 * 86400000)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const total = filtered.reduce((s, b) => s + (b.total_harga || 0), 0)

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>📜 History Belanja</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>Semua nota terkumpul · siap untuk laporan akuntansi</p>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {[['today', 'Hari ini'], ['week', 'Minggu ini'], ['month', 'Bulan ini']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: '5px 11px', fontSize: '11px', borderRadius: '99px',
            border: `1px solid ${C.border}`, cursor: 'pointer',
            background: filter === k ? C.text : 'transparent',
            color: filter === k ? C.panel : C.text2,
          }}>{l}</button>
        ))}
      </div>

      <div style={{ background: C.panel2, padding: '8px 12px', borderRadius: '7px', fontSize: '12px', marginBottom: '12px' }}>
        💰 Total: <strong>{formatRupiah(total)}</strong> · {filtered.length} transaksi
      </div>

      {filtered.map(b => {
        const colorMap = { kecil: 'greenLight', normal: 'blue', darurat: 'red' }
        return (
          <div key={b.id} style={{ background: C.panel2, padding: '11px 12px', borderRadius: '8px', marginBottom: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.items?.map(i => i.nama).join(', ') || 'Belanja'}</div>
            <div style={{ fontSize: '11px', color: C.text3, marginTop: '4px' }}>
              <span style={{ ...S.badge(colorMap[b.jalur]), marginRight: '6px' }}>{b.jalur}</span>
              {formatTanggalID(b.tanggal)} · {b.yang_belanja} · {b.sumber_dana} · {formatRupiah(b.total_harga)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// =====================================================
// OWNER DASHBOARD
// =====================================================
function OwnerDashboardView({ bahanBaku, produksi, belanja, closing, waste, auditLog, showToast }) {
  const [tab, setTab] = useState('produksi')
  const [searchHPP, setSearchHPP] = useState('')
  const [selectedProduksi, setSelectedProduksi] = useState(null)

  const exportExcel = (type) => {
    let data, filename
    if (type === 'stok') {
      data = bahanBaku.map(b => ({
        Nama: b.nama, Kategori: b.kategori, Divisi: b.divisi,
        'Stok Saat Ini': b.stok_saat_ini, Satuan: b.satuan_dasar,
        'Stok Minimum': b.stok_minimum, 'Harga/Satuan': b.harga_per_satuan,
      }))
      filename = `Stok_Piccolo_${formatTanggal()}.xlsx`
    } else if (type === 'closing') {
      data = []
      closing.forEach(c => {
        const b = bahanBaku.find(x => x.id === c.bahan_id)
        data.push({
          Tanggal: c.tanggal, Bahan: b?.nama || '-',
          'Prediksi': c.prediksi_sistem, 'Aktual': c.sisa_aktual, 'Selisih': c.selisih,
          'Bumbu': c.qty_bumbu, 'Terjual': c.qty_terjual, 'Staff': c.qty_staff,
          'Wasted-Kadaluarsa': c.qty_wasted_kadaluarsa, 'Wasted-Busuk': c.qty_wasted_busuk,
          'Total Wasted': c.qty_wasted_kadaluarsa + c.qty_wasted_busuk,
          'Yang Closing': c.yang_closing, Catatan: c.catatan || '',
        })
      })
      filename = `Closing_Piccolo_${formatTanggal()}.xlsx`
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

  const totalProduksi = produksi.length
  const totalBelanja = belanja.length
  const stokRendah = bahanBaku.filter(b => b.stok_saat_ini < b.stok_minimum).length
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
        <StatCard color="red" label="Stok Low" value={stokRendah} />
        <StatCard color="red" label="Expiring" value={expiring} />
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${C.border}`, marginBottom: '12px', overflowX: 'auto' }}>
        {[['produksi', '📋 Produksi'], ['hpp', 'HPP'], ['belanja', 'Belanja'], ['closing', 'Closing'], ['audit', 'Audit']].map(([k, l]) => (
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

      {tab === 'belanja' && belanja.slice(0, 10).map(b => (
        <div key={b.id} style={{ background: C.panel2, padding: '11px 12px', borderRadius: '8px', marginBottom: '6px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{b.items?.map(i => i.nama).join(', ')}</div>
          <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>{formatTanggalID(b.tanggal)} · {b.yang_belanja} · {formatRupiah(b.total_harga)}</div>
        </div>
      ))}

      {tab === 'closing' && closing.slice(0, 10).map(c => {
        const ba = bahanBaku.find(x => x.id === c.bahan_id)
        return (
          <div key={c.id} style={{ background: C.panel2, padding: '11px 12px', borderRadius: '8px', marginBottom: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{ba?.nama || '-'}</div>
            <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>
              {formatTanggalID(c.tanggal)} · selisih {c.selisih} · waste {(c.qty_wasted_kadaluarsa + c.qty_wasted_busuk).toFixed(2)} · oleh {c.yang_closing}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <button onClick={() => exportExcel('stok')} style={{ ...S.btn, ...S.btnSecondary, fontSize: '11px', padding: '10px' }}>📥 Export Stok</button>
        <button onClick={() => exportExcel('produksi')} style={{ ...S.btn, ...S.btnSecondary, fontSize: '11px', padding: '10px' }}>📥 Export Produksi</button>
        <button onClick={() => exportExcel('closing')} style={{ ...S.btn, ...S.btnSecondary, fontSize: '11px', padding: '10px' }}>📥 Export Closing</button>
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
          const qtyPK = Number(row['Isi Kemasan (satuan dasar per kemasan)'] || row['qty_per_kemasan']) || null
          const hargaPK = Number(row['Harga per Kemasan (Rp)'] || row['harga_per_kemasan']) || null
          // Auto-hitung harga_per_satuan kalau ada data kemasan
          const hargaPS = qtyPK && hargaPK
            ? hargaPK / qtyPK
            : (Number(row['Harga per Satuan Dasar (Rp)'] || row['Harga']) || 0)
          return {
            nama: (row['Nama Bahan'] || row['Nama'] || '').toString().trim(),
            kategori: (row['Kategori'] || '').toString().trim().toLowerCase(),
            divisi: (row['Divisi'] || '').toString().trim(),
            satuan_dasar: (row['Satuan Dasar'] || row['Satuan'] || '').toString().trim().toLowerCase(),
            kemasan: (row['Kemasan'] || '').toString().trim(),
            qty_per_kemasan: qtyPK,
            harga_per_kemasan: hargaPK,
            stok_minimum: Number(row['Stok Minimum']) || 0,
            harga_per_satuan: hargaPS,
            is_perishable: (row['Perishable?'] || '').toString().trim().toLowerCase() === 'y',
            umur_simpan_hari: Number(row['Umur Simpan (hari)']) || null,
            catatan: (row['Catatan'] || '').toString().trim(),
          }
        }).filter(r => r.nama && ['mentah', 'prepack', 'jadi'].includes(r.kategori) && ['Kitchen', 'Bar', 'Both'].includes(r.divisi))
        setPreview(cleaned)
        showToast(`✅ ${cleaned.length} bahan terbaca`)
      } catch (err) { showToast('❌ Error baca file: ' + err.message) }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    if (preview.length === 0) { showToast('❌ Belum ada data'); return }
    setSubmitting(true)
    try {
      let updated = 0, created = 0
      for (const item of preview) {
        const existing = bahanBaku.find(b => b.nama.toLowerCase() === item.nama.toLowerCase())
        if (existing) {
          await supabase.from('bahan_baku').update({
            kategori: item.kategori, divisi: item.divisi,
            satuan_dasar: item.satuan_dasar, kemasan: item.kemasan,
            qty_per_kemasan: item.qty_per_kemasan,
            harga_per_kemasan: item.harga_per_kemasan,
            stok_minimum: item.stok_minimum, harga_per_satuan: item.harga_per_satuan,
            is_perishable: item.is_perishable, umur_simpan_hari: item.umur_simpan_hari,
            catatan: item.catatan, is_active: true,
          }).eq('id', existing.id)
          updated++
        } else {
          await supabase.from('bahan_baku').insert({
            id: generateId(), ...item, stok_saat_ini: 0, is_active: true,
          })
          created++
        }
      }
      await logAudit('bahan_baku', 0, 'bulk_import', null, null, { created, updated, total: preview.length })
      showToast(`✅ Import: ${created} baru, ${updated} update`)
      setPreview([])
      loadData()
    } catch (e) { showToast('❌ ' + e.message) }
    setSubmitting(false)
  }

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>📤 Upload Master Bahan</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>Upload Excel — owner only · Format: Nama, Kategori, Divisi, Satuan Dasar, Stok Minimum</p>

      <div style={{ padding: '18px', background: C.panel2, border: `1.5px dashed ${C.border}`, borderRadius: '8px', textAlign: 'center', marginBottom: '14px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600 }}>📎 Pilih file Excel</p>
        <p style={{ fontSize: '11px', color: C.border2, marginTop: '4px' }}>.xlsx · maks 5MB</p>
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ marginTop: '10px', fontSize: '12px' }} />
      </div>

      {preview.length > 0 && (
        <>
          <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: '7px', marginBottom: '12px' }}>
            <table style={{ fontSize: '11px', width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: C.panel2 }}>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Nama</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Kat</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Divisi</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Sat</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Min</th>
              </tr></thead>
              <tbody>
                {preview.slice(0, 20).map((p, i) => (
                  <tr key={i} style={{ borderTop: `0.5px solid ${C.panel2}` }}>
                    <td style={{ padding: '5px 8px' }}>{p.nama}</td>
                    <td style={{ padding: '5px 8px' }}>{p.kategori}</td>
                    <td style={{ padding: '5px 8px' }}>{p.divisi}</td>
                    <td style={{ padding: '5px 8px' }}>{p.satuan_dasar}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>{p.stok_minimum}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: C.greenBg, color: C.green, padding: '10px 12px', borderRadius: '7px', fontSize: '12px', marginBottom: '12px' }}>
            ✅ <strong>{preview.length} bahan</strong> akan diimport. Existing akan di-update.
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
