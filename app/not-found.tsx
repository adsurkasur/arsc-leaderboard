import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
      <div className="text-center space-y-6 p-8 animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mb-4">
          <AlertCircle className="w-10 h-10 text-destructive" />
        </div>
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold">Halaman Tidak Ditemukan</h2>
        <p className="text-muted-foreground max-w-md">
          Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
        </p>
        <Button asChild size="lg" className="gap-2">
          <Link href="/">
            <Home className="w-4 h-4" />
            Kembali ke Beranda
          </Link>
        </Button>
      </div>
    </div>
  );
}
