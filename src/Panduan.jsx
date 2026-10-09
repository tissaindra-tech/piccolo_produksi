// Panduan di dalam aplikasi: kartu skenario per peran (bukan per menu), supaya staff baru
// belajar dari situasi nyata: "stok hampir habis", "belanja ke Lotte", "masak satu batch", dst.
import { useState } from 'react'
import { C, S } from './shared'

const ATURAN_WAJIB = [
  ['⚖️', 'Jumlah selalu dalam satuan terkecil: gram, ml, atau pcs. Beli 2 botol × 1000 ml, tulis 2000.'],
  ['🗑️', 'Waste hanya barang yang benar-benar dibuang. Kalau stok turun karena dipakai masak, pilih "Tidak ada".'],
  ['📷', 'Ragu isi barangnya? Cukup foto nota dan isi totalnya. Claude membaca barangnya tiap pagi.'],
  ['🙋', 'Kalau bingung, jangan dikira-kira. Tanya owner, atau lihat kartu di bawah.'],
]

// Tiap kartu: judul situasi, kapan dipakai, langkah, catatan, dan menu yang dibuka
const KARTU = {
  staff: [
    {
      judul: 'Stok hampir habis, minta dibelikan', kapan: 'Saat lihat bahan menipis atau muncul tanda "⚠ rendah" di Stok.', view: 'request', tombol: 'Buka Request',
      langkah: [
        'Buka Lainnya → Request, tap "Buat".',
        'Tap barang dari daftar "Stok rendah", atau ketik namanya di kolom cari.',
        'Isi jumlah dan satuan yang diminta (boleh "2 Pack"; saat nota nanti tetap diisi gram/ml).',
        'Tulis catatan kalau perlu (untuk event, beli di mana), lalu "Kirim request".',
        'Tunggu owner. Kalau sudah "Disetujui · siap dibeli", baru belanja.',
      ],
      catatan: 'Barang Produksi dan Prepack (ayam kremes, french fries) tidak ada di daftar, karena dibuat sendiri lewat Produksi.',
    },
    {
      judul: 'Barang belanjaan datang, cek dan terima', kapan: 'Setiap ada barang masuk dari belanja owner atau supplier.', view: 'barangmasuk', tombol: 'Buka Barang Masuk',
      langkah: [
        'Buka Lainnya → Barang Masuk. Nota yang belum dicek ada di tab "Belum dicek" (di Home juga ada pengingatnya).',
        'Cocokkan tiap barang dengan yang datang: jumlahnya pas, tidak rusak, tidak busuk.',
        'Semua pas? Isi nama, tap "Semua sesuai, terima".',
        'Ada yang kurang, rusak, atau busuk? Tap "Ada masalah" di barang itu, isi jumlah yang benar-benar diterima dan kondisinya.',
        'Simpan. Stok otomatis dikoreksi, yang rusak atau busuk tercatat sebagai waste.',
      ],
      catatan: 'Stok sudah bertambah saat nota diinput. Tugasmu memastikan yang masuk memang sesuai. Kalau kamu sendiri yang belanja kecil pakai kas kasir, catat notanya di Lainnya → Nota.',
    },
    {
      judul: 'Masak satu batch (ayam kremes, kuah bakso, cireng)', kapan: 'Setiap selesai produksi atau prepack.', view: 'produksi', tombol: 'Buka Produksi',
      langkah: [
        'Buka Produksi. Pilih Divisi (Kitchen / Bar) dan "Produk yang dibuat".',
        'Isi bahan yang dipakai beserta jumlahnya. Resep biasanya sudah terisi, tinggal sesuaikan.',
        'Isi "Hasil produksi": berapa pcs/gram jadi, dan berapa porsi.',
        'Status "Selesai" kalau sudah jadi. "Proses" kalau masih dimasak, nanti diubah di tab Riwayat.',
        'Isi nama yang masak, lalu Simpan.',
        'Mau lihat yang sudah dimasak? Tap tab "Riwayat" di atas form.',
      ],
      catatan: 'Begitu Selesai: stok bahan berkurang, stok produk bertambah, dan COGS per porsi terhitung otomatis.',
    },
    {
      judul: 'Update stok / hitung sisa', kapan: 'Harian untuk bahan segar, mingguan untuk bahan kering (aplikasi memberi tahu).', view: 'closing', tombol: 'Buka Update Stok',
      langkah: [
        'Buka Update Stok. Cari bahan, lihat angka "Sebelum".',
        'Hitung fisik, isi angka sisa yang sebenarnya, isi nama, tap Simpan.',
        'Kalau stok turun, muncul pertanyaan "berapa yang dibuang?". Isi HANYA yang dibuang atau rusak.',
        'Kalau turun karena terpakai masak, tap "Tidak ada, simpan".',
      ],
      catatan: 'Jangan isi sisa stok di kotak waste. Angka waste maksimal sebesar yang berkurang.',
    },
    {
      judul: 'Ada bahan busuk, gosong, atau tumpah', kapan: 'Saat kejadian, sebelum dibuang.', view: 'waste', tombol: 'Buka Waste',
      langkah: [
        'Buka Lainnya → Waste. Pilih bahan, isi jumlah yang dibuang (gram/ml/pcs).',
        'Pilih alasan, foto kalau bisa, isi nama, Simpan.',
      ],
      catatan: 'Stok otomatis berkurang. Kalau salah input, owner bisa menghapusnya dari riwayat Waste.',
    },
    {
      judul: 'Uang kasir keluar (parkir, galon, ongkir, konsumsi staff)', kapan: 'Setiap uang kasir dipakai, hari itu juga.', view: 'pengeluaran', tombol: 'Buka Kas Keluar',
      langkah: [
        'Buka Kas Keluar. Isi jumlah dan "untuk apa".',
        'Pilih sumber uang (kas kasir, petty cash, ditalangi).',
        'Isi siapa owner yang menyetujui dan caranya, foto nota kalau ada, Simpan.',
      ],
      catatan: 'Belanja bahan tidak dicatat di sini, tapi di Nota. Kas Keluar untuk yang bukan stok.',
    },
  ],
  kasir: [
    {
      judul: 'Tutup kasir malam', kapan: 'Setiap malam setelah transaksi terakhir.', view: 'penjualan', tombol: 'Buka Tutup Kasir',
      langkah: [
        'Buka Tutup Kasir. Isi penerimaan per metode: tunai, QRIS, EDC, transfer, sesuai laporan POS.',
        'Foto layar rekap POS dan settlement EDC.',
        'Cek daftar "Sudah tercatat di aplikasi hari ini". Yang belum tercatat, tambahkan nama barang dan nominalnya.',
        'Isi kas kemarin (sisa kas kasir) dan kas fisik yang dihitung.',
        'Simpan, lalu "Salin teks laporan" dan kirim ke grup WA.',
      ],
      catatan: 'Sudah masuk tidak bisa diubah kasir. Kalau salah, minta owner.',
    },
  ],
  owner: [
    {
      judul: 'Approve request staff', kapan: 'Tiap ada notifikasi request menunggu, idealnya hari itu.', view: 'request', tombol: 'Buka Request',
      langkah: [
        'Buka Request → tab Menunggu. Di tiap kartu terlihat stok saat ini dan minimumnya.',
        'Tulis catatan untuk staff kalau perlu (beli di mana, pakai dana apa), lalu Setujui atau Tolak.',
        'Tab Disetujui: "Tandai sudah dibeli" kalau dibeli tanpa nota, atau "Batalkan" kalau tidak jadi.',
      ],
      catatan: 'Tidak perlu menunggu loading antar approve. Tombol "Tandai semua" ada kalau request banyak.',
    },
    {
      judul: 'Input nota belanja (Lotte, pasar, supplier)', kapan: 'Setiap habis belanja, hari itu juga.', view: 'inputnota', tombol: 'Buka Nota',
      langkah: [
        'Buka Nota. Isi tanggal, sumber dana (kas kasir, QRIS toko, ditalangi), dan nama yang belanja.',
        'Kalau dibayar dari 2 sumber (QRIS + ShopeePay), tap "+ Dibayar dari 2 sumber dana" dan isi nominal sumber keduanya.',
        'Tap pil request yang dibelanjakan (boleh lebih dari satu, atau "Pilih semua").',
        'Pilih "Upload nota": foto struknya. Barang terbaca otomatis, atau diisi Claude pagi. Wajib isi "Total di nota".',
        'Atau "Ketik manual": pilih barang, isi jumlah dalam gram/ml/pcs, dan harga total baris itu.',
        'Barang bukan stok (tisu, plastik, parkir) masuk lewat "+ Tambah baris bukan stok".',
        'Tap Simpan. Stok bertambah, request tertanda "sudah dibeli", dan staff diminta mengecek barangnya di Barang Masuk.',
      ],
      catatan: 'Satu nota boleh berisi beberapa request. Nama di struk beda dengan di aplikasi tidak masalah.',
    },
    {
      judul: 'Cek hari ini sebelum input Accurate', kapan: 'Pagi, untuk hari sebelumnya.', view: 'rekap', tombol: 'Buka Rekap Harian',
      langkah: [
        'Buka Rekap Harian, pilih tanggal.',
        'Lihat 4 kotak: Omzet, Total belanja, Pengeluaran kasir, Sisa cash hari ini.',
        'Periksa nota yang "belum dibaca" atau bertotal Rp 0, dan item "belum terhubung ke Accurate".',
        '"Salin teks rekap" untuk input cepat, atau "Export Excel" untuk arsip.',
      ],
      catatan: 'Baris bukan stok tampil terpisah dengan kategorinya supaya masuk akun beban, bukan persediaan.',
    },
    {
      judul: 'Review bulanan produksi dan COGS', kapan: 'Awal bulan, untuk bulan sebelumnya.', view: 'histproduksi', tombol: 'Buka Lap. Produksi',
      langkah: [
        'Buka Lainnya → Lap. Produksi (atau tab Riwayat di Produksi), pilih bulan.',
        'Lihat ringkasan per menu: batch, hasil, porsi, COGS, dan COGS per porsi.',
        'Tap "Excel": sheet Ringkasan, Pemakaian Bahan (dengan kode Accurate), dan Per Batch.',
      ],
      catatan: 'Batch berstatus "proses" tidak dihitung sampai diubah jadi Selesai.',
    },
    {
      judul: 'Ada input yang salah', kapan: 'Begitu ketahuan, sebelum tanggalnya lewat jauh.', view: 'auditlog', tombol: 'Buka Audit',
      langkah: [
        'Waste salah: Lainnya → Waste → riwayat → "Salah input? Hapus".',
        'Nota salah: Belanja → pilih nota → Edit (angka saja, stok tidak berubah).',
        'Request salah: Request → Batalkan. Produksi salah: Lap. Produksi → batch → Hapus (stok tidak balik otomatis).',
        'Semua perubahan tercatat di Audit, jadi bisa dilacak siapa dan kapan.',
      ],
      catatan: 'Kalau stok ikut salah karena koreksi, betulkan lewat Update Stok.',
    },
    {
      judul: 'Tambah barang baru atau rapikan master', kapan: 'Saat ada bahan baru, atau laporan Accurate sering dikoreksi manual.', view: 'stoklist', tombol: 'Buka Stok',
      langkah: [
        'Buka Stok → "+ Tambah" atau Edit di barang yang ada.',
        'Pilih kategori: Mentah (dibeli), Jadi (dibeli siap jual), Produksi (dimasak sendiri), Prepack (hanya diporsi).',
        'Satuan dasar harus sama dengan Accurate: gram, ml, pcs. Isi kode Accurate supaya rekap langsung cocok.',
        'Isi stok minimum supaya peringatan "rendah" dan request order jalan.',
      ],
      catatan: 'Barang yang tidak dipakai lagi dinonaktifkan, jangan dihapus, supaya riwayatnya tetap ada.',
    },
  ],
}

