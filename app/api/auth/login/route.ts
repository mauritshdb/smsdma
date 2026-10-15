import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../../lib/prisma';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ message: 'Email dan password wajib diisi.' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ message: 'Email atau password salah.' }, { status: 401 });
  }
  if (!user.active) return NextResponse.json({ message: 'Akun ini nonaktif. Hubungi Manajer SDM.' }, { status: 403 });

  const { passwordHash, ...safe } = user;
  return NextResponse.json(safe);
}
