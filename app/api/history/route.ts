import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getActor } from '../../../lib/permissions';

// GET /api/history?employeeId=  -> semua riwayat, terbaru dulu. Bisa difilter per karyawan.
export async function GET(req: NextRequest) {
  const actor = getActor(req);
  if (!actor) return NextResponse.json({ message: 'Belum masuk / sesi tidak valid.' }, { status: 401 });

  const employeeId = req.nextUrl.searchParams.get('employeeId');
  const history = await prisma.history.findMany({
    where: employeeId ? { employeeId: Number(employeeId) } : undefined,
    include: { employee: { select: { name: true, no: true } } },
    orderBy: { at: 'desc' },
    take: 200,
  });
  return NextResponse.json(history);
}
