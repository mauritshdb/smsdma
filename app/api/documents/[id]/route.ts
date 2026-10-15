import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../../../lib/prisma';
import { requirePerm, getActor } from '../../../../lib/permissions';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'documents');

// GET /api/documents/:id -> unduh file (siapa saja yang login boleh unduh)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = getActor(req);
  if (!actor) return NextResponse.json({ message: 'Belum masuk / sesi tidak valid.' }, { status: 401 });

  const doc = await prisma.document.findUnique({ where: { id: Number(params.id) } });
  if (!doc) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 });

  const abs = path.join(STORAGE_DIR, doc.filePath);
  if (!abs.startsWith(STORAGE_DIR) || !fs.existsSync(abs)) return NextResponse.json({ message: 'File tidak ditemukan di server.' }, { status: 404 });

  const buffer = fs.readFileSync(abs);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${doc.fileName}"`,
      'Content-Length': String(doc.size),
    },
  });
}

// DELETE /api/documents/:id -> hapus dokumen (butuh izin 'documents_delete', hanya Manajer)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = requirePerm(req, 'documents_delete');
  if ('error' in guard) return guard.error;

  const doc = await prisma.document.findUnique({ where: { id: Number(params.id) } });
  if (!doc) return NextResponse.json({ message: 'Dokumen tidak ditemukan.' }, { status: 404 });

  const abs = path.join(STORAGE_DIR, doc.filePath);
  if (abs.startsWith(STORAGE_DIR) && fs.existsSync(abs)) fs.unlinkSync(abs);

  await prisma.document.delete({ where: { id: doc.id } });
  await prisma.history.create({ data: { employeeId: doc.employeeId, type: 'DOCUMENT_DELETE', oldValue: doc.type, newValue: '-', description: `Hapus dokumen: ${doc.fileName}`, by: guard.actor.name } });

  return NextResponse.json({ ok: true });
}
