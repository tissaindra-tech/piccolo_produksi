// Request belanja: staff mengajukan barang yang perlu dibeli, owner menyetujui/menolak di aplikasi,
// lalu request yang disetujui dipakai saat input nota (status jadi "dibeli").
import { useState, useEffect } from 'react'
import { supabase, generateId, formatTanggalID } from './supabase'
import { C, S, Icon } from './shared'

export const STATUS_REQ = {
  menunggu:  ['Menunggu owner', 'yellow'],
  disetujui: ['Disetujui · siap dibeli', 'greenLight'],
  ditolak:   ['Ditolak', 'red'],
  dibeli:    ['Sudah dibeli', 'green'],
  batal:     ['Dibatalkan', 'default'],
}

const Badge = ({ status }) => {
  const [label, color] = STATUS_REQ[status] || [status, 'default']
  return <span style={S.badge(color)}>{label}</span>
}

const ringkasItems = (items = []) => items.map(i => `${i.nama} ${i.jumlah || ''} ${i.satuan || ''}`.trim()).join(', ')

export function RequestBelanjaView({ bahanBaku = [], requests = [], setRequests, role, userName, showToast, loadData, setView, logAudit, requestDraft, setRequestDraft }) {
  const isOwner = role === 'owner'
  const [rows, setRows] = useState([])            // [{ bahan_id, nama, jumlah, satuan }]
  const [cari, setCari] = useState('')
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState(isOwner ? 'menunggu' : 'semua')
  const [noteOwner, setNoteOwner] = useState({})   // id -> catatan owner
  const [buka, setBuka] = useState(!isOwner)
  const [sibuk, setSibuk] = useState({})           // id -> true selagi tombol setujui/tolak/batal diproses

  // Ubah satu request langsung di layar tanpa muat ulang semua data (daftar lain tetap terlihat, tidak ada layar loading).
  const ubahLokal = (id, patch) => setRequests && setRequests(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x))

  // Semua barang aktif yang bisa dibeli: mentah, prepack, maupun barang jadi (Indomie, susu kedelai botol)
  const mentah = bahanBaku.filter(b => b.is_active !== false)
  const stokRendah = mentah.filter(b => Number(b.stok_saat_ini) < Number(b.stok_minimum)).slice(0, 8)
  const hasil = cari.trim()
    ? mentah.filter(b => b.nama.toLowerCase().includes(cari.toLowerCase()) && !rows.some(r => r.bahan_id === b.id)).slice(0, 8)
    : []

  const tambah = (b) => {
    if (rows.some(r => r.bahan_id === b.id)) return
    const sat = b.kemasan || ({ gram: 'kg', gr: 'kg', g: 'kg', ml: 'liter' })[String(b.satuan_dasar || '').toLowerCase()] || b.satuan_dasar || ''
    setRows([...rows, { bahan_id: b.id, nama: b.nama, jumlah: '', satuan: sat }])
    setCari('')
  }
  const ubah = (idx, f, v) => setRows(rows.map((r, i) => i === idx ? { ...r, [f]: v } : r))
  const hapus = (idx) => setRows(rows.filter((_, i) => i !== idx))

  // Datang dari tombol "Request order" di layar stok: langsung buka form dengan barang itu
  useEffect(() => {
    if (requestDraft) { tambah(requestDraft); setBuka(true); setRequestDraft && setRequestDraft(null) }
  }, [requestDraft])  // eslint-disable-line react-hooks/exhaustive-deps

  const kirim = async () => {
    const valid = rows.filter(r => r.bahan_id && Number(r.jumlah) > 0)
    if (valid.length === 0) { showToast('❌ Pilih barang dan isi jumlahnya'); return }
    setSaving(true)
    try {
      const id = generateId()
      const { error } = await supabase.from('request_belanja').insert({
        id, dibuat_oleh: userName || 'staff', catatan: catatan.trim() || null,
        items: valid.map(r => ({ bahan_id: r.bahan_id, nama: r.nama, jumlah: Number(r.jumlah), satuan: r.satuan })),
      })
      if (error) throw error
      if (logAudit) await logAudit('request_belanja', id, 'create', null, `${valid.length} barang`, { items: valid })
      showToast('✅ Request terkirim, menunggu owner')
      setRows([]); setCatatan(''); setBuka(false)
      loadData && loadData()
    } catch (e) { showToast('❌ ' + e.message) }
    setSaving(false)
  }

  const putuskan = async (r, status) => {
    if (sibuk[r.id]) return
    setSibuk(p => ({ ...p, [r.id]: true }))
    try {
      const patch = {
        status, diputuskan_oleh: userName || 'owner', catatan_owner: (noteOwner[r.id] || '').trim() || null, tanggal_putus: new Date().toISOString(),
      }
      const { error } = await supabase.from('request_belanja').update(patch).eq('id', r.id)
      if (error) throw error
      ubahLokal(r.id, patch)
      setNoteOwner(p => { const n = { ...p }; delete n[r.id]; return n })
      showToast(status === 'disetujui' ? '✅ Disetujui' : 'Request ditolak')
      if (!setRequests && loadData) loadData()
    } catch (e) { showToast('❌ ' + e.message) }
    setSibuk(p => { const n = { ...p }; delete n[r.id]; return n })
  }
  const batalkan = async (r) => {
    if (sibuk[r.id]) return
    setSibuk(p => ({ ...p, [r.id]: true }))
    const { error } = await supabase.from('request_belanja').update({ status: 'batal' }).eq('id', r.id)
    setSibuk(p => { const n = { ...p }; delete n[r.id]; return n })
    if (error) { showToast('❌ ' + error.message); return }
    ubahLokal(r.id, { status: 'batal' })
    showToast('Request dibatalkan')
    if (!setRequests && loadData) loadData()
  }

  const daftar = requests.filter(r => {
    if (filter === 'semua') return true
    if (filter === 'saya') return r.dibuat_oleh === userName
    return r.status === filter
  })
  const nMenunggu = requests.filter(r => r.status === 'menunggu').length
  const nSiap = requests.filter(r => r.status === 'disetujui').length

  const chip = (id, label, n) => (
    <button key={id} onClick={() => setFilter(id)} style={{
      ...S.btn, padding: '6px 10px', fontSize: '11px', borderRadius: '99px',
      background: filter === id ? C.sun : C.panel, color: C.text, border: `1px solid ${filter === id ? C.sun : C.border}`,
    }}>{label}{n != null ? ` · ${n}` : ''}</button>
  )

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>🛒 Request Belanja</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '14px' }}>
        {isOwner ? 'Setujui atau tolak barang yang diminta staff. Yang disetujui bisa langsung dipakai saat input nota.' : 'Ajukan barang yang perlu dibeli. Setelah disetujui owner, belanja lalu input notanya.'}
      </p>

      {!isOwner && nSiap > 0 && (
        <div onClick={() => setView('inputnota')} style={{ background: C.greenLightBg, border: `1px solid ${C.greenLightBorder}`, color: C.greenLight, borderRadius: '10px', padding: '10px 12px', fontSize: '12px', marginBottom: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
          <span>✅ <strong>{nSiap} request disetujui</strong>, siap dibelanjakan</span><span>Input nota →</span>
        </div>
      )}

      {/* Form request (staff; owner juga boleh) */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>➕ Request baru</div>
          {!buka && <button onClick={() => setBuka(true)} style={{ ...S.btn, ...S.btnPrimary, padding: '6px 12px', fontSize: '11px' }}>Buat</button>}
        </div>
        {buka && (
          <div style={{ marginTop: '10px' }}>
            {stokRendah.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: C.text3, marginBottom: '4px' }}>Stok rendah, tap untuk tambah:</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {stokRendah.filter(b => !rows.some(r => r.bahan_id === b.id)).map(b => (
                    <button key={b.id} onClick={() => tambah(b)} style={{ ...S.btn, padding: '5px 9px', fontSize: '11px', borderRadius: '99px', background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` }}>
                      + {b.nama} <span style={{ opacity: 0.7 }}>({b.stok_saat_ini} {b.satuan_dasar})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <input id="req-cari" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama barang..." style={S.input} />
            {hasil.length > 0 && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', marginTop: '4px', overflow: 'hidden' }}>
                {hasil.map(b => (
                  <div key={b.id} onClick={() => tambah(b)} style={{ padding: '8px 10px', fontSize: '12px', borderBottom: `1px solid ${C.panel2}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{b.nama}</span><span style={{ color: C.text3 }}>stok {b.stok_saat_ini} {b.satuan_dasar}</span>
                  </div>
                ))}
              </div>
            )}
            {rows.map((r, idx) => (
              <div key={r.bahan_id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px auto', gap: '6px', alignItems: 'center', marginTop: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nama}</div>
                <input type="number" inputMode="decimal" placeholder="Jml" value={r.jumlah} onChange={e => ubah(idx, 'jumlah', e.target.value)} style={{ ...S.input, padding: '8px' }} />
                <input value={r.satuan} onChange={e => ubah(idx, 'satuan', e.target.value)} placeholder="Satuan" style={{ ...S.input, padding: '8px' }} />
                <button onClick={() => hapus(idx)} style={{ ...S.btn, ...S.btnDanger, padding: '8px 10px' }}>✕</button>
              </div>
            ))}
            <textarea rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan (misal: untuk event Sabtu, beli di Lotte)" style={{ ...S.input, marginTop: '8px' }} />
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button onClick={kirim} disabled={saving || rows.length === 0} style={{ ...S.btn, ...S.btnSuccess, flex: 1, padding: '11px', opacity: saving || rows.length === 0 ? 0.6 : 1 }}>
                {saving ? 'Mengirim...' : `📨 Kirim request${rows.length ? ` (${rows.length} barang)` : ''}`}
              </button>
              {!isOwner ? null : <button onClick={() => setBuka(false)} style={{ ...S.btn, background: C.panel2, color: C.text, padding: '11px 14px' }}>Tutup</button>}
            </div>
          </div>
        )}
      </div>

      {/* Daftar */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {chip('menunggu', 'Menunggu', nMenunggu)}
        {chip('disetujui', 'Disetujui', nSiap)}
        {!isOwner && chip('saya', 'Punya saya')}
        {chip('semua', 'Semua')}
      </div>
      {daftar.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: C.text3, fontSize: '13px' }}>Tidak ada request di sini</div>}
      {daftar.map(r => (
        <div key={r.id} style={{ background: C.panel, border: `1px solid ${r.status === 'menunggu' ? C.yellowBorder : C.border}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ fontSize: '11px', color: C.text3 }}>{formatTanggalID(r.tanggal)} · <strong style={{ color: C.text }}>{r.dibuat_oleh}</strong></div>
            <Badge status={r.status} />
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
            {(r.items || []).map((i, k) => {
              const b = bahanBaku.find(x => String(x.id) === String(i.bahan_id))
              return (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span>• {i.nama} <strong>{i.jumlah} {i.satuan}</strong></span>
                  {isOwner && b && <span style={{ fontSize: '11px', color: Number(b.stok_saat_ini) < Number(b.stok_minimum) ? C.red : C.text3 }}>stok {b.stok_saat_ini} / min {b.stok_minimum}</span>}
                </div>
              )
            })}
          </div>
          {r.catatan && <div style={{ fontSize: '11.5px', color: C.text2, marginTop: '6px' }}>📝 {r.catatan}</div>}
          {r.catatan_owner && <div style={{ fontSize: '11.5px', color: C.sunDark, marginTop: '4px', background: C.yellowBg, padding: '6px 8px', borderRadius: '6px' }}>👑 {r.diputuskan_oleh}: {r.catatan_owner}</div>}
          {isOwner && r.status === 'menunggu' && (
            <div style={{ marginTop: '10px' }}>
              <input value={noteOwner[r.id] || ''} onChange={e => setNoteOwner({ ...noteOwner, [r.id]: e.target.value })} placeholder="Catatan untuk staff (opsional): beli di mana, pakai dana apa" style={{ ...S.input, fontSize: '12px', marginBottom: '6px' }} />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => putuskan(r, 'disetujui')} disabled={!!sibuk[r.id]} style={{ ...S.btn, ...S.btnSuccess, flex: 1, padding: '10px', opacity: sibuk[r.id] ? 0.6 : 1 }}>{sibuk[r.id] ? 'Menyimpan...' : '✓ Setujui'}</button>
                <button onClick={() => putuskan(r, 'ditolak')} disabled={!!sibuk[r.id]} style={{ ...S.btn, background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, padding: '10px 14px', opacity: sibuk[r.id] ? 0.6 : 1 }}>Tolak</button>
              </div>
            </div>
          )}
          {!isOwner && r.status === 'menunggu' && r.dibuat_oleh === userName && (
            <button onClick={() => batalkan(r)} disabled={!!sibuk[r.id]} style={{ ...S.btn, background: 'transparent', color: C.text3, border: `1px dashed ${C.border}`, padding: '6px 10px', fontSize: '11px', marginTop: '8px', opacity: sibuk[r.id] ? 0.6 : 1 }}>{sibuk[r.id] ? 'Membatalkan...' : 'Batalkan request'}</button>
          )}
          {!isOwner && r.status === 'disetujui' && (
            <button onClick={() => setView('inputnota')} style={{ ...S.btn, ...S.btnPrimary, padding: '8px 12px', fontSize: '12px', marginTop: '8px' }}>Sudah dibeli? Input nota →</button>
          )}
        </div>
      ))}
    </div>
  )
}
