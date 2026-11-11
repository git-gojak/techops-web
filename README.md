# GoJak TechOps — Frontend PWA

Frontend GitHub Pages untuk GoJak TechOps.

## Struktur
- `index.html`: halaman aplikasi
- `api.js`: konektor JSONP ke Google Apps Script
- `css/style.css`: tema profesional navy-biru
- `js/`: modul dashboard, komputer, printer, maintenance, QR Info
- `manifest.json`: konfigurasi PWA
- `service-worker.js`: cache app shell

## Konfigurasi
Pastikan `API_URL` pada `api.js` menunjuk ke deployment Web App Apps Script yang benar.

## Keamanan
Saat login belum aktif, aplikasi hanya menyediakan fungsi baca. Jangan menambahkan endpoint tulis publik atau menaruh secret/token di frontend.
