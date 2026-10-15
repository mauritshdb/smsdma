// Seed: 3 akun + daftar unit + data pegawai dari prisma/data/pegawai.xlsx (lihat prisma/import-excel.js).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const path = require('path');
const { importFile, ensureUnits, printSummary, DEFAULT_UNITS } = require('./import-excel');

const prisma = new PrismaClient();

async function main() {
  console.log('Membersihkan data lama...');
  await prisma.document.deleteMany();
  await prisma.history.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.user.deleteMany();

  console.log('Membuat akun pengguna (3 role)...');
  const users = [
    { name: 'Hj. Rahmawati, S.Pd', email: 'manajer@sekolah.id', password: 'manajer123', role: 'manajer' },
    { name: 'Dewi Kartika', email: 'pelayanan@sekolah.id', password: 'pelayanan123', role: 'pelayanan' },
    { name: 'Fajar Nugroho', email: 'staf@sekolah.id', password: 'staf123', role: 'staf' },
  ];
  for (const u of users) {
    await prisma.user.create({ data: { name: u.name, email: u.email, passwordHash: await bcrypt.hash(u.password, 10), role: u.role } });
  }

  console.log('Membuat daftar unit...');
  await ensureUnits(prisma, DEFAULT_UNITS);

  console.log('Mengimpor pegawai dari Excel...');
  printSummary(await importFile(prisma, path.join(__dirname, 'data', 'pegawai.xlsx'), {}));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
