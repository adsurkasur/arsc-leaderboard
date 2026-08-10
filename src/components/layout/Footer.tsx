'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { m } from 'framer-motion';

export function Footer() {
  const pathname = usePathname();
  if (pathname === '/auth') return null;

  return (
    <m.footer
      className="border-t border-border/70 bg-card"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.35 }}
    >
      <div className="container flex flex-col gap-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between md:py-10">
        <div>
          <p className="font-semibold text-foreground">ARSC Leaderboard</p>
          <p className="mt-1 text-muted-foreground">Rekam partisipasi kompetisi anggota ARSC.</p>
        </div>
        <div className="flex flex-col gap-2 text-muted-foreground sm:items-end">
          <Link href="/leaderboard" className="transition-colors hover:text-foreground">Lihat peringkat</Link>
          <p>© {new Date().getFullYear()} Agritech Research and Study Club</p>
        </div>
      </div>
    </m.footer>
  );
}
