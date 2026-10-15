# SDM Sekolah (prototype)

Next.js 14 (App Router) + TypeScript strict.
- **Frontend**: `app/page.tsx` (client component, satu halaman dengan beberapa "view").
- **Backend**: API routes Next.js di `app/api/**` — REST, bukan Server Actions, supaya jelas endpoint mana yang dipanggil.
- **Database**: MySQL, diakses lewat Prisma ORM (`prisma/schema.prisma`).
- **Dokumen**: file disimpan di folder lokal `storage/documents/`, metadata di tabel `Document`.

## 1. Siapkan MySQL

Next.js sendiri **tidak butuh database** — lihat penjelasan di bagian bawah. Tapi fitur di aplikasi ini (data karyawan, dokumen, riwayat, pengguna) butuh tempat penyimpanan permanen, jadi Anda perlu server MySQL yang jalan (lokal atau cloud), salah satu dari:

- **Lokal**: install MySQL / MariaDB (mis. lewat XAMPP/Laragon di Windows, atau `brew install mysql` di Mac), lalu buat database:
  ```sql
  CREATE DATABASE sdm_sekolah;
  ```
- **Docker** (tanpa install MySQL manual):
  ```
  docker run --name sdm-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=sdm_sekolah -p 3306:3306 -d mysql:8
  ```
- **Cloud** (PlanetScale, AWS RDS, Railway, dll) — tinggal pakai connection string yang mereka berikan.

## 2. Konfigurasi & migrasi

```
cp .env.example .env
# edit .env, sesuaikan DATABASE_URL dengan kredensial MySQL Anda

npm install
npm run db:migrate   # membuat/mengubah tabel sesuai prisma/schema.prisma (beri nama migrasi saat diminta)
npm run db:seed      # membuat 3 akun + mengimpor karyawan dari prisma/data/pegawai.xlsx
```

## 3. Jalankan aplikasi

```
npm run dev
```
Buka http://localhost:3000

Cek tipe TypeScript kapan saja dengan `npm run typecheck`.

## Impor data pegawai dari Excel (template Talenta)

`db:seed` membaca `prisma/data/pegawai.xlsx` (menghapus data lama lebih dulu). Untuk file Excel **berikutnya** tanpa menghapus apa pun:

```
npm run import:excel -- path/ke/file.xlsx --dry-run     # cek dulu, tidak menyimpan
npm run import:excel -- path/ke/file.xlsx               # simpan
# opsi: --unit "NAMA UNIT"  (jika file tidak punya kolom UNIT)   --status PTT  (jika status kosong)
```

- Kolom dikenali dari **nama header**, bukan urutan. Header yang **tidak dikenal** (header ekstra) tidak dibuang: disimpan apa adanya di `extraData` dan tampil di detail pegawai. Kolom `USIA` diabaikan karena bisa dihitung dari tanggal lahir.
- **NIPA = NIP**. Pegawai dicocokkan lewat NIPA (lalu NIK, lalu nama + tgl lahir), kemudian **di-update**, bukan digandakan. Sel kosong tidak menimpa data lama. Setiap perubahan tercatat di riwayat.
- **Unit** disimpan di tabel `Unit`. Unit yang belum ada otomatis ditambahkan saat impor. Nama lama dipetakan ke nama baku: TK→TKIT, SD→SDIT, SMP→SMPIT, SMA→SMAIT, Madrasah Ibtidaiyah→MI PLUS, Madrasah Tsanawiyah→MTS PLUS, **SD Cabang Sepatan→SDIT 4**, **SMP Cabang Tanah Tinggi→ASSTAQU**. Untuk menambah pemetaan, edit `UNIT_ALIASES` di `prisma/import-excel.js`.
- **Fungsi tugas** diturunkan dari kolom JABATAN, lalu BIDANG (mis. KEPSEK/WAKASEK/KADIV → Tim Manajemen, WALAS/GURU → Guru, STAFF/TU/BENDAHARA → Staf, OB/OG → Kebersihan). Yang tidak dikenali diisi NON-GURU dan ditandai di laporan.
- Data yang meragukan tidak dipaksa benar, tetapi dilaporkan: NIK bukan 16 digit dikosongkan; tanggal lahir yang tidak cocok dengan NIK atau usia saat masuk < 15 tahun diberi peringatan.
- Data keuangan (NPWP, PTKP, bank, BPJS) dan header ekstra **disembunyikan dari role Staf** oleh API.

## Akun demo (dibuat oleh db:seed)

| Role | Email | Password | Akses |
|---|---|---|---|
| Manajer SDM | manajer@sekolah.id | manajer123 | Semua fitur, termasuk kelola pengguna & hapus dokumen |
| Pelayanan SDM | pelayanan@sekolah.id | pelayanan123 | Tambah/edit, pindah, ubah status, keluarkan, unggah dokumen, laporan |
| Staf SDM | staf@sekolah.id | staf123 | Hanya lihat: dashboard, cari karyawan, riwayat, unduh dokumen |

## Struktur data karyawan

