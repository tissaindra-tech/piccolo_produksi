// =====================================================
// CHECKLIST HARIAN KITCHEN
// Tugas diambil dari tabel checklist_templates (diubah Owner tanpa coding).
// Jadwal jam, daftar "Saat Tidak Ada Tamu", bersih mingguan, dan tab Info dari app_settings id 'checklist_kitchen'.
// Satu lembar (checklist_runs) per station per tanggal WITA, dibuat otomatis lewat fungsi buka_checklist.
// =====================================================
import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { C, S, uploadFotoToStorage } from './shared'

const HARI_KEY = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']
const HARI_NAMA = { minggu: 'Minggu', senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu' }
const MENIT_KUNING = 30   // kuning: 30 menit sebelum batas jam

// Warna status (hijau asli untuk "selesai", beda dengan oranye "sukses" aplikasi)
const W = {
  abu: { bg: C.panel, border: C.border, fg: C.text3, label: 'Belum waktunya' },
  kuning: { bg: C.yellowBg, border: C.yellowBorder, fg: C.yellow, label: 'Segera' },
  merah: { bg: C.redBg, border: C.redBorder, fg: C.red, label: 'Lewat batas' },
  hijau: { bg: '#E7F6EC', border: '#8FD3A4', fg: '#1E7B3A', label: 'Selesai' },
  lewati: { bg: C.panel2, border: C.border2, fg: C.text2, label: 'Tidak dikerjakan' },
}

// Jam & tanggal sekarang di WITA (Asia/Makassar), apa pun zona waktu HP-nya
export function sekarangWita() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(x => [x.type, x.value]))
  const tanggal = `${p.year}-${p.month}-${p.day}`
  const menit = Number(p.hour) * 60 + Number(p.minute)
  const hari = HARI_KEY[new Date(tanggal + 'T00:00:00Z').getUTCDay()]
  return { tanggal, menit, hari, jam: `${p.hour}.${p.minute}`, tglBulan: Number(p.day) }
}

