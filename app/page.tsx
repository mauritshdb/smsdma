'use client';
import { useRef } from 'react';
import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import {
  EMPLOYMENT_STATUSES, FUNCTIONS, EDUCATION_LEVELS, DOCUMENT_TYPES, DOCUMENT_LABELS, ROLE_LABELS, can, type Role,
} from '../lib/constants';
import { apiGet, apiSend, apiUpload, apiDownload, login, loadSession, saveSession, clearSession, ApiError } from '../lib/api';
import type { Employee, DocumentMeta, HistoryEntry, ReportSummary, User } from '../lib/types';

type Form = Record<string, string>;
const TYPE_LABEL: Record<string, string> = {
  TRANSFER: 'Pindah unit', STATUS_CHANGE: 'Ubah status', EMPLOYEE_EXIT: 'Keluar', DATA_UPDATE: 'Ubah data',
  EMPLOYEE_ADD: 'Tambah', DOCUMENT_UPLOAD: 'Unggah dokumen', DOCUMENT_DELETE: 'Hapus dokumen',
};
const DEMO = [
  { label: 'Admin Web', email: 'maurits@assta.sch', password: 'admin' },
  { label: 'Manajer SDM', email: 'seviyenti@asy-syukriyyah.sch.id', password: 'manajer123' },
  { label: 'Pelayanan SDM', email: 'agus.priyatna@asy-syukriyyah.sch.id', password: 'pelayanan123' },
  { label: 'Staf SDM', email: 'annisa.nabilah@asy-syukriyyah.sch.id', password: 'staf123' },
];

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (s?: string | null) => (s ? s.slice(0, 10) : '-');
const fmtDT = (s?: string | null) => (s ? s.replace('T', ' ').slice(0, 16) : '-');
const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const count = (list: Employee[], key: 'unit' | 'employmentStatus' | 'fn', opts: readonly string[]): [string, number][] =>
  opts.map((o) => [o, list.filter((e) => e[key] === o).length]);

function Bars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <>{rows.map(([l, n]) => (
      <div className="bar" key={l}><span>{l}</span><div className="trk"><div className="fill" style={{ width: `${(n / max) * 100}%` }} /></div><b>{n}</b></div>
    ))}</>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="fld">{label}{children}</label>; }
function Sel({ name, opts, def, blank }: { name: string; opts: readonly string[]; def?: string; blank?: boolean }) {
  return <select className="in" name={name} defaultValue={def ?? (blank ? '' : undefined)}>{blank && <option value="">— belum diisi —</option>}{opts.map((o) => <option key={o}>{o}</option>)}</select>;
}
function Modal({ title, onClose, onSubmit, okLabel = 'Simpan', danger, busy, children }: {
  title: string; onClose: () => void; onSubmit?: (f: Form) => void; okLabel?: string; danger?: boolean; busy?: boolean; children: ReactNode;
}) {
  return (
    <div className="ov" onClick={onClose}>
      <form className="md" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); onSubmit?.(Object.fromEntries(new FormData(e.currentTarget)) as Form); }}>
        <h2>{title}</h2>{children}
        <div className="row"><button type="button" className="btn" onClick={onClose}>Batal</button>
          {onSubmit && <button className={`btn ${danger ? 'd' : 'p'}`} disabled={busy}>{busy ? 'Menyimpan...' : okLabel}</button>}</div>
      </form>
    </div>
  );
}

