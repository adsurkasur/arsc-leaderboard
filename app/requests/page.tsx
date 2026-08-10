'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { RequestsHistory } from '@/components/requests/RequestsHistory';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function RequestsPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      <main className="container max-w-4xl py-8 sm:py-12">
        <div className="mb-7">
          <p className="text-sm font-semibold text-primary">Aktivitas Anda</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Pengajuan & percakapan</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Semua keputusan, alasan, informasi tambahan, dan balasan admin tersimpan di sini.
          </p>
        </div>

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center"><Loader2 className="size-5 animate-spin" /></div>
        ) : user ? (
          <RequestsHistory user={user} />
        ) : (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <p className="font-medium">Masuk untuk melihat pengajuan Anda.</p>
            <Button asChild className="mt-4"><Link href="/auth">Masuk</Link></Button>
          </div>
        )}
      </main>
    </div>
  );
}
