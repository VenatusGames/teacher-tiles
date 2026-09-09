import type { Metadata } from 'next';
import { Fredoka, Nunito } from 'next/font/google';
import './globals.css';

const heading = Fredoka({ variable: '--font-heading-face', subsets: ['latin'] });
const body = Nunito({ variable: '--font-body', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WIGs',
  description: 'A friendly student tracker for daily lead measures and progress history.',
  icons: { icon: '/wigs/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
