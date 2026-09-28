'use client';
import { useEffect, useMemo, useState } from 'react';
import { UNITS, STATUSES, FUNCS, ROLES, USERS, can, seedEmployees, seedHistory } from '../lib/data';

const KEY = 'sdm-db-v1';
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const count = (list, key, opts) => opts.map(o => [o, list.filter(e => e[key] === o).length]);
const TYPE = { TRANSFER: 'Pindah unit', STATUS_CHANGE: 'Ubah status', EMPLOYEE_EXIT: 'Keluar', DATA_UPDATE: 'Ubah data', EMPLOYEE_ADD: 'Tambah' };

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return rows.map(([l, n]) => (
    <div className="bar" key={l}><span>{l}</span><div className="trk"><div className="fill" style={{ width: `${(n / max) * 100}%` }} /></div><b>{n}</b></div>
  ));
}

function Field({ label, children }) { return <label className="fld">{label}{children}</label>; }
function Sel({ name, opts, def, ...p }) {
  return <select className="in" name={name} defaultValue={def} {...p}>{opts.map(o => <option key={o}>{o}</option>)}</select>;
}

function Modal({ title, onClose, onSubmit, okLabel = 'Simpan', danger, children }) {
  return (
    <div className="ov" onClick={onClose}>
      <form className="md" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); onSubmit(Object.fromEntries(new FormData(e.target))); }}>
        <h2>{title}</h2>{children}
        <div className="row"><button type="button" className="btn" onClick={onClose}>Batal</button>
          {onSubmit && <button className={`btn ${danger ? 'd' : 'p'}`}>{okLabel}</button>}</div>
      </form>
    </div>
  );
}

