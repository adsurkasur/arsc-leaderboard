'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ExternalLink, Inbox, Loader2, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import {
  Competition,
  CompetitionProposal,
  CompetitionScoringRule,
  CompetitionTrack,
  Profile,
  ScoringTemplate,
  ScoringTemplateRule,
} from '@/lib/types';
import { reviewCompetitionProposal } from '@/lib/actions/stage6_proposals';
import { getErrorMessage } from '@/lib/async';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CaseThread } from '@/components/requests/CaseThread';
import { useAuth } from '@/hooks/useAuth';

type ProposalWithProfile = CompetitionProposal & { profile?: Profile };
type CompetitionOption = Competition & {
  scoring_rules: CompetitionScoringRule[];
  tracks: CompetitionTrack[];
};

interface ReviewForm {
  mode: 'new' | 'existing';
  competitionId: string;
  title: string;
  date: string;
  description: string;
  category: string;
  templateId: string | null;
  rules: Array<{ label: string; points: number }>;
  tracks: Array<{ name: string }>;
  trackId: string;
  trackName: string;
  scoringRuleLabel: string;
  reviewNotes: string;
}

function proposalBadge(status: string) {
  if (status === 'pending') return <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">Menunggu</Badge>;
  if (status === 'needs_info') return <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">Perlu informasi</Badge>;
  if (status === 'accepted') return <Badge variant="outline" className="border-success/20 bg-success/10 text-success">Ditambahkan</Badge>;
  return <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">Ditolak</Badge>;
}

