// Daftar nilai baku yang dipakai backend (validasi) dan frontend (opsi form).
// Daftar unit disimpan di database (tabel Unit) dan diambil lewat GET /api/units; unit baru otomatis ditambah saat impor Excel.

export const EMPLOYMENT_STATUSES = ['PTT', 'PT', 'CAPEG', 'CAPEG-1', 'CAPEG-2', 'CAPEG-3', 'KONTRAK'] as const;

export const FUNCTIONS = ['GURU', 'TIM MANAJEMEN', 'STAF', 'NON-GURU', 'KEBERSIHAN', 'SATPAM'] as const;

export const EDUCATION_LEVELS = ['SD', 'SMP', 'SMA', 'SMK', 'D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3'] as const;

export const DOCUMENT_TYPES = [
  'KTP', 'KK', 'IJAZAH', 'SK', 'KONTRAK',
  'SURAT_PENGANGKATAN', 'SURAT_MUTASI', 'SURAT_PENGUNDURAN_DIRI', 'LAINNYA',
] as const;

export const DOCUMENT_LABELS: Record<string, string> = {
  KTP: 'KTP', KK: 'Kartu Keluarga', IJAZAH: 'Ijazah', SK: 'SK Pengangkatan/Jabatan',
  KONTRAK: 'Kontrak Kerja', SURAT_PENGANGKATAN: 'Surat Pengangkatan',
  SURAT_MUTASI: 'Surat Mutasi', SURAT_PENGUNDURAN_DIRI: 'Surat Pengunduran Diri', LAINNYA: 'Lainnya',
};

export type Role = 'admin' | 'manajer' | 'pelayanan' | 'staf';
export type Perm = 'edit' | 'move' | 'status' | 'exit' | 'documents' | 'documents_delete' | 'report' | 'users';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin WEB',
  manajer: 'Manajer SDM',
  pelayanan: 'Pelayanan SDM',
  staf: 'Staf SDM',
};

// Matriks hak akses — Bab 5.1 proposal.
export const PERMS: Record<Role, Perm[]> = {
  admin: ['edit', 'move', 'status', 'exit', 'documents', 'documents_delete', 'report', 'users'],
  manajer: ['edit', 'move', 'status', 'exit', 'documents', 'documents_delete', 'report', 'users'],
  pelayanan: ['edit', 'move', 'status', 'exit', 'documents', 'report'],
  staf: ['documents', 'report'],
};

export const can = (role: Role, p: Perm): boolean => PERMS[role]?.includes(p) ?? false;
