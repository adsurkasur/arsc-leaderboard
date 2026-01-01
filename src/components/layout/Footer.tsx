'use client';

import { usePathname } from 'next/navigation';
import { m } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';
import { Heart } from 'lucide-react';

export function Footer() {
  const pathname = usePathname();

  // Don't show footer on auth page
  if (pathname === '/auth') {
    return null;
  }

  return (
    <m.footer 
      className="border-t py-8 md:py-10 bg-muted/30"
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.5 }}
    >
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5">
            © {new Date().getFullYear()} Agritech Research and Study Club (ARSC)
          </p>
          <p className="flex items-center gap-1.5">
            Dibuat dengan <Heart className="w-4 h-4 text-pink fill-pink" /> untuk komunitas
          </p>
        </div>
      </div>
    </m.footer>
  );
}

