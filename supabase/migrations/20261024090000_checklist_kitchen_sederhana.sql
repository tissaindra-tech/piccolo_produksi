-- Checklist Kitchen disederhanakan: 14 tugas → 6 tugas per waktu kerja.
-- Tugas khusus hari tertentu tidak lagi jadi tugas terpisah, tapi baris tambahan di tugas terkait (kolom tambahan_hari).
-- Template lama dinonaktifkan (aktif = false), tidak dihapus, supaya riwayat checklist lama tetap utuh.
-- lampiran baru: 'update_stok' (tombol ke menu Update Stok).

alter table public.checklist_templates add column tambahan_hari jsonb not null default '{}'::jsonb;
comment on column public.checklist_templates.tambahan_hari is 'Baris tambahan per hari, mis. {"senin": "Stock opname ..."}. Kunci = nama hari huruf kecil.';

update public.checklist_templates set aktif = false where station = 'kitchen';

insert into public.checklist_templates (station, no_urut, tugas, batas_jam, wajib_catatan, wajib_foto, kritis, lampiran, tambahan_hari) values
('kitchen', '1', 'Opening siap: nasi dimasak, meja, talenan & lantai bersih, station terisi & berlabel', '11.00', false, false, false, null, '{}'),
('kitchen', '2', 'Cek stok & rencana produksi. Thawing ayam kalau produk ayam (cireng, ayam nasi goreng, karage, chicken crispy) sisa 5 porsi', '11.30', false, false, false, 'update_stok',
  '{"senin": "Stock opname: SEMUA barang diisi di aplikasi, termasuk yang stoknya tidak bergerak (paling lambat 14.00)"}'),
('kitchen', '3', 'Kirim daftar restock ke Supervisor (semua bahan yang sudah di batas minimum). Item kritis tidak boleh kosong: ayam, bakso, beef patty, telur, garnish, roti', '15.00', false, false, true, null, '{}'),
('kitchen', '4', 'Jam sepi: minimal 3 tugas dari daftar "Saat Tidak Ada Tamu" (tulis tugasnya)', '17.00', true, false, false, 'tidak_ada_tamu', '{}'),
('kitchen', '5', 'Prep besok: bawang, sayur, garnish siap di chiller (tertutup + label)', '17.30', false, false, false, null,
  '{"jumat": "Persiapan weekend: 3 porsi ayam kremes + 3 porsi ayam bakar siap, telur min. 3 krat, beras min. 5 kg, beef patty ready"}'),
('kitchen', '6', 'Closing: alat masak, piring & gelas dicuci kering; lantai & kolong disapu-pel; bersih mingguan hari ini; sampah organik ke tong kompos; gas & kompor mati. Kirim 1 foto dapur', '20.00', false, true, false, 'bersih_mingguan', '{}');
-- Rumos (Senin/Rabu/Jumat) sudah tampil lewat jadwal bersih mingguan di tugas Closing.
