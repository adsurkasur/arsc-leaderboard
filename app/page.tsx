'use client';

import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/hooks/useAuth';
import { ParticipationModal } from '@/components/modals';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-background to-muted/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance animate-slide-up">
              Temukan Para
              <span className="text-primary"> Ahli Lomba</span> ARSC
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '100ms' }}>
              Ayo teman-teman ARSC, pantau dan tingkatkan partisipasi kompetisi kalian di sini!
            </p>
          </div>
        </div>
      </section>

      {/* Leaderboard Section */}
      <main className="container py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Papan Peringkat</h2>
          <p className="text-muted-foreground">Peringkat berdasarkan total partisipasi</p>
        </div>
        <LeaderboardTable />
        
        {/* Submit Participation Section */}
        {user && (
          <div className="mt-12 text-center">
            <ParticipationModal user={user} />
          </div>
        )}
      </main>
    </div>
  );
}
