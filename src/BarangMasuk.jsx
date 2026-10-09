// Barang Masuk: staff mengecek barang belanjaan yang datang. Stok sudah bertambah saat nota diinput
// (biasanya oleh owner); di sini staff memastikan jumlahnya pas dan kondisinya baik.
// Kalau kurang / rusak / busuk: stok dikoreksi otomatis, yang rusak/busuk tercatat sebagai waste.
import { useState } from 'react'
import { supabase, generateId, formatTanggal, formatTanggalID } from './supabase'
import { C, S } from './shared'

const KONDISI = [['kurang', 'Kurang (datang lebih sedikit)'], ['rusak', 'Rusak'], ['busuk', 'Busuk / tidak layak']]
const ALASAN_WASTE = { rusak: 'Rusak saat diterima', busuk: 'Busuk / expired' }

export const notaPerluDicek = (b) => b.diterima_status === 'belum' && b.status_baca !== 'menunggu' && (b.items || []).length > 0

export function BarangMasukView({ belanja = [], bahanBaku = [], showToast, loadData, logAudit, userName, setUserName }) {
  const [tab, setTab] = useState('belum')
  const [buka, setBuka] = useState(null)            // id nota yang sedang dicek / dilihat
  const [cek, setCek] = useState({})                // idx item -> { masalah, diterima, kondisi, catatan }
  const [who, setWho] = useState(userName || '')
  const [saving, setSaving] = useState(false)

  const belum = belanja.filter(notaPerluDicek)
  const menunggu = belanja.filter(b => b.diterima_status === 'belum' && !notaPerluDicek(b))
  const sudah = belanja.filter(b => b.diterima_status !== 'belum')

  const mulaiCek = (b) => { setBuka(buka === b.id ? null : b.id); setCek({}) }
  const ubah = (idx, patch) => setCek(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), ...patch } }))

  const simpan = async (b, semuaSesuai) => {
    if (!who.trim()) { showToast('❌ Isi nama yang mengecek'); return }
    const items = b.items || []
    const hasil = items.map((it, idx) => {
      const c = semuaSesuai ? null : cek[idx]
      const masalah = !!c?.masalah
      const diterima = masalah ? Number(c.diterima) : Number(it.jumlah)
      return { bahan_id: it.bahan_id || null, nama: it.nama, satuan: it.satuan, jumlah_nota: Number(it.jumlah), jumlah_diterima: diterima, kondisi: masalah ? (c.kondisi || 'kurang') : 'baik', catatan: masalah ? (c.catatan || '') : '' }
    })
    const salah = hasil.find(h => h.kondisi !== 'baik' && (!(h.jumlah_diterima >= 0) || h.jumlah_diterima > h.jumlah_nota))
    if (salah) { showToast(`❌ Jumlah diterima ${salah.nama} harus 0 sampai ${salah.jumlah_nota}`); return }
    setSaving(true); setUserName?.(who)
    try {
      const today = formatTanggal()
      for (const h of hasil) {
        const selisih = h.jumlah_nota - h.jumlah_diterima
        if (h.kondisi === 'baik' || selisih <= 0) continue
        const bahan = bahanBaku.find(x => x.id === h.bahan_id)
        if (bahan) {
          await supabase.from('bahan_baku').update({ stok_saat_ini: Math.max(0, (bahan.stok_saat_ini || 0) - selisih) }).eq('id', bahan.id)
          if (h.kondisi === 'rusak' || h.kondisi === 'busuk') {
            await supabase.from('waste').insert({
              id: generateId(), tanggal: today, bahan_id: bahan.id, jumlah: selisih, alasan: ALASAN_WASTE[h.kondisi],
              catatan: `Barang masuk ${formatTanggalID(b.tanggal)}: ${h.kondisi}${h.catatan ? ' · ' + h.catatan : ''}`, foto: '', yang_catat: who,
            })
          }
        }
        await logAudit?.('belanja', b.id, 'terima barang: ' + h.kondisi, bahan?.id || null, h.nama, { jumlah_nota: h.jumlah_nota, jumlah_diterima: h.jumlah_diterima, stok_dikurangi: bahan ? selisih : 0, catatan: h.catatan })
      }
      const { error } = await supabase.from('belanja').update({ diterima_status: 'selesai', diterima_oleh: who, diterima_at: new Date().toISOString(), diterima_items: hasil }).eq('id', b.id)
      if (error) throw error
      const adaMasalah = hasil.some(h => h.kondisi !== 'baik')
      showToast(adaMasalah ? '✅ Tersimpan. Stok sudah dikoreksi.' : '✅ Barang diterima, semua sesuai')
      setBuka(null); setCek({})
      await loadData?.()
    } catch (e) { showToast('❌ ' + e.message) }
    setSaving(false)
  }

  const StatusBadge = ({ b }) => {
    if (b.diterima_status === 'lewat') return <span style={S.badge('default')}>tidak dicek · nota lama</span>
    if (b.diterima_status !== 'selesai') return <span style={S.badge('yellow')}>belum dicek</span>
    const masalah = (b.diterima_items || []).filter(h => h.kondisi !== 'baik')
    return masalah.length
      ? <span style={S.badge('red')}>⚠ {masalah.length} barang bermasalah</span>
      : <span style={S.badge('green')}>✓ sesuai</span>
  }

  const KartuNota = ({ b, bisaCek }) => {
    const terbuka = buka === b.id
    const items = b.items || []
    return (
      <div style={{ background: C.panel, border: `1px solid ${terbuka ? C.sun : C.border}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '8px' }}>
        <div onClick={() => mulaiCek(b)} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, flex: 1 }}>{formatTanggalID(b.tanggal)} · {b.yang_belanja || '-'}</div>
            <span style={{ fontSize: '12px', color: C.text3 }}>{terbuka ? '▲' : '▼'}</span>
          </div>
          <div style={{ fontSize: '11.5px', color: C.text3, marginTop: '3px' }}>{items.map(i => `${i.nama} ${i.jumlah} ${i.satuan || ''}`).join(', ') || 'Belum ada rincian barang'}</div>
          <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge b={b} />
            {b.diterima_oleh && <span style={{ fontSize: '10.5px', color: C.text3 }}>oleh {b.diterima_oleh}</span>}
          </div>
        </div>

        {terbuka && bisaCek && (
          <div style={{ marginTop: '10px', borderTop: `1px solid ${C.panel2}`, paddingTop: '10px' }}>
            <div style={{ fontSize: '11.5px', color: C.text2, marginBottom: '8px' }}>Cocokkan dengan barang yang datang. Tap "Ada masalah" hanya kalau jumlahnya kurang, rusak, atau busuk.</div>
            {items.map((it, idx) => {
              const c = cek[idx] || {}
              return (
                <div key={idx} style={{ background: c.masalah ? C.redBg : C.panel2, border: `1px solid ${c.masalah ? C.redBorder : C.border}`, borderRadius: '10px', padding: '9px 11px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{it.nama}</div>
                      <div style={{ fontSize: '11px', color: C.text3 }}>di nota: {it.jumlah} {it.satuan || ''}</div>
                    </div>
                    <button onClick={() => ubah(idx, { masalah: !c.masalah, diterima: c.diterima ?? it.jumlah, kondisi: c.kondisi || 'kurang' })}
                      style={{ ...S.btn, padding: '5px 10px', fontSize: '11px', background: c.masalah ? C.panel : C.redBg, color: C.red, border: `1px solid ${C.redBorder}` }}>
                      {c.masalah ? 'Batal, sesuai' : 'Ada masalah'}
                    </button>
                  </div>
                  {c.masalah && (
                    <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Diterima ({it.satuan || 'pcs'})</div>
                        <input type="number" inputMode="decimal" value={c.diterima} onChange={e => ubah(idx, { diterima: e.target.value })} style={S.input} />
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Kondisi</div>
                        <select value={c.kondisi || 'kurang'} onChange={e => ubah(idx, { kondisi: e.target.value })} style={S.input}>
                          {KONDISI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      </div>
                      <input type="text" value={c.catatan || ''} onChange={e => ubah(idx, { catatan: e.target.value })} placeholder="Catatan (boleh kosong)" style={{ ...S.input, gridColumn: '1 / -1' }} />
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>Yang mengecek</div>
              <input type="text" value={who} onChange={e => setWho(e.target.value)} placeholder="Nama..." style={S.input} />
            </div>
            {Object.values(cek).some(c => c?.masalah) ? (
              <button onClick={() => simpan(b, false)} disabled={saving} style={{ ...S.btn, ...S.btnPrimary, width: '100%', marginTop: '10px', opacity: saving ? 0.6 : 1 }}>{saving ? 'Menyimpan...' : '✅ Simpan pengecekan'}</button>
            ) : (
              <button onClick={() => simpan(b, true)} disabled={saving} style={{ ...S.btn, ...S.btnPrimary, width: '100%', marginTop: '10px', opacity: saving ? 0.6 : 1 }}>{saving ? 'Menyimpan...' : '✅ Semua sesuai, terima'}</button>
            )}
          </div>
        )}

        {terbuka && !bisaCek && b.diterima_items && (
          <div style={{ marginTop: '10px', borderTop: `1px solid ${C.panel2}`, paddingTop: '8px' }}>
            {b.diterima_items.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', color: h.kondisi === 'baik' ? C.text : C.red }}>
                <span>{h.nama}</span>
                <span>{h.kondisi === 'baik' ? `✓ ${h.jumlah_nota} ${h.satuan || ''}` : `⚠ ${h.jumlah_diterima}/${h.jumlah_nota} ${h.satuan || ''} · ${h.kondisi}${h.catatan ? ' · ' + h.catatan : ''}`}</span>
              </div>
            ))}
            {b.diterima_at && <div style={{ fontSize: '10.5px', color: C.text3, marginTop: '4px' }}>Dicek {formatTanggalID(b.diterima_at.slice(0, 10))} oleh {b.diterima_oleh}</div>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>📦 Barang Masuk</h2>
      <p style={{ fontSize: '12px', color: C.text3, marginBottom: '12px' }}>Barang belanjaan yang datang dicek di sini: jumlahnya pas, tidak rusak, tidak busuk.</p>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {[['belum', `Belum dicek (${belum.length})`], ['sudah', 'Sudah dicek']].map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setBuka(null) }} style={{ ...S.btn, flex: 1, padding: '8px 10px', fontSize: '12px', borderRadius: '99px', background: tab === k ? C.sun : C.panel, color: C.text, border: `1px solid ${tab === k ? C.sun : C.border}` }}>{l}</button>
        ))}
      </div>

      {tab === 'belum' && (
        <>
          {belum.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: C.text3, fontSize: '13px' }}>Semua barang masuk sudah dicek 👍</div>}
          {belum.map(b => <KartuNota key={b.id} b={b} bisaCek />)}
          {menunggu.length > 0 && (
            <div style={{ fontSize: '11.5px', color: C.text3, background: C.panel2, borderRadius: '8px', padding: '8px 10px', marginTop: '6px' }}>
              {menunggu.length} nota foto masih menunggu dibaca Claude (pagi). Setelah barangnya terisi, baru bisa dicek di sini.
            </div>
          )}
        </>
      )}
      {tab === 'sudah' && (
        <>
          {sudah.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: C.text3, fontSize: '13px' }}>Belum ada yang dicek.</div>}
          {sudah.map(b => <KartuNota key={b.id} b={b} bisaCek={false} />)}
        </>
      )}
    </div>
  )
}
