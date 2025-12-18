import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Header } from '@/components/layout/Header';
import { Trophy, Users, Activity } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-background to-muted/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container relative py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium animate-fade-in">
              <Trophy className="w-4 h-4" />
              Competition Rankings
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance animate-slide-up">
              Discover Our Top
              <span className="text-primary"> Performers</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '100ms' }}>
              Track participation, celebrate achievements, and see who's leading the pack in our competitive community.
            </p>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-12 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex flex-col items-center p-6 rounded-xl bg-card border shadow-card">
              <Users className="w-8 h-8 text-primary mb-2" />
              <span className="text-2xl font-bold">100+</span>
              <span className="text-sm text-muted-foreground">Participants</span>
            </div>
            <div className="flex flex-col items-center p-6 rounded-xl bg-card border shadow-card">
              <Trophy className="w-8 h-8 text-gold mb-2" />
              <span className="text-2xl font-bold">50+</span>
              <span className="text-sm text-muted-foreground">Competitions</span>
            </div>
            <div className="flex flex-col items-center p-6 rounded-xl bg-card border shadow-card col-span-2 md:col-span-1">
              <Activity className="w-8 h-8 text-success mb-2" />
              <span className="text-2xl font-bold">Live</span>
              <span className="text-sm text-muted-foreground">Real-time Updates</span>
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard Section */}
      <main className="container py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Competition Leaderboard</h2>
          <p className="text-muted-foreground">Rankings based on total competition participation</p>
        </div>
        <LeaderboardTable />
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Leaderboard System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
