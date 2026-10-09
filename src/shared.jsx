// =====================================================
// PICCOLO CORNER — konstanta & helper yang dipakai bersama
// (dipakai App.jsx dan Kasir.jsx)
// =====================================================
import { supabase } from './supabase'
import { kirimKeDrive } from './nota'

// Palet warna aplikasi
export const C = {
  // Gaya "Sunset": latar krem hangat, header kuning matahari, aksen oranye
  bg: '#F3EDE2', panel: '#FFFDF9', panel2: '#EFE5D3',
  text: '#3B2514', text2: '#5E4330', text3: '#8A7360',
  border: '#E2D5C0', border2: '#CDB38A',
  sun: '#F2B34C', sunDark: '#5A3A10',                 // header & tombol utama (amber kartu loyalti)
  green: '#B85A12', greenBg: '#FBE3BF', greenBorder: '#E9A23B',       // "sukses / utama" = oranye stiker menu
  yellow: '#7A5A00', yellowBg: '#FFF8DC', yellowBorder: '#E8C547',    // peringatan
  red: '#B42318', redBg: '#FEECEB', redBorder: '#F4A79F',
  blue: '#1240B8', blueBg: '#E6EEFF', blueBorder: '#9DB8F5',           // info
  greenLight: '#7A4B00', greenLightBg: '#FFF1C9', greenLightBorder: '#F7B733',
}

// Gaya dasar tombol, input, kartu
export const S = {
  btn: { padding: '11px 14px', fontSize: '13px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' },
  btnPrimary: { background: '#F2B34C', color: '#3B2514' },
  btnSuccess: { background: '#C2651B', color: '#FFFFFF' },
  btnDanger: { background: '#FEECEB', color: '#B42318', border: '1px solid #F4A79F' },
  btnSecondary: { background: 'transparent', color: '#5E4330', border: '1px solid #E2D5C0' },
  input: { width: '100%', padding: '11px 12px', border: '1.5px solid #E2D5C0', borderRadius: '10px', fontSize: '14px', background: '#FFFDF9', fontFamily: 'inherit', color: '#3B2514' },
  label: { display: 'block', fontSize: '11px', color: '#8A7360', marginBottom: '4px', fontWeight: 600 },
  card: { background: '#FFFDF9', borderRadius: '14px', padding: '16px 18px', marginBottom: '12px' },
  badge: (color) => ({ fontSize: '10px', padding: '3px 8px', borderRadius: '99px', fontWeight: 600, display: 'inline-block', background: C[color + 'Bg'], color: C[color] }),
}

// ─── Ikon garis (pengganti emoji di menu) ───
const ICON_PATHS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4"/><path d="M12 11v10"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M8 8h8M8 12h8"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M16 14h2"/>',
  cash: '<rect x="2" y="7" width="20" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 12.5h.01M18 12.5h.01"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2"/><path d="M9 11h6M9 15h4"/>',
  pot: '<path d="M4 10h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/><path d="M2 10h20"/><path d="M8 6c0-2 8-2 8 0"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h10l2-7H6.5"/>',
  bag: '<path d="M6 8h12l1 12H5z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  book: '<path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/>',
  upload: '<path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c3 0 5 2 5 5"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  logout: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h7v18h-7"/>',
}
export function Icon({ name, size = 24, strokeWidth = 2, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || ICON_PATHS.more }} />
  )
}

// ─── HELPER: Kompres gambar sebelum upload ───
export async function compressImage(file, maxWidth = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round(height * maxWidth / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Kompresi gagal')); return }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    img.onerror = reject
    img.src = url
  })
}

// ─── HELPER: Upload foto ke Supabase Storage ───
// folder: 'produksi' | 'belanja' | 'waste' | 'penjualan' | 'pengeluaran'
// Pengaturan Google Drive (Apps Script milik owner). Diisi dari app_settings id 'drive'.
export const driveCtx = { url: '', user: '' }
export const setDriveContext = (url, user) => { driveCtx.url = url || ''; driveCtx.user = user || '' }

const fileToDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(file) })