function EmpForm({ e = {}, mode, units }: { e?: Partial<Employee>; mode: 'add' | 'edit'; units: string[] }) {
  return (<>
    <div className="two">
      <Field label="NIK (16 digit, opsional)"><input className="in" name="nik" defaultValue={e.nik ?? ''} minLength={16} maxLength={16} pattern="[0-9]{16}" /></Field>
      <Field label="NIP / Nomor pegawai"><input className="in" name="nip" defaultValue={e.nip ?? ''} required /></Field>
      <Field label="Nama lengkap"><input className="in" name="name" defaultValue={e.name} required /></Field>
      <Field label="Jenis kelamin"><select className="in" name="gender" defaultValue={e.gender || 'L'}><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></Field>
      <Field label="Tempat lahir"><input className="in" name="birthPlace" defaultValue={e.birthPlace} /></Field>
      <Field label="Tanggal lahir"><input className="in" type="date" name="birthDate" defaultValue={fmt(e.birthDate) === '-' ? '' : fmt(e.birthDate)} required /></Field>
      <Field label="Nomor HP"><input className="in" name="phone" defaultValue={e.phone ?? ''} /></Field>
      <Field label="Email"><input className="in" type="email" name="email" defaultValue={e.email ?? ''} /></Field>
      <Field label="Pendidikan terakhir"><Sel name="education" opts={EDUCATION_LEVELS} def={e.education ?? undefined} blank /></Field>
      <Field label="Jurusan (opsional)"><input className="in" name="major" defaultValue={e.major || ''} /></Field>
      <Field label="Unit sekolah"><Sel name="unit" opts={units} def={e.unit} /></Field>
      <Field label="Jabatan"><input className="in" name="position" defaultValue={e.position} placeholder="mis. Guru Kelas 3A" required /></Field>
      <Field label="Fungsi tugas"><Sel name="fn" opts={FUNCTIONS} def={e.fn} /></Field>
      {mode === 'add' && <>
        <Field label="Status kepegawaian"><Sel name="employmentStatus" opts={EMPLOYMENT_STATUSES} def={e.employmentStatus} /></Field>
        <Field label="Tanggal masuk"><input className="in" type="date" name="joinDate" defaultValue={today()} required /></Field>
      </>}
    </div>
    <Field label="Alamat"><input className="in" name="address" defaultValue={e.address} /></Field>
    {mode === 'edit' && <p className="mut" style={{ margin: 0 }}>Unit di sini hanya untuk perbaikan data. Gunakan aksi &quot;Pindah&quot; agar tercatat di riwayat mutasi.</p>}
  </>);
}