function normalizeRules<T extends CompetitionScoringRule | ScoringTemplateRule>(rules: T[]) {
  return [...rules].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

export function CompetitionProposalsManagement() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<ProposalWithProfile[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [templates, setTemplates] = useState<ScoringTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [reviewing, setReviewing] = useState<ProposalWithProfile | null>(null);
  const [form, setForm] = useState<ReviewForm | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [proposalResult, competitionResult, templateResult] = await Promise.all([
        supabase
          .from('leaderboard_competition_proposals')
          .select('*, profile:profiles(id, full_name, bidang_biro, avatar_url)')
          .order('created_at', { ascending: false }),
        supabase
          .from('competitions')
          .select('*, scoring_rules:leaderboard_competition_scoring_rules(*), tracks:leaderboard_competition_tracks(*)')
          .order('title'),
        supabase
          .from('leaderboard_scoring_templates')
          .select('*, rules:leaderboard_scoring_template_rules(*)')
          .order('name'),
      ]);

      if (proposalResult.error) throw proposalResult.error;
      if (competitionResult.error) throw competitionResult.error;
      if (templateResult.error) throw templateResult.error;

      setProposals(proposalResult.data as unknown as ProposalWithProfile[]);
      setCompetitions((competitionResult.data ?? []).map((competition) => ({
        ...competition,
        scoring_rules: normalizeRules((competition.scoring_rules ?? []) as CompetitionScoringRule[]),
        tracks: [...((competition.tracks ?? []) as CompetitionTrack[])].sort((a, b) => a.name.localeCompare(b.name)),
      })) as CompetitionOption[]);
      setTemplates((templateResult.data ?? []).map((template) => ({
        ...template,
        rules: normalizeRules((template.rules ?? []) as ScoringTemplateRule[]),
      })) as ScoringTemplate[]);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Usulan kompetisi belum dapat dimuat.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredProposals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return proposals.filter((proposal) => {
      const matchesQuery = !normalizedQuery
        || proposal.proposed_title.toLowerCase().includes(normalizedQuery)
        || proposal.proposed_organizer.toLowerCase().includes(normalizedQuery)
        || proposal.profile?.full_name?.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'open' && ['pending', 'needs_info'].includes(proposal.status))
        || proposal.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [proposals, query, statusFilter]);

  const chooseTemplate = useCallback((proposal: CompetitionProposal) => {
    const level = proposal.proposed_level.toLowerCase();
    return templates.find((template) =>
      template.code === (level === 'internal arsc' ? 'internal-arsc' : '')
      || template.suggested_category.toLowerCase() === level,
    ) ?? templates.find((template) => template.code === 'umum') ?? templates[0];
  }, [templates]);

  const openReview = (proposal: ProposalWithProfile) => {
    const template = chooseTemplate(proposal);
    const proposedRule = template?.rules.find(
      (rule) => rule.label.toLowerCase() === proposal.proposed_achievement.toLowerCase(),
    ) ?? template?.rules[0];

    setReviewing(proposal);
    setForm({
      mode: 'new',
      competitionId: '',
      title: proposal.proposed_title,
      date: proposal.proposed_date ?? new Date().toISOString().slice(0, 10),
      description: `${proposal.proposed_organizer}. Sumber resmi: ${proposal.information_url}`,
      category: proposal.proposed_level,
      templateId: template?.id ?? null,
      rules: template?.rules.map((rule) => ({ label: rule.label, points: rule.points })) ?? [],
      tracks: [{ name: proposal.proposed_track_name }],
      trackId: '',
      trackName: proposal.proposed_track_name,
      scoringRuleLabel: proposedRule?.label ?? '',
      reviewNotes: '',
    });
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template || !form) return;
    const proposedLabel = reviewing?.proposed_achievement.toLowerCase();
    const scoringRule = template.rules.find((rule) => rule.label.toLowerCase() === proposedLabel) ?? template.rules[0];
    setForm({
      ...form,
      templateId: template.id,
      category: template.suggested_category,
      rules: template.rules.map((rule) => ({ label: rule.label, points: rule.points })),
      scoringRuleLabel: scoringRule?.label ?? '',
    });
  };

  const selectExistingCompetition = (competitionId: string) => {
    if (!form) return;
    const competition = competitions.find((item) => item.id === competitionId);
    if (!competition) return;
    const proposedTrack = reviewing?.proposed_track_name.toLowerCase();
    const matchingTrack = competition.tracks.find((track) => track.name.toLowerCase() === proposedTrack);
    const proposedAchievement = reviewing?.proposed_achievement.toLowerCase();
    const matchingRule = competition.scoring_rules.find((rule) => rule.label.toLowerCase() === proposedAchievement)
      ?? competition.scoring_rules.find((rule) => rule.is_active);
    setForm({
      ...form,
      mode: 'existing',
      competitionId,
      trackId: matchingTrack?.id ?? '',
      trackName: matchingTrack?.name ?? reviewing?.proposed_track_name ?? 'Umum',
      scoringRuleLabel: matchingRule?.label ?? '',
    });
  };

  const handleSimpleDecision = async (status: 'needs_info' | 'rejected') => {
    if (!reviewing || !form?.reviewNotes.trim()) {
      toast({ title: 'Catatan diperlukan', description: 'Jelaskan informasi yang kurang atau alasan penolakan.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const result = await reviewCompetitionProposal({
      proposalId: reviewing.id,
      status,
      reviewNotes: form.reviewNotes.trim(),
    });
    setIsSaving(false);
    if (!result.success) {
      toast({ title: 'Keputusan belum tersimpan', description: result.error, variant: 'destructive' });
      return;
    }
    toast({ title: status === 'needs_info' ? 'Informasi tambahan diminta' : 'Usulan ditolak' });
    setReviewing(null);
    await fetchData();
  };

  const handleAccept = async () => {
    if (!reviewing || !form) return;
    if (!form.scoringRuleLabel) {
      toast({ title: 'Capaian belum dipetakan', description: 'Pilih capaian resmi yang sesuai dengan usulan anggota.', variant: 'destructive' });
      return;
    }
    if (form.mode === 'new' && (!form.title.trim() || !form.date || !form.category.trim() || form.rules.length === 0)) {
      toast({ title: 'Kompetisi belum lengkap', description: 'Lengkapi nama, tanggal, tingkat, dan preset scoring.', variant: 'destructive' });
      return;
    }
    if (form.mode === 'existing' && !form.competitionId) return;
    if (!form.trackName.trim()) {
      toast({
        title: 'Kategori/cabang belum diisi',
        description: 'Pilih kategori yang sudah ada atau tulis nama kategori baru.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const result = await reviewCompetitionProposal({
      proposalId: reviewing.id,
      status: 'accepted',
      reviewNotes: form.reviewNotes.trim() || null,
      competitionId: form.mode === 'existing' ? form.competitionId : null,
      title: form.mode === 'new' ? form.title.trim() : null,
      date: form.mode === 'new' ? form.date : null,
      description: form.mode === 'new' ? form.description.trim() || null : null,
      category: form.mode === 'new' ? form.category.trim() : null,
      isActive: true,
      templateId: form.mode === 'new' ? form.templateId : null,
      rules: form.mode === 'new'
        ? form.rules.map((rule, index) => ({ ...rule, sort_order: (index + 1) * 10 }))
        : null,
      tracks: form.mode === 'new' ? form.tracks : null,
      trackId: form.mode === 'existing' ? form.trackId || null : null,
      trackName: form.trackName,
      scoringRuleLabel: form.scoringRuleLabel,
    });
    setIsSaving(false);

    if (!result.success) {
      toast({ title: 'Usulan belum dapat diterima', description: result.error, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Kompetisi siap digunakan',
      description: 'Kompetisi/kategori telah disimpan dan pengajuan anggota dibuat sebagai menunggu tinjauan.',
    });
    setReviewing(null);
    await fetchData();
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full" />)}</div>;
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
        <p className="font-medium text-destructive">Usulan belum dapat dimuat</p>
        <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
        <Button className="mt-4 gap-2" variant="outline" size="sm" onClick={() => void fetchData()}>
          <RefreshCw className="size-4" /> Coba lagi
        </Button>
      </div>
    );
  }

  const existingCompetition = form?.competitionId
    ? competitions.find((competition) => competition.id === form.competitionId)
    : null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-muted/25 p-4 text-sm leading-6 text-muted-foreground">
        Anggota dapat mengusulkan lomba yang belum ada. Terima sebagai kompetisi baru, tambahkan kategori ke acara
        yang sudah ada, atau minta informasi tambahan. Pengajuan partisipasi dibuat otomatis setelah usulan diterima.
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama lomba, penyelenggara, atau anggota" className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Perlu ditangani</SelectItem>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="accepted">Ditambahkan</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kompetisi</TableHead>
              <TableHead>Pengusul</TableHead>
              <TableHead>Sumber</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProposals.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground"><Inbox className="mx-auto mb-2 size-7 opacity-50" />Tidak ada usulan pada filter ini</TableCell></TableRow>
            ) : filteredProposals.map((proposal) => (
              <TableRow key={proposal.id}>
                <TableCell>
                  <p className="font-medium">{proposal.proposed_title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{proposal.proposed_track_name} · {proposal.proposed_level} · {proposal.proposed_achievement}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm">{proposal.profile?.full_name ?? 'Anggota'}</p>
                  <p className="text-xs text-muted-foreground">{proposal.profile?.bidang_biro ?? '-'}</p>
                </TableCell>
                <TableCell>
                  <a href={proposal.information_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Buka <ExternalLink className="size-3" /></a>
                </TableCell>
                <TableCell>{proposalBadge(proposal.status)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => openReview(proposal)} disabled={!['pending', 'needs_info'].includes(proposal.status)}>Tinjau</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tinjau usulan kompetisi</DialogTitle>
            <DialogDescription>
              Periksa sumber, tentukan kompetisi dan kategori, lalu petakan capaian anggota ke aturan resmi.
            </DialogDescription>
          </DialogHeader>

          {reviewing && form && (
            <div className="space-y-6 py-2">
              <div className="grid gap-3 rounded-2xl border bg-muted/25 p-4 text-sm sm:grid-cols-2">
                <div><p className="text-xs text-muted-foreground">Usulan</p><p className="font-medium">{reviewing.proposed_title}</p></div>
                <div><p className="text-xs text-muted-foreground">Penyelenggara</p><p className="font-medium">{reviewing.proposed_organizer}</p></div>
                <div><p className="text-xs text-muted-foreground">Kategori/cabang</p><p className="font-medium">{reviewing.proposed_track_name}</p></div>
                <div><p className="text-xs text-muted-foreground">Capaian</p><p className="font-medium">{reviewing.proposed_achievement}</p></div>
                <div className="flex gap-3 sm:col-span-2">
                  <a href={reviewing.information_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Sumber resmi <ExternalLink className="size-3.5" /></a>
                  <a href={reviewing.evidence_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Bukti <ExternalLink className="size-3.5" /></a>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Gunakan kompetisi</Label>
                <Select value={form.mode} onValueChange={(mode) => setForm({ ...form, mode: mode as 'new' | 'existing', competitionId: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Buat kompetisi baru</SelectItem>
                    <SelectItem value="existing">Hubungkan ke kompetisi yang sudah ada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.mode === 'new' ? (
                <div className="space-y-4 rounded-2xl border p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2"><Label>Nama kompetisi</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
                    <div className="space-y-2"><Label>Tanggal</Label><Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></div>
                    <div className="space-y-2"><Label>Tingkat/kategori</Label><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></div>
                    <div className="space-y-2 sm:col-span-2"><Label>Deskripsi</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} /></div>
                    <div className="space-y-2"><Label>Preset scoring</Label><Select value={form.templateId ?? ''} onValueChange={applyTemplate}><SelectTrigger><SelectValue placeholder="Pilih preset" /></SelectTrigger><SelectContent>{templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Kategori/cabang dibuat</Label><Input value={form.trackName} onChange={(event) => setForm({ ...form, trackName: event.target.value, tracks: [{ name: event.target.value }] })} /></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 rounded-2xl border p-4">
                  <div className="space-y-2"><Label>Kompetisi terdaftar</Label><Select value={form.competitionId} onValueChange={selectExistingCompetition}><SelectTrigger><SelectValue placeholder="Pilih kompetisi" /></SelectTrigger><SelectContent>{competitions.map((competition) => <SelectItem key={competition.id} value={competition.id}>{competition.title}</SelectItem>)}</SelectContent></Select></div>
                  {existingCompetition && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Kategori yang sudah ada</Label>
                        <Select value={form.trackId || 'new'} onValueChange={(trackId) => {
                          const track = existingCompetition.tracks.find((item) => item.id === trackId);
                          setForm({ ...form, trackId: trackId === 'new' ? '' : trackId, trackName: track?.name ?? reviewing.proposed_track_name });
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{existingCompetition.tracks.filter((track) => track.is_active).map((track) => <SelectItem key={track.id} value={track.id}>{track.name}</SelectItem>)}<SelectItem value="new">+ Tambahkan kategori baru</SelectItem></SelectContent>
                        </Select>
                      </div>
                      {!form.trackId && <div className="space-y-2"><Label>Nama kategori baru</Label><Input value={form.trackName} onChange={(event) => setForm({ ...form, trackName: event.target.value })} /></div>}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Capaian resmi untuk pengajuan *</Label>
                <Select value={form.scoringRuleLabel} onValueChange={(scoringRuleLabel) => setForm({ ...form, scoringRuleLabel })}>
                  <SelectTrigger><SelectValue placeholder="Pilih capaian" /></SelectTrigger>
                  <SelectContent>
                    {(form.mode === 'new' ? form.rules : existingCompetition?.scoring_rules.filter((rule) => rule.is_active) ?? []).map((rule) => (
                      <SelectItem key={rule.label} value={rule.label}>{rule.label} · {rule.points} poin</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-5 text-muted-foreground">Anggota menulis “{reviewing.proposed_achievement}”. Admin tetap menentukan capaian resmi berdasarkan bukti.</p>
              </div>

              <div className="space-y-2"><Label>Catatan admin</Label><Textarea value={form.reviewNotes} onChange={(event) => setForm({ ...form, reviewNotes: event.target.value })} placeholder="Wajib untuk meminta informasi atau menolak." rows={3} /></div>

              {user && (
                <CaseThread caseType="proposal" caseId={reviewing.id} currentUserId={user.id} isAdmin />
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => void handleSimpleDecision('rejected')} disabled={isSaving}>Tolak</Button>
              <Button variant="outline" onClick={() => void handleSimpleDecision('needs_info')} disabled={isSaving}>Minta informasi</Button>
            </div>
            <Button onClick={() => void handleAccept()} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              Simpan & lanjutkan pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