export function PanduanView({ role, setView, bisaPenjualan }) {
  const tabs = role === 'owner'
    ? [['owner', '👑 Owner'], ['staff', '👩‍🍳 Kitchen & Bar'], ['kasir', '💵 Kasir']]
    : [['staff', '👩‍🍳 Kitchen & Bar'], ...(bisaPenjualan ? [['kasir', '💵 Kasir']] : []), ['owner', '👑 Owner']]
  const [tab, setTab] = useState(tabs[0][0])
  const [buka, setBuka] = useState(null)
  const kartu = KARTU[tab] || []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '2px' }}>📖 Panduan</h2>
          <p style={{ fontSize: '12px', color: C.text3, marginBottom: '12px' }}>Pilih situasinya, ikuti langkahnya. Untuk staff baru dan pengingat semua.</p>
        </div>
        <button onClick={() => window.print()} style={{ ...S.btn, ...S.btnSecondary, fontSize: '11px', padding: '7px 10px', whiteSpace: 'nowrap' }}>🖨️ Cetak</button>
      </div>

      <div style={{ background: C.yellowBg, border: `1px solid ${C.yellowBorder}`, borderRadius: '12px', padding: '10px 12px', marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: C.yellow, marginBottom: '6px' }}>Aturan wajib</div>
        {ATURAN_WAJIB.map(([ik, t]) => (
          <div key={t} style={{ display: 'flex', gap: '8px', fontSize: '12px', color: C.text, marginBottom: '4px' }}><span>{ik}</span><span>{t}</span></div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {tabs.map(([id, l]) => (
          <button key={id} onClick={() => { setTab(id); setBuka(null) }} style={{
            ...S.btn, padding: '6px 10px', fontSize: '11px', borderRadius: '99px',
            background: tab === id ? C.sun : C.panel, color: C.text, border: `1px solid ${tab === id ? C.sun : C.border}`,
          }}>{l}</button>
        ))}
      </div>

      {kartu.map((k, i) => {
        const terbuka = buka === i
        return (
          <div key={k.judul} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '8px' }}>
            <div onClick={() => setBuka(terbuka ? null : i)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{i + 1}. {k.judul}</div>
                <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>{k.kapan}</div>
              </div>
              <span style={{ fontSize: '12px', color: C.text3 }}>{terbuka ? '▲' : '▼'}</span>
            </div>
            {terbuka && (
              <div style={{ marginTop: '10px' }}>
                <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', lineHeight: 1.55 }}>
                  {k.langkah.map((l, j) => <li key={j} style={{ marginBottom: '4px' }}>{l}</li>)}
                </ol>
                {k.catatan && <div style={{ fontSize: '11.5px', color: C.text2, background: C.panel2, borderRadius: '8px', padding: '7px 10px', marginTop: '8px' }}>💡 {k.catatan}</div>}
                {k.view && setView && (
                  <button onClick={() => { setView(k.view); window.scrollTo({ top: 0 }) }} style={{ ...S.btn, ...S.btnPrimary, marginTop: '10px', padding: '8px 12px', fontSize: '12px' }}>{k.tombol} →</button>
                )}
              </div>
            )}
          </div>
        )
      })}

      <style>{`@media print { button { display: none !important } body { background: #fff } }`}</style>
    </div>
  )
}
