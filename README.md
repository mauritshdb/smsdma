# SDM Sekolah (prototype)
Next.js 14 (App Router), tanpa library tambahan. Data dummy disimpan di localStorage browser.

    npm install
    npm run dev   # http://localhost:3000

Akun demo
- Manajer SDM   : manajer@sekolah.id   / manajer123   (semua fitur + kelola pengguna)
- Pelayanan SDM : pelayanan@sekolah.id / pelayanan123 (tambah/edit, pindah, ubah status, keluarkan, laporan)
- Staf SDM      : staf@sekolah.id      / staf123      (dashboard, cari, riwayat - hanya lihat)

Reset data: hapus localStorage key `sdm-db-v1`.
Struktur data dummy: lib/data.js. Semua UI: app/page.js.