function DetailModal({ employee, me, onClose, notify, onChanged }: {
  employee: Employee; me: User; onClose: () => void; notify: (m: string, bad?: boolean) => void; onChanged: () => void;
}) {
  const [emp, setEmp] = useState(employee);
  const [docType, setDocType] = useState<string>(DOCUMENT_TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const canDoc = can(me.role, 'documents');
  const canDelDoc = can(me.role, 'documents_delete');

  async function refresh() {
    try { setEmp(await apiGet(`/api/employees/${emp.id}`)); } catch { /* biarkan data lama jika gagal refresh */ }
  }
  async function upload(ev: FormEvent) {
    ev.preventDefault();
    if (!file) return notify('Pilih file terlebih dahulu.', true);
    setBusy(true);
    try {
      const form = new FormData(); form.append('file', file); form.append('type', docType);
      await apiUpload(`/api/employees/${emp.id}/documents`, form);
      setFile(null); notify('Dokumen berhasil diunggah.'); await refresh();
    } catch (err) { notify(errMsg(err, 'Gagal mengunggah dokumen.'), true); }
    setBusy(false);
  }
  async function remove(id: number) {
    if (!confirm('Hapus dokumen ini? Tindakan ini tidak dapat dibatalkan.')) return;
    try { await apiSend(`/api/documents/${id}`, 'DELETE'); notify('Dokumen dihapus.'); await refresh(); }
    catch (err) { notify(errMsg(err, 'Gagal menghapus dokumen.'), true); }
  }
  async function download(d: DocumentMeta) {
    try { await apiDownload(`/api/documents/${d.id}`, d.fileName); } catch { notify('Gagal mengunduh dokumen.', true); }
  }

  const rows: [string, string][] = [
    ['No. Induk', emp.no], ['NIK', emp.nik || '-'], ['NIP', emp.nip || '-'], ['Jenis kelamin', emp.gender === 'L' ? 'Laki-laki' : 'Perempuan'],
    ['Tempat, Tgl Lahir', [emp.birthPlace, fmt(emp.birthDate)].filter(Boolean).join(', ')], ['Telepon', emp.phone || '-'], ['Email', emp.email || '-'],
    ['Alamat', emp.address || '-'], ['Status perkawinan', emp.maritalStatus || '-'], ['Bidang', emp.field || '-'],
    ['NPWP', emp.npwp || '-'], ['Status PTKP', emp.ptkpStatus || '-'],
    ['Bank', [emp.bankName, emp.bankAccountNo].filter(Boolean).join(' · ') || '-'], ['Atas nama', emp.bankAccountName || '-'],
    ['BPJS Ketenagakerjaan', emp.bpjsEmployment || '-'], ['BPJS Kesehatan', emp.bpjsHealth || '-'],
    ['Pendidikan', emp.education || '-'], ['Jurusan', emp.major || '-'], ['Unit', emp.unit], ['Jabatan', emp.position],
    ['Fungsi tugas', emp.fn], ['Status kepegawaian', emp.employmentStatus], ['Tgl perubahan status', fmt(emp.statusChangeDate)],
    ['Tgl masuk', fmt(emp.joinDate)], ['Tgl keluar', fmt(emp.exitDate)], ['Alasan keluar', emp.exitReason || '-'],
  ];

  return (
    <div className="ov" onClick={onClose}>
      <div className="md" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <h2>{emp.name} {!emp.isActive && <span className="tag off">Nonaktif</span>}</h2>
        <div className="two mut">{rows.map(([k, v]) => <div key={k}>{k}<br /><b style={{ color: 'var(--ink)' }}>{v}</b></div>)}</div>
        {emp.extraData && Object.keys(emp.extraData).length ? <div className="mut">Data tambahan: {Object.entries(emp.extraData).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div> : null}

        <div>
          <h2>Dokumen</h2>
          {emp.documents?.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table><thead><tr><th>Jenis</th><th>Nama file</th><th>Ukuran</th><th>Diunggah</th><th></th></tr></thead>
                <tbody>{emp.documents.map((d) => (
                  <tr key={d.id}>
                    <td>{DOCUMENT_LABELS[d.type] || d.type}</td><td>{d.fileName}</td><td>{fmtSize(d.size)}</td>
                    <td>{fmtDT(d.uploadedAt)}<br /><span className="mut">{d.uploadedBy}</span></td>
                    <td><div className="act">
                      <button className="btn s" type="button" onClick={() => download(d)}>Unduh</button>
                      {canDelDoc && <button className="btn s d" type="button" onClick={() => remove(d.id)}>Hapus</button>}
                    </div></td>
                  </tr>))}</tbody></table>
            </div>
          ) : <p className="mut">Belum ada dokumen.</p>}

          {canDoc && (
            <form onSubmit={upload} className="two" style={{ marginTop: 10 }}>
              <Field label="Jenis dokumen">
                <select className="in" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_LABELS[t]}</option>)}
                </select>
              </Field>
              <Field label="File (PDF/JPG/PNG, maks 10MB)">
                <input className="in" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </Field>
              <button className="btn p" disabled={busy} style={{ gridColumn: '1/-1' }}>{busy ? 'Mengunggah...' : 'Unggah dokumen'}</button>
            </form>
          )}
        </div>

        <div>
          <h2>Riwayat</h2>
          {emp.history?.length
            ? emp.history.map((h) => (
              <div className="tl" key={h.id}>
                <span className="tag">{TYPE_LABEL[h.type] || h.type}</span> {h.oldValue} → {h.newValue}
                <br /><span className="mut">{fmtDT(h.at)} · {h.by} · {h.description}</span>
              </div>))
            : <p className="mut">Belum ada riwayat.</p>}
        </div>

        <div className="row"><button type="button" className="btn" onClick={() => { onChanged(); onClose(); }}>Tutup</button></div>
      </div>
    </div>
  );
}

function Login({ onLogin, err, busy }: { onLogin: (email: string, password: string) => void; err: string; busy: boolean }) {
  const [em, setEm] = useState(''); const [pw, setPw] = useState('');
  return (
    <div className="login">
      <form className="card" onSubmit={(e) => { e.preventDefault(); onLogin(em, pw); }}>
        <div className="brand" style={{ color: 'var(--ink)', padding: 0 }}><div className="logo">S</div>SDM Sekolah</div>
        <h1>Masuk</h1>
        <Field label="Email"><input className="in" type="email" value={em} onChange={(e) => setEm(e.target.value)} required /></Field>
        <Field label="Password"><input className="in" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required /></Field>
        {err && <div className="tag off" role="alert">{err}</div>}
        <button className="btn p" disabled={busy}>{busy ? 'Memeriksa...' : 'Masuk'}</button>
        <div className="demo"><span className="mut">Akun demo (klik untuk mengisi):</span>
          {DEMO.map((u) => <button type="button" className="btn" key={u.email} onClick={() => { setEm(u.email); setPw(u.password); }}>{u.label} · {u.email}</button>)}</div>
      </form>
    </div>
  );
}