// "10.40" / "10:40" → menit sejak 00.00; selain itu (mis. "saat masak") → null
const keMenit = (s) => {
  const m = /^(\d{1,2})[.:](\d{2})$/.exec(String(s || '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
const jamTeks = (iso) => iso ? new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) : ''
const urutNo = (a, b) => String(a.template.no_urut).localeCompare(String(b.template.no_urut), 'id', { numeric: true })

export function warnaItem(item, menit) {
  if (item.status === 'selesai') return 'hijau'
  if (item.status === 'tidak_dikerjakan') return 'lewati'
  const batas = keMenit(item.template.batas_jam)
  if (batas === null) return 'abu'
  if (menit > batas) return 'merah'
  if (menit >= batas - MENIT_KUNING) return 'kuning'
  return 'abu'
}

// Ambil lembar hari ini + itemnya (dibuat otomatis kalau belum ada)
async function muatChecklist(station, staffId) {
  const { data: runId, error } = await supabase.rpc('buka_checklist', { p_station: station, p_staff: staffId || null })
  if (error) throw error
  const { data, error: e2 } = await supabase.from('checklist_items').select('*, template:checklist_templates(*)').eq('run_id', runId)
  if (e2) throw e2
  return { runId, items: (data || []).filter(i => i.template?.aktif).sort(urutNo) }
}

// Ringkasan kecil untuk kartu di Home staff
export function useRingkasChecklist(station, staffId, aktif) {
  const [r, setR] = useState(null)
  useEffect(() => {
    if (!aktif) return
    let batal = false
    muatChecklist(station, staffId).then(({ items }) => {
      if (batal) return
      const { menit } = sekarangWita()
      setR({ total: items.length, selesai: items.filter(i => i.status === 'selesai').length, merah: items.filter(i => warnaItem(i, menit) === 'merah').length })
    }).catch(e => console.error('ringkas checklist:', e))
    return () => { batal = true }
  }, [station, staffId, aktif])
  return r
}

export function ChecklistView({ settings, currentUser, userName, bahanBaku = [], setView, showToast, station = 'kitchen' }) {
  const konten = settings?.[`checklist_${station}`] || {}
  const [tab, setTab] = useState('checklist')
  const [runId, setRunId] = useState(null)
  const [items, setItems] = useState([])
  const [memuat, setMemuat] = useState(true)
  const [gagal, setGagal] = useState('')
  const [waktu, setWaktu] = useState(sekarangWita())
  const [bukaTamu, setBukaTamu] = useState(false)
  const [bukaJadwal, setBukaJadwal] = useState(false)

  useEffect(() => { const t = setInterval(() => setWaktu(sekarangWita()), 30000); return () => clearInterval(t) }, [])

  const muat = async () => {
    try {
      const r = await muatChecklist(station, currentUser?.id)
      setRunId(r.runId); setItems(r.items); setGagal('')
    } catch (e) { console.error(e); setGagal(e.message || 'Gagal memuat checklist') }
    setMemuat(false)
  }
  // Muat ulang juga saat tanggal berganti (HP dibiarkan terbuka sampai besok)
  useEffect(() => { muat() }, [station, waktu.tanggal])

  // Perubahan dari HP lain langsung terlihat
  useEffect(() => {
    if (!runId) return
    const ch = supabase.channel(`ch-checklist-${runId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items', filter: `run_id=eq.${runId}` }, () => muat())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [runId])

  const ubah = async (item, patch, pesan) => {
    setItems(list => list.map(i => i.id === item.id ? { ...i, ...patch } : i))
    const { error } = await supabase.from('checklist_items').update(patch).eq('id', item.id)
    if (error) { showToast('❌ Gagal simpan: ' + error.message); muat(); return false }
    if (pesan) showToast(pesan)
    return true
  }

  const selesai = items.filter(i => i.status === 'selesai').length
  const dilewati = items.filter(i => i.status === 'tidak_dikerjakan').length
  const itemTamu = items.find(i => i.template.lampiran === 'tidak_ada_tamu')

  if (memuat) return <div style={{ ...S.card, textAlign: 'center', fontSize: '15px', color: C.text3 }}>Memuat checklist...</div>

  return (
    <div>
      {/* Pilih tab: Checklist | Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: C.panel2, padding: '5px', borderRadius: '14px', marginBottom: '14px' }}>
        {[['checklist', '✅ Checklist'], ['info', '📖 Info']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            ...S.btn, minHeight: '50px', fontSize: '16px', fontWeight: 800, borderRadius: '10px',
            background: tab === id ? C.panel : 'transparent', color: tab === id ? C.text : C.text3,
            boxShadow: tab === id ? '0 1px 4px rgba(43,29,18,0.12)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      {gagal && <div style={{ ...S.card, background: C.redBg, color: C.red, fontSize: '14px' }}>❌ {gagal} <button onClick={muat} style={{ ...S.btn, ...S.btnDanger, marginLeft: '8px' }}>Coba lagi</button></div>}

      {tab === 'info' ? <InfoTab konten={konten} bahanBaku={bahanBaku} waktu={waktu} /> : (
        <>
          <KartuSekarang konten={konten} waktu={waktu} buka={bukaJadwal} setBuka={setBukaJadwal} />

          {/* Progress */}
          <div style={{ ...S.card, border: `1.5px solid ${selesai === items.length && items.length ? W.hijau.border : C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: C.text }}>{selesai} dari {items.length} selesai</div>
              <div style={{ fontSize: '13px', color: C.text3 }}>{HARI_NAMA[waktu.hari]}</div>
            </div>
            <div style={{ height: '12px', background: C.panel2, borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ width: `${items.length ? (selesai / items.length) * 100 : 0}%`, height: '100%', background: W.hijau.fg, borderRadius: '99px', transition: 'width .4s' }} />
            </div>
            {dilewati > 0 && <div style={{ fontSize: '13px', color: C.text2, marginTop: '6px' }}>{dilewati} tugas ditandai tidak dikerjakan</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '10px', fontSize: '12px', color: C.text2 }}>
              {[['abu', 'Belum waktunya'], ['kuning', 'Mendekati batas'], ['merah', 'Lewat batas'], ['hijau', 'Selesai']].map(([k, l]) => (
                <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '4px', background: W[k].bg, border: `2px solid ${W[k].border}` }} />{l}</span>
              ))}
            </div>
          </div>

          <button onClick={() => setBukaTamu(true)} style={{ ...S.btn, ...S.btnPrimary, width: '100%', minHeight: '58px', fontSize: '17px', fontWeight: 800, marginBottom: '14px' }}>
            🍽️ Saat Tidak Ada Tamu
          </button>

          {items.length === 0 && !gagal && <div style={{ ...S.card, textAlign: 'center', color: C.text3 }}>Belum ada tugas untuk hari ini.</div>}
          {items.map(item => (
            <KartuItem key={item.id} item={item} waktu={waktu} konten={konten} userName={userName} ubah={ubah}
              showToast={showToast} setView={setView} bukaTamu={() => setBukaTamu(true)} />
          ))}
        </>
      )}

      {bukaTamu && <ModalTidakAdaTamu konten={konten} item={itemTamu} ubah={ubah} onClose={() => setBukaTamu(false)} />}
    </div>
  )
}

