// Laporan Tutup Kasir — mengikuti kebiasaan laporan harian Diandra di WA:
//   penerimaan per metode → kas kemarin + tunai hari ini − pengeluaran kas = kas akhir
//   → daftar pengeluaran kas kasir → pengeluaran dari dana lain (BCA Tissa, ShopeePay, talangan)
import { useState, useEffect } from 'react'
import { supabase, generateId, formatTanggal, formatTanggalID, formatRupiah } from './supabase'
import { C, S, uploadFotoToStorage, SUMBER_DANA_LABEL, sumberText } from './shared'
import { FormRow, RupiahInput, FotoInput, Tabs, DatePicker, num, bulanIni } from './Kasir'

// Urutan mengikuti layar POS: Tunai, EDC, Transfer, QRIS
const METODE_KASIR = [
  ['tunai', '💵 Tunai (Cash)'],
  ['kartu', '💳 EDC BCA'],
  ['transfer', '🏦 Transfer BCA'],
  ['qris', '📱 QRIS'],
  ['online', '🛵 GoFood / Grab / Shopee'],
  ['lainnya', '➕ Lainnya'],
]
const SUMBER_LAIN = ['transfer_owner', 'shopeepay_tissa', 'talangan', 'petty_cash', 'transfer_toko', 'qris_toko']
const kosongMetode = () => ({ tunai: '', kartu: '', transfer: '', qris: '', online: '', lainnya: '' })
const tglID = (ymd) => { const [y, m, d] = ymd.split('-'); return `${d}/${m}/${y}` }
const rp = (n) => Number(n || 0).toLocaleString('id-ID')

// Kartu didefinisikan di luar komponen utama: kalau di dalam, React menganggapnya komponen baru tiap render
// dan input di dalamnya kehilangan fokus setiap satu huruf diketik.
function Kartu({ judul, children, warna }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${warna || C.border}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>{judul}</div>
      {children}
    </div>
  )
}

function BarisUang({ rows, setRows, denganSumber = false, placeholder }) {
  const ubah = (i, f, v) => setRows(rows.map((r, k) => k === i ? { ...r, [f]: v } : r))
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ marginBottom: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr auto', gap: '6px' }}>
            <input value={r.keperluan} onChange={e => ubah(i, 'keperluan', e.target.value)} placeholder={placeholder} style={{ ...S.input, padding: '9px' }} />
            <RupiahInput value={r.jumlah} onChange={v => ubah(i, 'jumlah', v)} />
            <button onClick={() => setRows(rows.filter((_, k) => k !== i))} style={{ ...S.btn, ...S.btnDanger, padding: '8px 10px' }}>✕</button>
          </div>
          {denganSumber && (
            <div style={{ display: 'grid', gridTemplateColumns: r.sumber === 'talangan' ? '1fr 1fr' : '1fr', gap: '6px', marginTop: '4px' }}>
              <select value={r.sumber} onChange={e => ubah(i, 'sumber', e.target.value)} style={{ ...S.input, padding: '8px', fontSize: '12px' }}>
                {SUMBER_LAIN.map(k => <option key={k} value={k}>{SUMBER_DANA_LABEL[k]}</option>)}
              </select>
              {r.sumber === 'talangan' && <input value={r.dibayar_oleh || ''} onChange={e => ubah(i, 'dibayar_oleh', e.target.value)} placeholder="Siapa yang bayar dulu?" style={{ ...S.input, padding: '8px', fontSize: '12px', background: C.yellowBg }} />}
            </div>
          )}
        </div>
      ))}
      <button onClick={() => setRows([...rows, { keperluan: '', jumlah: '', sumber: 'transfer_owner', dibayar_oleh: '' }])}
        style={{ ...S.btn, background: 'transparent', border: `1px dashed ${C.border}`, color: C.text2, width: '100%', fontSize: '12px', padding: '9px' }}>+ Tambah baris</button>
    </div>
  )
}

