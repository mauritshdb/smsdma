import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requirePerm } from '../../../../lib/permissions';
import { EMPLOYMENT_STATUSES, FUNCTIONS } from '../../../../lib/constants';

// GET /api/report/summary -> rekap jumlah karyawan aktif per unit x status, dan per fungsi
export async function GET(req: NextRequest) {
  const guard = requirePerm(req, 'report');
  if ('error' in guard) return guard.error;

  const units = (await prisma.unit.findMany({ orderBy: { id: 'asc' } })).map((u) => u.name);
  const active = await prisma.employee.findMany({ where: { isActive: true }, select: { unit: true, employmentStatus: true, fn: true, gender: true } });

  const byUnitStatus = units.map((unit) => ({
    unit,
    counts: Object.fromEntries(EMPLOYMENT_STATUSES.map((st) => [st, active.filter((e) => e.unit === unit && e.employmentStatus === st).length])),
    total: active.filter((e) => e.unit === unit).length,
  }));
  const byFunction = FUNCTIONS.map((fn) => [fn, active.filter((e) => e.fn === fn).length]);
  const male = active.filter((e) => e.gender === 'L').length;

  return NextResponse.json({ totalActive: active.length, male, female: active.length - male, byUnitStatus, byFunction });
}
