// ============================================================
// Piccolo Corner - Google Apps Script
// Menyimpan foto dari aplikasi ke Google Drive owner, dan
// membaca tulisan di nota dengan OCR bawaan Google Drive (gratis).
//
// Cara pasang (sekali saja, ~5 menit):
// 1. Buka https://script.google.com  ->  "Proyek baru"
// 2. Hapus isi editor, tempel seluruh isi file ini, Ctrl+S
// 3. Kanan atas "Terapkan" (Deploy)  ->  "Deployment baru"
//    Jenis: Aplikasi web · Jalankan sebagai: Saya · Siapa yang punya akses: Siapa saja
//    ->  Terapkan  ->  izinkan akses akun Google  ->  salin "URL aplikasi web"
// 4. Tempel URL itu di aplikasi Piccolo: Dashboard owner  ->  Google Drive  ->  Atur
// ============================================================

var ROOT_FOLDER = 'Piccolo Corner - Foto Aplikasi';
var NAMA_FOLDER = { belanja: 'Nota belanja', pengeluaran: 'Nota kas kasir', penjualan: 'Laporan penjualan', produksi: 'Produksi', waste: 'Waste', tes: 'tes' };

function doGet() {
  return keluar({ ok: true, pesan: 'Piccolo Drive siap', folder: ROOT_FOLDER });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.ping) return keluar({ ok: true, folder: ROOT_FOLDER });
    if (!body.image) return keluar({ ok: false, error: 'Foto kosong' });

    var folder = ambilFolder(body.folder || 'lain', body.tanggal);
    var bytes = Utilities.base64Decode(body.image);
    var blob = Utilities.newBlob(bytes, body.mediaType || 'image/jpeg', body.nama || ('foto_' + Date.now() + '.jpg'));
    var file = folder.createFile(blob);

    var text = null, ocrError = null;
    if (body.ocr) {
      // Drive menyalin gambar menjadi Google Doc sambil menjalankan OCR (lewat API Drive biasa,
      // tidak perlu menambah layanan apa pun di editor)
      var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + file.getId() + '/copy?ocrLanguage=id&fields=id', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        payload: JSON.stringify({ name: 'ocr_' + file.getName(), mimeType: 'application/vnd.google-apps.document', parents: [folder.getId()] }),
        muteHttpExceptions: true
      });
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
        var docId = JSON.parse(res.getContentText()).id;
        text = DocumentApp.openById(docId).getBody().getText();
        DriveApp.getFileById(docId).setTrashed(true);
      } else {
        ocrError = 'OCR gagal (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 200);
      }
    }
    return keluar({ ok: true, fileUrl: file.getUrl(), fileId: file.getId(), text: text, ocrError: ocrError });
  } catch (err) {
    return keluar({ ok: false, error: String(err && err.message || err) });
  }
}

function ambilFolder(jenis, tanggal) {
  var root = cariAtauBuat(DriveApp.getRootFolder(), ROOT_FOLDER);
  var sub = cariAtauBuat(root, NAMA_FOLDER[jenis] || jenis);
  var bulan = (tanggal || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd')).slice(0, 7);
  return cariAtauBuat(sub, bulan);
}

function cariAtauBuat(parent, nama) {
  var it = parent.getFoldersByName(nama);
  return it.hasNext() ? it.next() : parent.createFolder(nama);
}

function keluar(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
