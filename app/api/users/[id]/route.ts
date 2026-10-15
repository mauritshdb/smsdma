import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requirePerm } from '../../../../lib/permissions';

// PATCH /api/users/:id  { role?, active? } -> hanya Manajer, tidak bisa mengubah akun sendiri
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = requirePerm(req, 'users');
  if ('error' in guard) return guard.error;
  const id = Number(params.id);
  if (id === guard.actor.id) return NextResponse.json({ message: 'Tidak bisa mengubah akun Anda sendiri.' }, { status: 400 });

  const body = await req.json();
  const data: { role?: 'admin' | 'manajer' | 'pelayanan' | 'staf'; active?: boolean } = {};
  if (body.role) data.role = body.role;
  if (typeof body.active === 'boolean') data.active = body.active;

  const user = await prisma.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true, active: true } });
  return NextResponse.json(user);
}