export default function App() {
  const [db, setDb] = useState(null);
  const [me, setMe] = useState(null);
  const [view, setView] = useState('dashboard');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [q, setQ] = useState({ s: '', unit: '', gender: '', emp: '', fn: '', active: 'Aktif' });
  const [err, setErr] = useState('');

  useEffect(() => {
    let d = { emps: seedEmployees(), hist: seedHistory(), users: USERS };
    try {
      const s = localStorage.getItem(KEY); if (s) d = JSON.parse(s);
      const u = sessionStorage.getItem('sdm-me'); if (u) setMe(JSON.parse(u));
    } catch {}
    setDb(d);
  }, []);
  useEffect(() => { if (db) try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} }, [db]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);

  const emps = db?.emps || [];
  const active = useMemo(() => emps.filter(e => e.active), [emps]);
  const shown = useMemo(() => emps.filter(e =>
    (!q.s || `${e.name} ${e.no}`.toLowerCase().includes(q.s.toLowerCase())) &&
    (!q.unit || e.unit === q.unit) && (!q.gender || e.gender === q.gender) &&
    (!q.emp || e.emp === q.emp) && (!q.fn || e.fn === q.fn) &&
    (q.active === 'Semua' || e.active === (q.active === 'Aktif'))), [emps, q]);

  if (!db) return null;

  const notify = (msg, bad) => setToast({ msg, bad });
  const login = (email, password) => {
    const u = db.users.find(x => x.email === email && x.password === password);
    if (!u) return setErr('Email atau password salah.');
    if (!u.active) return setErr('Akun ini nonaktif. Hubungi Manajer SDM.');
    setErr(''); setMe(u); setView('dashboard');
    try { sessionStorage.setItem('sdm-me', JSON.stringify(u)); } catch {}
  };
  const logout = () => { setMe(null); try { sessionStorage.removeItem('sdm-me'); } catch {} };

  // Semua perubahan penting dicatat ke histori (FR-05..FR-09)
  const mutate = (id, patch, type, oldV, newV, desc) => {
    setDb(d => ({
      ...d,
      emps: d.emps.map(e => e.id === id ? { ...e, ...patch } : e),
      hist: [{ id: Date.now(), eid: id, type, old: oldV, new: newV, desc: desc || '-', by: me.name, at: now() }, ...d.hist],
    }));
  };
  const save = (f, ex) => {
    if (!f.name.trim() || !f.birth) return notify('Nama dan tanggal lahir wajib diisi.', true);
    if (ex) mutate(ex.id, { ...f }, 'DATA_UPDATE', ex.name, f.name, 'Data karyawan diperbarui');
    else setDb(d => {
      const id = Math.max(0, ...d.emps.map(e => e.id)) + 1;
      return { ...d, emps: [...d.emps, { ...f, id, no: `EMP-${String(id).padStart(4, '0')}`, active: true, exit: '' }],
        hist: [{ id: Date.now(), eid: id, type: 'EMPLOYEE_ADD', old: '-', new: f.unit, desc: 'Karyawan baru', by: me.name, at: now() }, ...d.hist] };
    });
    setModal(null); notify(ex ? 'Data berhasil diperbarui.' : 'Karyawan berhasil ditambahkan.');
  };
  const move = (e, f) => {
    if (f.unit === e.unit) return notify('Unit tujuan sama dengan unit saat ini.', true);
    mutate(e.id, { unit: f.unit }, 'TRANSFER', e.unit, f.unit, `${f.date} · ${f.note}`); setModal(null); notify('Karyawan berhasil dipindahkan.');
  };
  const chStatus = (e, f) => {
    if (f.emp === e.emp) return notify('Status baru sama dengan status saat ini.', true);
    mutate(e.id, { emp: f.emp }, 'STATUS_CHANGE', e.emp, f.emp, `${f.date} · ${f.note}`); setModal(null); notify('Status kepegawaian diubah.');
  };
  const exit = (e, f) => {
    mutate(e.id, { active: false, exit: f.date }, 'EMPLOYEE_EXIT', 'Aktif', 'Nonaktif', f.note); setModal(null); notify('Karyawan dikeluarkan (data tetap tersimpan).');
  };

  if (!me) return <Login onLogin={login} err={err} />;

  const nav = [['dashboard', 'Dashboard'], ['employees', 'Karyawan'], ['history', 'Riwayat'],
    ...(can(me.role, 'report') ? [['report', 'Laporan']] : []), ...(can(me.role, 'users') ? [['users', 'Pengguna']] : [])];

  const EmpForm = ({ e = {} }) => (<>
    <div className="two">
      <Field label="Nama lengkap"><input className="in" name="name" defaultValue={e.name} required /></Field>
      <Field label="Jenis kelamin"><select className="in" name="gender" defaultValue={e.gender || 'L'}><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></Field>
      <Field label="Tanggal lahir"><input className="in" type="date" name="birth" defaultValue={e.birth} required /></Field>
      <Field label="Telepon"><input className="in" name="phone" defaultValue={e.phone} required /></Field>
      <Field label="Email"><input className="in" type="email" name="email" defaultValue={e.email} required /></Field>
      <Field label="Tanggal mulai bekerja"><input className="in" type="date" name="join" defaultValue={e.join || today()} required /></Field>
      <Field label="Unit sekolah"><Sel name="unit" opts={UNITS} def={e.unit} /></Field>
      <Field label="Status kepegawaian"><Sel name="emp" opts={STATUSES} def={e.emp} /></Field>
      <Field label="Fungsi tugas"><Sel name="fn" opts={FUNCS} def={e.fn} /></Field>
    </div>
    <Field label="Alamat"><input className="in" name="address" defaultValue={e.address} required /></Field>
  </>);

  const open = (type, e) => {
    const info = <p className="mut" style={{ margin: 0 }}>{e?.name} · {e?.unit} · {e?.emp}</p>;
    const date = <Field label="Tanggal"><input className="in" type="date" name="date" defaultValue={today()} required /></Field>;
    const note = <Field label="Keterangan"><input className="in" name="note" required /></Field>;
    if (type === 'add') setModal(<Modal title="Tambah karyawan" onClose={() => setModal(null)} onSubmit={f => save(f)}><EmpForm /></Modal>);
    if (type === 'edit') setModal(<Modal title="Edit karyawan" onClose={() => setModal(null)} onSubmit={f => save(f, e)}><EmpForm e={e} /></Modal>);
    if (type === 'move') setModal(<Modal title="Pindah karyawan" okLabel="Pindahkan" onClose={() => setModal(null)} onSubmit={f => move(e, f)}>{info}
      <Field label="Unit tujuan"><Sel name="unit" opts={UNITS} def={e.unit} /></Field>{date}{note}</Modal>);
    if (type === 'status') setModal(<Modal title="Ubah status kepegawaian" onClose={() => setModal(null)} onSubmit={f => chStatus(e, f)}>{info}
      <Field label="Status baru"><Sel name="emp" opts={STATUSES} def={e.emp} /></Field>{date}{note}</Modal>);
    if (type === 'exit') setModal(<Modal title="Keluarkan karyawan" okLabel="Keluarkan" danger onClose={() => setModal(null)} onSubmit={f => exit(e, f)}>{info}
      <p className="mut" style={{ margin: 0 }}>Karyawan menjadi nonaktif. Data dan riwayat tetap tersimpan.</p>{date}{note}</Modal>);
    if (type === 'detail') setModal(<Modal title={e.name} onClose={() => setModal(null)}>
      <div className="two mut">{[['ID', e.no], ['Jenis kelamin', e.gender === 'L' ? 'Laki-laki' : 'Perempuan'], ['Tanggal lahir', e.birth], ['Telepon', e.phone], ['Email', e.email], ['Unit', e.unit],
        ['Status', e.emp], ['Fungsi', e.fn], ['Mulai kerja', e.join], ['Tanggal keluar', e.exit || '-']].map(([k, v]) => <div key={k}>{k}<br /><b style={{ color: 'var(--ink)' }}>{v}</b></div>)}</div>
      <div><h2>Riwayat</h2>{db.hist.filter(h => h.eid === e.id).map(h => <div className="tl" key={h.id}><b>{TYPE[h.type]}</b>: {h.old} → {h.new}<br /><span className="mut">{h.at} · {h.by} · {h.desc}</span></div>)}
        {!db.hist.some(h => h.eid === e.id) && <p className="mut">Belum ada riwayat.</p>}</div></Modal>);
  };

  const csv = () => {
    const rows = [['ID', 'Nama', 'JK', 'Unit', 'Status', 'Fungsi', 'Aktif'], ...shown.map(e => [e.no, e.name, e.gender, e.unit, e.emp, e.fn, e.active ? 'Aktif' : 'Nonaktif'])];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')], { type: 'text/csv' }));
    a.download = 'laporan-karyawan.csv'; a.click();
  };

  const male = active.filter(e => e.gender === 'L').length, female = active.length - male;
  const set = (k, v) => setQ({ ...q, [k]: v });

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><div className="logo">S</div>SDM Sekolah</div>
        {nav.map(([k, l]) => <button key={k} className={`nav ${view === k ? 'on' : ''}`} onClick={() => setView(k)}>{l}</button>)}
        <button className="nav" onClick={logout}>Keluar</button>
        <div className="who"><b>{me.name}</b>{ROLES[me.role]}</div>
      </aside>

      <main className="main">
        {view === 'dashboard' && <>
          <div className="top"><h1>Dashboard</h1><span className="mut">Halo, {me.name}</span></div>
          <div className="grid">
            <div className="card"><div className="big">{active.length}</div><p className="mut">Karyawan aktif dari {emps.length} data · {emps.length - active.length} nonaktif</p></div>
            <div className="card"><h2>Jenis kelamin</h2>
              <div className="split"><div style={{ width: `${(male / active.length) * 100}%`, background: 'var(--pri)' }} /><div style={{ flex: 1, background: 'var(--amb)' }} /></div>
              <p className="mut">Laki-laki {male} · Perempuan {female}</p></div>
            <div className="card"><h2>Status kepegawaian</h2><Bars rows={count(active, 'emp', STATUSES)} /></div>
            <div className="card"><h2>Fungsi tugas</h2><Bars rows={count(active, 'fn', FUNCS)} /></div>
            <div className="card" style={{ gridColumn: '1/-1' }}><h2>Unit sekolah</h2><Bars rows={count(active, 'unit', UNITS)} /></div>
          </div></>}

        {view === 'employees' && <>
          <div className="top"><h1>Data karyawan</h1>{can(me.role, 'edit') && <button className="btn p" onClick={() => open('add')}>Tambah karyawan</button>}</div>
          <div className="filters">
            <input className="in" placeholder="Cari nama atau ID" value={q.s} onChange={e => set('s', e.target.value)} />
            {[['unit', 'Semua unit', UNITS], ['emp', 'Semua status', STATUSES], ['fn', 'Semua fungsi', FUNCS]].map(([k, l, o]) =>
              <select key={k} className="in" value={q[k]} onChange={e => set(k, e.target.value)}><option value="">{l}</option>{o.map(x => <option key={x}>{x}</option>)}</select>)}
            <select className="in" value={q.gender} onChange={e => set('gender', e.target.value)}><option value="">Semua JK</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>
            <select className="in" value={q.active} onChange={e => set('active', e.target.value)}>{['Aktif', 'Nonaktif', 'Semua'].map(x => <option key={x}>{x}</option>)}</select>
          </div>
          <div className="card" style={{ padding: 8 }}>
            <table className="rt"><thead><tr>{['ID', 'Nama', 'JK', 'Unit', 'Status', 'Fungsi', 'Aktif', 'Aksi'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{shown.map(e => (
                <tr key={e.id}>
                  <td data-l="ID">{e.no}</td><td data-l="Nama"><b>{e.name}</b></td><td data-l="JK">{e.gender}</td><td data-l="Unit">{e.unit}</td>
                  <td data-l="Status"><span className="tag">{e.emp}</span></td><td data-l="Fungsi">{e.fn}</td>
                  <td data-l="Aktif"><span className={`tag ${e.active ? '' : 'off'}`}>{e.active ? 'Aktif' : 'Nonaktif'}</span></td>
                  <td><div className="act">
                    <button className="btn s" onClick={() => open('detail', e)}>Detail</button>
                    {e.active && can(me.role, 'edit') && <button className="btn s" onClick={() => open('edit', e)}>Edit</button>}
                    {e.active && can(me.role, 'move') && <button className="btn s" onClick={() => open('move', e)}>Pindah</button>}
                    {e.active && can(me.role, 'status') && <button className="btn s" onClick={() => open('status', e)}>Status</button>}
                    {e.active && can(me.role, 'exit') && <button className="btn s d" onClick={() => open('exit', e)}>Keluarkan</button>}
                  </div></td>
                </tr>))}</tbody></table>
            {!shown.length && <p className="mut" style={{ padding: 12 }}>Tidak ada karyawan yang cocok. Ubah kata kunci atau filter.</p>}
          </div></>}

        {view === 'history' && <>
          <div className="top"><h1>Riwayat perubahan</h1></div>
          <div className="card">{db.hist.map(h => {
            const e = emps.find(x => x.id === h.eid);
            return <div className="tl" key={h.id}><span className={`tag ${h.type === 'EMPLOYEE_EXIT' ? 'off' : h.type === 'TRANSFER' ? 'amb' : ''}`}>{TYPE[h.type]}</span> <b>{e?.name}</b>: {h.old} → {h.new}
              <br /><span className="mut">{h.at} · {h.by} · {h.desc}</span></div>;
          })}</div></>}

        {view === 'report' && <>
          <div className="top"><h1>Laporan</h1><button className="btn p" onClick={csv}>Unduh CSV</button></div>
          <div className="card" style={{ overflowX: 'auto' }}><h2>Karyawan aktif per unit dan status</h2>
            <table><thead><tr><th>Unit</th>{STATUSES.map(s => <th key={s}>{s}</th>)}<th>Total</th></tr></thead>
              <tbody>{UNITS.map(u => <tr key={u}><td>{u}</td>{STATUSES.map(s => <td key={s}>{active.filter(e => e.unit === u && e.emp === s).length}</td>)}<td><b>{active.filter(e => e.unit === u).length}</b></td></tr>)}</tbody></table>
            <p className="mut">CSV mengikuti filter di halaman Karyawan ({shown.length} baris).</p></div></>}

        {view === 'users' && <>
          <div className="top"><h1>Kelola pengguna</h1></div>
          <div className="card" style={{ padding: 8 }}>
            <table className="rt"><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
              <tbody>{db.users.map(u => (
                <tr key={u.id}><td data-l="Nama"><b>{u.name}</b></td><td data-l="Email">{u.email}</td>
                  <td data-l="Role"><select className="in" value={u.role} disabled={u.id === me.id} onChange={e => { setDb(d => ({ ...d, users: d.users.map(x => x.id === u.id ? { ...x, role: e.target.value } : x) })); notify('Role diperbarui.'); }}>
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                  <td data-l="Status"><button className="btn s" disabled={u.id === me.id} onClick={() => { setDb(d => ({ ...d, users: d.users.map(x => x.id === u.id ? { ...x, active: !x.active } : x) })); notify('Status akun diperbarui.'); }}>{u.active ? 'Aktif' : 'Nonaktif'}</button></td></tr>))}</tbody></table>
          </div></>}
      </main>
      {modal}
      {toast && <div className={`toast ${toast.bad ? 'err' : ''}`} role="status">{toast.msg}</div>}
    </div>
  );
}

function Login({ onLogin, err }) {
  const [em, setEm] = useState(''), [pw, setPw] = useState('');
  return (
    <div className="login">
      <form className="card" onSubmit={e => { e.preventDefault(); onLogin(em, pw); }}>
        <div className="brand" style={{ color: 'var(--ink)', padding: 0 }}><div className="logo">S</div>SDM Sekolah</div>
        <h1>Masuk</h1>
        <Field label="Email"><input className="in" type="email" value={em} onChange={e => setEm(e.target.value)} required /></Field>
        <Field label="Password"><input className="in" type="password" value={pw} onChange={e => setPw(e.target.value)} required /></Field>
        {err && <div className="tag off" role="alert">{err}</div>}
        <button className="btn p">Masuk</button>
        <div className="demo"><span className="mut">Akun demo (klik untuk mengisi):</span>
          {USERS.map(u => <button type="button" className="btn" key={u.id} onClick={() => { setEm(u.email); setPw(u.password); }}>{ROLES[u.role]} · {u.email}</button>)}</div>
      </form>
    </div>
  );
}
