// =====================================================
// PICCOLO CORNER — konstanta & helper yang dipakai bersama
// (dipakai App.jsx dan Kasir.jsx)
// =====================================================
import { supabase } from './supabase'

// Palet warna aplikasi
export const C = {
  bg: '#f0ede5', panel: '#fdfaf0', panel2: '#ebe6d3',
  text: '#1a1814', text2: '#3d3929', text3: '#7a7560',
  border: '#c8b58c', border2: '#a3845c',
  green: '#085041', greenBg: '#e1f5ee', greenBorder: '#5dcaa5',
  yellow: '#633806', yellowBg: '#faeeda', yellowBorder: '#ef9f27',
  red: '#791f1f', redBg: '#fcebeb', redBorder: '#f09595',
  blue: '#042c53', blueBg: '#e6f1fb', blueBorder: '#7dadeb',
  greenLight: '#3b6d11', greenLightBg: '#eaf3de', greenLightBorder: '#639922',
}

// Gaya dasar tombol, input, kartu
export const S = {
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
export async function uploadFotoToStorage(file, folder) {
  const compressed = await compressImage(file)
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
  const { error } = await supabase.storage.from('foto-piccolo').upload(fileName, compressed, {
    cacheControl: '3600', upsert: false, contentType: 'image/jpeg'
  })
  if (error) throw new Error('Gagal upload foto: ' + error.message)
  const { data: { publicUrl } } = supabase.storage.from('foto-piccolo').getPublicUrl(fileName)
  return publicUrl
}

// Label sumber dana yang dipakai di Nota & Pengeluaran Kasir
export const SUMBER_DANA_LABEL = {
  kas_kasir: 'Kas kasir',
  petty_cash: 'Petty cash',
  transfer_toko: 'Transfer rekening toko',
  qris_toko: 'QRIS toko',
  talangan: 'Ditalangi dulu',
  transfer_owner: 'Transfer owner',
}

// Teks sumber dana + siapa yang menalangi (untuk rekap & riwayat)
export const sumberText = (r) => (SUMBER_DANA_LABEL[r?.sumber_dana] || r?.sumber_dana || '') + (r?.dibayar_oleh ? ` oleh ${r.dibayar_oleh}` + (r.status_ganti === 'sudah' ? ' (sudah diganti)' : ' (belum diganti)') : '')
