// Impor data pegawai dari Excel (template Talenta). CommonJS biasa agar jalan langsung dengan `node`.
// Pemakaian: npm run import:excel -- path/file.xlsx [--unit "NAMA UNIT"] [--status PTT] [--dry-run]
// - Kolom dikenali dari NAMA HEADER (bukan urutan). Header yang tidak dikenal disimpan apa adanya di `extraData`.
// - Aman diulang: dicocokkan lewat NIPA (nip), lalu NIK, lalu nama + tgl lahir -> di-update, bukan digandakan.
// - Sel kosong tidak menimpa data yang sudah ada. Unit yang belum ada otomatis ditambahkan.
const path = require('path');

const DEFAULT_UNITS = ['TKIT', 'SDIT', 'SDIT 4', 'MI PLUS', 'SMPIT', 'ASSTAQU', 'MTS PLUS', 'SMAIT', 'LPIA', 'LDSM'];
// sebutan lama / lain -> nama unit baku (SDIT 4 = SD Cabang Sepatan, ASSTAQU = SMP Cabang Tanah Tinggi)
const UNIT_ALIASES = {
  TK: 'TKIT', SD: 'SDIT', SMP: 'SMPIT', SMA: 'SMAIT', 'MADRASAH IBTIDAIYAH': 'MI PLUS', 'MADRASAH TSANAWIYAH': 'MTS PLUS',
  'SD CABANG SEPATAN': 'SDIT 4', 'SMP CABANG TANAH TINGGI': 'ASSTAQU',
};
const STATUSES = ['PTT', 'PT', 'CAPEG', 'CAPEG-1', 'CAPEG-2', 'CAPEG-3', 'KONTRAK'];
const EDU = ['SD', 'SMP', 'SMA', 'SMK', 'D1', 'D2', 'D3', 'D4', 'S1', 'S2', 'S3'];
const MARITAL = { MARRIED: 'Menikah', SINGLE: 'Belum menikah', WIDOW: 'Janda', WIDOWER: 'Duda' };

// header (dinormalisasi: huruf kecil tanpa spasi/simbol) -> field
const ALIASES = {
  name: ['namalengkap', 'nama'], nip: ['nipa', 'nip', 'nomorpegawai', 'nopegawai'], nik: ['nik', 'niknpwp16digit'],
  unit: ['unit', 'unitsekolah'], field: ['bidang'], position: ['jabatan'],
  join: ['tanggalmasuk', 'tglmasuk', 'tanggalbergabung', 'tglbergabung'], empStatus: ['statuskepegawaian'],
  email: ['email'], birthDate: ['tanggallahir', 'tgllahir'], birthPlace: ['tempatlahir'], address: ['alamat', 'alamatrumah'],
  npwp: ['npwp'], ptkp: ['statusptkp'], bankName: ['namabank'], bankNo: ['norekening', 'nomorrekening'],
  bankOwner: ['namapemilikbank', 'namapemilikrekening'], bpjsTk: ['bpjsketenagakerjaan'], bpjsKes: ['bpjskesehatan'],
  phone: ['nomorhp', 'nohp', 'notelepon', 'telepon'], gender: ['gender', 'jeniskelamin', 'jk'],
  marital: ['statusperkawinan', 'statusmenikah'], education: ['pendidikanterakhir', 'pendidikan'], major: ['jurusan'],
  active: ['status'], exit: ['tanggalkeluar', 'tglkeluar'], exitReason: ['alasankeluar'],
};
const IGNORE = ['no', 'usia']; // usia dihitung dari tanggal lahir, tidak disimpan