// "Sekarang jam berapa → kerjakan apa"
function KartuSekarang({ konten, waktu, buka, setBuka }) {
  const jadwal = (konten.jadwal || []).map(j => ({ ...j, m0: keMenit(j.mulai), m1: keMenit(j.selesai) ?? keMenit(j.mulai) + 30 }))
  const aktif = jadwal.filter(j => waktu.menit >= j.m0 && waktu.menit < j.m1)
  const berikut = jadwal.filter(j => j.m0 > waktu.menit).sort((a, b) => a.m0 - b.m0)[0]
  const belumMulai = jadwal.length && waktu.menit < Math.min(...jadwal.map(j => j.m0))
  return (
    <div style={{ background: C.sun, borderRadius: '16px', padding: '16px 18px', marginBottom: '12px', color: C.text }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: C.sunDark }}>Sekarang jam</div>
      <div style={{ fontSize: '38px', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1px' }}>{waktu.jam}</div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: C.sunDark, marginTop: '10px' }}>Kerjakan:</div>
      {belumMulai ? (
        <div style={{ fontSize: '19px', fontWeight: 800, marginTop: '2px' }}>Belum mulai. Datang jam {jadwal.sort((a, b) => a.m0 - b.m0)[0].mulai}.</div>
      ) : aktif.length ? aktif.map((j, i) => (
        <div key={i} style={{ fontSize: '19px', fontWeight: 800, marginTop: '2px', lineHeight: 1.3 }}>→ {j.teks} <span style={{ fontSize: '13px', fontWeight: 600, color: C.sunDark }}>({j.mulai}{j.selesai && j.selesai !== '23.59' ? `–${j.selesai}` : ''})</span></div>
      )) : (
        <div style={{ fontSize: '17px', fontWeight: 800, marginTop: '2px', lineHeight: 1.3 }}>→ {konten.jadwal_kosong || 'Service'}</div>
      )}
      {berikut && <div style={{ fontSize: '14px', marginTop: '10px', background: 'rgba(255,255,255,0.45)', borderRadius: '10px', padding: '8px 10px' }}>Berikutnya <strong>{berikut.mulai}</strong> · {berikut.teks}</div>}
      <button onClick={() => setBuka(!buka)} style={{ ...S.btn, width: '100%', marginTop: '10px', minHeight: '44px', fontSize: '14px', background: 'rgba(43,29,18,0.08)', color: C.text, border: '1px solid rgba(43,29,18,0.2)' }}>
        {buka ? 'Tutup jadwal ▲' : 'Lihat jadwal lengkap ▼'}
      </button>
      {buka && (
        <div style={{ marginTop: '8px', background: C.panel, borderRadius: '12px', overflow: 'hidden' }}>
          {jadwal.map((j, i) => {
            const now = waktu.menit >= j.m0 && waktu.menit < j.m1
            return (
              <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 12px', borderTop: i ? `1px solid ${C.panel2}` : 'none', background: now ? C.greenLightBg : 'transparent', fontSize: '14px' }}>
                <div style={{ width: '92px', flexShrink: 0, fontWeight: 700 }}>{j.mulai}{j.selesai && j.selesai !== '23.59' && keMenit(j.selesai) - keMenit(j.mulai) > 10 ? `–${j.selesai}` : ''}</div>
                <div style={{ fontWeight: now ? 800 : 500 }}>{j.teks}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function KartuItem({ item, waktu, konten, userName, ubah, showToast, setView, bukaTamu }) {
  const t = item.template
  const warna = warnaItem(item, waktu.menit)
  const w = W[warna]
  const [catatan, setCatatan] = useState(item.catatan || '')
  const [tampilCatatan, setTampilCatatan] = useState(!!(t.wajib_catatan || item.catatan))
  const [upload, setUpload] = useState(false)
  const fotoRef = useRef(null)
  const sudah = item.status !== 'belum'

  // Catatan dari HP lain / dari daftar "Saat Tidak Ada Tamu"
  useEffect(() => { setCatatan(item.catatan || ''); if (item.catatan) setTampilCatatan(true) }, [item.catatan])

  const batas = keMenit(t.batas_jam)
  const sisa = batas !== null ? batas - waktu.menit : null
  const keterangan = item.status === 'selesai' ? `Selesai jam ${jamTeks(item.selesai_at)}${item.selesai_oleh ? ` · ${item.selesai_oleh}` : ''}`
    : item.status === 'tidak_dikerjakan' ? `Tidak dikerjakan${item.selesai_oleh ? ` · ${item.selesai_oleh}` : ''}`
    : warna === 'merah' ? `Lewat batas ${Math.floor(-sisa / 60) ? `${Math.floor(-sisa / 60)} jam ` : ''}${-sisa % 60} menit`
    : warna === 'kuning' ? `Sisa ${sisa} menit`
    : batas === null ? '' : 'Belum waktunya'

  const simpanCatatan = () => { if ((item.catatan || '') !== catatan) ubah(item, { catatan: catatan.trim() || null }) }

  const tandaiSelesai = () => {
    if (t.wajib_catatan && !catatan.trim()) { setTampilCatatan(true); showToast('✍️ Tulis catatan dulu, baru bisa Selesai'); return }
    if (t.wajib_foto && !item.foto_url) { showToast('📷 Ambil foto dulu, baru bisa Selesai'); return }
    ubah(item, { status: 'selesai', selesai_at: new Date().toISOString(), selesai_oleh: userName || null, catatan: catatan.trim() || null }, `✅ No. ${t.no_urut} selesai`)
  }
  const tandaiTidak = () => {
    if (!catatan.trim()) { setTampilCatatan(true); showToast('✍️ Tulis alasannya di catatan dulu'); return }
    ubah(item, { status: 'tidak_dikerjakan', selesai_at: new Date().toISOString(), selesai_oleh: userName || null, catatan: catatan.trim() })
  }
  const batalkan = () => ubah(item, { status: 'belum', selesai_at: null, selesai_oleh: null })

  const ambilFoto = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setUpload(true)
    try {
      const url = await uploadFotoToStorage(file, 'checklist', { tanggal: waktu.tanggal })
      await ubah(item, { foto_url: url }, '📷 Foto tersimpan')
    } catch (err) { showToast('❌ ' + err.message) }
    setUpload(false)
  }

  const bersihHariIni = konten.bersih_mingguan?.[waktu.hari]

  return (
    <div style={{ background: w.bg, border: `2px solid ${w.border}`, borderRadius: '16px', padding: '14px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{ minWidth: '42px', height: '42px', borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: 800,
          background: warna === 'hijau' ? w.fg : warna === 'abu' ? C.panel2 : w.border, color: warna === 'hijau' ? '#fff' : C.text }}>
          {warna === 'hijau' ? '✓' : t.no_urut}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: w.fg }}>⏰ {/^\d/.test(t.batas_jam || '') ? `Batas ${t.batas_jam}` : (t.batas_jam || 'Tanpa batas')}</span>
            {t.kritis && <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '99px', background: C.red, color: '#fff' }}>KRITIS</span>}
            {t.hari_berlaku?.length > 0 && <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: C.blueBg, color: C.blue }}>Hanya {t.hari_berlaku.map(h => HARI_NAMA[h] || h).join(', ')}</span>}
            {t.wajib_foto && <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: C.panel2, color: C.text2 }}>📷 Foto wajib</span>}
            {t.wajib_catatan && <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: C.panel2, color: C.text2 }}>✍️ Catatan wajib</span>}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: C.text, lineHeight: 1.35, textDecoration: item.status === 'selesai' ? 'line-through' : 'none' }}>{t.tugas}</div>
          {keterangan && <div style={{ fontSize: '13px', fontWeight: 700, color: w.fg, marginTop: '4px' }}>{keterangan}</div>}
        </div>
      </div>

      {/* Tambahan per tugas */}
      {t.tambahan_hari?.[waktu.hari] && (
        <div style={{ marginTop: '10px', background: C.blueBg, border: `1.5px solid ${C.blueBorder}`, borderRadius: '10px', padding: '10px 12px', fontSize: '14px', color: C.text }}>
          📌 <strong>Khusus hari ini ({HARI_NAMA[waktu.hari]}):</strong> {t.tambahan_hari[waktu.hari]}
        </div>
      )}
      {t.lampiran === 'bersih_mingguan' && (
        <div style={{ marginTop: '10px', background: C.panel, borderRadius: '10px', padding: '10px 12px', fontSize: '14px', color: C.text }}>
          🧽 <strong>Hari ini ({HARI_NAMA[waktu.hari]}):</strong> {bersihHariIni || '-'}
          {waktu.tglBulan <= 7 && konten.bersih_bulanan && <div style={{ marginTop: '6px' }}>📅 <strong>Bulanan:</strong> {konten.bersih_bulanan}</div>}
        </div>
      )}
      {t.lampiran === 'tidak_ada_tamu' && !sudah && (
        <button onClick={bukaTamu} style={{ ...S.btn, ...S.btnSecondary, width: '100%', minHeight: '48px', fontSize: '15px', marginTop: '10px', background: C.panel }}>🍽️ Pilih dari daftar "Saat Tidak Ada Tamu"</button>
      )}
      {t.lampiran === 'update_stok' && !sudah && (
        <button onClick={() => { setView('closing'); window.scrollTo({ top: 0 }) }} style={{ ...S.btn, ...S.btnSecondary, width: '100%', minHeight: '48px', fontSize: '15px', marginTop: '10px', background: C.panel }}>📋 Buka menu Update Stok</button>
      )}
      {t.lampiran === 'produksi' && !sudah && (
        <button onClick={() => { setView('produksi'); window.scrollTo({ top: 0 }) }} style={{ ...S.btn, ...S.btnSecondary, width: '100%', minHeight: '48px', fontSize: '15px', marginTop: '10px', background: C.panel }}>🍳 Buka menu Produksi</button>
      )}

      {/* Foto */}
      {t.wajib_foto && (
        <div style={{ marginTop: '10px' }}>
          {item.foto_url && <a href={item.foto_url} target="_blank" rel="noreferrer"><img src={item.foto_url} alt="Foto dapur" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '10px', display: 'block', marginBottom: '8px' }} /></a>}
          {!sudah && (
            <>
              <input ref={fotoRef} type="file" accept="image/*" capture="environment" onChange={ambilFoto} style={{ display: 'none' }} />
              <button onClick={() => fotoRef.current?.click()} disabled={upload} style={{ ...S.btn, ...S.btnSecondary, width: '100%', minHeight: '52px', fontSize: '16px', background: C.panel }}>
                {upload ? 'Mengunggah foto...' : item.foto_url ? '📷 Ganti foto' : '📷 Ambil foto dapur'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Catatan */}
      {tampilCatatan ? (
        <textarea value={catatan} onChange={e => setCatatan(e.target.value)} onBlur={simpanCatatan} disabled={sudah} rows={t.wajib_catatan ? 3 : 2}
          placeholder={t.wajib_catatan ? 'Wajib: tulis tugas yang dikerjakan' : 'Catatan (boleh kosong)'}
          style={{ ...S.input, marginTop: '10px', fontSize: '15px', resize: 'vertical', background: sudah ? C.panel2 : C.panel }} />
      ) : !sudah && (
        <button onClick={() => setTampilCatatan(true)} style={{ ...S.btn, background: 'transparent', color: C.text2, padding: '8px 0', fontSize: '14px', marginTop: '4px' }}>+ Tambah catatan</button>
      )}

      {/* Tombol utama */}
      {!sudah ? (
        <>
          <button onClick={tandaiSelesai} style={{ ...S.btn, width: '100%', minHeight: '58px', fontSize: '19px', fontWeight: 800, marginTop: '10px', background: W.hijau.fg, color: '#fff' }}>✓ Selesai</button>
          <button onClick={tandaiTidak} style={{ ...S.btn, background: 'transparent', color: C.text3, width: '100%', padding: '10px', fontSize: '13px', marginTop: '4px' }}>Tidak dikerjakan (tulis alasan di catatan)</button>
        </>
      ) : (
        <button onClick={batalkan} style={{ ...S.btn, ...S.btnSecondary, width: '100%', minHeight: '44px', fontSize: '14px', marginTop: '10px', background: C.panel }}>↩ Batalkan, tandai belum</button>
      )}
    </div>
  )
}

