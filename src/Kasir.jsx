// =====================================================
// PICCOLO CORNER — Layar Kasir
//   1. PenjualanView        : laporan penjualan harian (pengganti laporan di WA)
//   2. PengeluaranKasirView : pengeluaran kas kasir, dengan/tanpa nota, + persetujuan owner
//   3. RekapHarianView      : rekap satu hari untuk Owner / input ke Accurate
// =====================================================
import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase, generateId, formatTanggal, formatTanggalID, formatRupiah } from './supabase'
import { C, S, uploadFotoToStorage, SUMBER_DANA_LABEL, sumberText, KATEGORI_BIAYA } from './shared'

const BELANJA_BAHAN = 'Belanja bahan (stok)'
const CARA_PERSETUJUAN = ['WA', 'Telepon', 'Lisan']
const METODE = [
  ['tunai', '💵 Tunai'],
  ['qris', '📱 QRIS'],
  ['transfer', '🏦 Transfer'],
  ['kartu', '💳 Kartu / EDC BCA'],
  ['online', '🛵 GoFood / Grab / Shopee'],
  ['lainnya', '➕ Lainnya'],
]

export const num = (v) => Number(v) || 0
const shiftDate = (ymd, days) => { const d = new Date(ymd); d.setDate(d.getDate() + days); return formatTanggal(d) }
export const bulanIni = (ymd) => ymd.slice(0, 7)

export function FormRow({ label, children, hint }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={S.label}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: '10px', color: C.text3, marginTop: '3px' }}>{hint}</div>}
    </div>
  )
}

// Input angka Rupiah: tampil dengan titik ribuan, simpan sebagai angka
export function RupiahInput({ value, onChange, placeholder = '0', big = false, autoFocus = false }) {
  const shown = value === '' || value === null || value === undefined ? '' : Number(value).toLocaleString('id-ID')
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: big ? '15px' : '12px', color: C.text3 }}>Rp</span>
      <input inputMode="numeric" value={shown} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value.replace(/[^\d]/g, ''))}
        placeholder={placeholder}
        style={{ ...S.input, paddingLeft: '36px', fontSize: big ? '22px' : '13px', fontWeight: big ? 700 : 400, textAlign: big ? 'right' : 'left' }} />
    </div>
  )
}

export const semuaFoto = (utama, tambahan) => [utama, ...(Array.isArray(tambahan) ? tambahan : [])].filter(Boolean)

// Beberapa foto sekaligus (nota lebih dari satu lembar / beberapa nota)
function FotoMultiInput({ label, fotos, onAdd, onRemove, maxMB = 6, showToast }) {
  const handle = (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    const oke = files.filter(f => { if (f.size > maxMB * 1024 * 1024) { showToast(`❌ ${f.name}: foto max ${maxMB}MB`); return false } return true })
    if (!oke.length) return
    Promise.all(oke.map(f => new Promise(res => { const r = new FileReader(); r.onload = ev => res({ file: f, b64: ev.target.result }); r.readAsDataURL(f) })))
      .then(list => onAdd(list))
  }
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={S.label}>{label}</label>
      {fotos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '6px' }}>
          {fotos.map((f, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={f.b64} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${C.border}` }} />
              <button onClick={() => onRemove(i)} aria-label="Hapus foto" style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '11px', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>✕</button>
              <div style={{ position: 'absolute', left: '4px', bottom: '4px', fontSize: '10px', background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>{i + 1}</div>
            </div>
          ))}
        </div>
      )}
      <label style={{ display: 'block', border: `1.5px dashed ${C.border2}`, borderRadius: '8px', padding: fotos.length ? '10px' : '16px', textAlign: 'center', cursor: 'pointer', background: C.panel, fontSize: '12px', color: C.text2 }}>
        {fotos.length ? '➕ Tambah foto lagi' : '📷 Tap untuk foto / pilih gambar (boleh lebih dari satu)'}
        <input type="file" accept="image/*" multiple onChange={handle} style={{ display: 'none' }} />
      </label>
    </div>
  )
}

export function FotoInput({ label, foto, onFile, onClear, maxMB = 4, showToast }) {
  const handle = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > maxMB * 1024 * 1024) { showToast(`❌ Foto max ${maxMB}MB`); return }
    const reader = new FileReader()
    reader.onload = (ev) => onFile(file, ev.target.result)
    reader.readAsDataURL(file)
  }
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={S.label}>{label}</label>
      {foto ? (
        <div style={{ position: 'relative' }}>
          <img src={foto} alt="foto" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${C.border}` }} />
          <button onClick={onClear} style={{ ...S.btn, ...S.btnDanger, position: 'absolute', top: '8px', right: '8px', padding: '4px 10px', fontSize: '11px' }}>✕ Ganti</button>
        </div>
      ) : (
        <label style={{ display: 'block', border: `1.5px dashed ${C.border2}`, borderRadius: '8px', padding: '16px', textAlign: 'center', cursor: 'pointer', background: C.panel, fontSize: '12px', color: C.text2 }}>
          📷 Tap untuk foto / pilih gambar
          <input type="file" accept="image/*" onChange={handle} style={{ display: 'none' }} />
        </label>
      )}
    </div>
  )
}

