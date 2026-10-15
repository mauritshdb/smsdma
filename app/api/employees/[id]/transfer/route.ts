import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requirePerm } from '../../../../../lib/permissions';

// POST /api/employees/:id/transfer  { unit, date, note }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = requirePerm(req, 'move');
  if ('error' in guard) return guard.error;
  const id = Number(params.id);

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return NextResponse.json({ message: 'Karyawan tidak ditemukan.' }, { status: 404 });
  if (!emp.isActive) return NextResponse.json({ message: 'Karyawan sudah nonaktif.' }, { status: 400 });

  const { unit, note } = await req.json();
  if (!unit) return NextResponse.json({ message: 'Unit tujuan wajib diisi.' }, { status: 400 });
  if (unit === emp.unit) return NextResponse.json({ message: 'Unit tujuan sama dengan unit saat ini.' }, { status: 400 });

  const updated = await prisma.employee.update({ where: { id }, data: { unit } });
  await prisma.history.create({ data: { employeeId: id, type: 'TRANSFER', oldValue: emp.unit, newValue: unit, description: note || '-', by: guard.actor.name } });
  return NextResponse.json(updated);
}
