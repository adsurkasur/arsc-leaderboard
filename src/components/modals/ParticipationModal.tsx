'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, AlertCircle, RefreshCw, Search, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Competition, CompetitionScoringRule, CompetitionTrack } from '@/lib/types';
import { User } from '@supabase/supabase-js';
import { submitParticipation } from '@/lib/actions/stage3_participations';
import { submitCompetitionProposal } from '@/lib/actions/stage6_proposals';
import { RaporLinkForm } from '@/components/profile/RaporLinkForm';
import { getErrorMessage, withTimeout } from '@/lib/async';

const PARTICIPATION_REQUEST_TIMEOUT_MS = 12_000;

interface ParticipationModalProps {
  user: User | null;
  linkStatus: string | null;
  onIdentityLinked?: () => void | Promise<void>;
}

function isLinkedIdentity(status: string | null) {
  return status === 'linked_exact' || status === 'manually_linked';
}

export function ParticipationModal({ user, linkStatus, onIdentityLinked }: ParticipationModalProps) {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState('');
  const [competitionTrackId, setCompetitionTrackId] = useState('');
  const [scoringRuleId, setScoringRuleId] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [effectiveLinkStatus, setEffectiveLinkStatus] = useState<string | null>(linkStatus);
  const [isLoadingCompetitions, setIsLoadingCompetitions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submissionMode, setSubmissionMode] = useState<'existing' | 'proposal'>('existing');
  const [proposal, setProposal] = useState({
    title: '',
    organizer: '',
    informationUrl: '',
    date: '',
    level: 'Nasional',
    trackName: 'Umum',
    achievement: '',
    evidenceUrl: '',
    memberNotes: '',
  });

  const fetchCompetitions = useCallback(async () => {
    if (!user || !isLinkedIdentity(effectiveLinkStatus)) return;

    setIsLoadingCompetitions(true);
    setLoadError(null);
    try {
      const competitionsResult = await withTimeout(
        supabase
          .from('competitions')
          .select(`
            id,
            title,
            date,
            description,
            category,
            is_active,
            scoring_template_id,
            created_at,
            updated_at,
            scoring_rules:leaderboard_competition_scoring_rules(*),
            tracks:leaderboard_competition_tracks(*)
          `)
          .eq('is_active', true)
          .order('date', { ascending: false }),
        PARTICIPATION_REQUEST_TIMEOUT_MS,
        'Formulir belum merespons. Periksa koneksi lalu coba lagi.',
      );

      if (!competitionsResult.error) {
        setCompetitions((competitionsResult.data ?? []).map((competition) => ({
          ...competition,
          scoring_rules: [...((competition.scoring_rules ?? []) as CompetitionScoringRule[])]
            .filter((rule) => rule.is_active)
            .sort((a, b) => a.sort_order - b.sort_order),
          tracks: [...((competition.tracks ?? []) as CompetitionTrack[])]
            .filter((track) => track.is_active)
            .sort((a, b) => a.name.localeCompare(b.name)),
        })) as Competition[]);
        return;
      }

      // Preserve the deployed Stage 5 flow while Stage 6 still awaits its manual SQL step.
      const stage5Result = await withTimeout(
        supabase
          .from('competitions')
          .select(`
            id,
            title,
            date,
            description,
            category,
            is_active,
            scoring_template_id,
            created_at,
            updated_at,
            scoring_rules:leaderboard_competition_scoring_rules(*)
          `)
          .eq('is_active', true)
          .order('date', { ascending: false }),
        PARTICIPATION_REQUEST_TIMEOUT_MS,
      );

      if (stage5Result.error) throw competitionsResult.error;
      setCompetitions((stage5Result.data ?? []).map((competition) => ({
        ...competition,
        scoring_rules: [...((competition.scoring_rules ?? []) as CompetitionScoringRule[])]
          .filter((rule) => rule.is_active)
          .sort((a, b) => a.sort_order - b.sort_order),
        tracks: [{
          id: `stage5-default-${competition.id}`,
          competition_id: competition.id,
          name: 'Umum',
          description: 'Kategori bawaan sebelum Stage 6 aktif.',
          is_active: true,
          created_at: competition.created_at,
          updated_at: competition.updated_at,
        }],
      })) as Competition[]);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Formulir pengajuan belum dapat dimuat.'));
    } finally {
      setIsLoadingCompetitions(false);
    }
  }, [effectiveLinkStatus, user]);

  useEffect(() => {
    setEffectiveLinkStatus(linkStatus);
    setLoadError(null);
  }, [linkStatus, user?.id]);

  useEffect(() => {
    if (isModalOpen && user && isLinkedIdentity(effectiveLinkStatus)) {
      void fetchCompetitions();
    }
  }, [effectiveLinkStatus, fetchCompetitions, isModalOpen, user]);

  const handleSubmit = async () => {
    if (!competitionId || !competitionTrackId || !scoringRuleId || !evidenceUrl.trim()) {
      toast({
        title: 'Kesalahan',
        description: 'Silakan pilih kompetisi, kategori, capaian, dan sertakan URL bukti.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Execute the Stage 3 RPC explicitly (never write to participation_logs directly)
      const result = await withTimeout(
        submitParticipation(competitionId, competitionTrackId, scoringRuleId, evidenceUrl.trim()),
        PARTICIPATION_REQUEST_TIMEOUT_MS,
        'Pengajuan belum merespons. Periksa koneksi lalu coba lagi.',
      );

      if (!result.success) {
        toast({
          title: 'Kesalahan',
          description: result.error || 'Gagal mengirim partisipasi.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Berhasil',
          description: 'Permintaan partisipasi Anda telah dikirim untuk ditinjau.',
        });
        setIsModalOpen(false);
        setCompetitionId('');
        setCompetitionTrackId('');
        setScoringRuleId('');
        setEvidenceUrl('');
      }
    } catch (error) {
      toast({
        title: 'Kesalahan',
        description: getErrorMessage(error, 'Terjadi kesalahan yang tidak terduga.'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProposalSubmit = async () => {
    if (
      !proposal.title.trim()
      || !proposal.organizer.trim()
      || !proposal.informationUrl.trim()
      || !proposal.level.trim()
      || !proposal.trackName.trim()
      || !proposal.achievement.trim()
      || !proposal.evidenceUrl.trim()
    ) {
      toast({
        title: 'Informasi belum lengkap',
        description: 'Lengkapi nama, penyelenggara, sumber resmi, tingkat, kategori, capaian, dan tautan bukti.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await withTimeout(
        submitCompetitionProposal({
          title: proposal.title.trim(),
          organizer: proposal.organizer.trim(),
          informationUrl: proposal.informationUrl.trim(),
          date: proposal.date || null,
          level: proposal.level,
          trackName: proposal.trackName.trim(),
          achievement: proposal.achievement.trim(),
          evidenceUrl: proposal.evidenceUrl.trim(),
          memberNotes: proposal.memberNotes.trim() || null,
        }),
        PARTICIPATION_REQUEST_TIMEOUT_MS,
        'Usulan belum merespons. Periksa koneksi lalu coba lagi.',
      );

      if (!result.success) throw new Error(result.error);

      toast({
        title: 'Usulan kompetisi terkirim',
        description: 'Admin akan memeriksa informasi lomba. Setelah diterima, pengajuan partisipasi dibuat otomatis.',
      });
      setProposal({
        title: '',
        organizer: '',
        informationUrl: '',
        date: '',
        level: 'Nasional',
        trackName: 'Umum',
        achievement: '',
        evidenceUrl: '',
        memberNotes: '',
      });
      setIsModalOpen(false);
    } catch (error) {
      toast({
        title: 'Usulan belum terkirim',
        description: getErrorMessage(error, 'Terjadi kesalahan saat mengirim usulan.'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-12 gap-2 rounded-full bg-white px-6 text-slate-950 hover:bg-blue-50">
          <Plus className="w-5 h-5" />
          Ajukan Partisipasi
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajukan Partisipasi</DialogTitle>
          <DialogDescription>
            Pilih kompetisi yang sudah ada atau usulkan lomba baru. Semua bukti tetap ditinjau administrator.
          </DialogDescription>
        </DialogHeader>
        
        {isLoadingCompetitions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="space-y-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="space-y-1.5">
                <p className="font-medium text-destructive">Formulir belum dapat dimuat</p>
                <p className="text-sm leading-6 text-muted-foreground">{loadError}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void fetchCompetitions()}>
              <RefreshCw className="size-4" />
              Coba lagi
            </Button>
          </div>
        ) : !isLinkedIdentity(effectiveLinkStatus) ? (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4 text-sm">
              <p className="font-semibold text-foreground">Hubungkan Rapor sebelum mengajukan</p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                Ini memastikan pengajuan masuk ke identitas anggota yang benar. Anda tidak perlu menunggu admin.
              </p>
            </div>
            <RaporLinkForm
              compact
              onLinked={async () => {
                setEffectiveLinkStatus('linked_exact');
                await onIdentityLinked?.();
              }}
            />
          </div>
        ) : (
          <Tabs value={submissionMode} onValueChange={(value) => setSubmissionMode(value as 'existing' | 'proposal')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing" className="gap-2">
                <Search className="size-4" />
                Kompetisi terdaftar
              </TabsTrigger>
              <TabsTrigger value="proposal" className="gap-2">
                <Plus className="size-4" />
                Usulkan baru
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="mt-5 space-y-5">
              <div className="space-y-4">
              <div>
                <Label htmlFor="competition">Kompetisi *</Label>
                <Select
                  value={competitionId}
                  onValueChange={(value) => {
                    setCompetitionId(value);
                    const tracks = competitions.find((competition) => competition.id === value)?.tracks ?? [];
                    setCompetitionTrackId(tracks.length === 1 ? tracks[0].id : '');
                    setScoringRuleId('');
                  }}
                >
                  <SelectTrigger className="border-primary/20 focus:border-primary">
                    <SelectValue placeholder="Pilih kompetisi..." />
                  </SelectTrigger>
                  <SelectContent>
                    {competitions.length === 0 ? (
                      <SelectItem value="empty" disabled>Tidak ada kompetisi tersedia</SelectItem>
                    ) : (
                      competitions.map((comp) => (
                        <SelectItem key={comp.id} value={comp.id}>
                          {comp.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Tidak menemukannya? Gunakan tab “Usulkan baru”; Anda tidak perlu menunggu admin untuk mengisi ulang bukti.
                </p>
              </div>
              <div>
                <Label htmlFor="competition-track">Kategori/cabang *</Label>
                <Select
                  value={competitionTrackId}
                  onValueChange={setCompetitionTrackId}
                  disabled={!competitionId}
                >
                  <SelectTrigger id="competition-track" className="border-primary/20 focus:border-primary">
                    <SelectValue placeholder={competitionId ? 'Pilih kategori...' : 'Pilih kompetisi dahulu'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(competitions.find((competition) => competition.id === competitionId)?.tracks ?? []).map((track) => (
                      <SelectItem key={track.id} value={track.id}>{track.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Setiap kategori dapat memiliki pemenang yang sama, termasuk lebih dari satu Juara 1 untuk tim.
                </p>
              </div>
              <div>
                <Label htmlFor="achievement">Capaian yang diajukan *</Label>
                <Select
                  value={scoringRuleId}
                  onValueChange={setScoringRuleId}
                  disabled={!competitionId}
                >
                  <SelectTrigger id="achievement" className="border-primary/20 focus:border-primary">
                    <SelectValue placeholder={competitionId ? 'Pilih capaian...' : 'Pilih kompetisi dahulu'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(competitions.find((competition) => competition.id === competitionId)?.scoring_rules ?? []).length === 0 ? (
                      <SelectItem value="empty" disabled>Aturan poin belum tersedia</SelectItem>
                    ) : (
                      competitions
                        .find((competition) => competition.id === competitionId)
                        ?.scoring_rules?.map((rule) => (
                          <SelectItem key={rule.id} value={rule.id}>
                            {rule.label} · {rule.points} poin
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Admin akan mencocokkan capaian ini dengan bukti sebelum poin diberikan.
                </p>
              </div>
              <div>
                <Label htmlFor="evidenceUrl">Tautan Bukti (Evidence URL) *</Label>
                <Input
                  id="evidenceUrl"
                  type="url"
                  placeholder="https://gdrive.com/..."
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  className="border-primary/20 focus:border-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL ke sertifikat, pengumuman, atau bukti valid lainnya.
                </p>
              </div>
              </div>
              <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  'Kirim Permintaan'
                )}
              </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="proposal" className="mt-5 space-y-5">
              <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 text-sm leading-6 text-muted-foreground">
                Kirim informasi singkat tentang lomba. Admin akan memeriksa sumber, membuat atau menghubungkan
                kompetisi dan kategorinya, lalu pengajuan partisipasi Anda dibuat otomatis sebagai menunggu tinjauan.
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="proposal-title">Nama kompetisi *</Label>
                  <Input
                    id="proposal-title"
                    value={proposal.title}
                    onChange={(event) => setProposal({ ...proposal, title: event.target.value })}
                    placeholder="Contoh: Gemastik 2026"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">Gunakan nama resmi kegiatan beserta tahun atau edisinya agar tidak tertukar.</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="proposal-organizer">Penyelenggara *</Label>
                  <Input
                    id="proposal-organizer"
                    value={proposal.organizer}
                    onChange={(event) => setProposal({ ...proposal, organizer: event.target.value })}
                    placeholder="Nama institusi atau organisasi"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">Tuliskan pihak yang secara resmi menyelenggarakan atau menaungi lomba.</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="proposal-info-url">Sumber informasi resmi *</Label>
                  <Input
                    id="proposal-info-url"
                    type="url"
                    value={proposal.informationUrl}
                    onChange={(event) => setProposal({ ...proposal, informationUrl: event.target.value })}
                    placeholder="https://instagram.com/... atau situs resmi"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">Tautkan situs, unggahan Instagram, atau pengumuman resmi yang menjelaskan kompetisi.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal-date">Tanggal (jika diketahui)</Label>
                  <Input
                    id="proposal-date"
                    type="date"
                    value={proposal.date}
                    onChange={(event) => setProposal({ ...proposal, date: event.target.value })}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">Boleh dikosongkan bila tanggal belum diumumkan.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal-level">Tingkat kompetisi *</Label>
                  <Select value={proposal.level} onValueChange={(level) => setProposal({ ...proposal, level })}>
                    <SelectTrigger id="proposal-level"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Internal ARSC', 'Internal UB', 'Regional', 'Nasional', 'Internasional', 'PKM', 'Lainnya'].map((level) => (
                        <SelectItem key={level} value={level}>{level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-muted-foreground">Pilih jangkauan peserta tertinggi yang berlaku untuk kompetisi ini.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal-track">Kategori/cabang *</Label>
                  <Input
                    id="proposal-track"
                    value={proposal.trackName}
                    onChange={(event) => setProposal({ ...proposal, trackName: event.target.value })}
                    placeholder="Umum atau contoh: UI/UX Design"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">Satu acara dapat memiliki beberapa kategori dan lebih dari satu Juara 1.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal-achievement">Capaian yang diraih *</Label>
                  <Input
                    id="proposal-achievement"
                    value={proposal.achievement}
                    onChange={(event) => setProposal({ ...proposal, achievement: event.target.value })}
                    placeholder="Contoh: Juara 1 atau Finalis"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">Tulis hasil yang tertera pada pengumuman atau sertifikat; admin akan memetakannya ke skor resmi.</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="proposal-evidence">Tautan bukti *</Label>
                  <Input
                    id="proposal-evidence"
                    type="url"
                    value={proposal.evidenceUrl}
                    onChange={(event) => setProposal({ ...proposal, evidenceUrl: event.target.value })}
                    placeholder="https://drive.google.com/..."
                  />
                  <p className="text-xs leading-5 text-muted-foreground">Pastikan tautan dapat dibuka admin tanpa meminta akses tambahan.</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="proposal-notes">Keterangan tambahan (opsional)</Label>
                  <Textarea
                    id="proposal-notes"
                    value={proposal.memberNotes}
                    onChange={(event) => setProposal({ ...proposal, memberNotes: event.target.value })}
                    placeholder="Informasi yang membantu admin memverifikasi lomba atau kategori."
                    rows={3}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">Tambahkan konteks bila nama tim, kategori, atau hasil pada bukti tidak langsung terlihat.</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
                <Button onClick={() => void handleProposalSubmit()} disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Kirim usulan
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
