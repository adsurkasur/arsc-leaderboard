'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Competition, CompetitionScoringRule } from '@/lib/types';
import { User } from '@supabase/supabase-js';
import { submitParticipation } from '@/lib/actions/stage3_participations';
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
  const [scoringRuleId, setScoringRuleId] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [effectiveLinkStatus, setEffectiveLinkStatus] = useState<string | null>(linkStatus);
  const [isLoadingCompetitions, setIsLoadingCompetitions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
            scoring_rules:leaderboard_competition_scoring_rules(*)
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
        })) as Competition[]);
        return;
      }

      // Compatibility fallback while the Stage 5 SQL artifact awaits manual execution.
      const legacyResult = await withTimeout(
        supabase
          .from('competitions')
          .select('id, title, date, description, category, created_at, updated_at')
          .order('date', { ascending: false }),
        PARTICIPATION_REQUEST_TIMEOUT_MS,
      );

      if (legacyResult.error) throw competitionsResult.error;
      setCompetitions((legacyResult.data ?? []).map((competition) => ({
        ...competition,
        is_active: true,
        scoring_template_id: null,
        scoring_rules: [],
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
    if (!competitionId || !scoringRuleId || !evidenceUrl.trim()) {
      toast({
        title: 'Kesalahan',
        description: 'Silakan pilih kompetisi, capaian, dan sertakan URL bukti.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Execute the Stage 3 RPC explicitly (never write to participation_logs directly)
      const result = await withTimeout(
        submitParticipation(competitionId, scoringRuleId, evidenceUrl.trim()),
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

  if (!user) return null;

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-12 gap-2 rounded-full bg-white px-6 text-slate-950 hover:bg-blue-50">
          <Plus className="w-5 h-5" />
          Ajukan Partisipasi
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajukan Partisipasi</DialogTitle>
          <DialogDescription>
            Pilih kompetisi, capaian yang diraih, dan tautan bukti Anda.
            Permintaan akan ditinjau oleh administrator.
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
          <>
            <div className="space-y-4">
              <div>
                <Label htmlFor="competition">Kompetisi *</Label>
                <Select
                  value={competitionId}
                  onValueChange={(value) => {
                    setCompetitionId(value);
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
                  Hanya kompetisi yang sudah terdaftar yang dapat dipilih.
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
