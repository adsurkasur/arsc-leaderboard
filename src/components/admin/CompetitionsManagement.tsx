'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Competition } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, Search, Calendar, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

type SortField = 'title' | 'category' | 'date';
type SortDirection = 'asc' | 'desc';

export function CompetitionsManagement() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<Competition | null>(null);
  const [formData, setFormData] = useState({ title: '', date: '', description: '', category: 'other' });
  const [isSaving, setIsSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
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

  const sortedAndFilteredCompetitions = useMemo(() => {
    let filtered = competitions.filter(c => 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [competitions, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'title' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1" /> 
      : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  const openCreateDialog = () => {
    setEditingCompetition(null);
    setFormData({ title: '', date: new Date().toISOString().split('T')[0], description: '', category: 'other' });
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
      toast({ title: 'Gagal', description: 'Judul dan tanggal wajib diisi', variant: 'destructive' });
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
        toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Kompetisi berhasil diperbarui' });
        setIsDialogOpen(false);
        fetchCompetitions();
      }
    } else {
      const { error } = await supabase
        .from('competitions')
        .insert(payload);

      if (error) {
        toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Kompetisi berhasil dibuat' });
        setIsDialogOpen(false);
        fetchCompetitions();
      }
    }

    setIsSaving(false);
  };

  const handleDelete = async (competition: Competition) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus "${competition.title}"?`)) return;

    const { error } = await supabase
      .from('competitions')
      .delete()
      .eq('id', competition.id);

    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Kompetisi berhasil dihapus' });
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
            placeholder="Cari kompetisi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              Tambah Kompetisi
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCompetition ? 'Edit Kompetisi' : 'Buat Kompetisi'}</DialogTitle>
              <DialogDescription>
                {editingCompetition ? 'Perbarui detail kompetisi.' : 'Tambahkan kompetisi baru.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Judul</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Judul Kompetisi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Tanggal</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Kategori</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Umum"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi (opsional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Deskripsi kompetisi..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingCompetition ? 'Simpan Perubahan' : 'Buat Kompetisi'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('title')} className="font-semibold -ml-2">
                  Kompetisi <SortIcon field="title" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('category')} className="font-semibold -ml-2">
                  Kategori <SortIcon field="category" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('date')} className="font-semibold -ml-2">
                  Tanggal <SortIcon field="date" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredCompetitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Tidak ada kompetisi ditemukan
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredCompetitions.map((competition) => (
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
