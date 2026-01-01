'use client';

import { usePathname } from 'next/navigation';

export function Footer() {
  const pathname = usePathname();

  // Don't show footer on auth page
  if (pathname === '/auth') {
    return null;
  }

  return (
    <footer className="border-t py-8 bg-muted/30">
      <div className="container text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Agritech Research and Study Club (ARSC)</p>
      </div>
    </footer>
  );
}