Sesuai permintaan, satu record karyawan (tabel `Employee`) memuat:
NIK, NIP, nama lengkap, jenis kelamin, tempat & tanggal lahir, alamat, no. HP, email,
pendidikan terakhir, jurusan, tanggal masuk, unit sekolah, jabatan, fungsi tugas,
status kepegawaian, tanggal perubahan status, tanggal keluar, dan alasan keluar.

## Dokumen karyawan

Tabel `Document` menyimpan metadata file yang dikaitkan ke satu karyawan, dengan jenis:
KTP, KK, Ijazah, SK, Kontrak, Surat Pengangkatan, Surat Mutasi, Surat Pengunduran Diri, Lainnya.
File asli (PDF/JPG/PNG, maks 10MB) disimpan di `storage/documents/{employeeId}/...` di server,
**bukan** di database (praktik umum — database hanya menyimpan path & metadata-nya).

## Endpoint API (ringkas)

| Endpoint | Fungsi |
|---|---|
| `POST /api/auth/login` | Masuk, mengembalikan data user (tanpa password) |
| `GET /api/employees` | Daftar karyawan + filter (`s`, `unit`, `gender`, `emp`, `fn`, `active`) |
| `POST /api/employees` | Tambah karyawan |
| `GET /api/employees/:id` | Detail karyawan + dokumen + riwayat |
| `PUT /api/employees/:id` | Ubah data pribadi/pendidikan/jabatan |
| `POST /api/employees/:id/transfer` | Pindah unit (tercatat di riwayat) |
| `POST /api/employees/:id/status` | Ubah status kepegawaian (tercatat di riwayat) |
| `POST /api/employees/:id/exit` | Keluarkan karyawan (nonaktif, data tetap ada) |
| `GET /api/employees/:id/documents` | Daftar dokumen karyawan |
| `POST /api/employees/:id/documents` | Unggah dokumen (multipart/form-data) |
| `GET /api/documents/:id` | Unduh file dokumen |
| `DELETE /api/documents/:id` | Hapus dokumen (Manajer saja) |
| `GET /api/history` | Riwayat semua perubahan |
| `GET /api/report/summary` | Rekap untuk halaman Laporan |
| `GET /api/report/csv` | Unduh laporan sebagai CSV |
| `GET /api/users` / `PATCH /api/users/:id` | Kelola pengguna (Manajer saja) |

## ⚠️ Catatan keamanan prototipe (baca sebelum dipakai serius)

Ini prototipe, bukan sistem produksi. Yang **sudah** dilakukan dengan benar:
- Password di database di-hash dengan bcrypt (tidak plain text).
- Validasi hak akses per role dilakukan di **server** (`lib/permissions.ts`), tidak hanya sembunyikan tombol di UI.

Yang **belum** aman dan wajib diperbaiki sebelum dipakai nyata:
- Tidak ada sesi/token asli. Setelah login, identitas pengguna dikirim lewat header
  (`x-user-id`, `x-user-role`) yang **dipercaya begitu saja oleh server** — siapa pun yang
  tahu cara mengubah header bisa berpura-pura jadi Manajer. Ganti dengan session/JWT
  (misalnya pakai NextAuth.js) yang ditandatangani dan diverifikasi di server.
- Tidak ada rate limiting untuk percobaan login.
- Validasi input di API masih dasar (cek field wajib, panjang NIK); tambahkan validasi
  format lebih ketat (mis. Zod) untuk email, NIK, NIP, nomor HP.
- File upload disimpan langsung di disk server; untuk skala produksi pertimbangkan
  object storage (S3-compatible) dan pemindaian antivirus.

## Next.js dan database — perlu server sendiri atau tidak?

**Next.js sendiri tidak menyediakan atau memerlukan database.** Next.js adalah framework untuk
membangun frontend *dan* backend ringan (lewat API routes / route handlers) dalam satu proyek,
tapi ia tidak "membawa" database apa pun secara built-in.

- Kalau aplikasi Anda cuma menampilkan halaman statis atau dari data dummy di kode, Next.js
  bisa berjalan tanpa database sama sekali (contoh prototipe sebelumnya, yang memakai localStorage).
- Begitu Anda butuh data yang **tersimpan permanen, konsisten, dan bisa diakses banyak
  pengguna sekaligus** (seperti sistem ini: data karyawan, dokumen, riwayat, akun pengguna),
  Anda perlu database server yang berjalan terus (MySQL, PostgreSQL, dll) — Next.js API routes
  di sini hanya bertindak sebagai jembatan: menerima request dari browser, lalu memanggil
  database lewat driver/ORM (di proyek ini: **Prisma** yang tersambung ke MySQL lewat `DATABASE_URL`).

Jadi: MySQL server-nya **harus ada dan berjalan sendiri** (di komputer Anda, Docker, atau layanan
cloud) — Next.js hanya terhubung ke sana, bukan menggantikannya. Ini juga berarti server MySQL
harus tetap menyala setiap kali aplikasi ini dipakai, tidak seperti versi awal yang memakai
localStorage di browser (jalan tanpa server tambahan, tapi datanya hanya tersimpan
per-browser dan tidak bisa dibagi antar pengguna).
