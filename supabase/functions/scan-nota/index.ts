// Edge Function: scan-nota
// Membaca foto nota belanja dengan Claude dan mencocokkan tiap baris ke master bahan.
// Kunci API disimpan sebagai secret ANTHROPIC_API_KEY di Supabase (tidak pernah dikirim ke browser).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

type MasterItem = {
  id: string | number;
  nama: string;
  satuan_dasar?: string | null;
  kemasan?: string | null;
  qty_per_kemasan?: number | null;
};

const SCHEMA = {
  type: "object",
  properties: {
    terbaca: { type: "boolean", description: "false jika foto bukan nota atau tidak bisa dibaca sama sekali" },
    toko: { type: ["string", "null"] },
    tanggal: { type: ["string", "null"], description: "YYYY-MM-DD jika tertera di nota" },
    total_nota: { type: ["number", "null"], description: "total akhir yang tertera di nota, dalam rupiah" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nama_nota: { type: "string", description: "nama item persis seperti di nota, singkatan boleh dipanjangkan" },
          bahan_id: { type: ["string", "null"], description: "id dari daftar master yang jelas sama dengan item ini, null jika tidak ada yang cocok" },
          jumlah: { type: "number" },
          satuan: { type: "string" },
          harga_total: { type: "number", description: "harga total baris ini dalam rupiah, setelah diskon baris jika ada" },
          yakin: { type: "boolean", description: "true jika angka dan pencocokan dibaca dengan jelas" },
        },
        required: ["nama_nota", "bahan_id", "jumlah", "satuan", "harga_total", "yakin"],
        additionalProperties: false,
      },
    },
  },
  required: ["terbaca", "toko", "tanggal", "total_nota", "items"],
  additionalProperties: false,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Gunakan POST" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ ok: false, code: "NO_KEY", error: "Scan nota belum aktif: secret ANTHROPIC_API_KEY belum diisi di Supabase." });
  }

  let body: { image?: string; mediaType?: string; master?: MasterItem[] };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Body harus JSON" }, 400);
  }

  const image = (body.image || "").replace(/^data:[^;]+;base64,/, "");
  if (!image) return json({ ok: false, error: "Foto kosong" }, 400);
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
  const mediaType = (allowed as readonly string[]).includes(body.mediaType || "")
    ? (body.mediaType as (typeof allowed)[number])
    : "image/jpeg";
  const master = Array.isArray(body.master) ? body.master.slice(0, 600) : [];

  const masterText = master
    .map((m) => {
      const kemasan = m.kemasan && m.qty_per_kemasan
        ? ` | kemasan: ${m.kemasan} = ${m.qty_per_kemasan} ${m.satuan_dasar || ""}`
        : "";
      return `${m.id} | ${m.nama} | satuan dasar: ${m.satuan_dasar || "-"}${kemasan}`;
    })
    .join("\n");

  const prompt = `Kamu membaca foto nota belanja bahan baku untuk kafe Piccolo Corner (Indonesia).
Tugas:
1. Baca SEMUA baris item yang dibeli. Lewati baris yang bukan item (subtotal, PPN, pembulatan, kembalian, voucher, nama kasir).
2. Untuk tiap item, cocokkan ke daftar master bahan di bawah. Isi bahan_id dengan id master hanya jika memang barang yang sama (merek/ukuran berbeda tetap boleh jika jelas bahan yang sama). Jika ragu atau tidak ada, bahan_id = null.
3. jumlah dan satuan: tulis seperti yang dibeli di nota. Jika master punya kemasan dan item dibeli per kemasan, pakai nama kemasan master sebagai satuan (misal "pack", "dus", "botol"). Jika dibeli per berat/volume, pakai satuan dasar master (gram, ml, kg, liter, pcs).
4. harga_total = harga total baris itu (jumlah x harga satuan, setelah diskon baris), angka rupiah bulat tanpa titik.
5. Jika foto bukan nota atau tidak terbaca, terbaca = false dan items kosong.

Daftar master bahan (format: id | nama | satuan):
${masterText || "(kosong)"}`;

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: prompt },
          ],
        },
      ],
    } as Parameters<typeof client.messages.create>[0]);

    const text = response.content
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { text?: string }) => c.text || "")
      .join("");
    const parsed = JSON.parse(text);
    return json({ ok: true, ...parsed, usage: response.usage });
  } catch (err) {
    const e = err as { status?: number; message?: string };
    const msg = e.status === 401
      ? "Kunci API ditolak (401). Cek ANTHROPIC_API_KEY di Supabase."
      : e.status === 429
      ? "Terlalu banyak permintaan ke AI, coba lagi sebentar."
      : (e.message || String(err));
    return json({ ok: false, code: e.status ? `API_${e.status}` : "ERR", error: msg });
  }
});
