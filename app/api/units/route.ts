import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getActor } from '../../../lib/permissions';

// GET /api/units -> daftar nama unit (siapa saja yang login)
export async function GET(req: NextRequest) {
  if (!getActor(req)) return NextResponse.json({ message: 'Belum masuk / sesi tidak valid.' }, { status: 401 });
  const units = await prisma.unit.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json(units.map((u) => u.name));
}
