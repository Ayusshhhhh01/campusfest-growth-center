import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CampusFest Bengaluru — Sponsorship Growth Center',
  description:
    'Point-in-time sponsorship analytics, live pipeline management, early warning system, and AI execution command center for CampusFest Bengaluru.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#F4F7FB] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 flex flex-col">
        {children}
      </body>
    </html>
  );
}