// Salinan foto ke Google Drive, tidak menghentikan proses kalau gagal.
export async function salinKeDrive(file, folder, tanggal, ocr = false) {
  if (!driveCtx.url) return { ok: false, error: 'belum diatur' }
  const dataUrl = typeof file === 'string' ? file : await fileToDataUrl(file)
  const tgl = tanggal || new Date().toISOString().slice(0, 10)
  const nama = `${tgl}_${folder}_${(driveCtx.user || 'staff').replace(/[^\w]+/g, '')}_${Date.now().toString(36)}.jpg`
  return kirimKeDrive({ url: driveCtx.url, dataUrl, nama, folder, tanggal: tgl, ocr })
}

export async function uploadFotoToStorage(file, folder, opts = {}) {
  const compressed = await compressImage(file)
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
  const { error } = await supabase.storage.from('foto-piccolo').upload(fileName, compressed, {
    cacheControl: '3600', upsert: false, contentType: 'image/jpeg'
  })
  if (error) throw new Error('Gagal upload foto: ' + error.message)
  const { data: { publicUrl } } = supabase.storage.from('foto-piccolo').getPublicUrl(fileName)
  if (!opts.skipDrive && driveCtx.url) salinKeDrive(compressed, folder, opts.tanggal).catch(() => {})
  return publicUrl
}

// Label sumber dana yang dipakai di Nota & Pengeluaran Kasir
// Kategori pengeluaran bukan-stok (kas kasir keluar & baris non-bahan di nota belanja)
export const KATEGORI_BIAYA = ['Operasional', 'Transport / parkir', 'Konsumsi staff', 'Perbaikan / alat', 'Kebersihan', 'Perlengkapan (tisu, plastik, dll)', 'Lainnya']

// Kategori bahan: mentah (dibeli), jadi (dibeli siap jual: Indomie, kaleng soda),
// produksi (dimasak sendiri: ayam kremes, kuah bakso, egg mayo), prepack (hanya diporsi: french fries 150g, kentang burger 100g).
// produksi & prepack sama-sama dibuat lewat menu Produksi dan tidak pernah di-request/dibeli.
export const KATEGORI_LABEL = { mentah: 'Mentah', produksi: 'Produksi', prepack: 'Prepack', jadi: 'Jadi' }
export const dibuatSendiri = (b) => b?.kategori === 'produksi' || b?.kategori === 'prepack'

export const SUMBER_DANA_LABEL = {
  kas_kasir: 'Kas kasir',
  petty_cash: 'Petty cash',
  transfer_toko: 'Transfer rekening toko',
  qris_toko: 'QRIS toko',
  talangan: 'Ditalangi dulu',
  transfer_owner: 'BCA Tissa (pribadi)',
  shopeepay_tissa: 'ShopeePay Tissa',
}

// Satu nota bisa dibayar dari dua sumber (sumber_dana + sumber_dana_2 sebesar jumlah_sumber_2).
// bagianSumber: berapa rupiah dari nota/catatan ini yang keluar dari sumber tertentu.
export const bagianSumber = (r, sumber) => {
  const total = Number(r?.total_harga ?? r?.jumlah) || 0
  const j2 = r?.sumber_dana_2 ? Number(r?.jumlah_sumber_2) || 0 : 0
  let x = 0
  if (r?.sumber_dana === sumber) x += total - j2
  if (r?.sumber_dana_2 === sumber) x += j2
  return x
}
const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID')

// Teks sumber dana + siapa yang menalangi (untuk rekap & riwayat)
export const sumberText = (r) => {
  const l1 = SUMBER_DANA_LABEL[r?.sumber_dana] || r?.sumber_dana || ''
  const talangan = r?.dibayar_oleh ? ` oleh ${r.dibayar_oleh}` + (r.status_ganti === 'sudah' ? ' (sudah diganti)' : ' (belum diganti)') : ''
  const j2 = r?.sumber_dana_2 ? Number(r?.jumlah_sumber_2) || 0 : 0
  if (!j2) return l1 + talangan
  const total = Number(r?.total_harga ?? r?.jumlah) || 0
  const l2 = SUMBER_DANA_LABEL[r.sumber_dana_2] || r.sumber_dana_2
  return `${l1} ${rp(total - j2)}${talangan} + ${l2} ${rp(j2)}`
}
