import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import { AuthProvider } from '@/context/AuthContext';
import AuthModal from '@/components/AuthModal';

export const metadata: Metadata = {
  title: 'SkillVault — Developer Learning Operating System',
  description: 'Master backend, cloud architecture, system design, and AI engineering from structured, production-grade knowledge paths.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#06080e] text-slate-100 antialiased selection:bg-sky-500/20 selection:text-sky-200">
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
          <AuthModal />
        </AuthProvider>
      </body>
    </html>
  );
}

