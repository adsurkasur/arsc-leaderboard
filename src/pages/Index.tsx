import { useState, useEffect } from 'react';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Competition } from '@/lib/types';
import { Trophy, Users, Activity, Plus, Loader2 } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionName, setCompetitionName] = useState('');
  const [competitionCategory, setCompetitionCategory] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const fetchCompetitions = async () => {
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .order('date', { ascending: false });

    if (!error && data) {
      setCompetitions(data);
    }
  };

  const handleSubmit = async () => {
    if (!competitionName.trim() || !competitionCategory.trim() || !message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a competition name, select a category, and provide a message.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) {
        toast({
          title: 'Error',
          description: 'User profile not found. Please contact an administrator.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Check if competition exists, create if not
      let competitionId: string;
      const existingCompetition = competitions.find(
        comp => comp.title.toLowerCase() === competitionName.trim().toLowerCase()
      );

      if (existingCompetition) {
        competitionId = existingCompetition.id;
      } else {
        // Create new competition
        const { data: newCompetition, error: createError } = await supabase
          .from('competitions')
          .insert({
            title: competitionName.trim(),
            category: competitionCategory.trim(),
            date: new Date().toISOString().split('T')[0], // Today's date
          })
          .select('id')
          .single();

        if (createError) {
          toast({
            title: 'Error',
            description: 'Failed to create competition: ' + createError.message,
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }

        competitionId = newCompetition.id;
        // Refresh competitions list
        fetchCompetitions();
      }

      // Submit verification request
      const { error } = await supabase
        .from('verification_requests')
        .insert({
          profile_id: profile.id,
          competition_id: competitionId,
          message: message.trim(),
        });

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Your participation request has been submitted for review.',
        });
        setIsModalOpen(false);
        setCompetitionName('');
        setCompetitionCategory('');
        setMessage('');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  };

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
        
        {/* Submit Participation Section */}
        {user && (
          <div className="mt-12 text-center">
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Submit Participation
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Submit Participation Request</DialogTitle>
                  <DialogDescription>
                    Select a competition and provide details about your participation.
                    Your request will be reviewed by an administrator.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="competition">Competition Name</Label>
                    <Input
                      id="competition"
                      placeholder="Enter competition name"
                      value={competitionName}
                      onChange={(e) => setCompetitionName(e.target.value)}
                      className="border-primary/20 focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      If the competition doesn't exist, it will be created automatically.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="category">Competition Category *</Label>
                    <Select value={competitionCategory} onValueChange={setCompetitionCategory}>
                      <SelectTrigger className="border-primary/20 focus:border-primary">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Academic">Academic</SelectItem>
                        <SelectItem value="Sports">Sports</SelectItem>
                        <SelectItem value="Innovation">Innovation</SelectItem>
                        <SelectItem value="Art">Art</SelectItem>
                        <SelectItem value="Technology">Technology</SelectItem>
                        <SelectItem value="Science">Science</SelectItem>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Culture">Culture</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      This helps in filtering the leaderboard by category.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Describe your participation or provide any additional details..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Request'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Competition Leaderboard. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
