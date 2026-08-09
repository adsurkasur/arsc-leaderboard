'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Profile, Competition, CompetitionScoringRule, ParticipationLog } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Search, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { reviewParticipation } from '@/lib/actions/stage3_participations';

type SortField = 'user' | 'competition' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc';

export function ParticipationManagement() {
  const [logs, setLogs] = useState<ParticipationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Review state
  const [reviewingLog, setReviewingLog] = useState<ParticipationLog | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>('');
  const [reviewRuleId, setReviewRuleId] = useState('');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [rulesByCompetition, setRulesByCompetition] = useState<Record<string, CompetitionScoringRule[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: logsData, error }, rulesResult] = await Promise.all([
      supabase
        .from('participation_logs')
        .select(`
          *,
          profile:profiles(id, full_name, avatar_url),
          competition:competitions(id, title, date)
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('leaderboard_competition_scoring_rules')
        .select('*')
        .order('sort_order'),
    ]);

    if (!error && logsData) {
      const transformedLogs = logsData.map(log => {
        const logData = log as unknown as ParticipationLog;
        return {
          ...logData,
          profile: logData.profile as unknown as Profile,
          competition: logData.competition as unknown as Competition
        };
      });
      setLogs(transformedLogs);
    }

    if (!rulesResult.error) {
      const grouped = (rulesResult.data ?? []).reduce<Record<string, CompetitionScoringRule[]>>(
        (result, rule) => {
          result[rule.competition_id] ??= [];
          result[rule.competition_id].push(rule);
          return result;
        },
        {},
      );
      setRulesByCompetition(grouped);
    } else {
      setRulesByCompetition({});
    }
    setIsLoading(false);
  };

  const sortedAndFilteredLogs = useMemo(() => {
    const filtered = logs.filter(log => {
      const searchLower = searchQuery.toLowerCase();
      return (
        log.profile?.full_name?.toLowerCase().includes(searchLower) ||
        log.competition?.title?.toLowerCase().includes(searchLower)
      );
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'user':
          comparison = (a.profile?.full_name || '').localeCompare(b.profile?.full_name || '');
          break;
        case 'competition':
          comparison = (a.competition?.title || '').localeCompare(b.competition?.title || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'created_at': {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
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

  const openReviewDialog = (log: ParticipationLog) => {
    setReviewingLog(log);
    setReviewStatus(log.status || 'pending');
    setReviewRuleId(log.awarded_scoring_rule_id ?? log.requested_scoring_rule_id ?? '');
    setReviewNotes(log.notes || '');
    setIsDialogOpen(true);
  };

  const handleReviewSubmission = async () => {
    if (!reviewingLog || !reviewingLog.id) return;
    if (reviewStatus !== 'approved' && reviewStatus !== 'rejected') {
      toast({ title: 'Gagal', description: 'Status harus disetujui atau ditolak.', variant: 'destructive' });
      return;
    }
    
    setIsSaving(true);

    try {
      const result = await reviewParticipation(
        reviewingLog.id, 
        reviewStatus, 
        reviewStatus === 'approved' ? reviewRuleId : null,
        reviewNotes
      );

      if (!result.success) {
        toast({ title: 'Gagal', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Ulasan berhasil disimpan.' });
        setIsDialogOpen(false);
        fetchData();
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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Menunggu</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Disetujui</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Ditolak</Badge>;
      default:
        return null;
    }
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
            placeholder="Cari pengguna atau kompetisi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
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
              <TableHead>Bukti</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="font-semibold -ml-2">
                  Status <SortIcon field="status" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('created_at')} className="font-semibold -ml-2">
                  Waktu Kirim <SortIcon field="created_at" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Tidak ada data partisipasi
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
                      <span className="font-medium">{log.competition?.title || 'Tidak Dikenal'}</span>
                      {log.requested_achievement && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Diajukan: {log.requested_achievement}
                          {log.requested_points !== null ? ` · ${log.requested_points} poin` : ''}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.evidence_url ? (
                      <a href={log.evidence_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                        Lihat <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(log.status || 'pending')}
                      {log.awarded_points !== null && log.status === 'approved' && (
                        <span className="text-xs font-semibold text-success">+{log.awarded_points} pts</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {log.created_at ? format(new Date(log.created_at), 'dd MMM yyyy, HH:mm') : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openReviewDialog(log)}
                      disabled={log.status !== 'pending'}
                    >
                      {log.status === 'pending' ? 'Tinjau' : 'Selesai'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tinjau Partisipasi</DialogTitle>
            <DialogDescription>
              Tinjau partisipasi oleh {reviewingLog?.profile?.full_name} untuk {reviewingLog?.competition?.title}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tautan Bukti</Label>
              <div>
                <a href={reviewingLog?.evidence_url || '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-2">
                  Buka Dokumen Bukti <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Status Keputusan *</Label>
              <Select value={reviewStatus} onValueChange={setReviewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih keputusan..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Setujui</SelectItem>
                  <SelectItem value="rejected">Tolak</SelectItem>
                  <SelectItem value="pending" disabled>Menunggu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {reviewStatus === 'approved' && (
              <div className="space-y-2">
                <Label>Capaian terverifikasi *</Label>
                <Select value={reviewRuleId} onValueChange={setReviewRuleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih capaian sesuai bukti..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(reviewingLog
                      ? rulesByCompetition[reviewingLog.competition_id] ?? []
                      : []
                    )
                      .filter((rule) => rule.is_active || rule.id === reviewingLog?.requested_scoring_rule_id)
                      .map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.label} · {rule.points} poin
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reviewingLog?.requested_achievement && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Anggota mengajukan <span className="font-medium text-foreground">{reviewingLog.requested_achievement}</span>
                    {reviewingLog.requested_points !== null ? ` (${reviewingLog.requested_points} poin)` : ''}.
                    Admin tetap dapat memilih capaian lain jika bukti menunjukkan hasil berbeda.
                  </p>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="notes">Catatan (opsional)</Label>
              <Textarea
                id="notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Alasan penolakan atau catatan tambahan..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleReviewSubmission} disabled={isSaving || reviewStatus === 'pending' || (reviewStatus === 'approved' && !reviewRuleId)}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Kirim Tinjauan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
