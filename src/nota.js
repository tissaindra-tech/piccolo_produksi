// Pembaca nota tanpa biaya: teks hasil OCR (Google Drive) -> daftar barang,
// lalu dicocokkan ke master bahan. Tidak memakai AI berbayar.

const SKIP = /\b(sub ?total|total|ppn|pajak|tax|tunai|cash|kembali|change|diskon|discount|voucher|member|kasir|cashier|terima ?kasih|thank|npwp|telp|tel\.|phone|struk|invoice|faktur|tgl|tanggal|date|jam|time|qty|harga|price|jumlah|amount|dibayar|bayar|debit|kredit|credit|qris|ovo|gopay|edc|bca|mandiri|bri|bni|rp\.?\s*$|jl\.|jalan|item\(s\)|items?\b\s*:)/i
const SATUAN = /(kg|gr|gram|g|ml|l|ltr|liter|pcs|pc|pak|pack|btl|botol|ikat|bks|bungkus|dus|sachet|sct|renceng|box|kaleng|kg\.|lusin|buah|bh|ekor|sisir|papan|slop|roll)/i
const ALIAS = { bwg: 'bawang', bwng: 'bawang', pth: 'putih', mrh: 'merah', ptih: 'putih', tlr: 'telur', tlur: 'telur', ayam: 'ayam', ayn: 'ayam', dd: 'dada', fil: 'fillet', flt: 'fillet', ssu: 'susu', uht: 'uht', fm: 'fresh milk', tpg: 'tepung', trg: 'terigu', gl: 'gula', gula: 'gula', mnyk: 'minyak', myk: 'minyak', grg: 'goreng', kcp: 'kecap', sgr: 'segar', cab: 'cabai', cbe: 'cabai', cabe: 'cabai', tmt: 'tomat', wrt: 'wortel', ktg: 'kentang', kntg: 'kentang', bwb: 'bawang bombay', bby: 'bombay', kju: 'keju', mnts: 'mentega', mtg: 'mentega', sausa: 'saus', cklt: 'cokelat', coklat: 'cokelat', chz: 'cheese', mozz: 'mozzarella', mzr: 'mozzarella', drg: 'daging', sp: 'sapi', ykt: 'yakult', jrk: 'jeruk', nps: 'nipis', lmn: 'lemon', pkt: 'paket', roti: 'roti', ttr: 'tawar', garam: 'garam', grm: 'garam', lada: 'lada', mrc: 'merica', kntl: 'kental', mns: 'manis', skm: 'susu kental manis', air: 'air', mnrl: 'mineral' }

export const angka = (s) => {
  if (s == null) return 0
  const t = String(s).trim().replace(/\s/g, '')
  // 48.500 / 48,500 / 48500 / 48.500,00
  const m = t.match(/^(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{1,2}))?$/)
  if (!m) return Number(t.replace(/[^\d]/g, '')) || 0
  return Number(m[1].replace(/[.,]/g, ''))
}

export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

const tokens = (s) => norm(s).split(' ').filter(w => w.length >= 2 && !/^\d+$/.test(w)).map(w => ALIAS[w] || w).join(' ').split(' ').filter(Boolean)

// Cocokkan nama di nota ke master bahan. Hasil: { bahan, skor } atau null
export function cocokkanBahan(namaNota, bahanBaku) {
  const t = tokens(namaNota)
  if (!t.length) return null
  let best = null
  for (const b of bahanBaku) {
    if (b.is_active === false) continue
    const tb = tokens(b.nama)
    if (!tb.length) continue
    const nb = tb.join(' '); const nn = t.join(' ')
    let skor = 0
    if (nb === nn) skor = 1
    else {
      const hit = tb.filter(w => t.some(x => x === w || (w.length >= 4 && x.length >= 4 && (x.startsWith(w) || w.startsWith(x))))).length
      skor = hit / tb.length
      if (nn.includes(nb) || nb.includes(nn)) skor = Math.max(skor, 0.75)
      // nama di nota lebih panjang (merek, ukuran): bonus kalau semua kata master ada
      if (hit === tb.length) skor = Math.max(skor, 0.9)
    }
    if (skor > (best?.skor || 0)) best = { bahan: b, skor }
  }
  return best && best.skor >= 0.6 ? best : null
}

