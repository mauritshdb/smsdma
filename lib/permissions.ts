import { NextRequest, NextResponse } from 'next/server';
import { can, type Perm, type Role } from './constants';

/**
 * PROTOTYPE: identitas pengguna dibaca dari header x-user-id / x-user-role yang
 * dikirim oleh klien setelah login (lihat lib/api.ts di sisi frontend).
 * Ini BUKAN otentikasi aman — tidak ada verifikasi token/session di server.
 * Untuk produksi, ganti dengan session/JWT (mis. NextAuth) yang divalidasi di server,
 * jangan percaya header yang dikirim klien begitu saja.
 */
export interface Actor { id: number; role: Role; name: string }

export function getActor(req: NextRequest): Actor | null {
  const id = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role') as Role | null;
  const name = req.headers.get('x-user-name');
  if (!id || !role) return null;
  return { id: Number(id), role, name: name || role };
}

export function requirePerm(req: NextRequest, perm: Perm): { actor: Actor } | { error: NextResponse } {
  const actor = getActor(req);
  if (!actor) return { error: NextResponse.json({ message: 'Belum masuk / sesi tidak valid.' }, { status: 401 }) };
  if (!can(actor.role, perm)) return { error: NextResponse.json({ message: 'Anda tidak memiliki izin untuk aksi ini.' }, { status: 403 }) };
  return { actor };
}

// Data keuangan/identitas sensitif disembunyikan dari role yang hanya boleh melihat (Staf).
const SENSITIVE = ['npwp', 'ptkpStatus', 'bankName', 'bankAccountNo', 'bankAccountName', 'bpjsEmployment', 'bpjsHealth', 'extraData'];
export function redact<T extends object>(emp: T, role: Role): T {
  if (can(role, 'edit')) return emp;
  const copy = { ...emp } as Record<string, unknown>;
  for (const k of SENSITIVE) if (k in copy) copy[k] = null;
  return copy as unknown as T;
}