// fungsi tugas: dari JABATAN dulu (lebih spesifik), lalu dari BIDANG
const FN_BY_TITLE = [
  [/SATPAM|KEAMANAN/, 'SATPAM'], [/KEBERSIHAN|CLEANING/, 'KEBERSIHAN'],
  [/KEPSEK|KEPALA SEKOLAH|WAKASEK|DIREKTUR|KADIV|MANAJER|ADVISOR/, 'TIM MANAJEMEN'],
  [/GURU|WALAS|WALI KELAS|USTADZ|USTAZ|PENGAJAR/, 'GURU'],
  [/\bTU\b|TATA USAHA|STAFF?|BENDAHARA|OPERATOR|AKUNTING|HUMAS/, 'STAF'],
];
const FN_BY_FIELD = {
  GURU: 'GURU', 'OB/OG': 'KEBERSIHAN', 'MANAJEMENT UNIT': 'TIM MANAJEMEN', 'PELAYANAN UMUM': 'NON-GURU',
  TENDIK: 'STAF', KEUANGAN: 'STAF', SDM: 'STAF', PENDIDIKAN: 'STAF', YAYASAN: 'STAF', LDSM: 'STAF', 'BIRO KESEKRETARIATAN & UMUM': 'STAF',
};

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = (v) => (v == null || v instanceof Date ? '' : String(v)).replace(/\s+/g, ' ').trim();
const iso = (d) => d.toISOString().slice(0, 10);

function mapHeaders(cells) {
  return cells.map((c) => {
    const h = norm(c);
    if (!h || IGNORE.includes(h)) return null;
    for (const [key, list] of Object.entries(ALIASES)) if (list.includes(h)) return key;
    const label = clean(c);
    return label ? `x:${label}` : null; // header ekstra -> disimpan di extraData
  });
}

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const t = clean(v);
  let y, mo, d, m;
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCDate() === d && dt.getUTCMonth() === mo - 1 ? dt : null;
}

// Satu baris (sudah dipetakan ke nama field) -> data siap simpan + peringatan.
function normalizeRow(r, opts = {}) {
  const w = []; const guessed = new Set();
  const name = clean(r.name);
  if (!name) return { error: 'Nama lengkap kosong', warnings: w };

  let nik = null;
  if (r.nik !== undefined && r.nik !== '') {
    const s = typeof r.nik === 'number' ? (Number.isInteger(r.nik) ? String(r.nik) : '') : clean(r.nik).replace(/\D/g, '');
    if (/^\d{16}$/.test(s)) nik = s; else w.push(`NIK tidak valid (${r.nik}) — dikosongkan, mohon lengkapi manual`);
  }

  const birthDate = parseDate(r.birthDate);
  if (r.birthDate && !birthDate) w.push(`Tanggal lahir tidak terbaca (${clean(r.birthDate)})`);
  if (nik && birthDate) {
    let d = +nik.slice(6, 8); if (d > 40) d -= 40;
    if (d !== birthDate.getUTCDate() || +nik.slice(8, 10) !== birthDate.getUTCMonth() + 1 || +nik.slice(10, 12) !== birthDate.getUTCFullYear() % 100)
      w.push(`Tanggal lahir (${iso(birthDate)}) tidak cocok dengan tanggal di NIK — periksa`);
  }

  let gender = null; const g = clean(r.gender).toLowerCase();
  if (/^(p|perempuan|wanita|female)/.test(g)) gender = 'P';
  else if (/^(l|laki|pria|male)/.test(g)) gender = 'L';
  else if (nik) { gender = +nik.slice(6, 8) > 40 ? 'P' : 'L'; w.push('Jenis kelamin kosong — diambil dari NIK'); }
  if (!gender) return { error: 'Jenis kelamin tidak terbaca', warnings: w };

  const rawUnit = clean(r.unit);
  const unit = rawUnit ? (UNIT_ALIASES[rawUnit.toUpperCase()] || rawUnit) : opts.unit;
  if (!unit) return { error: 'Unit kosong (gunakan --unit "NAMA UNIT")', warnings: w };

  const position = clean(r.position); const field = clean(r.field);
  let fn = null;
  for (const [re, f] of FN_BY_TITLE) if (re.test(position.toUpperCase())) { fn = f; break; }
  if (!fn) fn = FN_BY_FIELD[field.toUpperCase()] || null;
  if (!fn) { fn = 'NON-GURU'; guessed.add('fn'); w.push(`Fungsi tugas tidak dikenali (jabatan "${position}", bidang "${field}") — diisi NON-GURU, mohon cek`); }

  const st = clean(r.empStatus).toUpperCase().replace(/\s+/g, '-');
  let employmentStatus = STATUSES.includes(st) ? st : null;
  if (!employmentStatus) {
    employmentStatus = opts.status || 'PTT'; guessed.add('employmentStatus');
    w.push(st ? `Status kepegawaian "${st}" tidak dikenali — diisi ${employmentStatus}` : `Status kepegawaian kosong — diisi ${employmentStatus}, mohon cek`);
  }

  let joinDate = parseDate(r.join);
  if (!joinDate) { joinDate = parseDate(new Date()); guessed.add('joinDate'); w.push('Tanggal masuk kosong/tidak terbaca — diisi hari ini'); }
  else if (birthDate && (joinDate - birthDate) / 31557600000 < 15)
    w.push(`Usia saat masuk ${((joinDate - birthDate) / 31557600000).toFixed(1)} tahun (lahir ${iso(birthDate)}, masuk ${iso(joinDate)}) — periksa tanggalnya`);

  let phone = clean(r.phone).replace(/[\s-]/g, '');
  if (/^\+?62/.test(phone)) phone = '0' + phone.replace(/^\+?62/, ''); else if (/^8/.test(phone)) phone = '0' + phone;

  let education = clean(r.education).toUpperCase() || null;
  if (education && !EDU.includes(education)) { w.push(`Pendidikan "${education}" tidak dikenali — diabaikan`); education = null; }

  const orNull = (v) => { const s = clean(v); return !s || /^not set$/i.test(s) ? null : s; };
  const s = clean(r.active).toLowerCase();
  if (r.active === undefined) guessed.add('isActive'); // tanpa kolom status, jangan ubah status aktif yang sudah ada

  const extra = {};
  for (const [k, v] of Object.entries(r)) if (k.startsWith('x:')) extra[k.slice(2)] = v instanceof Date ? iso(v) : v;

  const data = {
    name, nip: orNull(r.nip), nik, gender, birthPlace: clean(r.birthPlace), birthDate, address: clean(r.address),
    phone: phone || null, email: orNull(r.email), education, major: orNull(r.major), joinDate, unit, position: position || '-',
    field: field || null, fn, employmentStatus, maritalStatus: MARITAL[clean(r.marital).toUpperCase()] || orNull(r.marital),
    npwp: orNull(r.npwp), ptkpStatus: orNull(r.ptkp), bankName: orNull(r.bankName), bankAccountNo: orNull(r.bankNo),
    bankAccountName: orNull(r.bankOwner), bpjsEmployment: orNull(r.bpjsTk), bpjsHealth: orNull(r.bpjsKes),
    isActive: !s || (/aktif/.test(s) && !/non|tidak/.test(s)), exitDate: parseDate(r.exit), exitReason: orNull(r.exitReason),
  };
  if (Object.keys(extra).length) data.extraData = extra;
  return { data, guessed, warnings: w };
}

