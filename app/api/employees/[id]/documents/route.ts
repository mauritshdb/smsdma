import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../../../../lib/prisma';
import { requirePerm, getActor } from '../../../../../lib/permissions';
import { DOCUMENT_TYPES } from '../../../../../lib/constants';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'documents');
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// GET /api/employees/:id/documents -> daftar dokumen milik karyawan (siapa saja yang login boleh lihat)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = getActor(req);
  if (!actor) return NextResponse.json({ message: 'Belum masuk / sesi tidak valid.' }, { status: 401 });

  const documents = await prisma.document.findMany({ where: { employeeId: Number(params.id) }, orderBy: { uploadedAt: 'desc' } });
  return NextResponse.json(documents);
}

// POST /api/employees/:id/documents  (multipart/form-data: file, type) — butuh izin 'documents'
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = requirePerm(req, 'documents');
  if ('error' in guard) return guard.error;
  const employeeId = Number(params.id);

  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return NextResponse.json({ message: 'Karyawan tidak ditemukan.' }, { status: 404 });

  const form = await req.formData();
  const file = form.get('file');
  const type = String(form.get('type') || '');

  if (!(file instanceof File)) return NextResponse.json({ message: 'File wajib diunggah.' }, { status: 400 });
  if (!DOCUMENT_TYPES.includes(type as (typeof DOCUMENT_TYPES)[number])) return NextResponse.json({ message: 'Jenis dokumen tidak valid.' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ message: 'Ukuran file maksimal 10MB.' }, { status: 400 });
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'text/plain'];
  if (!allowed.includes(file.type)) return NextResponse.json({ message: 'Format file harus PDF atau gambar (JPG/PNG).' }, { status: 400 });

  const empDir = path.join(STORAGE_DIR, String(employeeId));
  fs.mkdirSync(empDir, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${type}-${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(empDir, fileName), buffer);

  const doc = await prisma.document.create({
    data: {
      employeeId, type: type as (typeof DOCUMENT_TYPES)[number], fileName: file.name,
      filePath: `${employeeId}/${fileName}`, mimeType: file.type, size: file.size, uploadedBy: guard.actor.name,
    },
  });
  await prisma.history.create({ data: { employeeId, type: 'DOCUMENT_UPLOAD', oldValue: '-', newValue: type, description: `Unggah dokumen: ${file.name}`, by: guard.actor.name } });

  return NextResponse.json(doc, { status: 201 });
}
