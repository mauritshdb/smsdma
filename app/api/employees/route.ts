import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requirePerm, getActor, redact } from '../../../lib/permissions';
import type { Prisma } from '@prisma/client';

// GET /api/employees?s=&unit=&gender=&emp=&fn=&active=Aktif|Nonaktif|Semua
// Bisa dilihat oleh siapa saja yang sudah login (termasuk role Staf, hanya melihat).
export async function GET(req: NextRequest) {
  const actor = getActor(req);
  if (!actor) return NextResponse.json({ message: 'Belum masuk / sesi tidak valid.' }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const where: Prisma.EmployeeWhereInput = {};

  const s = q.get('s');
  if (s) where.OR = [{ name: { contains: s } }, { no: { contains: s } }, { nik: { contains: s } }, { nip: { contains: s } }];
  const unit = q.get('unit'); if (unit) where.unit = unit;
  const gender = q.get('gender'); if (gender === 'L' || gender === 'P') where.gender = gender;
  const emp = q.get('emp'); if (emp) where.employmentStatus = emp;
  const fn = q.get('fn'); if (fn) where.fn = fn;
  const active = q.get('active');
  if (active === 'Aktif') where.isActive = true;
  else if (active === 'Nonaktif') where.isActive = false;
  // default 'Semua' / tidak ada -> tanpa filter isActive

  const employees = await prisma.employee.findMany({ where, orderBy: { id: 'asc' } });
  return NextResponse.json(employees.map((e) => redact(e, actor.role)));
}

// POST /api/employees  (tambah karyawan baru — butuh izin 'edit')
export async function POST(req: NextRequest) {
  const guard = requirePerm(req, 'edit');
  if ('error' in guard) return guard.error;

  const body = await req.json();
  const required = ['nip', 'name', 'gender', 'birthDate', 'joinDate', 'unit', 'position', 'fn', 'employmentStatus'];
  for (const f of required) {
    if (!body[f]) return NextResponse.json({ message: `Field "${f}" wajib diisi.` }, { status: 400 });
  }
  if (body.nik && String(body.nik).length !== 16) return NextResponse.json({ message: 'NIK harus 16 digit.' }, { status: 400 });

  const dupe = await prisma.employee.findFirst({ where: { OR: [{ nip: body.nip }, ...(body.nik ? [{ nik: body.nik }] : [])] } });
  if (dupe) return NextResponse.json({ message: 'NIK atau NIP sudah terdaftar untuk karyawan lain.' }, { status: 409 });

  const last = await prisma.employee.findFirst({ orderBy: { id: 'desc' } });
  const no = `EMP-${String((last?.id ?? 0) + 1).padStart(4, '0')}`;

  const employee = await prisma.employee.create({
    data: {
      no, nik: body.nik || null, nip: body.nip, name: body.name, gender: body.gender,
      birthPlace: body.birthPlace || '', birthDate: new Date(body.birthDate), address: body.address || '',
      phone: body.phone || null, email: body.email || null, education: body.education || null, major: body.major || null,
      joinDate: new Date(body.joinDate), unit: body.unit, position: body.position, fn: body.fn,
      employmentStatus: body.employmentStatus, statusChangeDate: new Date(body.joinDate), isActive: true,
    },
  });
  await prisma.history.create({ data: { employeeId: employee.id, type: 'EMPLOYEE_ADD', oldValue: '-', newValue: employee.unit, description: 'Karyawan baru', by: guard.actor.name } });

  return NextResponse.json(employee, { status: 201 });
}