function plain(v) {
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return plain(v.result);
    if ('text' in v) return String(v.text);
    return '';
  }
  return v;
}

async function readWorkbook(file) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const out = [];
  wb.eachSheet((ws) => {
    let keys = null;
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      const cells = [];
      for (let c = 1; c <= row.cellCount; c++) cells.push(plain(row.getCell(c).value));
      if (!keys) { const k = mapHeaders(cells); if (k.includes('name')) keys = k; return; }
      const obj = {};
      cells.forEach((v, i) => { if (keys[i] && v !== '') obj[keys[i]] = v; });
      if (Object.keys(obj).length) out.push({ sheet: ws.name, n, obj });
    });
  });
  return out;
}

async function ensureUnits(prisma, names) {
  for (const name of names) await prisma.unit.upsert({ where: { name }, create: { name }, update: {} });
}

const sv = (x) => (x instanceof Date ? x.toISOString() : x == null ? '' : typeof x === 'object' ? JSON.stringify(x) : String(x));

async function importRows(prisma, rows, opts = {}, base = 'Excel') {
  const sum = { file: base, total: rows.length, created: 0, updated: 0, unchanged: 0, skipped: 0, unitsAdded: [], dryRun: !!opts.dryRun, warnings: [] };
  const known = new Map((await prisma.unit.findMany()).map((u) => [u.name.toLowerCase(), u.name]));
  const nos = await prisma.employee.findMany({ select: { no: true } });
  let seq = nos.reduce((m, e) => Math.max(m, parseInt(e.no.replace(/\D/g, ''), 10) || 0), 0);

  for (const { sheet, n, obj } of rows) {
    const label = `[${sheet} baris ${n}] ${clean(obj.name) || '(tanpa nama)'}`;
    try {
      const r = normalizeRow(obj, opts);
      r.warnings.forEach((x) => sum.warnings.push(`${label}: ${x}`));
      if (r.error) { sum.skipped++; sum.warnings.push(`${label}: DILEWATI — ${r.error}`); continue; }
      const { data, guessed } = r;

      const lc = data.unit.toLowerCase(); // samakan huruf besar/kecil dengan unit yang sudah ada; tambah jika belum ada
      if (known.has(lc)) data.unit = known.get(lc);
      else { known.set(lc, data.unit); sum.unitsAdded.push(data.unit); if (!opts.dryRun) await prisma.unit.create({ data: { name: data.unit } }); }

      let found = data.nip ? await prisma.employee.findUnique({ where: { nip: data.nip } }) : null;
      if (!found && data.nik) found = await prisma.employee.findUnique({ where: { nik: data.nik } });
      if (!found && !data.nip && !data.nik)
        found = await prisma.employee.findFirst({ where: { name: data.name, ...(data.birthDate ? { birthDate: data.birthDate } : {}) } });

      if (found) {
        const upd = {};
        for (const [k, v] of Object.entries(data)) {
          if (guessed.has(k)) continue; // nilai tebakan tidak boleh menimpa data yang sudah ada
          if (k !== 'isActive' && (v === null || v === '' || v === undefined)) continue; // sel kosong tidak menghapus data
          if (sv(found[k]) !== sv(v)) upd[k] = v;
        }
        if (!Object.keys(upd).length) { sum.unchanged++; continue; }
        if (!opts.dryRun) {
          await prisma.employee.update({ where: { id: found.id }, data: upd });
          await prisma.history.create({ data: { employeeId: found.id, type: 'DATA_UPDATE', oldValue: '-', newValue: '-', description: `Diperbarui dari Excel (${base}): ${Object.keys(upd).join(', ')}`, by: 'Impor Excel' } });
        }
        sum.updated++;
      } else {
        seq++;
        if (!opts.dryRun) {
          const e = await prisma.employee.create({ data: { ...data, no: `EMP-${String(seq).padStart(4, '0')}`, statusChangeDate: data.joinDate } });
          await prisma.history.create({ data: { employeeId: e.id, type: 'EMPLOYEE_ADD', oldValue: '-', newValue: e.unit, description: `Impor dari Excel (${base})`, by: 'Impor Excel' } });
        }
        sum.created++;
      }
    } catch (e) {
      sum.skipped++; sum.warnings.push(`${label}: DILEWATI — ${e.message.split('\n').filter(Boolean).pop()}`);
    }
  }
  return sum;
}