// Daftar "Saat Tidak Ada Tamu": yang dicentang otomatis masuk ke catatan tugas jam sepi (no. 7)
function ModalTidakAdaTamu({ konten, item, ubah, onClose }) {
  const grup = konten.tidak_ada_tamu || []
  const semuaBaris = grup.flatMap((g, gi) => g.tugas.map(x => `• ${g.tugas.length > 1 ? `${g.judul.replace(/\s*\(.*\)$/, '')}: ` : ''}${x}`))
  const awal = (item?.catatan || '').split('\n').map(s => s.trim()).filter(Boolean)
  const [pilih, setPilih] = useState(() => new Set(awal.filter(b => semuaBaris.includes(b))))
  const lainnya = awal.filter(b => !semuaBaris.includes(b))   // catatan yang diketik sendiri tetap disimpan
  const bisaIsi = item && item.status === 'belum'

  const toggle = (b) => setPilih(s => { const n = new Set(s); n.has(b) ? n.delete(b) : n.add(b); return n })
  const simpan = async () => {
    if (bisaIsi) {
      const teks = [...semuaBaris.filter(b => pilih.has(b)), ...lainnya].join('\n')
      await ubah(item, { catatan: teks || null }, pilih.size ? `✍️ ${pilih.size} tugas masuk ke catatan no. ${item.template.no_urut}` : null)
    }
    onClose()
  }

  return (
    <div onClick={simpan} style={{ position: 'fixed', inset: 0, background: 'rgba(43,29,18,0.5)', zIndex: 960, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.panel, width: '100%', maxWidth: '520px', maxHeight: '88dvh', overflowY: 'auto', borderRadius: '18px 18px 0 0', padding: '18px 16px calc(18px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ fontSize: '19px', fontWeight: 800, color: C.text }}>🍽️ Saat Tidak Ada Tamu</div>
        <div style={{ fontSize: '14px', color: C.text2, margin: '4px 0 12px' }}>
          {bisaIsi ? <>Centang yang sudah dikerjakan. Otomatis masuk ke catatan tugas no. {item.template.no_urut}. <strong style={{ color: pilih.size >= 3 ? W.hijau.fg : C.red }}>{pilih.size} dipilih (minimal 3)</strong></> : 'Kerjakan minimal 3 tugas dari daftar ini saat café sepi.'}
        </div>
        {grup.map((g, gi) => (
          <div key={gi} style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: C.text, marginBottom: '6px' }}>{gi + 1}. {g.judul}</div>
            {g.tugas.map(x => {
              const b = `• ${g.tugas.length > 1 ? `${g.judul.replace(/\s*\(.*\)$/, '')}: ` : ''}${x}`
              const on = pilih.has(b)
              return (
                <button key={b} onClick={() => bisaIsi && toggle(b)} style={{
                  font: 'inherit', width: '100%', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', minHeight: '52px', padding: '10px 12px', marginBottom: '6px',
                  borderRadius: '12px', border: `2px solid ${on ? W.hijau.border : C.border}`, background: on ? W.hijau.bg : C.bg, color: C.text, fontSize: '15px', fontWeight: 600, cursor: bisaIsi ? 'pointer' : 'default',
                }}>
                  {bisaIsi && <span style={{ width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0, border: `2px solid ${on ? W.hijau.fg : C.border2}`, background: on ? W.hijau.fg : C.panel, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{on ? '✓' : ''}</span>}
                  {x}
                </button>
              )
            })}
          </div>
        ))}
        <button onClick={simpan} style={{ ...S.btn, ...S.btnPrimary, width: '100%', minHeight: '56px', fontSize: '17px', fontWeight: 800, position: 'sticky', bottom: 0 }}>{bisaIsi ? 'Simpan & tutup' : 'Tutup'}</button>
      </div>
    </div>
  )
}

// Tab Info (hanya baca)
function InfoTab({ konten, bahanBaku, waktu }) {
  // Item kritis: cocokkan nama barang di Daftar Stok; merah kalau kosong / di bawah minimum
  const kritis = (konten.kritis || []).map(k => ({
    ...k,
    barang: bahanBaku.filter(b => b.is_active && k.cari.some(c => b.nama.toLowerCase().includes(c.toLowerCase()))),
  }))
  const kurang = (b) => Number(b.stok_saat_ini) <= 0 || Number(b.stok_saat_ini) < Number(b.stok_minimum)
  const judul = { fontSize: '17px', fontWeight: 800, color: C.text, marginBottom: '8px' }
  const baris = { fontSize: '15px', color: C.text, lineHeight: 1.45, padding: '6px 0', borderTop: `1px solid ${C.panel2}` }

  return (
    <div>
      <div style={{ ...S.card, border: `2px solid ${C.redBorder}` }}>
        <div style={judul}>🚨 Item kritis: tidak boleh kosong</div>
        <div style={{ fontSize: '13px', color: C.text3, marginBottom: '6px' }}>Merah = kosong atau di bawah batas minimum. Batas minimum diisi Owner di Daftar Stok.</div>
        {kritis.map(k => (
          <div key={k.label} style={{ ...baris }}>
            <div style={{ fontWeight: 800 }}>{k.label}</div>
            {k.barang.length === 0 && <div style={{ fontSize: '13px', color: C.text3 }}>Belum ada di Daftar Stok</div>}
            {k.barang.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '14px', padding: '3px 0', color: kurang(b) ? C.red : C.text2, fontWeight: kurang(b) ? 800 : 500 }}>
                <span>{kurang(b) ? '🔴 ' : ''}{b.nama}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{Number(b.stok_saat_ini)} {b.satuan_dasar}{Number(b.stok_minimum) > 0 ? ` / min ${Number(b.stok_minimum)}` : ' · min belum diisi'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {(konten.info || []).map(s => (
        <div key={s.judul} style={S.card}>
          <div style={judul}>{s.judul}</div>
          {s.baris.map((x, i) => <div key={i} style={baris}>• {x}</div>)}
        </div>
      ))}

      {konten.bersih_mingguan && (
        <div style={S.card}>
          <div style={judul}>🧽 Jadwal bersih mingguan</div>
          {HARI_KEY.slice(1).concat('minggu').map(h => (
            <div key={h} style={{ ...baris, display: 'flex', gap: '10px', background: h === waktu.hari ? C.greenLightBg : 'transparent', fontWeight: h === waktu.hari ? 800 : 500 }}>
              <span style={{ width: '64px', flexShrink: 0 }}>{HARI_NAMA[h]}</span><span>{konten.bersih_mingguan[h]}</span>
            </div>
          ))}
          {konten.bersih_bulanan && <div style={{ ...baris, fontWeight: 700 }}>📅 Bulanan: {konten.bersih_bulanan}</div>}
        </div>
      )}
    </div>
  )
}
