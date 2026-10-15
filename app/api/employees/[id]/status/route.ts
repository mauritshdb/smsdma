import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requirePerm } from '../../../../../lib/permissions';

// POST /api/employees/:id/status  { employmentStatus, date, note }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = requirePerm(req, 'status');
  if ('error' in guard) return guard.error;
  const id = Number(params.id);

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return NextResponse.json({ message: 'Karyawan tidak ditemukan.' }, { status: 404 });
  if (!emp.isActive) return NextResponse.json({ message: 'Karyawan sudah nonaktif.' }, { status: 400 });

  const { employmentStatus, date, note } = await req.json();
  if (!employmentStatus) return NextResponse.json({ message: 'Status baru wajib diisi.' }, { status: 400 });
  if (employmentStatus === emp.employmentStatus) return NextResponse.json({ message: 'Status baru sama dengan status saat ini.' }, { status: 400 });

  const updated = await prisma.employee.update({
    where: { id },
    data: { employmentStatus, statusChangeDate: date ? new Date(date) : new Date() },
  });
  await prisma.history.create({ data: { employeeId: id, type: 'STATUS_CHANGE', oldValue: emp.employmentStatus, newValue: employmentStatus, description: note || '-', by: guard.actor.name } });
  return NextResponse.json(updated);
}
