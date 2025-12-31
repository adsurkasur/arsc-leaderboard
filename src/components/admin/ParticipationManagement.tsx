'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Plus, Trash2, Loader2, CheckCircle, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

type SortField = 'user' | 'competition' | 'verified_at' | 'participation_date';
type SortDirection = 'asc' | 'desc';

export function ParticipationManagement() {
  const [logs, setLogs] = useState<ParticipationLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [competitionName, setCompetitionName] = useState<string>('');
  const [participationDate, setParticipationDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('verified_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingLog, setEditingLog] = useState<ParticipationLog | null>(null);
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

  const sortedAndFilteredLogs = useMemo(() => {
    let filtered = logs.filter(log => {
      const searchLower = searchQuery.toLowerCase();
      return (
        log.profile?.full_name?.toLowerCase().includes(searchLower) ||
        log.competition?.title?.toLowerCase().includes(searchLower)
      );
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'user':
          comparison = (a.profile?.full_name || '').localeCompare(b.profile?.full_name || '');
          break;
        case 'competition':
          comparison = (a.competition?.title || '').localeCompare(b.competition?.title || '');
          break;
        case 'verified_at':
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case 'participation_date':
          const pDateA = a.participation_date ? new Date(a.participation_date).getTime() : 0;
          const pDateB = b.participation_date ? new Date(b.participation_date).getTime() : 0;
          comparison = pDateA - pDateB;
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [logs, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1" /> 
      : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  const openCreateDialog = () => {
    setEditingLog(null);
    setSelectedProfile('');
    setCompetitionName('');
    setParticipationDate('');
    setNotes('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (log: ParticipationLog) => {
    setEditingLog(log);
    setSelectedProfile(log.profile_id);
    setCompetitionName(log.competition?.title || '');
    setParticipationDate(log.participation_date ? log.participation_date.slice(0, 16) : '');
    setNotes(log.notes || '');
    setIsDialogOpen(true);
  };

  const handleSaveParticipation = async () => {
    if (!selectedProfile || !competitionName.trim()) {
      toast({ title: 'Gagal', description: 'Silakan pilih pengguna dan masukkan nama kompetisi', variant: 'destructive' });
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
            category: 'other',
            date: new Date().toISOString().split('T')[0],
          })
          .select('id')
          .single();

        if (createError) {
          toast({
            title: 'Gagal',
            description: 'Gagal membuat kompetisi: ' + createError.message,
            variant: 'destructive',
          });
          setIsSaving(false);
          return;
        }

        competitionId = newCompetition.id;
        await fetchData();
      }

      if (editingLog) {
        // Update existing log
        const { error } = await supabase
          .from('participation_logs')
          .update({
            profile_id: selectedProfile,
            competition_id: competitionId,
            participation_date: participationDate ? new Date(participationDate).toISOString() : null,
            notes: notes || null
          })
          .eq('id', editingLog.id);

        if (error) {
          toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Berhasil', description: 'Log partisipasi berhasil diperbarui' });
          setIsDialogOpen(false);
          fetchData();
        }
      } else {
        // Add new participation log
        const { error } = await supabase
          .from('participation_logs')
          .insert({
            profile_id: selectedProfile,
            competition_id: competitionId,
            admin_id: user?.id,
            participation_date: participationDate ? new Date(participationDate).toISOString() : null,
            notes: notes || null
          });

        if (error) {
          if (error.code === '23505') {
            toast({ title: 'Gagal', description: 'Pengguna ini sudah terdaftar untuk kompetisi ini', variant: 'destructive' });
          } else {
            toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
          }
        } else {
          toast({ title: 'Berhasil', description: 'Partisipasi berhasil ditambahkan' });
          setIsDialogOpen(false);
          fetchData();
        }
      }
    } catch (error) {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan yang tidak terduga.',
        variant: 'destructive',
      });
    }

    setIsSaving(false);
  };

  const handleDelete = async (log: ParticipationLog) => {
    if (!confirm('Apakah Anda yakin ingin menghapus entri partisipasi ini?')) return;

    const { error } = await supabase
      .from('participation_logs')
      .delete()
      .eq('id', log.id);

    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Partisipasi berhasil dihapus' });
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
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari log partisipasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              Tambah Partisipasi
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLog ? 'Edit Log Partisipasi' : 'Tambah Entri Partisipasi'}</DialogTitle>
              <DialogDescription>
                {editingLog ? 'Perbarui detail log partisipasi.' : 'Catat partisipasi pengguna dalam kompetisi.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Pilih Pengguna</Label>
                <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih pengguna..." />
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
                <Label>Nama Kompetisi</Label>
                <Input
                  placeholder="Masukkan nama kompetisi"
                  value={competitionName}
                  onChange={(e) => setCompetitionName(e.target.value)}
                  className="border-primary/20 focus:border-primary"
                />
                <p className="text-xs text-muted-foreground">
                  Jika kompetisi belum ada, akan dibuat otomatis.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Waktu Partisipasi</Label>
                <Input
                  type="datetime-local"
                  value={participationDate}
                  onChange={(e) => setParticipationDate(e.target.value)}
                  className="border-primary/20 focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Catatan (opsional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
              <Button onClick={handleSaveParticipation} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingLog ? 'Simpan Perubahan' : 'Tambah Entri'}
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
                <Button variant="ghost" size="sm" onClick={() => handleSort('user')} className="font-semibold -ml-2">
                  Pengguna <SortIcon field="user" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('competition')} className="font-semibold -ml-2">
                  Kompetisi <SortIcon field="competition" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('participation_date')} className="font-semibold -ml-2">
                  Waktu Partisipasi <SortIcon field="participation_date" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('verified_at')} className="font-semibold -ml-2">
                  Diverifikasi Pada <SortIcon field="verified_at" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Tidak ada log partisipasi ditemukan
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredLogs.map((log) => (
                <TableRow key={log.id} className="table-row-hover">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={log.profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {log.profile ? getInitials(log.profile.full_name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{log.profile?.full_name || 'Tidak Dikenal'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <span>{log.competition?.title || 'Tidak Dikenal'}</span>
                      {log.competition?.date && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.competition.date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.participation_date ? (
                      <span className="text-sm">
                        {format(new Date(log.participation_date), 'dd MMM yyyy, HH:mm')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle className="w-4 h-4" />
                      {log.created_at ? format(new Date(log.created_at), 'dd MMM yyyy, HH:mm') : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => openEditDialog(log)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDelete(log)} 
                        className="text-destructive hover:text-destructive"
                      >
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
