'use client';

import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/hooks/useAuth';
import { ParticipationModal } from '@/components/modals';
import { m } from 'framer-motion';
import { 
  pageTransition, 
  heroTitle, 
  heroSubtitle, 
  staggerContainer, 
  staggerItem,
  fadeInUp 
} from '@/lib/motion';
import { Trophy, Sparkles, TrendingUp } from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <m.div 
      className="min-h-screen bg-background"
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <Header />
      
      {/* Hero Section - Vibrant and Motivating */}
      <section className="relative overflow-hidden border-b">
        {/* Gradient background with pattern */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-accent/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]" />
        
        {/* Decorative floating elements */}
        <m.div 
          className="absolute top-20 left-[10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl"
          animate={{ 
            y: [0, -20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ 
            duration: 6, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        />
        <m.div 
          className="absolute bottom-10 right-[15%] w-48 h-48 bg-violet/5 rounded-full blur-3xl"
          animate={{ 
            y: [0, 15, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{ 
            duration: 5, 
            repeat: Infinity, 
            ease: "easeInOut",
            delay: 1 
          }}
        />
        
        <div className="container relative py-16 md:py-24 lg:py-28">
          <m.div 
            className="max-w-3xl mx-auto text-center space-y-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* Badge */}
            <m.div 
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20"
              variants={staggerItem}
            >
              <Sparkles className="w-4 h-4" />
              <span>Papan Peringkat Kompetisi</span>
            </m.div>
            
            {/* Main heading with gradient text */}
            <m.h1 
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance"
              variants={heroTitle}
            >
              Temukan Para{' '}
              <span className="text-gradient">Ahli Lomba</span>{' '}
              ARSC
            </m.h1>
            
            {/* Subtitle */}
            <m.p 
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
              variants={heroSubtitle}
            >
              Ayo teman-teman ARSC, pantau dan tingkatkan partisipasi kompetisi kita di sini!
            </m.p>
            
            {/* Stats preview */}
            <m.div 
              className="flex flex-wrap justify-center gap-6 pt-4"
              variants={staggerItem}
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy className="w-5 h-5 text-gold" />
                <span className="font-medium">Top 10 Leaderboard</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-5 h-5 text-success" />
                <span className="font-medium">Real-time Updates</span>
              </div>
            </m.div>
          </m.div>
        </div>
      </section>

      {/* Leaderboard Section */}
      <main className="container py-8 md:py-12">
        <m.div 
          className="mb-6 md:mb-8"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Papan Peringkat</h2>
          <p className="text-muted-foreground">Peringkat berdasarkan total partisipasi</p>
        </m.div>
        
        <LeaderboardTable />
        
        {/* Submit Participation Section */}
        {user && (
          <m.div 
            className="mt-10 md:mt-12 text-center"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.3 }}
          >
            <ParticipationModal user={user} />
          </m.div>
        )}
      </main>
    </m.div>
  );
}
