'use client';
import type { User } from './types';

const SESSION_KEY = 'sdm-me';

export function loadSession(): User | null {
  try { const s = sessionStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function saveSession(user: User) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch { /* ignore */ }
}
export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export class ApiError extends Error {}

// Mengirim identitas pengguna via header agar API bisa memeriksa hak akses (lihat lib/permissions.ts di backend).
async function authHeaders(): Promise<Record<string, string>> {
  const me = loadSession();
  if (!me) return {};
  return { 'x-user-id': String(me.id), 'x-user-role': me.role, 'x-user-name': me.name };
}

async function handle(res: Response) {
  if (!res.ok) {
    let message = `Permintaan gagal (${res.status})`;
    try { message = (await res.json()).message ?? message; } catch { /* body bukan JSON */ }
    throw new ApiError(message);
  }
  const type = res.headers.get('content-type') || '';
  return type.includes('application/json') ? res.json() : res;
}

export async function apiGet(path: string) {
  const res = await fetch(path, { headers: await authHeaders() });
  return handle(res);
}
export async function apiSend(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handle(res);
}
export async function apiUpload(path: string, form: FormData) {
  const res = await fetch(path, { method: 'POST', headers: await authHeaders(), body: form });
  return handle(res);
}
export async function apiDownload(path: string, fileName: string) {
  const res = await fetch(path, { headers: await authHeaders() });
  if (!res.ok) throw new ApiError('Gagal mengunduh file.');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
  URL.revokeObjectURL(a.href);
}
export async function login(email: string, password: string): Promise<User> {
  const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return handle(res);
}
