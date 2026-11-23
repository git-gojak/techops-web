Roadmap — GoJak TechOps

Dokumen ini berisi status fitur yang sudah ditemukan pada kode repository dan rencana pengembangan berikutnya.

Keterangan Status

- "[x]" Fitur atau komponen sudah ditemukan pada kode repository.
- "[ ]" Pengembangan belum diterapkan atau masih menunggu pekerjaan dan pengujian.

Tanda selesai menunjukkan keberadaan implementasi pada frontend, bukan jaminan bahwa seluruh alur backend sudah diuji.

---

1. Dashboard

- [x] Ringkasan inventaris komputer.
- [x] Ringkasan inventaris printer.
- [x] Ringkasan total maintenance.
- [x] Informasi koneksi backend.
- [x] Monitoring perangkat berdasarkan unit.
- [x] Monitoring kondisi komputer dan printer.
- [x] Monitoring jadwal maintenance.
- [x] Aktivitas maintenance terbaru.
- [x] Informasi perangkat arsip.
- [ ] Mengganti kartu Aktivitas Maintenance Terbaru menjadi Notifikasi Sistem.
- [ ] Menampilkan lima aktivitas terbaru gabungan komputer dan printer.
- [ ] Menyempurnakan urutan aktivitas berdasarkan Waktu Dibuat.
- [ ] Menambahkan ikon pembeda komputer dan printer pada Notifikasi Sistem.

2. Inventaris Komputer

- [x] Menampilkan data komputer.
- [x] Pencarian dan detail perangkat.
- [x] Penambahan dan perubahan data.
- [x] Pengarsipan perangkat.
- [x] Pengaktifan kembali perangkat arsip.
- [x] Masking identitas perangkat untuk pengguna publik.
- [x] Integrasi Hardware Scanner.
- [ ] Audit dan pengujian menyeluruh proses perubahan inventaris.

3. Inventaris Printer

- [x] Menampilkan data printer.
- [x] Pencarian dan detail perangkat.
- [x] Penambahan dan perubahan data.
- [x] Pengarsipan perangkat.
- [x] Pengaktifan kembali perangkat arsip.
- [x] Informasi tinta dan FTP/masa penggunaan.
- [ ] Audit dan pengujian menyeluruh proses perubahan inventaris.

4. Maintenance

- [x] Pencatatan perawatan.
- [x] Pencatatan perbaikan.
- [x] Pencatatan komputer dan printer.
- [x] Pencatatan kondisi perangkat.
- [x] Pilihan jenis kerusakan Hardware dan Software.
- [x] Pilihan penanganan Teknisi dan Vendor.
- [x] Perhitungan jadwal maintenance berikutnya.
- [x] Riwayat maintenance.
- [ ] Penyempurnaan tampilan riwayat dan pengalaman penggunaan mobile.

5. QR Info dan QRScan

- [x] Pencarian perangkat berdasarkan serial.
- [x] Pemindaian QR menggunakan kamera.
- [x] Informasi komputer.
- [x] Informasi printer.
- [x] Riwayat maintenance perangkat.
- [x] Mode informasi publik.
- [x] Mode Admin melalui navigasi QRScan.
- [ ] Penyempurnaan dan pengujian pengalaman pemindaian QR pada berbagai perangkat mobile.

6. Hardware Scanner

- [x] Hardware Scanner Windows.
- [x] Hardware Scanner Linux.
- [x] Pembacaan spesifikasi perangkat.
- [x] Pencocokan berdasarkan Asset/Serial ID.
- [x] Perbandingan data lama dan hasil pemindaian.
- [x] Ringkasan perubahan sebelum penyimpanan.
- [x] Pengisian Pengguna sebelum penyimpanan.
- [x] Pengiriman data melalui API "hardwareScan.save".
- [ ] Pengujian menyeluruh pada berbagai model komputer Windows dan Linux.
- [ ] Audit penanganan kegagalan koneksi scanner lokal.

7. Autentikasi dan Keamanan

- [x] Login Admin dengan PIN.
- [x] Profil Admin.
- [x] Ganti PIN.
- [x] Logout.
- [x] Penyimpanan sesi menggunakan "localStorage".
- [x] Sinkronisasi status autentikasi antar-tab pada frontend.
- [x] Masking identitas perangkat untuk pengguna publik.
- [ ] Pengujian login, logout, dan pemulihan sesi antar-tab.
- [ ] Audit keamanan autentikasi pada backend.
- [ ] Audit hak akses setiap API.

8. PWA dan Infrastruktur

- [x] Web App Manifest.
- [x] Service Worker.
- [x] Cache aplikasi.
- [ ] Pengujian menyeluruh mode offline.
- [ ] Penyempurnaan strategi pembaruan cache setelah deployment.

9. Dokumentasi dan Pemeliharaan Proyek

- [x] README.md.
- [x] CHANGELOG.md.
- [x] ROADMAP.md.
- [ ] Dokumentasi backend Google Apps Script.
- [ ] Dokumentasi struktur database Google Sheets.
- [ ] Dokumentasi daftar endpoint API.
- [ ] Dokumentasi prosedur backup dan pemulihan data.
- [ ] Pembaruan changelog setiap ada commit fitur atau perbaikan.

---

Prinsip Pengembangan

1. Mempertahankan fungsi yang sudah berjalan.
2. Tidak menghapus atau mengganti fitur tanpa persetujuan.
3. Menghindari perubahan yang tidak berkaitan dengan pekerjaan.
4. Memisahkan perubahan frontend, backend, dan database.
5. Memastikan hak akses publik dan Admin tetap terjaga.
6. Melakukan pengujian sebelum pekerjaan dinyatakan selesai.
7. Memperbarui dokumentasi sesuai perubahan aktual.
