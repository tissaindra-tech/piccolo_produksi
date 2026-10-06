Ini pengecekan malam untuk Piccolo Corner Pet Café. Aku Tissa. Tugasmu singkat: pastikan bukti hari ini sudah masuk dan tagih check-in. Jangan buka Accurate, jangan ubah apa pun.

CEK 1 — APLIKASI PICCOLO (konektor Supabase, project uepywjdrwquxommmumtx, tool execute_sql, hanya SELECT)
a. Laporan penjualan hari ini: `select tanggal, yang_input, total, foto is not null as ada_foto_pos, foto_edc is not null as ada_foto_edc from penjualan_harian where tanggal = current_date`. Ada / belum? Foto POS dan foto settlement EDC ada / belum?
b. Nota belanja hari ini: `select count(*) as n, count(*) filter (where status_baca = 'menunggu') as menunggu, coalesce(sum(total_harga),0) as total from belanja where tanggal = current_date`.
c. Kas kasir keluar hari ini: `select count(*), coalesce(sum(jumlah),0) from pengeluaran_kasir where tanggal = current_date`.
d. Update stok hari ini: `select count(distinct bahan_id) as bahan, count(distinct yang_closing) as orang from closing_stok where tanggal = current_date`.
Kalau konektor Supabase tidak ada, tulis "Aplikasi tidak terbaca malam ini" dan lanjutkan.

CEK 2 — grup WhatsApp (lewat Claude in Chrome; WhatsApp Web di Chrome-ku sudah login), hanya untuk yang BELUM ada di aplikasi
Buka grup "NOTA/TRANSFER piccolo". Baca pesan sejak siang ini. Yang dicari: bukti transfer hari ini (berapa?), dan laporan kas kasir / settlement EDC kalau di aplikasi belum ada. Tutup tab yang kamu buka. Kalau Chrome tidak terjangkau, tulis "WA tidak terbaca malam ini" dan lanjutkan — jangan berhenti.

CEK 3 — Google Drive (konektor)
e. Folder "00 NOTA BARU — belum diinput" — ada file baru hari ini? Berapa?
f. Folder "Mutasi BCA <bulan> berjalan" — ada screenshot baru hari ini?

CEK 4 — papan progress (tool ArtifactData, muat lewat ToolSearch kalau belum ada; url https://claude.ai/artifact/M7uo5ef8U14gmHm2ZiMRQB)
g. Collection "checkins" — apakah aku sudah check-in hari ini?
h. Collection "tasks" — tugas paling atas yang belum done/hold, urut f1 → f2 → f3 → f4. Judul tugas ada di halaman artifact (tool Artifact action read) atau di dokumen project `claude/roadmap-bersih-buku-4-minggu-2026-09-23.md`.

KIRIM SATU PESAN, maksimal 10 baris, aku/kamu, jangan "Ibu":
- Bukti hari ini: ✔ / ✘ untuk laporan penjualan (+ foto POS, foto EDC), nota belanja (sebut berapa yang masih menunggu dibaca), kas kasir keluar, update stok, bukti transfer, mutasi.
- Kalau laporan penjualan atau foto settlement EDC belum ada di aplikasi: tulis satu kalimat siap-kirim untuk aku teruskan ke Diandra di grup, minta diisi lewat aplikasi (menu Laporan penjualan), bukan WA.
- Kalau aku belum check-in: sebut tugas paling atas + siapa yang kerjakan + perkiraan waktu, tawarkan mulai besok pagi. Kalau sudah 3 hari tidak check-in: jangan menghakimi, tawarkan satu tugas 15 menit.
- Sisa hari ke 20 Oktober 2026 + persen tugas done.

SIMPAN pesan yang sama ke dokumen project `claude/tutup-hari-<YYYY-MM-DD>.md` (tool Projects, method project_write). Kalau tool Projects tidak tersedia di sesi ini, simpan sebagai file "tutup-hari-<YYYY-MM-DD>.md" ke folder Drive "Laporan Harian Accurate" dan bilang di chat.

Tutup dengan satu pertanyaan saja. Jangan kirim email. Jangan sentuh Gmail (itu mailbox Dancing Wind, bisnis lain). Jangan tulis ke database papan maupun database aplikasi. Jangan balas atau kirim pesan apa pun di WhatsApp — hanya baca.
