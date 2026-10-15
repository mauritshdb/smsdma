import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requirePerm } from '../../../../lib/permissions';
import type { Prisma } from '@prisma/client';

// GET /api/report/csv?s=&unit=&gender=&emp=&fn=&active=  -> unduh CSV mengikuti filter yang sama dengan halaman Karyawan
export async function GET(req: NextRequest) {
  const guard = requirePerm(req, 'report');
  if ('error' in guard) return guard.error;

  const q = req.nextUrl.searchParams;
  const where: Prisma.EmployeeWhereInput = {};
  const s = q.get('s'); if (s) where.OR = [{ name: { contains: s } }, { no: { contains: s } }];
  const unit = q.get('unit'); if (unit) where.unit = unit;
  const gender = q.get('gender'); if (gender === 'L' || gender === 'P') where.gender = gender;
  const emp = q.get('emp'); if (emp) where.employmentStatus = emp;
  const fn = q.get('fn'); if (fn) where.fn = fn;
  const active = q.get('active');
  if (active === 'Aktif') where.isActive = true;
  else if (active === 'Nonaktif') where.isActive = false;

  const rows = await prisma.employee.findMany({ where, orderBy: { id: 'asc' } });
  const header = ['NIK', 'NIP', 'Nama', 'JK', 'Tempat Lahir', 'Tgl Lahir', 'Pendidikan', 'Jurusan', 'Unit', 'Jabatan', 'Fungsi', 'Status', 'Tgl Masuk', 'Aktif', 'Tgl Keluar', 'Alasan Keluar'];
  const csvRows = rows.map((e) => [
    e.nik ?? '', e.nip ?? '', e.name, e.gender, e.birthPlace, e.birthDate ? e.birthDate.toISOString().slice(0, 10) : '',
    e.education ?? '', e.major ?? '', e.unit, e.position, e.fn, e.employmentStatus,
    e.joinDate.toISOString().slice(0, 10), e.isActive ? 'Aktif' : 'Nonaktif',
    e.exitDate ? e.exitDate.toISOString().slice(0, 10) : '', e.exitReason ?? '',
  ]);
  const csv = [header, ...csvRows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="laporan-karyawan.csv"' },
  });
}