export default function App() {
  const [me, setMe] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [loginErr, setLoginErr] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [view, setView] = useState('dashboard');
  const [modal, setModal] = useState<ReactNode>(null);
  const [toast, setToast] = useState<{ msg: string; bad?: boolean } | null>(null);
  const [q, setQ] = useState<Record<string, string>>({ s: '', unit: '', gender: '', emp: '', fn: '', active: 'Aktif' });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [dashboardActive, setDashboardActive] = useState<Employee[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<string[]>([]);

  useEffect(() => { setMe(loadSession()); setBooting(false); }, []);
  useEffect(() => { if (me) apiGet('/api/units').then(setUnits).catch(() => {}); }, [me]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); } }, [toast]);
  const notify = (msg: string, bad?: boolean) => setToast({ msg, bad });

  useEffect(() => {
    if (!me || view !== 'employees') return;
    const t = setTimeout(loadEmployees, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, view, q]);
  useEffect(() => { if (me && view === 'dashboard') loadDashboard(); }, [me, view]);
  useEffect(() => { if (me && view === 'history') loadHistory(); }, [me, view]);
  useEffect(() => { if (me && view === 'report') loadReport(); }, [me, view]);
  useEffect(() => { if (me && view === 'users') loadUsers(); }, [me, view]);

  function buildParams() {
    const p = new URLSearchParams();
    if (q.s) p.set('s', q.s); if (q.unit) p.set('unit', q.unit); if (q.gender) p.set('gender', q.gender);
    if (q.emp) p.set('emp', q.emp); if (q.fn) p.set('fn', q.fn); p.set('active', q.active);
    return p;
  }
  async function loadEmployees() {
    setLoadingList(true);
    try { setEmployees(await apiGet(`/api/employees?${buildParams()}`)); }
    catch (e) { notify(errMsg(e, 'Gagal memuat data karyawan.'), true); }
    setLoadingList(false);
  }
  async function loadDashboard() {
    try { setDashboardActive(await apiGet('/api/employees?active=Aktif')); }
    catch (e) { notify(errMsg(e, 'Gagal memuat dashboard.'), true); }
  }
  async function loadHistory() {
    try { setHistory(await apiGet('/api/history')); }
    catch (e) { notify(errMsg(e, 'Gagal memuat riwayat.'), true); }
  }
  async function loadReport() {
    try { setReport(await apiGet('/api/report/summary')); }
    catch (e) { notify(errMsg(e, 'Gagal memuat laporan.'), true); }
  }
  async function loadUsers() {
    try { setUsers(await apiGet('/api/users')); }
    catch (e) { notify(errMsg(e, 'Gagal memuat pengguna.'), true); }
  }

  async function doLogin(email: string, password: string) {
    setLoginBusy(true); setLoginErr('');
    try { const user = await login(email, password); saveSession(user); setMe(user); setView('dashboard'); }
    catch (e) { setLoginErr(errMsg(e, 'Gagal masuk. Periksa koneksi ke server.')); }
    setLoginBusy(false);
  }
  function logout() { clearSession(); setMe(null); }

  async function submitAdd(f: Form) {
    try { await apiSend('/api/employees', 'POST', f); setModal(null); notify('Karyawan berhasil ditambahkan.'); loadEmployees(); }
    catch (e) { notify(errMsg(e, 'Gagal menambahkan karyawan.'), true); }
  }
  async function submitEdit(id: number, f: Form) {
    try { await apiSend(`/api/employees/${id}`, 'PUT', f); setModal(null); notify('Data karyawan diperbarui.'); loadEmployees(); }
    catch (e) { notify(errMsg(e, 'Gagal memperbarui data.'), true); }
  }
  async function submitMove(e: Employee, f: Form) {
    try { await apiSend(`/api/employees/${e.id}/transfer`, 'POST', f); setModal(null); notify('Karyawan berhasil dipindahkan.'); loadEmployees(); }
    catch (err) { notify(errMsg(err, 'Gagal memindahkan karyawan.'), true); }
  }
  async function submitStatus(e: Employee, f: Form) {
    try { await apiSend(`/api/employees/${e.id}/status`, 'POST', f); setModal(null); notify('Status kepegawaian diubah.'); loadEmployees(); }
    catch (err) { notify(errMsg(err, 'Gagal mengubah status.'), true); }
  }
  async function submitExit(e: Employee, f: Form) {
    try { await apiSend(`/api/employees/${e.id}/exit`, 'POST', f); setModal(null); notify('Karyawan dikeluarkan (data tetap tersimpan).'); loadEmployees(); }
    catch (err) { notify(errMsg(err, 'Gagal mengeluarkan karyawan.'), true); }
  }
  async function toggleRole(u: User, role: string) {
    try { await apiSend(`/api/users/${u.id}`, 'PATCH', { role }); notify('Role diperbarui.'); loadUsers(); }
    catch (e) { notify(errMsg(e, 'Gagal memperbarui role.'), true); }
  }
  async function toggleActive(u: User) {
    try { await apiSend(`/api/users/${u.id}`, 'PATCH', { active: !u.active }); notify('Status akun diperbarui.'); loadUsers(); }
    catch (e) { notify(errMsg(e, 'Gagal memperbarui status akun.'), true); }
  }
  async function submitAddUser(f: Form) {
    try { await apiSend('/api/users', 'POST', f); setModal(null); notify('Akun berhasil dibuat.'); loadUsers(); }
    catch (e) { notify(errMsg(e, 'Gagal membuat akun.'), true); }
  }
  function openAddUser() {
    setModal(<Modal title="Tambah akun" okLabel="Buat akun" onClose={() => setModal(null)} onSubmit={submitAddUser}>
      <Field label="Nama lengkap"><input className="in" name="name" required /></Field>
      <Field label="Email"><input className="in" type="email" name="email" required /></Field>
      <Field label="Password (minimal 8 karakter)"><input className="in" type="password" name="password" minLength={8} autoComplete="new-password" required /></Field>
      <Field label="Role">
        <select className="in" name="role" defaultValue="staf">
          {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
    </Modal>);
  }
  async function downloadCsv() {
    try { await apiDownload(`/api/report/csv?${buildParams()}`, 'laporan-karyawan.csv'); }
    catch { notify('Gagal mengunduh CSV.', true); }
  }

  function openAdd() { setModal(<Modal title="Tambah karyawan" onClose={() => setModal(null)} onSubmit={submitAdd}><EmpForm mode="add" units={units} /></Modal>); }
  function openEdit(e: Employee) { setModal(<Modal title="Edit karyawan" onClose={() => setModal(null)} onSubmit={(f) => submitEdit(e.id, f)}><EmpForm e={e} mode="edit" units={units} /></Modal>); }
  function openMove(e: Employee) {
    setModal(<Modal title="Pindah karyawan" okLabel="Pindahkan" onClose={() => setModal(null)} onSubmit={(f) => submitMove(e, f)}>
      <p className="mut" style={{ margin: 0 }}>{e.name} · saat ini di {e.unit}</p>
      <Field label="Unit tujuan"><Sel name="unit" opts={units} def={e.unit} /></Field>
      <Field label="Tanggal"><input className="in" type="date" name="date" defaultValue={today()} required /></Field>
      <Field label="Keterangan"><input className="in" name="note" required /></Field>
    </Modal>);
  }
  function openStatus(e: Employee) {
    setModal(<Modal title="Ubah status kepegawaian" onClose={() => setModal(null)} onSubmit={(f) => submitStatus(e, f)}>
      <p className="mut" style={{ margin: 0 }}>{e.name} · status saat ini: {e.employmentStatus}</p>
      <Field label="Status baru"><Sel name="employmentStatus" opts={EMPLOYMENT_STATUSES} def={e.employmentStatus} /></Field>
      <Field label="Tanggal"><input className="in" type="date" name="date" defaultValue={today()} required /></Field>
      <Field label="Keterangan"><input className="in" name="note" required /></Field>
    </Modal>);
  }
  function openExit(e: Employee) {
    setModal(<Modal title="Keluarkan karyawan" okLabel="Keluarkan" danger onClose={() => setModal(null)} onSubmit={(f) => submitExit(e, f)}>
      <p className="mut" style={{ margin: 0 }}>{e.name} · {e.unit}</p>
      <p className="mut" style={{ margin: 0 }}>Karyawan menjadi nonaktif. Data dan riwayat tetap tersimpan.</p>
      <Field label="Tanggal keluar"><input className="in" type="date" name="date" defaultValue={today()} required /></Field>
      <Field label="Alasan keluar"><input className="in" name="reason" required /></Field>
    </Modal>);
  }
  async function openDetail(id: number) {
    try { const full: Employee = await apiGet(`/api/employees/${id}`); setModal(<DetailModal employee={full} me={me!} onClose={() => setModal(null)} notify={notify} onChanged={loadEmployees} />); }
    catch (e) { notify(errMsg(e, 'Gagal memuat detail karyawan.'), true); }
  }
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    set('s', '')
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  if (booting) return null;
  if (!me) return <Login onLogin={doLogin} err={loginErr} busy={loginBusy} />;

  const nav: [string, string][] = [['dashboard', 'Dashboard'], ['employees', 'Karyawan'], ['history', 'Riwayat'],
    ...(can(me.role, 'report') ? [['report', 'Laporan'] as [string, string]] : []),
    ...(can(me.role, 'users') ? [['users', 'Pengguna'] as [string, string]] : [])];
  const set = (k: string, v: string) => setQ({ ...q, [k]: v });
  const male = dashboardActive.filter((e) => e.gender === 'L').length, female = dashboardActive.length - male;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><div className="logo">S</div>SDM Sekolah</div>
        {nav.map(([k, l]) => <button key={k} className={`nav ${view === k ? 'on' : ''}`} onClick={() => setView(k)}>{l}</button>)}
        <button className="nav" onClick={logout}>Keluar</button>
        <div className="who"><b>{me.name}</b>{ROLE_LABELS[me.role]}</div>
      </aside>

      <main className="main">
        {view === 'dashboard' && <>
          <div className="top"><h1>Dashboard</h1><span className="mut">Halo, {me.name}</span></div>
          <div className="grid">
            <div className="card"><div className="big">{dashboardActive.length}</div><p className="mut">Karyawan aktif</p></div>
            <div className="card"><h2>Jenis kelamin</h2>
              <div className="split"><div style={{ width: `${dashboardActive.length ? (male / dashboardActive.length) * 100 : 0}%`, background: 'var(--pri)' }} /><div style={{ flex: 1, background: 'var(--amb)' }} /></div>
              <p className="mut">Laki-laki {male} · Perempuan {female}</p></div>
            <div className="card"><h2>Status kepegawaian</h2><Bars rows={count(dashboardActive, 'employmentStatus', EMPLOYMENT_STATUSES)} /></div>
            <div className="card"><h2>Fungsi tugas</h2><Bars rows={count(dashboardActive, 'fn', FUNCTIONS)} /></div>
            <div className="card" style={{ gridColumn: '1/-1' }}><h2>Unit sekolah</h2><Bars rows={count(dashboardActive, 'unit', units)} /></div>
          </div></>}

        {view === 'employees' && <>
          <div className="top"><h1>Data karyawan</h1>{can(me.role, 'edit') && <button className="btn p" onClick={openAdd}>Tambah karyawan</button>}</div>
          <div className="filters">
            <span className='deleteicon'>
            <input ref={inputRef} className="in" placeholder="Cari nama, no. induk, NIK/NIP" value={q.s || ''} onChange={(e) => set('s', e.target.value)} />
            {q.s && (
            <span
              onClick={handleClear}
              className="absolute right-[3px] w-[15px] h-[15px] rounded-full bg-[#ccc] text-white text-[13px] font-mono text-center leading-[1em] cursor-pointer flex items-center justify-center select-none hover:bg-gray-400"
            >
            ×
            </span>
            )}
            </span>
            {([['unit', 'Semua unit', units], ['emp', 'Semua status', EMPLOYMENT_STATUSES], ['fn', 'Semua fungsi', FUNCTIONS]] as [string, string, readonly string[]][]).map(([k, l, o]) =>
              <select key={k} className="in" value={q[k]} onChange={(e) => set(k, e.target.value)}><option value="">{l}</option>{o.map((x) => <option key={x}>{x}</option>)}</select>)}
            <select className="in" value={q.gender} onChange={(e) => set('gender', e.target.value)}><option value="">Semua JK</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>
            <select className="in" value={q.active} onChange={(e) => set('active', e.target.value)}>{['Aktif', 'Nonaktif', 'Semua'].map((x) => <option key={x}>{x}</option>)}</select>
          </div>
          <div className="card" style={{ padding: 8 }}>
            {loadingList ? <p className="mut" style={{ padding: 12 }}>Memuat data...</p> : (
              <table className="rt"><thead><tr>{['No', 'Nama', 'Jabatan', 'Unit', 'Status', 'Fungsi', 'Aktif', 'Aksi'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{employees.map((e) => (
                  <tr key={e.id}>
                    <td data-l="No">{e.no}</td><td data-l="Nama"><b>{e.name}</b></td><td data-l="Jabatan">{e.position}</td><td data-l="Unit">{e.unit}</td>
                    <td data-l="Status"><span className="tag">{e.employmentStatus}</span></td><td data-l="Fungsi">{e.fn}</td>
                    <td data-l="Aktif"><span className={`tag ${e.isActive ? '' : 'off'}`}>{e.isActive ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td><div className="act">
                      <button className="btn s" onClick={() => openDetail(e.id)}>Detail</button>
                      {e.isActive && can(me.role, 'edit') && <button className="btn s" onClick={() => openEdit(e)}>Edit</button>}
                      {e.isActive && can(me.role, 'move') && <button className="btn s" onClick={() => openMove(e)}>Pindah</button>}
                      {e.isActive && can(me.role, 'status') && <button className="btn s" onClick={() => openStatus(e)}>Status</button>}
                      {e.isActive && can(me.role, 'exit') && <button className="btn s d" onClick={() => openExit(e)}>Keluarkan</button>}
                    </div></td>
                  </tr>))}</tbody></table>
            )}
            {!loadingList && !employees.length && <p className="mut" style={{ padding: 12 }}>Tidak ada karyawan yang cocok. Ubah kata kunci atau filter.</p>}
          </div></>}

        {view === 'history' && <>
          <div className="top"><h1>Riwayat perubahan</h1></div>
          <div className="card">{history.map((h) => (
            <div className="tl" key={h.id}>
              <span className={`tag ${h.type === 'EMPLOYEE_EXIT' ? 'off' : h.type === 'TRANSFER' ? 'amb' : ''}`}>{TYPE_LABEL[h.type] || h.type}</span> <b>{h.employee?.name}</b>: {h.oldValue} → {h.newValue}
              <br /><span className="mut">{fmtDT(h.at)} · {h.by} · {h.description}</span>
            </div>))}
            {!history.length && <p className="mut">Belum ada riwayat.</p>}
          </div></>}

        {view === 'report' && <>
          <div className="top"><h1>Laporan</h1><button className="btn p" onClick={downloadCsv}>Unduh CSV</button></div>
          {report && <div className="card" style={{ overflowX: 'auto' }}>
            <h2>Karyawan aktif per unit dan status</h2>
            <table><thead><tr><th>Unit</th>{EMPLOYMENT_STATUSES.map((s) => <th key={s}>{s}</th>)}<th>Total</th></tr></thead>
              <tbody>{report.byUnitStatus.map((row) => (
                <tr key={row.unit}><td>{row.unit}</td>{EMPLOYMENT_STATUSES.map((s) => <td key={s}>{row.counts[s] ?? 0}</td>)}<td><b>{row.total}</b></td></tr>))}</tbody></table>
            <p className="mut">Total aktif: {report.totalActive} (L: {report.male} · P: {report.female}). CSV mengikuti filter di halaman Karyawan.</p>
          </div>}</>}

        {view === 'users' && <>
          <div className="top"><h1>Kelola pengguna</h1><button className="btn p" onClick={openAddUser}>Tambah akun</button></div>
          <div className="card" style={{ padding: 8 }}>
            <table className="rt"><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
              <tbody>{users.map((u) => (
                <tr key={u.id}>
                  <td data-l="Nama"><b>{u.name}</b></td><td data-l="Email">{u.email}</td>
                  <td data-l="Role"><select className="in" value={u.role} disabled={u.id === me.id} onChange={(e) => toggleRole(u, e.target.value)}>
                    {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                  <td data-l="Status"><button className="btn s" disabled={u.id === me.id} onClick={() => toggleActive(u)}>{u.active ? 'Aktif' : 'Nonaktif'}</button></td>
                </tr>))}</tbody></table>
          </div></>}
      </main>
      {modal}
      {toast && <div className={`toast ${toast.bad ? 'err' : ''}`} role="status">{toast.msg}</div>}
    </div>
  );
}
