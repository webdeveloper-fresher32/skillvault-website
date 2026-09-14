import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'SkillVault — Developer Learning Operating System',
  description: 'Master backend, cloud architecture, system design, and AI engineering from structured, production-grade knowledge paths.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-blue-600/30 selection:text-blue-200">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
