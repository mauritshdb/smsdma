import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/prisma';
import { requirePerm } from '../../../lib/permissions';

// GET /api/users -> daftar pengguna (hanya Manajer)
export async function GET(req: NextRequest) {
  const guard = requirePerm(req, 'users');
  if ('error' in guard) return guard.error;
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, email: true, role: true, active: true } });
  return NextResponse.json(users);
}

// POST /api/users  { name, email, password, role } -> buat akun baru (hanya Manajer)
export async function POST(req: NextRequest) {
  const guard = requirePerm(req, 'users');
  if ('error' in guard) return guard.error;

  const body = await req.json();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const bad = (message: string, status = 400) => NextResponse.json({ message }, { status });

  if (!name) return bad('Nama wajib diisi.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad('Format email tidak valid.');
  if (password.length < 8) return bad('Password minimal 8 karakter.');
  if (!['manajer', 'pelayanan', 'staf'].includes(body.role)) return bad('Role tidak valid.');
  if (await prisma.user.findUnique({ where: { email } })) return bad('Email sudah dipakai akun lain.', 409);

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10), role: body.role },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return NextResponse.json(user, { status: 201 });
}
