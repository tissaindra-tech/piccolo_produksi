-- =====================================================
-- Checklist Harian (Kitchen / Bar)
-- checklist_templates : daftar tugas (diubah Owner lewat Supabase Table Editor, tanpa coding)
-- checklist_runs      : satu lembar checklist per station per tanggal (WITA)
-- checklist_items     : status tiap tugas di lembar itu
-- hari_berlaku pakai nama hari huruf kecil: minggu, senin, selasa, rabu, kamis, jumat, sabtu. Kosong = setiap hari.
-- lampiran: tombol/teks tambahan di item ('tidak_ada_tamu' | 'bersih_mingguan' | 'produksi').
-- Isi jadwal jam, daftar "Saat Tidak Ada Tamu", jadwal bersih mingguan, dan tab Info disimpan di app_settings id 'checklist_kitchen'.
-- =====================================================

create table public.checklist_templates (
  id bigint generated always as identity primary key,
  station text not null check (station in ('kitchen', 'bar')),
  no_urut text not null,
  tugas text not null,
  batas_jam text,
  hari_berlaku text[] not null default '{}',
  wajib_catatan boolean not null default false,
  wajib_foto boolean not null default false,
  kritis boolean not null default false,
  lampiran text,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.checklist_runs (
  id bigint generated always as identity primary key,
  station text not null check (station in ('kitchen', 'bar')),
  tanggal date not null default (now() at time zone 'Asia/Makassar')::date,
  staff_user_id text references public.app_users(id),
  dibuat_at timestamptz not null default now(),
  unique (station, tanggal)
);

create table public.checklist_items (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.checklist_runs(id) on delete cascade,
  template_id bigint not null references public.checklist_templates(id),
  status text not null default 'belum' check (status in ('belum', 'selesai', 'tidak_dikerjakan')),
  selesai_at timestamptz,
  selesai_oleh text,
  catatan text,
  foto_url text,
  dicek_supervisor boolean not null default false,
  dicek_oleh text,
  dicek_at timestamptz,
  komentar_supervisor text,
  unique (run_id, template_id)
);
create index checklist_items_template_idx on public.checklist_items(template_id);
create index checklist_runs_staff_idx on public.checklist_runs(staff_user_id);

-- RLS: semua user login boleh baca & isi checklist; template hanya diubah Owner; hapus hanya Owner.
alter table public.checklist_templates enable row level security;
alter table public.checklist_runs enable row level security;
alter table public.checklist_items enable row level security;

create policy baca_checklist_templates on public.checklist_templates for select to authenticated using (true);
create policy owner_tambah_checklist_templates on public.checklist_templates for insert to authenticated with check (public.is_owner());
create policy owner_ubah_checklist_templates on public.checklist_templates for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy owner_hapus_checklist_templates on public.checklist_templates for delete to authenticated using (public.is_owner());

create policy baca_checklist_runs on public.checklist_runs for select to authenticated using (true);
create policy tambah_checklist_runs on public.checklist_runs for insert to authenticated with check (true);
create policy owner_ubah_checklist_runs on public.checklist_runs for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy owner_hapus_checklist_runs on public.checklist_runs for delete to authenticated using (public.is_owner());

create policy baca_checklist_items on public.checklist_items for select to authenticated using (true);
create policy tambah_checklist_items on public.checklist_items for insert to authenticated with check (true);
create policy ubah_checklist_items on public.checklist_items for update to authenticated using (true) with check (true);
create policy owner_hapus_checklist_items on public.checklist_items for delete to authenticated using (public.is_owner());

revoke all on public.checklist_templates, public.checklist_runs, public.checklist_items from anon;
grant select, insert, update, delete on public.checklist_templates, public.checklist_runs, public.checklist_items to authenticated;

-- Buka checklist hari ini: buat lembar (kalau belum ada) + item untuk tugas yang berlaku hari ini (WITA).
-- Aman dipanggil berkali-kali / dari dua HP sekaligus.
create or replace function public.buka_checklist(p_station text, p_staff text)
returns bigint
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_tanggal date := (now() at time zone 'Asia/Makassar')::date;
  v_hari text := (array['minggu','senin','selasa','rabu','kamis','jumat','sabtu'])[extract(dow from v_tanggal)::int + 1];
  v_run bigint;
begin
  insert into checklist_runs (station, tanggal, staff_user_id)
  values (p_station, v_tanggal, p_staff)
  on conflict (station, tanggal) do nothing;

  select id into v_run from checklist_runs where station = p_station and tanggal = v_tanggal;

  insert into checklist_items (run_id, template_id)
  select v_run, t.id from checklist_templates t
  where t.station = p_station and t.aktif
    and (cardinality(t.hari_berlaku) = 0 or v_hari = any(t.hari_berlaku))
  on conflict (run_id, template_id) do nothing;

  return v_run;
end $$;
revoke all on function public.buka_checklist(text, text) from public, anon;
grant execute on function public.buka_checklist(text, text) to authenticated;

alter publication supabase_realtime add table public.checklist_items;

-- ── Template Kitchen ──
insert into public.checklist_templates (station, no_urut, tugas, batas_jam, hari_berlaku, wajib_catatan, wajib_foto, kritis, lampiran) values
('kitchen', '1',   'Nasi sudah dimasak di rice cooker', '10.40', '{}', false, false, false, null),
('kitchen', '2',   'Persiapan opening: meja, talenan, lantai, kulkas dicek', '10.50', '{}', false, false, false, null),
('kitchen', '3',   'Station terisi lengkap & berlabel', '11.00', '{}', false, false, false, null),
('kitchen', '4',   'Stok dihitung, rencana produksi ditentukan; ayam mentah di-thawing kalau produk ayam (cireng, ayam nasi goreng, karage, chicken crispy) sisa 5 porsi', '11.30', '{}', false, false, false, null),
('kitchen', '4b',  'Stock opname: SEMUA barang diisi di aplikasi, termasuk yang stoknya tidak bergerak', '14.00', '{senin}', false, false, true, null),
('kitchen', '5',   'Produksi hari ini dicatat di app Piccolo Produksi', 'saat masak', '{}', false, false, false, 'produksi'),
('kitchen', '6',   'Daftar restock dikirim ke Supervisor (semua bahan yang sudah di batas minimum). Item kritis tidak boleh kosong: ayam, bakso, beef patty, telur, garnish, roti', '15.00', '{}', false, false, true, null),
('kitchen', '7',   'Jam sepi: minimal 3 tugas dari daftar "Saat Tidak Ada Tamu" dikerjakan (tulis tugasnya)', '17.00', '{}', true, false, false, 'tidak_ada_tamu'),
('kitchen', '8',   'Prep untuk besok: bawang, sayur, garnish siap di chiller (tertutup + label)', '17.30', '{}', false, false, false, null),
('kitchen', '9',   'Piring, gelas, blender & alat masak dicuci bersih, kering', '20.00', '{}', false, false, false, null),
('kitchen', '10',  'Lantai & kolong kompor/meja disapu & dipel', '20.00', '{}', false, false, false, null),
('kitchen', '11',  'Tugas bersih mingguan hari ini selesai', '20.00', '{}', false, false, false, 'bersih_mingguan'),
('kitchen', '11b', 'Persiapan weekend: 3 porsi ayam kremes + 3 porsi ayam bakar siap, telur min. 3 krat, beras min. 5 kg, beef patty ready', '20.00', '{jumat}', false, false, true, null),
('kitchen', '12',  'Bakteri pengurai lemak (Rumos) dituang ke grease trap', '20.00', '{senin,rabu,jumat}', false, false, false, null),
('kitchen', '13',  'Sampah organik ke tong kompos, sampah lain dibuang, gas & kompor mati, foto dapur dikirim', '20.00', '{}', false, true, false, null);

-- ── Jadwal jam, daftar "Saat Tidak Ada Tamu", bersih mingguan, dan isi tab Info (Kitchen) ──
insert into public.app_settings (id, value) values ('checklist_kitchen', $json$
{
  "jadwal": [
    { "mulai": "10.30", "selesai": "10.40", "teks": "Datang + masak nasi" },
    { "mulai": "10.30", "selesai": "10.50", "teks": "Persiapan opening" },
    { "mulai": "10.50", "selesai": "11.00", "teks": "Station siap" },
    { "mulai": "11.00", "selesai": "11.10", "teks": "Café buka" },
    { "mulai": "11.00", "selesai": "11.30", "teks": "Cek stok (Senin: stock opname)" },
    { "mulai": "11.00", "selesai": "16.00", "teks": "Service + produksi" },
    { "mulai": "15.00", "selesai": "15.30", "teks": "Cek siang & kirim restock" },
    { "mulai": "16.00", "selesai": "17.30", "teks": "Prep untuk besok" },
    { "mulai": "19.00", "selesai": "20.00", "teks": "Persiapan closing (termasuk sampah organik ke tong kompos)" },
    { "mulai": "20.00", "selesai": "23.59", "teks": "Tutup" }
  ],
  "jadwal_kosong": "Service. Kalau tidak ada tamu, kerjakan daftar \"Saat Tidak Ada Tamu\".",
  "tidak_ada_tamu": [
    { "judul": "Produksi (Senin–Jumat)", "tugas": ["Produksi"] },
    { "judul": "Prep", "tugas": ["Bawang", "Sayur", "Garnish", "Ganti air rendaman garnish"] },
    { "judul": "Periksa", "tugas": ["Chiller & freezer (daging mentah tertutup, rak paling bawah)", "Label tanggal", "Minyak goreng", "Gas", "Perlengkapan (sabun, spons, plastik wrap, kantong sampah, kemasan take away, bakteri pengurai lemak (Rumos))"] },
    { "judul": "Perawatan alat", "tugas": ["Blender", "Griddle & grill", "Lubang api kompor", "Rice cooker & microwave", "Asah pisau", "Talenan", "Wadah & tutup"] },
    { "judul": "Bersih ekstra", "tugas": ["Tugas bersih mingguan besok", "Kolong", "Rak", "Tembok"] }
  ],
  "bersih_mingguan": {
    "senin": "Kulkas & chiller + bakteri pengurai lemak (Rumos)",
    "selasa": "Kompor & belakang kompor",
    "rabu": "Rak bahan kering + bakteri pengurai lemak (Rumos)",
    "kamis": "Kolong dalam",
    "jumat": "Rice cooker, microwave, oven + bakteri pengurai lemak (Rumos)",
    "sabtu": "Tempat sampah & tong kompos",
    "minggu": "Cek ringan"
  },
  "bersih_bulanan": "Minggu pertama tiap bulan: freezer, hood/exhaust, grease trap, cek alat",
  "kritis": [
    { "label": "Ayam", "cari": ["ayam kremes", "ayam bakar", "ayam fillet", "ayam potong"] },
    { "label": "Bakso", "cari": ["bakso a al", "bakso sapi"] },
    { "label": "Beef patty", "cari": ["beef patty"] },
    { "label": "Telur", "cari": ["telur ayam"] },
    { "label": "Garnish", "cari": ["selada", "sawi", "timun", "tomat merah"] },
    { "label": "Roti", "cari": ["roti bun", "roti shokupan"] }
  ],
  "info": [
    { "judul": "Batas minimum stok", "baris": [
      "Produk ayam: 5 porsi → thawing",
      "Beef patty: 3–5 → order. Sabtu–Minggu ready stock",
      "Bawang merah & putih: 200–300 g",
      "Bawang bombay: 2 buah",
      "Telur: 2 krat (Sabtu min. 3 krat)",
      "Beras: 3 kg weekdays, min. 5 kg weekend",
      "Garnish (selada, sawi hijau, timun, tomat): 200 g, TIDAK BOLEH KOSONG",
      "Cabe & sayur lain: 200 g",
      "Saus / kecap / sambal: 500 g/ml",
      "Minyak: 2 liter",
      "Bakteri pengurai lemak (Rumos): 500 ml, TIDAK BOLEH KOSONG"
    ] },
    { "judul": "Aturan daging", "baris": [
      "Thawing di chiller",
      "Daging mentah selalu tertutup & di rak paling bawah",
      "Tidak boleh dibekukan ulang",
      "Ayam kremes & bakar: weekdays defrost microwave saat order",
      "Jumat siapkan 3 + 3 porsi untuk weekend"
    ] },
    { "judul": "Standar masak", "baris": [
      "Nasi rajin diaduk supaya tidak kuning",
      "Ungkep paha ayam besar: api kecil 44–60 menit, terendam bumbu, ayam atas pindah ke bawah, jangan ditinggal",
      "Beef patty: api sedang, colok tengah. Air masih merah = mentah, DILARANG disajikan"
    ] },
    { "judul": "Kebersihan", "baris": [
      "Bersih harian jam 19.00–20.00, termasuk sampah organik ke tong kompos"
    ] },
    { "judul": "Produksi", "baris": [
      "Produksi dimaksimalkan Senin–Jumat",
      "Sabtu–Minggu hindari produksi kecuali mendesak"
    ] }
  ]
}
$json$::jsonb)
on conflict (id) do nothing;
