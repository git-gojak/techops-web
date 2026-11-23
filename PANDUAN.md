Panduan Penggunaan GoJak TechOps

Panduan ini menjelaskan penggunaan GoJak TechOps untuk pengguna umum dan Admin.

1. Mengenal GoJak TechOps

GoJak TechOps digunakan untuk melihat dan mengelola informasi perangkat IT, meliputi komputer, printer, serta riwayat perawatan dan perbaikan.

Menu utama:

- Dashboard — ringkasan inventaris dan aktivitas operasional.
- Inventaris Komputer — daftar dan detail komputer.
- Inventaris Printer — daftar dan detail printer.
- Maintenance — pencatatan serta riwayat perawatan dan perbaikan.
- QR Info — mencari informasi perangkat dengan QR atau serial number.
- QRScan — akses pemindaian cepat melalui navigasi HP.

2. Pengguna Umum (Tanpa Login Admin)

2.1 Membuka Dashboard

1. Buka alamat GoJak TechOps.
2. Tunggu sampai Dashboard selesai memuat data.
3. Gunakan tombol Perbarui Data untuk meminta data terbaru.
4. Gunakan menu navigasi untuk membuka halaman lain.

2.2 Melihat Inventaris Komputer

1. Buka menu Inventaris Komputer.
2. Cari perangkat melalui kolom pencarian.
3. Tekan Detail pada perangkat yang ingin dilihat.
4. Periksa informasi perangkat.
5. Tutup detail untuk kembali ke daftar.

Sebagian identitas perangkat dapat disamarkan pada mode publik.

2.3 Melihat Inventaris Printer

1. Buka menu Inventaris Printer.
2. Cari printer melalui kolom pencarian.
3. Tekan Detail.
4. Periksa informasi printer yang ditampilkan.

2.4 Menggunakan QR Info

Dengan kamera HP:

1. Buka menu QR Info.
2. Tekan Scan QR.
3. Izinkan akses kamera jika diminta.
4. Arahkan kamera belakang ke QR Code perangkat.
5. Tunggu sampai perangkat ditemukan.
6. Periksa informasi dan riwayat maintenance.

Dengan serial number:

1. Buka QR Info.
2. Masukkan serial number.
3. Jalankan pencarian.
4. Periksa hasilnya.

Jika kamera tidak terbuka, pastikan izin kamera diberikan kepada browser dan koneksi internet tersedia.

2.5 Menggunakan QRScan

1. Tekan menu QRScan di bagian tengah navigasi HP.
2. Tanpa login Admin, gunakan mode informasi perangkat.
3. Setelah Admin login, indikator QRScan berubah ke mode Admin.
4. Ikuti tindakan yang tersedia setelah QR terbaca.

3. Admin

Fungsi tambah, edit, arsip, pencatatan maintenance, dan Hardware Scanner memerlukan login Admin.

3.1 Login Admin

1. Tekan avatar GT di bagian kanan atas.
2. Masukkan PIN Admin sebanyak 6 digit.
3. Tekan Masuk.
4. Tunggu sampai status login berhasil.

Jangan membagikan PIN kepada pengguna lain.

3.2 Profil, Ganti PIN, dan Logout

1. Tekan avatar setelah login.
2. Pilih Profil Admin untuk melihat informasi akun.
3. Pilih Ganti PIN untuk mengganti PIN.
4. Pilih Keluar untuk logout.

Setelah mengganti PIN, login kembali menggunakan PIN baru. Pada perangkat bersama, selalu logout setelah selesai.

3.3 Menambah Komputer

1. Login sebagai Admin.
2. Buka Inventaris Komputer.
3. Tekan tombol Komputer.
4. Lengkapi formulir identitas dan spesifikasi.
5. Periksa Computer Name dan Asset/Serial ID.
6. Simpan dan tunggu notifikasi hasilnya.

3.4 Mengedit Komputer

1. Cari komputer.
2. Tekan Edit.
3. Perbarui informasi yang diperlukan.
4. Periksa kembali data.
5. Simpan perubahan.

Serial komputer dikunci pada formulir edit.

3.5 Mengarsipkan Komputer

1. Cari komputer yang akan diarsipkan.
2. Tekan Arsipkan.
3. Periksa perangkat yang dipilih.
4. Konfirmasikan tindakan.

Pengarsipan bukan penghapusan data.

Untuk mengaktifkan kembali, cari perangkat yang diarsipkan dan tekan Aktifkan.

3.6 Menambah Printer

1. Login sebagai Admin.
2. Buka Inventaris Printer.
3. Tekan tombol Printer.
4. Lengkapi identitas dan informasi printer.
5. Periksa serial printer.
6. Simpan.

3.7 Mengedit dan Mengarsipkan Printer

