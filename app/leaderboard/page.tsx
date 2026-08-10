import { Header } from '@/components/layout/Header';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      <main className="container py-8 sm:py-12 md:py-16">
        <div className="mb-7 max-w-2xl md:mb-9">
          <p className="text-sm font-semibold text-primary">Peringkat anggota</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Kontribusi kompetisi yang sudah diverifikasi
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Cari nama atau pilih kategori. Urutan didasarkan pada total poin dari capaian yang telah disetujui.
          </p>
        </div>
        <LeaderboardTable />
      </main>
    </div>
  );
}
