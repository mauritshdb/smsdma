import './globals.css';
export const metadata = { title: 'SDM Sekolah', description: 'Sistem Manajemen Sumber Daya Karyawan Sekolah' };
export const viewport = { width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }) {
  return <html lang="id"><body>{children}</body></html>;
}