export function PenjualanView({ showToast, userName, setUserName, loadData, role }) {
  const isOwner = role === 'owner'
  const [tab, setTab] = useState('input')
  const [tanggal, setTanggal] = useState(formatTanggal())
  const [existing, setExisting] = useState(null)
  const [metode, setMetode] = useState(kosongMetode())
  const [jumlahTrx, setJumlahTrx] = useState('')
  const [kasAwal, setKasAwal] = useState('')
  const [kasAwalAsal, setKasAwalAsal] = useState('')       // keterangan dari mana angka kas kemarin
  const [kasFisik, setKasFisik] = useState('')
  const [catatan, setCatatan] = useState('')
  const [foto, setFoto] = useState(''); const [fotoFile, setFotoFile] = useState(null)
  const [fotoEdc, setFotoEdc] = useState(''); const [fotoEdcFile, setFotoEdcFile] = useState(null)
  const [yangInput, setYangInput] = useState(userName)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])
  const [justSaved, setJustSaved] = useState(null)
  const [tercatat, setTercatat] = useState([])              // pengeluaran hari ini yang sudah ada di aplikasi
  const [barisKas, setBarisKas] = useState([])              // pengeluaran kas kasir baru (diketik di laporan)
  const [barisLain, setBarisLain] = useState([])            // pengeluaran dari dana lain

  const resetForm = () => {
    setMetode(kosongMetode()); setJumlahTrx(''); setKasFisik(''); setCatatan('')
    setFoto(''); setFotoFile(null); setFotoEdc(''); setFotoEdcFile(null); setBarisKas([]); setBarisLain([])
  }

  const loadDate = async (tgl) => {
    const [pj, prev, pk, bl] = await Promise.all([
      supabase.from('penjualan_harian').select('*').eq('tanggal', tgl).maybeSingle(),
      supabase.from('penjualan_harian').select('tanggal, kas_akhir').lt('tanggal', tgl).not('kas_akhir', 'is', null).order('tanggal', { ascending: false }).limit(1),
      supabase.from('pengeluaran_kasir').select('id, keperluan, jumlah, sumber_dana, dibayar_oleh, yang_input, dipindah_ke_belanja, cara_persetujuan').eq('tanggal', tgl).order('created_at'),
      supabase.from('belanja').select('id, total_harga, sumber_dana, yang_belanja, items, status_baca').eq('tanggal', tgl).order('created_at'),
    ])
    const data = pj.data || null
    setExisting(data); setJustSaved(null)
    const rows = [
      ...(pk.data || []).filter(p => !p.dipindah_ke_belanja).map(p => ({ id: 'p' + p.id, keperluan: p.keperluan, jumlah: num(p.jumlah), sumber: p.sumber_dana, dibayar_oleh: p.dibayar_oleh, oleh: p.yang_input })),
      ...(bl.data || []).map(b => ({ id: 'b' + b.id, keperluan: 'Belanja bahan' + (b.status_baca === 'menunggu' ? ' (nota menunggu dibaca)' : ': ' + (b.items || []).map(i => i.nama).join(', ').slice(0, 50)), jumlah: num(b.total_harga), sumber: b.sumber_dana, dibayar_oleh: null, oleh: b.yang_belanja })),
    ]
    setTercatat(rows)
    const prevRow = prev.data?.[0]
    if (data && !isOwner) { resetForm(); setKasAwal(''); return }   // staff tidak boleh melihat angka yang sudah ada
    if (data) {
      setMetode({ tunai: data.tunai ? String(data.tunai) : '', kartu: data.kartu ? String(data.kartu) : '', transfer: data.transfer ? String(data.transfer) : '', qris: data.qris ? String(data.qris) : '', online: data.online ? String(data.online) : '', lainnya: data.lainnya ? String(data.lainnya) : '' })
      setJumlahTrx(data.jumlah_transaksi ? String(data.jumlah_transaksi) : '')
      setKasAwal(data.kas_awal != null ? String(data.kas_awal) : (prevRow ? String(prevRow.kas_akhir) : ''))
      setKasAwalAsal(data.kas_awal != null ? 'dari laporan ini' : prevRow ? `kas akhir ${formatTanggalID(prevRow.tanggal)}` : '')
      setKasFisik(data.kas_fisik != null ? String(data.kas_fisik) : '')
      setCatatan(data.catatan || ''); setFoto(data.foto || ''); setFotoFile(null); setFotoEdc(data.foto_edc || ''); setFotoEdcFile(null)
      setBarisKas([]); setBarisLain([])
    } else {
      resetForm()
      setKasAwal(prevRow ? String(prevRow.kas_akhir) : '')
      setKasAwalAsal(prevRow ? `kas akhir ${formatTanggalID(prevRow.tanggal)}` : 'belum ada laporan sebelumnya, isi manual')
    }
  }
  const loadHistory = async () => {
    const { data } = await supabase.from('penjualan_harian').select('*').order('tanggal', { ascending: false }).limit(31)
    setHistory(data || [])
  }
  useEffect(() => { loadDate(tanggal) }, [tanggal])
  useEffect(() => { if (isOwner) loadHistory() }, [])

  // Hitungan ala laporan Diandra
  const totalOmzet = Object.values(metode).reduce((s, v) => s + num(v), 0)
  const kasTercatat = tercatat.filter(r => r.sumber === 'kas_kasir').reduce((s, r) => s + r.jumlah, 0)
  const kasBaru = barisKas.reduce((s, r) => s + num(r.jumlah), 0)
  const pengeluaranKas = kasTercatat + kasBaru
  const kasAkhir = num(kasAwal) + num(metode.tunai) - pengeluaranKas
  const selisihFisik = kasFisik === '' ? null : num(kasFisik) - kasAkhir
  const lainTercatat = tercatat.filter(r => r.sumber !== 'kas_kasir')
  const totalLain = lainTercatat.reduce((s, r) => s + r.jumlah, 0) + barisLain.reduce((s, r) => s + num(r.jumlah), 0)

  const teksLaporan = () => {
    const L = [`Report ${tglID(tanggal)}`]
    METODE_KASIR.forEach(([k, l]) => { if (num(metode[k])) L.push(`${l.replace(/^\S+\s/, '')}: ${rp(metode[k])}`) })
    L.push(`Total penerimaan: ${rp(totalOmzet)}`)
    L.push('')
    L.push(`Kas: ${rp(kasAwal)} + ${rp(metode.tunai)} (kas kmrn + kas hr ini) = ${rp(num(kasAwal) + num(metode.tunai))} - ${rp(pengeluaranKas)} (pengeluaran) = ${rp(kasAkhir)}`)
    if (selisihFisik != null) L.push(`Kas fisik: ${rp(kasFisik)} (${selisihFisik === 0 ? 'cocok' : (selisihFisik > 0 ? 'lebih ' : 'kurang ') + rp(Math.abs(selisihFisik))})`)
    const kasRows = [...tercatat.filter(r => r.sumber === 'kas_kasir'), ...barisKas.filter(r => r.keperluan.trim() && num(r.jumlah))]
    if (kasRows.length) { L.push(''); L.push(`Pengeluaran kas kasir ${tglID(tanggal)}:`); kasRows.forEach(r => L.push(`• ${r.keperluan}, ${rp(r.jumlah)}`)); L.push(`Total: ${rp(pengeluaranKas)}`) }
    const lainRows = [...lainTercatat, ...barisLain.filter(r => r.keperluan.trim() && num(r.jumlah))]
    if (lainRows.length) { L.push(''); L.push('Pengeluaran dana lain:'); lainRows.forEach(r => L.push(`• ${r.keperluan}, ${rp(r.jumlah)} (${SUMBER_DANA_LABEL[r.sumber] || r.sumber}${r.sumber === 'talangan' && r.dibayar_oleh ? ' ' + r.dibayar_oleh : ''})`)); L.push(`Total: ${rp(totalLain)}`) }
    if (catatan.trim()) { L.push(''); L.push(`Catatan: ${catatan.trim()}`) }
    return L.join('\n')
  }

  const salin = async (teks) => {
    try { await navigator.clipboard.writeText(teks); showToast('✅ Teks laporan disalin, tinggal tempel di WA') }
    catch { showToast('❌ Tidak bisa menyalin otomatis, tahan teksnya lalu salin manual') }
  }

  const handleSave = async () => {
    if (!yangInput.trim()) { showToast('❌ Isi nama yang input'); return }
    if (!totalOmzet) { showToast('❌ Isi penerimaan hari ini (minimal tunai atau EDC)'); return }
    if (kasAwal === '') { showToast('❌ Isi kas kemarin (sisa kas laci)'); return }
    const barisKasValid = barisKas.filter(r => r.keperluan.trim() && num(r.jumlah) > 0)
    const barisLainValid = barisLain.filter(r => r.keperluan.trim() && num(r.jumlah) > 0)
    if (barisLainValid.some(r => r.sumber === 'talangan' && !(r.dibayar_oleh || '').trim())) { showToast('❌ Isi siapa yang menalangi'); return }
    setSaving(true); setUserName(yangInput)
    try {
      // 1. pengeluaran yang diketik di laporan → catatan kas keluar (kategori diisi Claude pada tugas pagi)
      const baru = [...barisKasValid.map(r => ({ ...r, sumber: 'kas_kasir' })), ...barisLainValid]
      for (const r of baru) {
        const { error } = await supabase.from('pengeluaran_kasir').insert({
          id: generateId(), tanggal, jumlah: num(r.jumlah), keperluan: r.keperluan.trim(), kategori: null, sumber_dana: r.sumber,
          dibayar_oleh: r.sumber === 'talangan' ? (r.dibayar_oleh || '').trim() : null, status_ganti: r.sumber === 'talangan' ? 'belum' : null,
          ada_nota: false, disetujui_oleh: isOwner ? yangInput : null, cara_persetujuan: 'Laporan kasir', yang_input: yangInput, status_baca: 'menunggu',
        })
        if (error) throw error
      }
      // 2. foto
      let fotoUrl = isOwner ? (existing?.foto || '') : ''
      if (fotoFile) fotoUrl = await uploadFotoToStorage(fotoFile, 'penjualan', { tanggal })
      let fotoEdcUrl = isOwner ? (existing?.foto_edc || '') : ''
      if (fotoEdcFile) fotoEdcUrl = await uploadFotoToStorage(fotoEdcFile, 'penjualan', { tanggal })
      // 3. laporan harian
      const row = {
        id: existing?.id || generateId(), tanggal, total_omzet: totalOmzet, jumlah_transaksi: jumlahTrx ? Number(jumlahTrx) : null,
        tunai: num(metode.tunai), qris: num(metode.qris), transfer: num(metode.transfer), kartu: num(metode.kartu), online: num(metode.online), lainnya: num(metode.lainnya),
        kas_awal: num(kasAwal), kas_akhir: kasAkhir, pengeluaran_kas: pengeluaranKas, kas_fisik: kasFisik === '' ? null : num(kasFisik),
        foto: fotoUrl || null, foto_edc: fotoEdcUrl || null, catatan: catatan.trim() || null, yang_input: yangInput, updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('penjualan_harian').upsert(row, { onConflict: 'tanggal' })
      if (error) throw error
      const teks = teksLaporan()
      showToast(`✅ Laporan ${formatTanggalID(tanggal)} tersimpan`)
      setJustSaved({ tanggal, total: totalOmzet, kasAkhir, teks })
      loadData && loadData()
      if (isOwner) loadHistory()
    } catch (e) { showToast('❌ ' + e.message) }
    setSaving(false)
  }

  const totalBulan = history.filter(h => bulanIni(h.tanggal) === bulanIni(formatTanggal())).reduce((s, h) => s + num(h.total_omzet), 0)

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '2px' }}>💰 Laporan Tutup Kasir</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '12px' }}>Urutannya sama seperti laporan di WA: penerimaan, kas laci, pengeluaran. Sekali sehari setelah tutup.</p>

      {isOwner && <Tabs value={tab} onChange={setTab} items={[['input', '📝 Input'], ['history', `📅 Riwayat (${history.length})`]]} />}

      {tab === 'input' && justSaved && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px' }}>✅</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: C.green, marginTop: '4px' }}>Laporan {formatTanggalID(justSaved.tanggal)} tersimpan</div>
            <div style={{ fontSize: '13px', color: C.green }}>Penerimaan {formatRupiah(justSaved.total)} · kas akhir {formatRupiah(justSaved.kasAkhir)}</div>
          </div>
          <pre style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: '8px' }}>{justSaved.teks}</pre>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => salin(justSaved.teks)} style={{ ...S.btn, ...S.btnPrimary, flex: 1, padding: '11px' }}>📋 Salin teks laporan (untuk WA)</button>
            {isOwner && <button onClick={() => { setJustSaved(null); loadDate(tanggal) }} style={{ ...S.btn, background: C.panel2, color: C.text, padding: '11px 14px' }}>Ubah</button>}
          </div>
        </div>
      )}

      {tab === 'input' && existing && !isOwner && !justSaved && (
        <div>
          <DatePicker value={tanggal} onChange={setTanggal} />
          <div style={{ background: C.yellowBg, border: `1px solid ${C.yellowBorder}`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px' }}>🔒</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: C.yellow, marginTop: '4px' }}>Tanggal ini sudah dilaporkan oleh {existing.yang_input}</div>
            <div style={{ fontSize: '12px', color: C.yellow, marginTop: '4px' }}>Hanya owner yang bisa melihat atau mengubah laporan yang sudah masuk.</div>
          </div>
        </div>
      )}

      {tab === 'input' && !(existing && !isOwner) && !justSaved && (
        <div>
          <DatePicker value={tanggal} onChange={setTanggal} />
          {existing && isOwner && (
            <div style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.blue, borderRadius: '8px', padding: '8px 12px', fontSize: '12px', marginBottom: '10px' }}>
              ℹ️ Tanggal ini sudah diisi oleh <strong>{existing.yang_input}</strong>. Simpan akan memperbarui angkanya.
            </div>
          )}

          <Kartu judul="1 · Penerimaan hari ini (dari layar POS)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {METODE_KASIR.map(([k, l]) => (
                <div key={k}>
                  <label style={S.label}>{l}</label>
                  <RupiahInput value={metode[k]} onChange={v => setMetode(m => ({ ...m, [k]: v }))} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: `1px solid ${C.panel2}` }}>
              <span style={{ fontSize: '12px', color: C.text3 }}>Total penerimaan</span>
              <strong style={{ fontSize: '18px', color: C.green }}>{formatRupiah(totalOmzet)}</strong>
            </div>
            <div style={{ marginTop: '8px' }}>
              <label style={S.label}>Jumlah transaksi / struk (opsional)</label>
              <input type="number" inputMode="numeric" value={jumlahTrx} onChange={e => setJumlahTrx(e.target.value)} placeholder="misal: 3" style={S.input} />
            </div>
          </Kartu>

          <Kartu judul="2 · Pengeluaran kas kasir hari ini" >
            {tercatat.filter(r => r.sumber === 'kas_kasir').length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: C.text3, marginBottom: '4px' }}>Sudah tercatat di aplikasi hari ini:</div>
                {tercatat.filter(r => r.sumber === 'kas_kasir').map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '4px 0', borderBottom: `1px dashed ${C.panel2}` }}>
                    <span>• {r.keperluan} <span style={{ color: C.text3 }}>({r.oleh})</span></span><span>{formatRupiah(r.jumlah)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: '11px', color: C.text3, marginBottom: '4px' }}>Tambahkan yang belum tercatat (nama barang, nominal). Kategori dan isi nota diurus Claude:</div>
            <BarisUang rows={barisKas} setRows={setBarisKas} placeholder="misal: sawi ijo, nescafe sachet" />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px' }}>
              <span style={{ color: C.text3 }}>Total pengeluaran kas kasir</span><strong style={{ color: C.red }}>{formatRupiah(pengeluaranKas)}</strong>
            </div>
          </Kartu>

          <Kartu judul="3 · Kas laci" warna={C.sun}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={S.label}>Kas kemarin (sisa laci)</label>
                <RupiahInput value={kasAwal} onChange={setKasAwal} />
                {kasAwalAsal && <div style={{ fontSize: '10px', color: C.text3, marginTop: '2px' }}>{kasAwalAsal}</div>}
              </div>
              <div>
                <label style={S.label}>Kas fisik dihitung (opsional)</label>
                <RupiahInput value={kasFisik} onChange={setKasFisik} />
              </div>
            </div>
            <div style={{ background: C.panel2, borderRadius: '8px', padding: '10px 12px', marginTop: '10px', fontSize: '12.5px', lineHeight: 1.7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Kas kemarin</span><span>{formatRupiah(kasAwal)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>+ Tunai hari ini</span><span>{formatRupiah(metode.tunai)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: C.red }}><span>− Pengeluaran kas kasir</span><span>{formatRupiah(pengeluaranKas)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, marginTop: '4px', paddingTop: '4px', fontWeight: 800, fontSize: '15px' }}><span>= Kas akhir hari ini</span><span>{formatRupiah(kasAkhir)}</span></div>
              {selisihFisik != null && (
                <div style={{ fontSize: '11.5px', color: selisihFisik === 0 ? C.green : C.red, marginTop: '4px' }}>
                  {selisihFisik === 0 ? '✓ Kas fisik cocok dengan hitungan' : `⚠ Kas fisik ${selisihFisik > 0 ? 'lebih' : 'kurang'} ${formatRupiah(Math.abs(selisihFisik))} dari hitungan`}
                </div>
              )}
            </div>
          </Kartu>

          <Kartu judul="4 · Pengeluaran dari dana lain (bukan laci kasir)">
            <div style={{ fontSize: '11px', color: C.text3, marginBottom: '6px' }}>BCA Tissa, ShopeePay Tissa, talangan Diandra/staff, transfer atau QRIS toko. Tidak mengurangi kas laci.</div>
            <div style={{ fontSize: '11px', color: C.sunDark, background: C.yellowBg, borderRadius: '8px', padding: '7px 10px', marginBottom: '8px', lineHeight: 1.45 }}>
              💡 Satu belanja dibayar dari dua sumber? Buat dua baris dengan nama yang sama, misal "Lotte (talangan Diandra)" Rp 700.000 dan "Lotte (sisa, BCA Tissa)" Rp 150.000. Claude akan menggabungkannya jadi satu pembelian saat input ke Accurate.
            </div>
            {lainTercatat.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: C.text3, marginBottom: '4px' }}>Sudah tercatat hari ini:</div>
                {lainTercatat.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '4px 0', borderBottom: `1px dashed ${C.panel2}` }}>
                    <span>• {r.keperluan} <span style={{ color: C.text3 }}>({sumberText(r)})</span></span><span>{formatRupiah(r.jumlah)}</span>
                  </div>
                ))}
              </div>
            )}
            <BarisUang rows={barisLain} setRows={setBarisLain} denganSumber placeholder="misal: beli kopi Alfa, gaji harian" />
            {totalLain > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px' }}><span style={{ color: C.text3 }}>Total dana lain</span><strong>{formatRupiah(totalLain)}</strong></div>}
          </Kartu>

          <Kartu judul="5 · Foto">
            <FotoInput label="📷 Layar POS / laporan tutup kasir" foto={foto} showToast={showToast}
              onFile={(file, b64) => { setFotoFile(file); setFoto(b64) }} onClear={() => { setFotoFile(null); setFoto('') }} />
            <FotoInput label="📷 Settlement EDC BCA" foto={fotoEdc} showToast={showToast}
              onFile={(file, b64) => { setFotoEdcFile(file); setFotoEdc(b64) }} onClear={() => { setFotoEdcFile(null); setFotoEdc('') }} />
          </Kartu>

          <FormRow label="Catatan (opsional)">
            <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} placeholder="Hujan, ramai event, void 1 struk, dll" style={{ ...S.input, resize: 'vertical' }} />
          </FormRow>
          <FormRow label="Yang input *">
            <input value={yangInput} onChange={e => setYangInput(e.target.value)} placeholder="Nama kamu" style={S.input} />
          </FormRow>

          <button onClick={handleSave} disabled={saving} style={{ ...S.btn, ...S.btnSuccess, width: '100%', padding: '13px', fontSize: '14px', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Menyimpan...' : existing ? '💾 Update Laporan' : '✅ Simpan Laporan'}
          </button>
        </div>
      )}

      {tab === 'history' && (
        <div>
          <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: C.green }}>Total penerimaan bulan ini</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: C.green }}>{formatRupiah(totalBulan)}</div>
          </div>
          {history.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: C.text3, fontSize: '13px' }}>Belum ada laporan.</div>}
          {history.map(h => (
            <div key={h.id} onClick={() => { setTanggal(h.tanggal); setTab('input') }}
              style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '11px 14px', marginBottom: '8px', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center' }}>
              {h.foto ? <img src={h.foto} alt="" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px' }} />
                : <div style={{ width: '44px', height: '44px', borderRadius: '6px', background: C.panel2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>💰</div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{formatTanggalID(h.tanggal)}</div>
                <div style={{ fontSize: '11px', color: C.text3 }}>
                  tunai {formatRupiah(h.tunai)} · EDC {formatRupiah(h.kartu)}{h.kas_akhir != null ? ` · kas akhir ${formatRupiah(h.kas_akhir)}` : ''} · {h.yang_input}
                </div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: C.green }}>{formatRupiah(h.total_omzet)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
