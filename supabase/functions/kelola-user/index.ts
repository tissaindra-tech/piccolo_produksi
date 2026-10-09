// Edge Function: kelola-user
// Dipanggil dari menu "User" oleh OWNER yang sudah login. Membuat/mengubah akun login tersembunyi
// (email internal + PIN sebagai kata sandi) lewat kunci service role yang tidak pernah dikirim ke browser.
// Sumber yang di-deploy ada di Supabase (fungsi "kelola-user"); file ini salinan untuk arsip repo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const slug = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Gunakan POST" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Siapa yang memanggil? Harus owner yang sudah login.
  const authHeader = req.headers.get("Authorization") || "";
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user: callerUser }, error: callerErr } = await caller.auth.getUser();
  if (callerErr || !callerUser) return json({ ok: false, error: "Belum login" }, 401);

  const admin = createClient(url, service);
  const { data: me } = await admin.from("app_users").select("id, role, is_active").eq("auth_uid", callerUser.id).maybeSingle();
  if (!me || me.role !== "owner" || me.is_active === false) return json({ ok: false, error: "Hanya owner yang boleh mengelola user" }, 403);

  let body: { aksi?: string; user?: Record<string, unknown>; pin?: string | null };
  try { body = await req.json(); } catch { return json({ ok: false, error: "Body harus JSON" }, 400); }
  const aksi = body.aksi;
  const u = (body.user || {}) as Record<string, unknown>;
  const pin = (body.pin || "").toString().trim();

  try {
    if (aksi === "simpan") {
      const nama = String(u.nama || "").trim();
      if (!nama) return json({ ok: false, error: "Nama wajib diisi" }, 400);
      if (pin && !/^\d{6}$/.test(pin)) return json({ ok: false, error: "PIN harus 6 angka" }, 400);

      const id = String(u.id || "") || (slug(nama) || "user") + "_" + Math.random().toString(36).slice(2, 7);
      const { data: lama } = await admin.from("app_users").select("auth_uid, login_email").eq("id", id).maybeSingle();
      let authUid = (lama?.auth_uid as string | null) || null;
      const email = (lama?.login_email as string | null) || `u-${slug(id)}@piccolo.local`;
      const aktif = u.is_active !== false;

      if (!authUid) {
        if (!pin) return json({ ok: false, error: "User baru wajib diberi PIN 6 angka" }, 400);
        const { data: dibuat, error: e1 } = await admin.auth.admin.createUser({
          email, password: pin, email_confirm: true, user_metadata: { app_user_id: id, nama },
        });
        if (e1) throw e1;
        authUid = dibuat.user.id;
      } else {
        const patch: Record<string, unknown> = { user_metadata: { app_user_id: id, nama } };
        if (pin) patch.password = pin;
        patch.ban_duration = aktif ? "none" : "876000h";   // nonaktif = tidak bisa login
        const { error: e2 } = await admin.auth.admin.updateUserById(authUid, patch);
        if (e2) throw e2;
      }

      const row = {
        id, nama, role: u.role === "owner" ? "owner" : "staff",
        divisi: String(u.divisi || "Kitchen"), avatar: String(u.avatar || "👤"),
        is_active: aktif, urutan: u.urutan ?? null,
        bisa_penjualan: u.role === "owner" ? true : !!u.bisa_penjualan,
        auth_uid: authUid, login_email: email, pin: "",   // kolom pin lama NOT NULL; PIN hidup sebagai kata sandi akun, bukan di tabel
      };
      const { error: e3 } = await admin.from("app_users").upsert(row);
      if (e3) throw e3;
      return json({ ok: true, id, pin_diganti: !!pin });
    }

    if (aksi === "hapus") {
      const id = String(u.id || "");
      if (!id) return json({ ok: false, error: "id kosong" }, 400);
      if (id === me.id) return json({ ok: false, error: "Tidak bisa menghapus akun sendiri" }, 400);
      const { data: lama } = await admin.from("app_users").select("auth_uid").eq("id", id).maybeSingle();
      if (lama?.auth_uid) { const { error: e4 } = await admin.auth.admin.deleteUser(lama.auth_uid as string); if (e4) throw e4; }
      const { error: e5 } = await admin.from("app_users").delete().eq("id", id);
      if (e5) throw e5;
      return json({ ok: true });
    }

    return json({ ok: false, error: "aksi tidak dikenal" }, 400);
  } catch (err) {
    const e = err as { message?: string };
    return json({ ok: false, error: e.message || String(err) }, 500);
  }
});
