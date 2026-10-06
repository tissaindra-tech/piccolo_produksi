# Rutinitas Claude untuk Piccolo Corner

Teks perintah (prompt) rutinitas harian yang berjalan di Claude Desktop (macOS) milik Tissa.
Perubahan prompt hanya bisa disetujui dari Claude Desktop di laptop itu.

Cara memperbarui (sekali per rutinitas, ~1 menit):
1. Buka aplikasi Claude Desktop di laptop → mulai percakapan Cowork baru.
2. Kirim pesan: "Perbarui prompt rutinitas **<nama rutinitas>** dengan teks di file berikut, jangan ubah jadwal dan namanya" lalu lampirkan/tempel isi file .md yang sesuai.
3. Setujui saat Claude Desktop meminta persetujuan perubahan.

| Rutinitas | Jadwal (WITA) | File |
|---|---|---|
| Pembukuan Harian — Piccolo Corner | tiap hari 07.59 | `pembukuan-harian.md` |
| Closing Day — Piccolo Corner | tiap hari 21.49 | `closing-day.md` |

Yang berubah dibanding versi lama:
- Sumber utama = aplikasi Piccolo (Supabase), grup WA hanya pelengkap.
- Pagi: mengisi barang pada nota berstatus "menunggu" lewat fungsi database `terapkan_belanja` (sekaligus menambah stok), lalu melaporkan.
- Malam: mengecek laporan penjualan, nota, kas kasir keluar, dan update stok langsung dari aplikasi.