- Tekan Edit untuk memperbarui informasi printer.
- Tekan Arsipkan untuk mengeluarkan printer dari daftar aktif.
- Gunakan Aktifkan untuk mengaktifkan kembali printer yang diarsipkan.

Pengarsipan tidak menghapus data printer.

3.8 Mencatat Maintenance

1. Login sebagai Admin.
2. Buka menu Maintenance.
3. Tekan Scan QR.
4. Arahkan kamera ke QR Code komputer atau printer.
5. Pastikan perangkat yang ditemukan sudah benar.
6. Isi formulir Catat Maintenance.

Kolom formulir:

- Tanggal: tanggal kegiatan.
- Jenis Kegiatan: Perawatan atau Perbaikan.
- Jenis Kerusakan: Hardware atau Software, wajib untuk Perbaikan.
- Keterangan: uraian pekerjaan atau masalah.
- Kondisi Perangkat: Baik, Perlu Perhatian, atau Rusak.
- Refill: Ya atau Tidak.
- Penanganan: Teknisi atau Vendor.
- Jadwal Maintenance Berikutnya: dihitung otomatis jika berlaku.

Ketentuan jadwal:

- Komputer: 6 bulan.
- Printer: 3 bulan.
- Perbaikan: tidak memiliki jadwal berikutnya.

7. Periksa semua isian.
8. Tekan Simpan Maintenance.
9. Tunggu notifikasi hasil penyimpanan.

3.9 Melihat Riwayat Maintenance

1. Buka menu Maintenance.
2. Gunakan kolom pencarian untuk mencari perangkat, serial, kegiatan, atau teknisi.
3. Periksa daftar riwayat.
4. Gunakan navigasi halaman jika diperlukan.

4. Hardware Scanner

Hardware Scanner digunakan untuk membaca spesifikasi komputer yang sedang dipindai. Fitur ini hanya tersedia bagi Admin dan dijalankan dari komputer target, bukan HP.

4.1 Persiapan

- Login Admin pada browser komputer target.
- Pastikan komputer terhubung ke internet.
- Gunakan PowerShell untuk Windows atau Terminal untuk Linux.

4.2 Windows

1. Buka Inventaris Komputer.
2. Tekan Scan Spesifikasi.
3. Salin perintah Windows yang disediakan aplikasi.
4. Buka PowerShell pada komputer yang akan dipindai.
5. Tempel dan jalankan perintah.
6. Tunggu sampai Hardware Scanner aktif.
7. Kembali ke GoJak TechOps.
8. Tekan Coba Lagi jika diperlukan.

4.3 Linux

1. Buka Inventaris Komputer.
2. Tekan Scan Spesifikasi.
3. Salin perintah Linux yang disediakan aplikasi.
4. Buka Terminal pada komputer target.
5. Tempel dan jalankan perintah.
6. Tunggu sampai Hardware Scanner aktif.
7. Kembali ke aplikasi dan tekan Coba Lagi jika diperlukan.

4.4 Memeriksa Hasil Scan

1. Pastikan perangkat yang terdeteksi benar.
2. Periksa identitas dan spesifikasi komputer.
3. Periksa ringkasan perubahan data lama dan baru.
4. Lengkapi pilihan Pengguna secara manual jika diminta.
5. Simpan hanya jika seluruh data sudah benar.

Jalankan scanner hanya pada komputer yang diizinkan.

5. Tips Mengatasi Kendala

Kendala| Pemeriksaan
Dashboard tidak memuat data| Periksa internet dan tekan Perbarui Data.
Login gagal| Periksa PIN 6 digit.
Kamera tidak terbuka| Periksa izin kamera browser.
QR tidak menemukan perangkat| Periksa QR dan serial perangkat.
Tombol Edit tidak terlihat| Pastikan login Admin aktif.
Scanner tidak terhubung| Pastikan perintah dijalankan pada komputer target.
Data gagal disimpan| Periksa kolom wajib, koneksi, dan sesi Admin.

Jika masalah berlanjut, catat waktu kejadian, menu yang digunakan, dan pesan kesalahan. Jangan pernah mengirimkan PIN Admin.

6. Keamanan

- Jangan membagikan PIN Admin.
- Logout setelah menggunakan perangkat bersama.
- Periksa identitas perangkat sebelum menyimpan perubahan.
- Gunakan arsip, bukan penghapusan, jika perangkat hanya perlu dikeluarkan dari daftar aktif.
- Jalankan Hardware Scanner hanya pada komputer yang diizinkan.

7. Catatan

Panduan ini disusun berdasarkan audit kode frontend GoJak TechOps. Koneksi backend dan penyimpanan data berada pada layanan terpisah. Pengujian menyeluruh terhadap seluruh skenario backend belum dinyatakan selesai hanya berdasarkan audit frontend.

Apabila tampilan aplikasi berubah, panduan ini perlu diperbarui mengikuti versi aplikasi terbaru.
