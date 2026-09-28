// Dummy data + role permissions (sesuai proposal: 8 unit, 5 status, 6 fungsi, 3 role)
export const UNITS = ['TKIT','SDIT','SDIT 4 Sepatan TImur','MI Plus','SMPIT','SMPIT Quran','MTs Plus','SMAIT'];
export const STATUSES = ['PTT','PT','CAPEG-1','CAPEG-2','KONTRAK'];
export const FUNCS = ['GURU','TIM MANAJEMEN','STAF','NON-GURU','KEBERSIHAN','SATPAM'];

export const ROLES = { manajer: 'Manajer SDM', pelayanan: 'Pelayanan SDM', staf: 'Staf SDM' };
// Matriks hak akses (Bab 5.1)
export const PERMS = {
  manajer:   ['edit','move','status','exit','report','users'],
  pelayanan: ['edit','move','status','exit','report'],
  staf:      [],
};
export const can = (role, p) => PERMS[role]?.includes(p);

// Password plain hanya untuk prototype. Produksi: simpan hash (bcrypt/argon2).
export const USERS = [
  { id: 1, name: 'Sevi Yenti', email: 'manajer@sekolah.id',   password: 'manajer123',   role: 'manajer',   active: true },
  { id: 2, name: 'Agus Priyatna',        email: 'pelayanan@sekolah.id', password: 'pelayanan123', role: 'pelayanan', active: true },
  { id: 3, name: 'Annisa Nabilah',       email: 'staf@sekolah.id',      password: 'staf123',      role: 'staf',      active: true },
];

const M = ['Ahmad','Budi','Cahyo','Dedi','Eko','Fauzan','Guntur','Hendra','Irfan','Joko','Kurniawan','Lukman','Muhamad','Nanda','Oki','Rizal'];
const F = ['Aisyah','Bunga','Citra','Dina','Endang','Fitri','Gita','Hana','Intan','Jamilah','Kartini','Lestari','Maya','Novi','Putri','Rina'];
const S = ['Santoso','Wijaya','Hidayat','Pratama','Lestari','Saputra','Nasution','Rahman'];
const WEIGHT = [0,0,0,0,0,0,1,2,2,3,4,5]; // dominan GURU

const pad = (n, l = 2) => String(n).padStart(l, '0');
export function seedEmployees() {
  return Array.from({ length: 64 }, (_, i) => {
    const male = i % 2 === 0;
    const first = (male ? M : F)[(i >> 1) % 16];
    const inactive = i % 13 === 0 && i > 0;
    return {
      id: i + 1, no: `EMP-${pad(i + 1, 4)}`,
      name: `${first} ${S[(i * 3) % 8]}`, gender: male ? 'L' : 'P',
      birth: `${1975 + (i * 7) % 28}-${pad(1 + (i * 5) % 12)}-${pad(1 + (i * 11) % 28)}`,
      address: `Jl. Merdeka No. ${10 + i}, Tangerang`, phone: `0812${pad(3000000 + i * 4173, 7)}`,
      email: `${first.toLowerCase()}${i + 1}@sekolah.id`,
      unit: UNITS[(i * 3 + (i >> 2)) % 8], emp: STATUSES[(i * 7 + (i >> 3)) % 5],
      fn: FUNCS[WEIGHT[i % 12]], active: !inactive,
      join: `${2008 + (i % 17)}-${pad(1 + (i * 3) % 12)}-01`,
      exit: inactive ? '2026-06-30' : '',
    };
  });
}
export function seedHistory() {
  return [
    { id: 1, eid: 3, type: 'TRANSFER', old: 'SD', new: 'SD Cabang Sepatan', desc: 'Penyesuaian kebutuhan guru', by: 'Dewi Kartika', at: '2026-07-14 09:12' },
    { id: 2, eid: 5, type: 'STATUS_CHANGE', old: 'CAPEG-1', new: 'CAPEG-2', desc: 'Lulus evaluasi tahap 1', by: 'Hj. Rahmawati, S.Pd', at: '2026-08-02 10:30' },
    { id: 3, eid: 14, type: 'STATUS_CHANGE', old: 'KONTRAK', new: 'PT', desc: 'Diangkat menjadi pegawai tetap', by: 'Hj. Rahmawati, S.Pd', at: '2026-08-20 13:05' },
    { id: 4, eid: 27, type: 'EMPLOYEE_EXIT', old: 'Aktif', new: 'Nonaktif', desc: 'Mengundurkan diri', by: 'Dewi Kartika', at: '2026-06-30 15:40' },
  ];
}
