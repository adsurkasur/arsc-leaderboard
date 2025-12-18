import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Competition } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, Search, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export function CompetitionsManagement() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [formData, setFormData] = useState({ title: '', date: '', description: '', category: 'General' });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

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
    setIsLoading(false);
  };

  const filteredCompetitions = competitions.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingCompetition(null);
    setFormData({ title: '', date: new Date().toISOString().split('T')[0], description: '', category: 'General' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (competition: Competition) => {
    setEditingCompetition(competition);
    setFormData({ 
      title: competition.title, 
      date: competition.date,
      description: competition.description || '',
      category: competition.category
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.date) {
      toast({ title: 'Error', description: 'Title and date are required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    const payload = {
      title: formData.title,
      date: formData.date,
      description: formData.description || null,
      category: formData.category
    };

    if (editingCompetition) {
      const { error } = await supabase
        .from('competitions')
        .update(payload)
        .eq('id', editingCompetition.id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Competition updated successfully' });
        setIsDialogOpen(false);
        fetchCompetitions();
      }
    } else {
      const { error } = await supabase
        .from('competitions')
        .insert(payload);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Competition created successfully' });
        setIsDialogOpen(false);
        fetchCompetitions();
      }
    }

    setIsSaving(false);
  };

  const handleDelete = async (competition: Competition) => {
    if (!confirm(`Are you sure you want to delete "${competition.title}"?`)) return;

    const { error } = await supabase
      .from('competitions')
      .delete()
      .eq('id', competition.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Competition deleted successfully' });
      fetchCompetitions();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search competitions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Competition
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCompetition ? 'Edit Competition' : 'Create Competition'}</DialogTitle>
              <DialogDescription>
                {editingCompetition ? 'Update the competition details.' : 'Add a new competition.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Competition Title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="General"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Competition description..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingCompetition ? 'Save Changes' : 'Create Competition'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Competition</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCompetitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No competitions found
                </TableCell>
              </TableRow>
            ) : (
              filteredCompetitions.map((competition) => (
                <TableRow key={competition.id} className="table-row-hover">
                  <TableCell>
                    <div>
                      <span className="font-medium">{competition.title}</span>
                      {competition.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{competition.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                      {competition.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(competition.date), 'MMM d, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(competition)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(competition)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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