// Teks OCR -> { items, total_nota, toko }
export function parseNotaText(text, bahanBaku = []) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const items = []
  let total_nota = null
  let toko = null
  let pendingName = null

  const priceAtEnd = /(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{3,})\s*$/i
  const qtyX = /(\d+(?:[.,]\d+)?)\s*(?:[xX×*]|@)\s*(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{3,})/
  const qtySat = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${SATUAN.source}\\b`, 'i')

  for (const raw of lines) {
    const line = raw.replace(/^\d{6,}\s*/, '')   // buang kode barang di depan
    if (!toko && /[a-z]{3,}/i.test(line) && !priceAtEnd.test(line)) toko = line.slice(0, 40)
    const low = line.toLowerCase()
    if (/total/.test(low) && !/sub/.test(low)) {
      const m = line.match(priceAtEnd); if (m) total_nota = Math.max(total_nota || 0, angka(m[1]))
      continue
    }
    if (SKIP.test(line) && !qtyX.test(line)) continue

    const hasLetters = /[a-z]{3,}/i.test(line.replace(qtyX, '').replace(/\b(x|pcs|kg|gr|ml)\b/gi, ''))
    const pm = line.match(priceAtEnd)
    if (!pm) {
      // baris nama saja (Lotte/Indogrosir: nama di satu baris, angka di baris berikutnya)
      if (hasLetters && line.length >= 3) pendingName = line
      continue
    }
    const harga = angka(pm[1])
    if (harga < 100) { if (hasLetters) pendingName = line; continue }

    let body = line.slice(0, pm.index).trim()
    let jumlah = 1, satuan = 'pcs'
    const qx = body.match(qtyX) || line.match(qtyX)
    const qs = body.match(qtySat)
    if (qx) { jumlah = Number(qx[1].replace(',', '.')) || 1; body = body.replace(qx[0], ' ') }
    else if (qs) { jumlah = Number(qs[1].replace(',', '.')) || jumlah; satuan = qs[2].toLowerCase(); body = body.replace(qs[0], ' ') }
    body = body.replace(/\b\d{1,3}(?:[.,]\d{3})+\b/g, ' ').replace(/[^\w\s%&/().-]/g, ' ').replace(/\s+/g, ' ').trim()
    let nama = /[a-z]{3,}/i.test(body) ? body : (pendingName || '')
    pendingName = null
    if (!nama || nama.length < 3) continue
    // ukuran dalam nama: "1KG", "500GR", "1L"
    const uk = nama.match(/(\d+(?:[.,]\d+)?)\s*(kg|gr|gram|g|ml|l|ltr|liter)\b/i)
    if (uk && !qx && !qs) { jumlah = Number(uk[1].replace(',', '.')); satuan = uk[2].toLowerCase() }
    satuan = ({ gr: 'gram', g: 'gram', l: 'liter', ltr: 'liter', pc: 'pcs', btl: 'botol', bks: 'bungkus', pak: 'pack', sct: 'sachet', bh: 'buah' })[satuan] || satuan
    const m = cocokkanBahan(nama, bahanBaku)
    items.push({ nama_nota: nama, bahan_id: m ? String(m.bahan.id) : null, jumlah, satuan, harga_total: harga, yakin: false })
  }
  return { ok: true, terbaca: items.length > 0, toko, tanggal: null, total_nota, items, sumber: 'ocr' }
}

// Kirim foto ke Google Drive lewat Apps Script milik owner (gratis). Mengembalikan { ok, fileUrl, text }.
export async function kirimKeDrive({ url, dataUrl, nama, folder, tanggal, ocr = false, timeoutMs = 60000 }) {
  if (!url) return { ok: false, error: 'URL Google Drive belum diatur' }
  const image = dataUrl.split(',')[1]
  const mediaType = dataUrl.split(';')[0].split(':')[1] || 'image/jpeg'
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST', redirect: 'follow', signal: ctl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // text/plain = tanpa preflight CORS (syarat Apps Script)
      body: JSON.stringify({ image, mediaType, nama, folder, tanggal, ocr }),
    })
    const txt = await res.text()
    try { return JSON.parse(txt) } catch { return { ok: false, error: 'Balasan Drive tidak dikenali: ' + txt.slice(0, 80) } }
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'Drive tidak merespons (timeout)' : e.message }
  } finally { clearTimeout(t) }
}
