import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Profile, Competition, ParticipationLog } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, CheckCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export function ParticipationManagement() {
  const [logs, setLogs] = useState<ParticipationLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [competitionName, setCompetitionName] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [logsRes, profilesRes, competitionsRes] = await Promise.all([
      supabase
        .from('participation_logs')
        .select(`
          *,
          profile:profiles(id, full_name, avatar_url),
          competition:competitions(id, title, date)
        `)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('competitions').select('*').order('date', { ascending: false })
    ]);

    if (!logsRes.error && logsRes.data) {
      // Transform the data to match our types
      const transformedLogs = logsRes.data.map(log => ({
        ...log,
        profile: log.profile as unknown as Profile,
        competition: log.competition as unknown as Competition
      }));
      setLogs(transformedLogs);
    }
    if (!profilesRes.error && profilesRes.data) setProfiles(profilesRes.data);
    if (!competitionsRes.error && competitionsRes.data) setCompetitions(competitionsRes.data);
    setIsLoading(false);
  };

  const handleAddParticipation = async () => {
    if (!selectedProfile || !competitionName.trim()) {
      toast({ title: 'Error', description: 'Please select a user and enter a competition name', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
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
            category: 'General', // Default category
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
          setIsSaving(false);
          return;
        }

        competitionId = newCompetition.id;
        // Refresh competitions list
        await fetchData();
      }

      // Add participation log
      const { error } = await supabase
        .from('participation_logs')
        .insert({
          profile_id: selectedProfile,
          competition_id: competitionId,
          admin_id: user?.id,
          notes: notes || null
        });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Error', description: 'This user is already registered for this competition', variant: 'destructive' });
        } else {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
      } else {
        toast({ title: 'Success', description: 'Participation added successfully' });
        setIsDialogOpen(false);
        setSelectedProfile('');
        setCompetitionName('');
        setNotes('');
        fetchData();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }

    setIsSaving(false);
  };

  const handleDelete = async (log: ParticipationLog) => {
    if (!confirm('Are you sure you want to remove this participation entry?')) return;

    const { error } = await supabase
      .from('participation_logs')
      .delete()
      .eq('id', log.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Participation removed successfully' });
      fetchData();
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-48" />
        </div>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Participation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Participation Entry</DialogTitle>
              <DialogDescription>
                Record a user's participation in a competition.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select User</Label>
                <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Select Competition</Label>
                <Input
                  placeholder="Enter competition name"
                  value={competitionName}
                  onChange={(e) => setCompetitionName(e.target.value)}
                  className="border-primary/20 focus:border-primary"
                />
                <p className="text-xs text-muted-foreground">
                  If the competition doesn't exist, it will be created automatically.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddParticipation} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Competition</TableHead>
              <TableHead>Verified At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No participation logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="table-row-hover">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={log.profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {log.profile ? getInitials(log.profile.full_name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{log.profile?.full_name || 'Unknown'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <span>{log.competition?.title || 'Unknown'}</span>
                      {log.competition?.date && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.competition.date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle className="w-4 h-4" />
                      {log.verified_at ? format(new Date(log.verified_at), 'MMM d, yyyy') : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(log)} 
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