export function Tabs({ value, onChange, items }) {
  return (
    <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${C.border}`, marginBottom: '14px' }}>
      {items.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          padding: '8px 14px', fontSize: '12px', fontWeight: value === k ? 600 : 400,
          border: 'none', borderBottom: value === k ? `2px solid ${C.text}` : '2px solid transparent',
          background: 'transparent', color: value === k ? C.text : C.text3, cursor: 'pointer',
        }}>{l}</button>
      ))}
    </div>
  )
}

export function DatePicker({ value, onChange }) {
  const today = formatTanggal()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
      <button onClick={() => onChange(shiftDate(value, -1))} style={{ ...S.btn, ...S.btnSecondary, padding: '8px 12px' }}>‹</button>
      <input type="date" value={value} max={today} onChange={e => onChange(e.target.value)} style={{ ...S.input, textAlign: 'center', fontWeight: 600 }} />
      <button onClick={() => onChange(shiftDate(value, 1))} disabled={value >= today} style={{ ...S.btn, ...S.btnSecondary, padding: '8px 12px', opacity: value >= today ? 0.4 : 1 }}>›</button>
      {value !== today && <button onClick={() => onChange(today)} style={{ ...S.btn, ...S.btnSecondary, padding: '8px 10px', fontSize: '11px' }}>Hari ini</button>}
    </div>
  )
}

// =====================================================
// 2. PENGELUARAN KAS KASIR
// =====================================================
export function PengeluaranKasirView({ showToast, userName, setUserName, loadData, role }) {
  const isOwner = role === 'owner'
  const [tab, setTab] = useState('catat')
  const [tanggal, setTanggal] = useState(formatTanggal())
  const [jumlah, setJumlah] = useState('')
  const [keperluan, setKeperluan] = useState('')
  const [sumber, setSumber] = useState('kas_kasir')
  const [dibayarOleh, setDibayarOleh] = useState('')
  const [adaNota, setAdaNota] = useState(false)
  const [fotos, setFotos] = useState([])   // [{ file, b64 }]
  const [disetujui, setDisetujui] = useState('')
  const [cara, setCara] = useState('WA')
  const [catatan, setCatatan] = useState('')
  const [yangInput, setYangInput] = useState(userName)
  const [owners, setOwners] = useState([])
  const [list, setList] = useState([])
  const [saving, setSaving] = useState(false)
  const [fotoModal, setFotoModal] = useState(null)

  const loadList = async () => {
    const [pk, bl] = await Promise.all([
      supabase.from('pengeluaran_kasir').select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false }).limit(100),
      supabase.from('belanja').select('id, tanggal, total_harga, sumber_dana, dibayar_oleh, yang_belanja, foto_nota, foto_tambahan, items, status_baca, catatan, created_at').order('created_at', { ascending: false }).limit(100),
    ])
    // Belanja bahan juga uang keluar laci, tampilkan di riwayat yang sama supaya laporan kas keluar lengkap
    const dipindah = new Set((pk.data || []).map(p => p.dipindah_ke_belanja).filter(Boolean))
    const belanjaRows = (bl.data || []).filter(b => !dipindah.has(b.id)).map(b => ({
      id: 'b-' + b.id, _belanja: true, tanggal: b.tanggal, jumlah: b.total_harga, kategori: BELANJA_BAHAN,
      keperluan: b.status_baca === 'menunggu' ? 'Belanja bahan — nota menunggu dibaca' : 'Belanja bahan — ' + ((b.items || []).map(i => i.nama).join(', ').slice(0, 60) || 'tanpa rincian'),
      sumber_dana: b.sumber_dana, dibayar_oleh: b.dibayar_oleh, yang_input: b.yang_belanja, ada_nota: !!b.foto_nota, foto: b.foto_nota, foto_tambahan: b.foto_tambahan, catatan: b.catatan, created_at: b.created_at,
    }))
    setList([...(pk.data || []), ...belanjaRows].sort((a, b) => (b.tanggal + (b.created_at || '')).localeCompare(a.tanggal + (a.created_at || ''))))
  }
  useEffect(() => {
    loadList()
    supabase.from('app_users').select('nama').eq('role', 'owner').eq('is_active', true).order('urutan')
      .then(({ data }) => { const n = (data || []).map(d => d.nama); setOwners(n); if (n[0]) setDisetujui(n[0]) })
  }, [])

  const reset = () => { setJumlah(''); setKeperluan(''); setAdaNota(false); setFotos([]); setCatatan(''); setDibayarOleh('') }

  const handleSave = async () => {
    if (!num(jumlah)) { showToast('❌ Isi jumlah'); return }
    if (!keperluan.trim()) { showToast('❌ Isi untuk apa uangnya'); return }
    if (!disetujui.trim()) { showToast('❌ Isi siapa yang menyetujui'); return }
    if (!yangInput.trim()) { showToast('❌ Isi nama yang input'); return }
    if (adaNota && fotos.length === 0) { showToast('❌ Kamu centang "ada nota", fotonya mana?'); return }
    if (sumber === 'talangan' && !dibayarOleh.trim()) { showToast('❌ Isi siapa yang menalangi'); return }
    setSaving(true)
    setUserName(yangInput)
    try {
      const urls = []
      for (const f of fotos) urls.push(await uploadFotoToStorage(f.file, 'pengeluaran', { tanggal }))
      const id = generateId()
      const { error } = await supabase.from('pengeluaran_kasir').insert({
        id, tanggal, jumlah: num(jumlah), keperluan: keperluan.trim(), kategori: null, sumber_dana: sumber,
        status_baca: urls.length ? 'menunggu' : 'selesai',   // ada foto → kategori & isi nota dibaca Claude pada tugas pagi
        dibayar_oleh: sumber === 'talangan' ? dibayarOleh.trim() : null, status_ganti: sumber === 'talangan' ? 'belum' : null,
        ada_nota: adaNota, disetujui_oleh: disetujui.trim(), cara_persetujuan: cara,
        foto: urls[0] || null, foto_tambahan: urls.slice(1), catatan: catatan.trim() || null, yang_input: yangInput,
      })
      if (error) throw error
      if (sumber === 'petty_cash') {
        await supabase.from('petty_cash').insert({
          id: generateId(), tanggal, jenis: 'pengeluaran', jumlah: -num(jumlah), saldo_setelah: 0,
          pemegang: 'staff', catatan: `Pengeluaran kasir: ${keperluan.trim()}`, yang_input: yangInput,
        })
      }
      showToast(`✅ Pengeluaran ${formatRupiah(num(jumlah))} tercatat`)
      reset(); await loadList(); loadData && loadData()
      setTab('riwayat')
    } catch (e) { showToast('❌ ' + e.message) }
    setSaving(false)
  }

  const bulan = bulanIni(formatTanggal())
  // Staff hanya melihat catatan yang dia input sendiri; owner melihat semuanya
  const visible = isOwner ? list : list.filter(p => p.yang_input === userName)
  const listBulan = visible.filter(p => bulanIni(p.tanggal) === bulan)
  const totalBulan = listBulan.reduce((s, p) => s + num(p.jumlah), 0)
  const perKategori = {}
  listBulan.forEach(p => { const k = p.kategori || 'Belum dikategorikan'; perKategori[k] = (perKategori[k] || 0) + num(p.jumlah) })

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '2px' }}>💸 Pengeluaran Kas Kasir</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '12px' }}>Semua uang yang keluar dari laci kasir / petty cash: belanja bahan, parkir, galon, ongkir, konsumsi staff. Cukup isi jumlah, untuk apa, dan foto notanya. Kategori dan isi nota diurus Claude saat input ke Accurate.</p>

      <Tabs value={tab} onChange={setTab} items={[['catat', '📝 Catat'], ['riwayat', `📅 Riwayat (${listBulan.length})`]]} />

      {tab === 'catat' && (
        <div>
          <FormRow label="Tanggal">
            <input type="date" value={tanggal} max={formatTanggal()} onChange={e => setTanggal(e.target.value)} style={S.input} />
          </FormRow>
          <FormRow label="Jumlah (Rp) *">
            <RupiahInput value={jumlah} onChange={setJumlah} big autoFocus />
          </FormRow>
          <FormRow label="Untuk apa? *">
            <input value={keperluan} onChange={e => setKeperluan(e.target.value)} placeholder="misal: belanja Lotte, parkir supplier, galon, ongkir Grab" style={S.input} />
          </FormRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            <FormRow label="Sumber uang">
              <select value={sumber} onChange={e => setSumber(e.target.value)} style={S.input}>
                <option value="kas_kasir">🏪 Kas kasir</option>
                <option value="petty_cash">💵 Petty cash</option>
                <option value="transfer_toko">🏦 Transfer rekening toko</option>
                <option value="qris_toko">📱 QRIS toko</option>
                <option value="talangan">🙋 Ditalangi dulu</option>
              </select>
            </FormRow>
          </div>
          {sumber === 'talangan' && (
            <FormRow label="Siapa yang bayar dulu? *" hint='Dicatat sebagai hutang toko ke orang itu sampai owner menandai "sudah diganti".'>
              <input value={dibayarOleh} onChange={e => setDibayarOleh(e.target.value)} placeholder="Tissa / Diandra / nama staff" style={{ ...S.input, background: C.yellowBg, borderColor: C.yellowBorder }} />
            </FormRow>
          )}

          <div style={{ background: C.yellowBg, border: `1px solid ${C.yellowBorder}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: C.yellow, fontWeight: 600, marginBottom: '8px' }}>✅ Persetujuan owner (wajib)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={S.label}>Disetujui oleh *</label>
                {owners.length > 0 ? (
                  <select value={disetujui} onChange={e => setDisetujui(e.target.value)} style={S.input}>
                    {owners.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input value={disetujui} onChange={e => setDisetujui(e.target.value)} placeholder="Nama owner" style={S.input} />
                )}
              </div>
              <div>
                <label style={S.label}>Lewat</label>
                <select value={cara} onChange={e => setCara(e.target.value)} style={S.input}>
                  {CARA_PERSETUJUAN.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <input type="checkbox" id="ada-nota" checked={adaNota} onChange={e => setAdaNota(e.target.checked)} />
            <label htmlFor="ada-nota" style={{ fontSize: '12px', cursor: 'pointer' }}>Ada nota / struk fisik</label>
          </div>
          <FotoMultiInput label={adaNota ? 'Foto nota * (boleh beberapa)' : 'Foto bukti (opsional, misal nota atau screenshot WA persetujuan)'} fotos={fotos} showToast={showToast}
            onAdd={list => setFotos(prev => [...prev, ...list])} onRemove={i => setFotos(prev => prev.filter((_, k) => k !== i))} />

          <FormRow label="Catatan (opsional)">
            <input value={catatan} onChange={e => setCatatan(e.target.value)} style={S.input} />
          </FormRow>
          <FormRow label="Yang input *">
            <input value={yangInput} onChange={e => setYangInput(e.target.value)} placeholder="Nama kamu" style={S.input} />
          </FormRow>

          <button onClick={handleSave} disabled={saving} style={{ ...S.btn, ...S.btnSuccess, width: '100%', padding: '13px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Menyimpan...' : '✅ Simpan Pengeluaran'}
          </button>
        </div>
      )}

      {tab === 'riwayat' && (
        <div>
          <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: C.red }}>{isOwner ? 'Total pengeluaran kasir bulan ini' : 'Total yang kamu input bulan ini'}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: C.red }}>{formatRupiah(totalBulan)}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {Object.entries(perKategori).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <span key={k} style={{ ...S.badge('red'), background: C.panel }}>{k}: {formatRupiah(v)}</span>
              ))}
            </div>
          </div>
          {!isOwner && <div style={{ fontSize: '11px', color: C.text3, marginBottom: '8px' }}>Hanya catatan yang kamu input sendiri yang tampil di sini.</div>}
          {visible.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: C.text3, fontSize: '13px' }}>Belum ada pengeluaran tercatat.</div>}
          {visible.map(p => (
            <div key={p.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '11px 14px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.keperluan}</div>
                  <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>
                    {formatTanggalID(p.tanggal)} · {p.kategori || (p.status_baca === 'menunggu' ? 'kategori diisi Claude (tugas pagi)' : 'belum dikategorikan')} · {sumberText(p)}{p.dipindah_ke_belanja ? ' · 🧾 jadi nota belanja' : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>
                    {p._belanja ? <>🧾 nota belanja · input {p.yang_input}{p.catatan ? ` · ${p.catatan}` : ''}</> : <>✅ {p.disetujui_oleh} via {p.cara_persetujuan} · input {p.yang_input}{p.ada_nota ? ' · 🧾 ada nota' : ' · tanpa nota'}</>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: C.red }}>{formatRupiah(p.jumlah)}</div>
                  {semuaFoto(p.foto, p.foto_tambahan).map((u, i, arr) => <button key={u} onClick={() => setFotoModal(u)} style={{ ...S.btn, ...S.btnSecondary, padding: '3px 8px', fontSize: '10px', marginTop: '4px', marginLeft: i ? '4px' : 0 }}>📷{arr.length > 1 ? ` ${i + 1}` : ' Foto'}</button>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {fotoModal && (
        <div onClick={() => setFotoModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <img src={fotoModal} alt="foto" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px' }} />
        </div>
      )}
    </div>
  )
}

// =====================================================
// 3. REKAP HARIAN (Owner) — satu hari, semua kejadian, siap untuk Accurate
// =====================================================
export function RekapHarianView({ bahanBaku, showToast, setView }) {
  const [tanggal, setTanggal] = useState(formatTanggal())
  const [data, setData] = useState({ penjualan: null, belanja: [], pengeluaran: [], waste: [], produksi: [] })
  const [loading, setLoading] = useState(false)
  const [fotoModal, setFotoModal] = useState(null)

  const bahanById = useMemo(() => Object.fromEntries((bahanBaku || []).map(b => [b.id, b])), [bahanBaku])

  const load = async (tgl) => {
    setLoading(true)
    try {
      const [pj, bl, pk, ws, pr] = await Promise.all([
        supabase.from('penjualan_harian').select('*').eq('tanggal', tgl).maybeSingle(),
        supabase.from('belanja').select('*').eq('tanggal', tgl).order('created_at'),
        supabase.from('pengeluaran_kasir').select('*').eq('tanggal', tgl).order('created_at'),
        supabase.from('waste').select('*').eq('tanggal', tgl).order('created_at'),
        supabase.from('produksi').select('id, menu_nama, hasil_pcs, total_cogs, yang_masak, status').eq('tanggal', tgl).order('created_at'),
      ])
      setData({ penjualan: pj.data || null, belanja: bl.data || [], pengeluaran: (pk.data || []).filter(p => !p.dipindah_ke_belanja), waste: ws.data || [], produksi: pr.data || [] })
    } catch (e) { showToast('❌ ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { load(tanggal) }, [tanggal])

  const { penjualan, belanja, pengeluaran, waste, produksi } = data
  const totalBelanja = belanja.reduce((s, b) => s + num(b.total_harga), 0)
  const totalPengeluaran = pengeluaran.reduce((s, p) => s + num(p.jumlah), 0)
  const nilaiWaste = waste.reduce((s, w) => s + num(w.jumlah) * num(bahanById[w.bahan_id]?.harga_per_satuan), 0)
  const belanjaKas = belanja.filter(b => b.sumber_dana === 'kas_kasir').reduce((s, b) => s + num(b.total_harga), 0)
  const pengeluaranKas = pengeluaran.filter(p => p.sumber_dana === 'kas_kasir').reduce((s, p) => s + num(p.jumlah), 0)
  const kasTunaiBersih = num(penjualan?.tunai) - belanjaKas - pengeluaranKas

  // Baris belanja per item, dengan kode Accurate
  const belanjaRows = []
  belanja.forEach(b => (b.items || []).forEach(it => {
    const bahan = bahanById[it.bahan_id]
    belanjaRows.push({
      nota_id: b.id, bahan_id: it.bahan_id, nama: it.nama, jumlah: it.jumlah, satuan: it.satuan, harga: it.harga,
      kode: bahan?.kode_accurate || '', nama_acc: bahan?.nama_accurate || '',
      sumber: sumberText(b), jalur: b.jalur, yang_belanja: b.yang_belanja, foto: b.foto_nota, dibayar_oleh: b.dibayar_oleh || '', status_ganti: b.status_ganti || '',
    })
  }))
  const biayaRows = []
  belanja.forEach(b => (b.biaya_lain || []).forEach(x => biayaRows.push({
    nota_id: b.id, keterangan: x.keterangan, kategori: x.kategori, harga: x.harga, sumber: sumberText(b), yang_belanja: b.yang_belanja, foto: b.foto_nota,
  })))
  const tanpaKode = belanjaRows.filter(r => !r.kode && bahanById[r.bahan_id]?.status_accurate !== 'tidak_perlu').length

  const teksRekap = () => {
    const L = []
    L.push(`REKAP PICCOLO CORNER — ${formatTanggalID(tanggal)}`)
    L.push('')
    L.push('PENJUALAN')
    if (penjualan) {
      L.push(`Total omzet: ${formatRupiah(penjualan.total_omzet)}${penjualan.jumlah_transaksi ? ` (${penjualan.jumlah_transaksi} trx)` : ''}`)
      METODE.forEach(([k, l]) => { if (num(penjualan[k])) L.push(`  ${l.replace(/^\S+\s/, '')}: ${formatRupiah(penjualan[k])}`) })
    } else L.push('Belum diinput')
    L.push('')
    L.push(`BELANJA BAHAN (${belanja.length} nota, ${formatRupiah(totalBelanja)})`)
    belanjaRows.forEach(r => L.push(`  ${r.kode || '[tanpa kode]'} ${r.nama_acc || r.nama} — ${r.jumlah} ${r.satuan} — ${formatRupiah(r.harga)} — ${r.sumber}`))
    biayaRows.forEach(r => L.push(`  [bukan stok] ${r.keterangan} — ${r.kategori} — ${formatRupiah(r.harga)} — ${r.sumber} (nota ${r.yang_belanja})`))
    L.push('')
    L.push(`PENGELUARAN KASIR (${pengeluaran.length}, ${formatRupiah(totalPengeluaran)})`)
    pengeluaran.forEach(p => L.push(`  ${p.keperluan} — ${formatRupiah(p.jumlah)} — ${p.kategori || 'belum dikategorikan'} — ${sumberText(p)} — acc ${p.disetujui_oleh} (${p.cara_persetujuan})${p.ada_nota ? ' — ada nota' : ' — tanpa nota'}`))
    L.push('')
    L.push(`WASTE (${waste.length}, nilai ± ${formatRupiah(nilaiWaste)})`)
    waste.forEach(w => { const b = bahanById[w.bahan_id]; L.push(`  ${b?.kode_accurate || '[tanpa kode]'} ${b?.nama || w.bahan_id} — ${w.jumlah} ${b?.satuan_dasar || ''} — ${w.alasan}`) })
    L.push('')
    L.push(`PRODUKSI: ${produksi.length} batch`)
    return L.join('\n')
  }

  const salin = async () => {
    try { await navigator.clipboard.writeText(teksRekap()); showToast('✅ Teks rekap disalin') }
    catch { showToast('❌ Tidak bisa menyalin otomatis di browser ini') }
  }

  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    const ringkasan = [
      { Keterangan: 'Tanggal', Nilai: tanggal },
      { Keterangan: 'Total omzet', Nilai: num(penjualan?.total_omzet) },
      ...METODE.map(([k, l]) => ({ Keterangan: `Omzet ${l.replace(/^\S+\s/, '')}`, Nilai: num(penjualan?.[k]) })),
      { Keterangan: 'Jumlah transaksi', Nilai: penjualan?.jumlah_transaksi || '' },
      { Keterangan: 'Foto POS', Nilai: penjualan?.foto || '' },
      { Keterangan: 'Foto settlement EDC', Nilai: penjualan?.foto_edc || '' },
      { Keterangan: 'Belanja bahan (total)', Nilai: totalBelanja },
      { Keterangan: 'Belanja bahan dari kas kasir', Nilai: belanjaKas },
      { Keterangan: 'Pengeluaran kasir (total)', Nilai: totalPengeluaran },
      { Keterangan: 'Pengeluaran kasir dari kas kasir', Nilai: pengeluaranKas },
      { Keterangan: 'Kas tunai bersih (tunai − belanja kas − pengeluaran kas)', Nilai: kasTunaiBersih },
      { Keterangan: 'Nilai waste (perkiraan)', Nilai: Math.round(nilaiWaste) },
      { Keterangan: 'Produksi (batch)', Nilai: produksi.length },
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ringkasan), 'Ringkasan')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(belanjaRows.map(r => ({
      Tanggal: tanggal, 'Kode Accurate': r.kode, 'Nama Accurate': r.nama_acc, 'Nama di App': r.nama,
      Jumlah: r.jumlah, Satuan: r.satuan, 'Total Harga': r.harga, 'Sumber Dana': r.sumber, 'Ditalangi Oleh': r.dibayar_oleh, 'Status Ganti': r.status_ganti, Jalur: r.jalur,
      'Yang Belanja': r.yang_belanja, 'Foto Nota': r.foto || '',
    }))), 'Belanja')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pengeluaran.map(p => ({
      Tanggal: p.tanggal, Keperluan: p.keperluan, Jumlah: p.jumlah, Kategori: p.kategori,
      'Sumber Dana': SUMBER_DANA_LABEL[p.sumber_dana] || p.sumber_dana, 'Ditalangi Oleh': p.dibayar_oleh || '', 'Status Ganti': p.status_ganti || '', 'Ada Nota': p.ada_nota ? 'Y' : 'T',
      'Disetujui Oleh': p.disetujui_oleh, 'Cara Persetujuan': p.cara_persetujuan, 'Yang Input': p.yang_input, Catatan: p.catatan || '', Foto: p.foto || '',
    }))), 'Pengeluaran Kasir')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(waste.map(w => {
      const b = bahanById[w.bahan_id]
      return { Tanggal: w.tanggal, 'Kode Accurate': b?.kode_accurate || '', 'Nama Bahan': b?.nama || w.bahan_id, Jumlah: w.jumlah, Satuan: b?.satuan_dasar || '',
        'Harga/Satuan': num(b?.harga_per_satuan), 'Nilai (Rp)': Math.round(num(w.jumlah) * num(b?.harga_per_satuan)), Alasan: w.alasan, 'Yang Catat': w.yang_catat, Foto: w.foto || '' }
    })), 'Waste')
    XLSX.writeFile(wb, `Rekap_Harian_Piccolo_${tanggal}.xlsx`)
    showToast('✅ File rekap diunduh')
  }

  const Tile = ({ label, value, color, sub }) => (
    <div style={{ background: C[color + 'Bg'], border: `1px solid ${C[color + 'Border']}`, borderRadius: '8px', padding: '8px 10px' }}>
      <div style={{ fontSize: '10px', color: C[color] }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: C[color], marginTop: '2px' }}>{value}</div>
      {sub && <div style={{ fontSize: '10px', color: C[color], opacity: 0.8 }}>{sub}</div>}
    </div>
  )
  const Section = ({ title, count, total, children, empty }) => (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>{title} <span style={{ fontSize: '11px', color: C.text3, fontWeight: 400 }}>({count})</span></div>
        {total !== undefined && <div style={{ fontSize: '13px', fontWeight: 700 }}>{formatRupiah(total)}</div>}
      </div>
      {count === 0 ? <div style={{ fontSize: '12px', color: C.text3 }}>{empty}</div> : children}
    </div>
  )

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '2px' }}>📅 Rekap Harian</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '12px' }}>Semua kejadian satu hari di satu tempat. Pakai teks atau Excel-nya untuk input ke Accurate.</p>
      <DatePicker value={tanggal} onChange={setTanggal} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
        <Tile label="Omzet" value={penjualan ? formatRupiah(penjualan.total_omzet) : 'belum diinput'} color={penjualan ? 'green' : 'yellow'} sub={penjualan?.jumlah_transaksi ? `${penjualan.jumlah_transaksi} transaksi` : ''} />
        <Tile label="Belanja bahan" value={formatRupiah(totalBelanja)} color="blue" sub={`${belanja.length} nota`} />
        <Tile label="Pengeluaran kasir" value={formatRupiah(totalPengeluaran)} color="red" sub={`${pengeluaran.length} catatan`} />
        <Tile label="Kas tunai bersih" value={formatRupiah(kasTunaiBersih)} color={kasTunaiBersih >= 0 ? 'greenLight' : 'red'} sub="tunai − keluar dari kas kasir" />
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <button onClick={salin} style={{ ...S.btn, ...S.btnSecondary, flex: 1, fontSize: '12px' }}>📋 Salin teks rekap</button>
        <button onClick={exportExcel} style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontSize: '12px' }}>📥 Export Excel</button>
      </div>

      {loading && <div style={{ fontSize: '12px', color: C.text3, textAlign: 'center', marginBottom: '8px' }}>Memuat...</div>}

      <Section title="💰 Penjualan" count={penjualan ? 1 : 0} total={penjualan ? num(penjualan.total_omzet) : undefined}
        empty={<span>Kasir belum input penjualan tanggal ini. {setView && <a onClick={() => setView('penjualan')} style={{ color: C.blue, cursor: 'pointer', textDecoration: 'underline' }}>Input sekarang</a>}</span>}>
        {penjualan && (
          <div style={{ fontSize: '12px', color: C.text2 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
              {METODE.filter(([k]) => num(penjualan[k])).map(([k, l]) => (
                <span key={k} style={S.badge('greenLight')}>{l}: {formatRupiah(penjualan[k])}</span>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: C.text3 }}>oleh {penjualan.yang_input}{penjualan.catatan ? ` · ${penjualan.catatan}` : ''}
              {penjualan.foto && <button onClick={() => setFotoModal(penjualan.foto)} style={{ ...S.btn, ...S.btnSecondary, padding: '2px 8px', fontSize: '10px', marginLeft: '6px' }}>📷 POS</button>}
              {penjualan.foto_edc && <button onClick={() => setFotoModal(penjualan.foto_edc)} style={{ ...S.btn, ...S.btnSecondary, padding: '2px 8px', fontSize: '10px', marginLeft: '6px' }}>💳 EDC</button>}
            </div>
          </div>
        )}
      </Section>

      <Section title="🧾 Belanja bahan" count={belanja.length} total={totalBelanja} empty="Tidak ada nota belanja.">
        {tanpaKode > 0 && (
          <div style={{ background: C.yellowBg, color: C.yellow, border: `1px solid ${C.yellowBorder}`, borderRadius: '6px', padding: '6px 10px', fontSize: '11px', marginBottom: '8px' }}>
            ⚠️ {tanpaKode} item belum terhubung ke Accurate. Isi lewat 📦 Stok → ✏️ Edit.
          </div>
        )}
        {belanja.map(b => (
          <div key={b.id} style={{ borderTop: `1px solid ${C.panel2}`, paddingTop: '8px', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.text3, marginBottom: '4px' }}>
              <span>{b.yang_belanja} · {b.jalur} · {sumberText(b)}</span>
              <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <strong style={{ color: C.text }}>{formatRupiah(b.total_harga)}</strong>
                {semuaFoto(b.foto_nota, b.foto_tambahan).map((u, i, arr) => <button key={u} onClick={() => setFotoModal(u)} style={{ ...S.btn, ...S.btnSecondary, padding: '2px 8px', fontSize: '10px' }}>📷{arr.length > 1 ? i + 1 : ''}</button>)}
              </span>
            </div>
            {(b.items || []).map((it, i) => {
              const bahan = bahanById[it.bahan_id]
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0' }}>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: bahan?.kode_accurate ? C.green : bahan?.status_accurate === 'tidak_perlu' ? C.text3 : C.red, marginRight: '6px' }}>{bahan?.kode_accurate || (bahan?.status_accurate === 'tidak_perlu' ? 'app' : '— —')}</span>
                    {it.nama} <span style={{ color: C.text3 }}>{it.jumlah} {it.satuan}</span>
                  </span>
                  <span>{formatRupiah(it.harga)}</span>
                </div>
              )
            })}
          </div>
        ))}
      </Section>

      <Section title="💸 Pengeluaran kasir" count={pengeluaran.length} total={totalPengeluaran} empty="Tidak ada pengeluaran kasir.">
        {pengeluaran.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderTop: `1px solid ${C.panel2}` }}>
            <span style={{ flex: 1 }}>
              {p.keperluan}
              <div style={{ fontSize: '10px', color: C.text3 }}>{p.kategori || 'belum dikategorikan'} · {sumberText(p)} · acc {p.disetujui_oleh} ({p.cara_persetujuan}){p.ada_nota ? ' · 🧾' : ''}</div>
            </span>
            <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <strong>{formatRupiah(p.jumlah)}</strong>
              {semuaFoto(p.foto, p.foto_tambahan).map((u, i, arr) => <button key={u} onClick={() => setFotoModal(u)} style={{ ...S.btn, ...S.btnSecondary, padding: '2px 8px', fontSize: '10px' }}>📷{arr.length > 1 ? i + 1 : ''}</button>)}
            </span>
          </div>
        ))}
      </Section>

      <Section title="🗑️ Waste" count={waste.length} total={Math.round(nilaiWaste)} empty="Tidak ada waste tercatat.">
        {waste.map(w => { const b = bahanById[w.bahan_id]; return (
          <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', borderTop: `1px solid ${C.panel2}` }}>
            <span><span style={{ fontFamily: 'monospace', fontSize: '11px', color: b?.kode_accurate ? C.green : b?.status_accurate === 'tidak_perlu' ? C.text3 : C.red, marginRight: '6px' }}>{b?.kode_accurate || (b?.status_accurate === 'tidak_perlu' ? 'app' : '— —')}</span>{b?.nama || w.bahan_id} <span style={{ color: C.text3 }}>{w.jumlah} {b?.satuan_dasar} · {w.alasan}</span></span>
            <span>{formatRupiah(Math.round(num(w.jumlah) * num(b?.harga_per_satuan)))}</span>
          </div>
        )})}
      </Section>

      <Section title="📝 Produksi" count={produksi.length} empty="Tidak ada produksi.">
        {produksi.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', borderTop: `1px solid ${C.panel2}` }}>
            <span>{p.menu_nama} <span style={{ color: C.text3 }}>{p.hasil_pcs} · {p.yang_masak}</span></span>
            <span style={{ color: C.text3 }}>HPP {formatRupiah(Math.round(num(p.total_cogs)))}</span>
          </div>
        ))}
      </Section>

      {fotoModal && (
        <div onClick={() => setFotoModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <img src={fotoModal} alt="foto" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '8px' }} />
        </div>
      )}
    </div>
  )
}

