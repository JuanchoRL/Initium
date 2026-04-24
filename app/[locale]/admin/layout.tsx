import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { IBM_Plex_Mono, Manrope } from 'next/font/google';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-admin-sans',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-admin-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Admin Dashboard | Initium+',
  description: 'Dashboard administrativo para equipos de RRHH y recruiting dentro de Initium+.',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <section className={`${manrope.variable} ${plexMono.variable} font-[family:var(--font-admin-sans)]`}>{children}</section>;
}
