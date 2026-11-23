GoJak TechOps

GoJak TechOps adalah aplikasi web untuk pengelolaan inventaris dan operasional perangkat teknologi informasi (IT).

Aplikasi ini membantu pengelolaan komputer, printer, pemeliharaan perangkat, identifikasi melalui QR Code, serta pemantauan kondisi perangkat.

1. Informasi Repository

Keterangan| Informasi
Nama aplikasi| GoJak TechOps
Repository| "git-gojak/techops-web"
Branch utama| "main"
Platform| Web Application / PWA
Bahasa frontend| HTML, CSS, JavaScript
Backend| Google Apps Script
Database| Google Sheets

Repository ini berisi kode frontend. Backend Google Apps Script diakses melalui API Bridge dan dikelola secara terpisah.

2. Arsitektur Aplikasi

GoJak TechOps menggunakan tiga bagian utama:

1. Frontend — aplikasi web yang disimpan di GitHub dan ditampilkan melalui GitHub Pages.
2. Backend — Google Apps Script untuk autentikasi, pengolahan permintaan, dan komunikasi data.
3. Database — Google Sheets sebagai penyimpanan data aplikasi.

Alur komunikasi:

"Frontend → API Bridge → Google Apps Script → Google Sheets"

3. Fitur Aplikasi

Dashboard

- Ringkasan inventaris komputer dan printer.
- Ringkasan total maintenance.
- Informasi koneksi backend.
- Monitoring perangkat berdasarkan unit.
- Monitoring kondisi komputer dan printer.
- Monitoring jadwal maintenance.
- Aktivitas maintenance terbaru.
- Informasi jumlah perangkat arsip.

Inventaris Komputer

- Menampilkan data komputer.
- Pencarian data perangkat.
- Detail spesifikasi komputer.
- Penambahan dan perubahan data.
- Pengarsipan dan pengaktifan kembali perangkat.
- Pembatasan informasi identitas perangkat untuk pengguna publik.

Inventaris Printer

- Menampilkan data printer.
- Pencarian dan detail perangkat.
- Penambahan dan perubahan data.
- Pengarsipan dan pengaktifan kembali perangkat.
- Informasi tinta dan FTP/masa penggunaan sesuai data inventaris.

Maintenance

- Pencatatan kegiatan perawatan dan perbaikan.
- Pencatatan komputer maupun printer.
- Informasi kondisi perangkat.
- Keterangan kegiatan.
- Kategori kerusakan Hardware atau Software.
- Pilihan penanganan Teknisi atau Vendor.
- Perhitungan jadwal maintenance berikutnya.
- Riwayat kegiatan maintenance.

QR Info dan QRScan

- Pencarian perangkat melalui serial number.
- Pemindaian QR Code menggunakan kamera.
- Informasi komputer dan printer.
- Tampilan riwayat maintenance perangkat.
- Mode publik untuk melihat informasi yang diizinkan.
- Mode Admin untuk mengakses fungsi pengelolaan melalui pemindaian.

Hardware Scanner

- Pemindaian spesifikasi komputer Windows dan Linux.
- Pembacaan identitas dan spesifikasi perangkat.
- Pencocokan perangkat berdasarkan Asset/Serial ID.
- Perbandingan data inventaris dengan hasil scan.
- Ringkasan perubahan sebelum penyimpanan.
- Pengisian Pengguna sebelum penyimpanan.
- Pengiriman data ke backend melalui API "hardwareScan.save".

Scanner lokal menggunakan:

- "log.ps1" untuk Windows.
- "log.sh" untuk Linux.
- Endpoint lokal "127.0.0.1:47831".

Autentikasi Admin

- Login menggunakan PIN 6 digit.
- Profil Admin.
- Ganti PIN.
- Logout.
- Penyimpanan sesi menggunakan "localStorage".
- Sinkronisasi perubahan status autentikasi antar-tab browser.

Progressive Web App (PWA)

- Web App Manifest.
- Service Worker.
- Cache aplikasi untuk mendukung pemuatan kembali ketika jaringan mengalami gangguan.

4. Hak Akses

Pengguna Publik

- Melihat informasi perangkat yang diizinkan.
- Menggunakan QR Info dan QRScan mode informasi.
- Melihat dashboard dan informasi operasional yang tersedia untuk publik.

Admin

- Mengelola inventaris komputer dan printer.
- Mengarsipkan dan mengaktifkan kembali perangkat.
- Melakukan pencatatan maintenance.
- Mengakses pemindaian hardware.
- Menggunakan fungsi QRScan untuk pengelolaan perangkat.
- Mengelola sesi dan PIN Admin.

Validasi akses tetap harus dilakukan oleh backend, bukan hanya berdasarkan tampilan frontend.

5. Struktur Repository

techops-web/
│
├── index.html
├── api.js
├── manifest.json
├── service-worker.js
│
├── css/
│   └── style.css
│
├── js/
│   ├── app.js
│   ├── dashboard.js
│   ├── computers.js
│   ├── printers.js
│   ├── maintenance.js
│   ├── hardware-scan.js
│   └── qr-info.js
│
├── assets/
│   └── icons/
│       ├── icon-192.svg
│       └── icon-512.svg
│
├── log.ps1
└── log.sh

6. Fungsi File Utama

File| Fungsi
"index.html"| Kerangka halaman dan navigasi
"api.js"| Penghubung frontend dengan backend
"app.js"| Status aplikasi, autentikasi, pemuatan data, dan navigasi
"dashboard.js"| Tampilan dashboard
"computers.js"| Modul inventaris komputer
"printers.js"| Modul inventaris printer
"maintenance.js"| Modul maintenance
"hardware-scan.js"| Integrasi Hardware Scanner
"qr-info.js"| Informasi dan pemindaian QR
"style.css"| Tampilan dan responsivitas aplikasi
"manifest.json"| Konfigurasi PWA
"service-worker.js"| Cache aplikasi
"log.ps1"| Hardware Scanner Windows
"log.sh"| Hardware Scanner Linux

7. Pengembangan dan Pemeliharaan

- Perubahan kode frontend dikelola melalui repository GitHub.
- Backend dan database dikelola secara terpisah.
- Perubahan fitur harus mempertahankan fungsi yang sudah berjalan.
- Hindari perubahan file yang tidak berkaitan dengan pekerjaan.
- Catat perubahan pada "CHANGELOG.md".
- Catat pekerjaan mendatang pada "ROADMAP.md".

8. Keamanan

- Jangan menyimpan PIN, password, token, atau kredensial rahasia di repository.
- Jangan mencantumkan data inventaris sensitif dalam dokumentasi publik.
- Pastikan validasi hak akses dilakukan oleh backend.
- Pastikan informasi publik dan Admin memiliki pembatasan yang sesuai.

9. Dokumentasi Proyek

- "README.md" — informasi dan struktur aplikasi.
- "CHANGELOG.md" — riwayat perubahan.
- "ROADMAP.md" — rencana pengembangan dan status pekerjaan.
