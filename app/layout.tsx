import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Initium+ Assessment Platform',
  description:
    'A professional gamified assessment platform for candidate evaluation, featuring cognitive, behavioral, and decision-making simulations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
