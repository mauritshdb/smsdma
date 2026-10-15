import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requirePerm, getActor, redact } from '../../../../lib/permissions';

// GET /api/employees/:id -> detail + dokumen + riwayat (siapa saja yang login)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = getActor(req);
  if (!actor) return NextResponse.json({ message: 'Belum masuk / sesi tidak valid.' }, { status: 401 });
  const id = Number(params.id);
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { documents: { orderBy: { uploadedAt: 'desc' } }, history: { orderBy: { at: 'desc' } } },
  });
  if (!employee) return NextResponse.json({ message: 'Karyawan tidak ditemukan.' }, { status: 404 });
  return NextResponse.json(redact(employee, actor.role));
}

// PUT /api/employees/:id -> update data pribadi/pendidikan (butuh izin 'edit')
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = requirePerm(req, 'edit');
  if ('error' in guard) return guard.error;
  const id = Number(params.id);

  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ message: 'Karyawan tidak ditemukan.' }, { status: 404 });

  const body = await req.json();
  const keys = [...(body.nik ? [{ nik: body.nik }] : []), ...(body.nip ? [{ nip: body.nip }] : [])];
  const dupe = keys.length ? await prisma.employee.findFirst({ where: { id: { not: id }, OR: keys } }) : null;
  if (dupe) return NextResponse.json({ message: 'NIK atau NIP sudah dipakai karyawan lain.' }, { status: 409 });

  const updated = await prisma.employee.update({
    where: { id },
    data: {
      nik: body.nik || null, nip: body.nip || null, name: body.name, gender: body.gender,
      birthPlace: body.birthPlace || '', birthDate: body.birthDate ? new Date(body.birthDate) : null, address: body.address || '',
      phone: body.phone || null, email: body.email || null, education: body.education || null, major: body.major || null,
      unit: body.unit, position: body.position, fn: body.fn,
    },
  });
  await prisma.history.create({ data: { employeeId: id, type: 'DATA_UPDATE', oldValue: existing.name, newValue: updated.name, description: 'Data karyawan diperbarui', by: guard.actor.name } });
  return NextResponse.json(updated);
}
