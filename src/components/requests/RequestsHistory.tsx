'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AlertCircle, Clock, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { Competition, CompetitionProposal, CompetitionTrack, ParticipationLog } from '@/lib/types';
import { getErrorMessage, withTimeout } from '@/lib/async';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CaseThread } from '@/components/requests/CaseThread';

const REQUEST_HISTORY_TIMEOUT_MS = 12_000;

interface RequestsHistoryProps {
  user: User;
  className?: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') return <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">Menunggu</Badge>;
  if (status === 'approved' || status === 'accepted') return <Badge variant="outline" className="border-success/20 bg-success/10 text-success">{status === 'accepted' ? 'Ditambahkan' : 'Disetujui'}</Badge>;
  if (status === 'rejected') return <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">Ditolak</Badge>;
  if (status === 'needs_info') return <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">Perlu informasi</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function RequestsHistory({ user, className }: RequestsHistoryProps) {
  const [participations, setParticipations] = useState<ParticipationLog[]>([]);
  const [proposals, setProposals] = useState<CompetitionProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const { data: profile, error: profileError } = await withTimeout(
        supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle(),
        REQUEST_HISTORY_TIMEOUT_MS,
        'Riwayat belum merespons. Periksa koneksi lalu coba lagi.',
      );
      if (profileError) throw profileError;
      if (!profile?.id) {
        setParticipations([]);
        setProposals([]);
        return;
      }

      const [participationResult, proposalResult] = await withTimeout(
        Promise.all([
          supabase
            .from('participation_logs')
            .select('*, competition:competitions(id, title), competition_track:leaderboard_competition_tracks(id, name)')
            .eq('profile_id', profile.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('leaderboard_competition_proposals')
            .select('*, resolved_competition:competitions(id, title)')
            .eq('profile_id', profile.id)
            .order('created_at', { ascending: false }),
        ]),
        REQUEST_HISTORY_TIMEOUT_MS,
        'Riwayat belum merespons. Periksa koneksi lalu coba lagi.',
      );

      if (participationResult.error) throw participationResult.error;
      if (proposalResult.error) throw proposalResult.error;

      setParticipations((participationResult.data ?? []).map((row) => {
        const item = row as unknown as ParticipationLog;
        return {
          ...item,
          competition: item.competition as unknown as Competition,
          competition_track: item.competition_track as unknown as CompetitionTrack | undefined,
        };
      }));
      setProposals((proposalResult.data ?? []) as unknown as CompetitionProposal[]);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Riwayat pengajuan belum dapat dimuat.'));
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  if (isLoading) {
    return <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-5 animate-spin" /></div>;
  }

  if (loadError) {
    return (
      <div className="space-y-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="space-y-1.5">
            <p className="font-medium text-destructive">Riwayat belum dapat dimuat</p>
            <p className="text-sm leading-6 text-muted-foreground">{loadError}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void fetchRequests()}>
          <RefreshCw className="size-4" /> Coba lagi
        </Button>
      </div>
    );
  }

  if (participations.length === 0 && proposals.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed py-12 text-center text-muted-foreground">
        <Clock className="mx-auto mb-3 size-8 opacity-50" />
        <p className="font-medium text-foreground">Belum ada pengajuan</p>
        <p className="mt-1 text-sm">Ajukan partisipasi atau usulkan kompetisi untuk memulai.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {proposals.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold">Usulan kompetisi</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Pantau keputusan dan jawab permintaan informasi dari admin di percakapan yang sama.</p>
          </div>
          {proposals.map((proposal) => (
            <article key={proposal.id} className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold">{proposal.proposed_title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{proposal.proposed_track_name} · {proposal.proposed_level}</p>
                </div>
                <StatusBadge status={proposal.status} />
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-muted-foreground">Penyelenggara</dt><dd className="mt-0.5">{proposal.proposed_organizer}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Capaian diajukan</dt><dd className="mt-0.5">{proposal.proposed_achievement}</dd></div>
              </dl>
              <div className="flex flex-wrap gap-4 text-xs">
                <a href={proposal.information_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Sumber resmi <ExternalLink className="size-3" /></a>
                <a href={proposal.evidence_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Bukti <ExternalLink className="size-3" /></a>
              </div>
              <CaseThread caseType="proposal" caseId={proposal.id} currentUserId={user.id} compact />
            </article>
          ))}
        </section>
      )}

      {participations.length > 0 && (
        <section className={`${proposals.length ? 'mt-8' : ''} space-y-4`}>
          <div>
            <p className="text-sm font-semibold">Pengajuan partisipasi</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Keputusan, poin, dan alasan peninjauan tersimpan bersama riwayat percakapannya.</p>
          </div>
          {participations.map((participation) => (
            <article key={participation.id} className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold">{participation.competition?.title ?? 'Kompetisi'}</h3>
                  {participation.competition_track?.name && <p className="mt-1 text-sm text-muted-foreground">{participation.competition_track.name}</p>}
                </div>
                <StatusBadge status={participation.status} />
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>{new Date(participation.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                {participation.evidence_url && <a href={participation.evidence_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Bukti <ExternalLink className="size-3" /></a>}
              </div>
              {participation.requested_achievement && (
                <p className="text-sm text-muted-foreground">Diajukan sebagai <span className="font-medium text-foreground">{participation.requested_achievement}</span>{participation.requested_points !== null ? ` · ${participation.requested_points} poin` : ''}</p>
              )}
              {participation.status === 'approved' && participation.awarded_points !== null && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-success/5 px-3 py-2 text-sm">
                  <span>{participation.awarded_achievement || 'Terverifikasi'}</span>
                  <span className="font-semibold text-success">+{participation.awarded_points} poin</span>
                </div>
              )}
              <CaseThread caseType="participation" caseId={participation.id} currentUserId={user.id} compact />
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
