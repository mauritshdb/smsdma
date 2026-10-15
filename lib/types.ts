// Tipe data sisi klien — cocok dengan bentuk JSON yang dikembalikan API (tanggal sebagai string ISO).
import type { Role } from './constants';

export interface User { id: number; name: string; email: string; role: Role; active: boolean }

export interface Employee {
  id: number; no: string;
  nik: string | null; nip: string | null; name: string; gender: 'L' | 'P';
  birthPlace: string; birthDate: string | null; address: string; phone: string | null; email: string | null;
  education: string | null; major: string | null;
  maritalStatus?: string | null; field?: string | null; npwp?: string | null; ptkpStatus?: string | null;
  bankName?: string | null; bankAccountNo?: string | null; bankAccountName?: string | null;
  bpjsEmployment?: string | null; bpjsHealth?: string | null; extraData?: Record<string, string | number> | null;
  joinDate: string; unit: string; position: string; fn: string;
  employmentStatus: string; statusChangeDate: string | null;
  exitDate: string | null; exitReason: string | null;
  isActive: boolean;
  documents?: DocumentMeta[];
  history?: HistoryEntry[];
}

export interface DocumentMeta {
  id: number; employeeId: number; type: string; fileName: string;
  mimeType: string; size: number; uploadedBy: string; uploadedAt: string;
}

export interface HistoryEntry {
  id: number; employeeId: number; type: string; oldValue: string; newValue: string;
  description: string; by: string; at: string;
  employee?: { name: string; no: string };
}

export interface ReportSummary {
  totalActive: number; male: number; female: number;
  byUnitStatus: { unit: string; counts: Record<string, number>; total: number }[];
  byFunction: [string, number][];
}