// =====================================================
// 4. TALANGAN (Owner) — uang pribadi yang dipakai dulu untuk toko, belum diganti
// =====================================================
export function TalanganCard({ showToast }) {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const load = async () => {
    const [a, b] = await Promise.all([
      supabase.from('belanja').select('id, tanggal, total_harga, dibayar_oleh, yang_belanja, catatan').eq('status_ganti', 'belum').order('tanggal'),
      supabase.from('pengeluaran_kasir').select('id, tanggal, jumlah, dibayar_oleh, keperluan').eq('status_ganti', 'belum').order('tanggal'),
    ])
    setRows([
      ...(a.data || []).map(r => ({ tabel: 'belanja', id: r.id, tanggal: r.tanggal, jumlah: num(r.total_harga), oleh: r.dibayar_oleh || '?', ket: 'Belanja bahan' + (r.catatan ? ' · ' + r.catatan : '') })),
      ...(b.data || []).map(r => ({ tabel: 'pengeluaran_kasir', id: r.id, tanggal: r.tanggal, jumlah: num(r.jumlah), oleh: r.dibayar_oleh || '?', ket: r.keperluan })),
    ].sort((x, y) => (x.tanggal || '').localeCompare(y.tanggal || '')))
  }
  useEffect(() => { load() }, [])
  const tandaiGanti = async (r) => {
    const { error } = await supabase.from(r.tabel).update({ status_ganti: 'sudah', tanggal_ganti: formatTanggal() }).eq('id', r.id)
    if (error) { showToast('❌ ' + error.message); return }
    showToast(`✅ ${formatRupiah(r.jumlah)} ke ${r.oleh} ditandai sudah diganti`)
    load()
  }
  if (rows.length === 0) return null
  const total = rows.reduce((s, r) => s + r.jumlah, 0)
  const perOrang = {}
  rows.forEach(r => { perOrang[r.oleh] = (perOrang[r.oleh] || 0) + r.jumlah })
  return (
    <div style={{ background: C.yellowBg, border: `1px solid ${C.yellowBorder}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: C.yellow }}>🙋 Talangan belum diganti</div>
          <div style={{ fontSize: '11px', color: C.yellow }}>{Object.entries(perOrang).map(([n, v]) => `${n}: ${formatRupiah(v)}`).join(' · ')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.yellow }}>{formatRupiah(total)}</div>
          <div style={{ fontSize: '10px', color: C.yellow }}>{rows.length} catatan · {open ? 'tutup ▲' : 'lihat ▼'}</div>
        </div>
      </div>
      {open && rows.map(r => (
        <div key={r.tabel + r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', borderTop: `1px solid ${C.yellowBorder}`, padding: '8px 0', fontSize: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{r.oleh} · {formatRupiah(r.jumlah)}</div>
            <div style={{ fontSize: '10px', color: C.text3 }}>{formatTanggalID(r.tanggal)} · {r.ket}</div>
          </div>
          <button onClick={() => tandaiGanti(r)} style={{ ...S.btn, ...S.btnSuccess, padding: '6px 10px', fontSize: '11px' }}>✓ Sudah diganti</button>
        </div>
      ))}
    </div>
  )
}