async function importFile(prisma, file, opts = {}) {
  return importRows(prisma, await readWorkbook(file), opts, path.basename(file));
}

function printSummary(s) {
  console.log(`\nImpor ${s.file}${s.dryRun ? ' (DRY RUN — tidak ada yang disimpan)' : ''}`);
  console.log(`  baris data: ${s.total} | baru: ${s.created} | diperbarui: ${s.updated} | tidak berubah: ${s.unchanged} | dilewati: ${s.skipped}`);
  if (s.unitsAdded.length) console.log(`  unit baru ditambahkan: ${s.unitsAdded.join(', ')}`);
  if (s.warnings.length) { console.log(`\nPerlu dicek (${s.warnings.length}):`); s.warnings.forEach((x) => console.log('  - ' + x)); }
}

module.exports = { importFile, importRows, ensureUnits, normalizeRow, mapHeaders, printSummary, DEFAULT_UNITS };

if (require.main === module) {
  const args = process.argv.slice(2); const opts = {}; let file = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--unit') opts.unit = args[++i];
    else if (args[i] === '--status') opts.status = args[++i];
    else file = args[i];
  }
  if (!file) { console.error('Pemakaian: npm run import:excel -- <file.xlsx> [--unit "NAMA UNIT"] [--status PTT] [--dry-run]'); process.exit(1); }
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  importFile(prisma, path.resolve(file), opts).then(printSummary)
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
