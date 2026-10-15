import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requirePerm } from '../../../../../lib/permissions';

// POST /api/employees/:id/exit  { date, reason }
// Karyawan dinonaktifkan, data & riwayat tetap tersimpan (soft delete).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = requirePerm(req, 'exit');
  if ('error' in guard) return guard.error;
  const id = Number(params.id);

  const emp = await prisma.employee.findUnique({ where: { id } });
  if (!emp) return NextResponse.json({ message: 'Karyawan tidak ditemukan.' }, { status: 404 });
  if (!emp.isActive) return NextResponse.json({ message: 'Karyawan sudah nonaktif.' }, { status: 400 });

  const { date, reason } = await req.json();
  if (!reason) return NextResponse.json({ message: 'Alasan keluar wajib diisi.' }, { status: 400 });

  const updated = await prisma.employee.update({
    where: { id },
    data: { isActive: false, exitDate: date ? new Date(date) : new Date(), exitReason: reason },
  });
  await prisma.history.create({ data: { employeeId: id, type: 'EMPLOYEE_EXIT', oldValue: 'Aktif', newValue: 'Nonaktif', description: reason, by: guard.actor.name } });
  return NextResponse.json(updated);
}
