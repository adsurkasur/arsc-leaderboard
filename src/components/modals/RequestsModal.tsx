'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, Loader2, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ParticipationLog, Competition, CompetitionProposal, CompetitionTrack } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { User } from '@supabase/supabase-js';
import { getErrorMessage, withTimeout } from '@/lib/async';

const REQUEST_HISTORY_TIMEOUT_MS = 12_000;

interface RequestsModalProps {
  user: User | null;
}

export function RequestsModal({ user }: RequestsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userRequests, setUserRequests] = useState<(ParticipationLog & { competition?: Competition })[]>([]);
  const [proposalRequests, setProposalRequests] = useState<CompetitionProposal[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchUserRequests = useCallback(async () => {
    if (!user) return;

    setIsLoadingRequests(true);
    setLoadError(null);

    try {
      const { data: profileData, error: profileError } = await withTimeout(
        supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle(),
        REQUEST_HISTORY_TIMEOUT_MS,
        'Riwayat belum merespons. Periksa koneksi lalu coba lagi.',
      );

      if (profileError) throw profileError;
      if (!profileData?.id) {
        setUserRequests([]);
        setProposalRequests([]);
        return;
      }

      const [stage6ParticipationResult, proposalResult] = await withTimeout(
        Promise.all([
          supabase
            .from('participation_logs')
            .select(`
              *,
              competition:competitions(id, title),
              competition_track:leaderboard_competition_tracks(id, name)
            `)
            .eq('profile_id', profileData.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('leaderboard_competition_proposals')
            .select('*, resolved_competition:competitions(id, title)')
            .eq('profile_id', profileData.id)
            .order('created_at', { ascending: false }),
        ]),
        REQUEST_HISTORY_TIMEOUT_MS,
        'Riwayat belum merespons. Periksa koneksi lalu coba lagi.',
      );

      const participationResult = stage6ParticipationResult.error
        ? await withTimeout(
            supabase
              .from('participation_logs')
              .select('*, competition:competitions(id, title)')
              .eq('profile_id', profileData.id)
              .order('created_at', { ascending: false }),
            REQUEST_HISTORY_TIMEOUT_MS,
          )
        : stage6ParticipationResult;

      if (participationResult.error) throw participationResult.error;
      setUserRequests((participationResult.data ?? []).map(req => {
          const reqData = req as unknown as ParticipationLog;
          return {
            ...reqData,
            status: reqData.status as 'pending' | 'approved' | 'rejected',
            competition: reqData.competition as unknown as Competition,
            competition_track: reqData.competition_track
              ? reqData.competition_track as unknown as CompetitionTrack
              : null,
          };
        }));
      setProposalRequests(
        proposalResult.error
          ? []
          : (proposalResult.data ?? []) as unknown as CompetitionProposal[],
      );
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Riwayat partisipasi belum dapat dimuat.'));
    } finally {
      setIsLoadingRequests(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserRequests();
    }
  }, [isOpen, user, fetchUserRequests]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Menunggu</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Disetujui</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Ditolak</Badge>;
      case 'needs_info':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Perlu informasi</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Ditambahkan</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Clock className="w-4 h-4" />
          Permintaan Saya
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Permintaan Saya</DialogTitle>
          <DialogDescription>
            Lacak usulan kompetisi dan pengajuan partisipasi Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {isLoadingRequests ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : loadError ? (
            <div className="space-y-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div className="space-y-1.5">
                  <p className="font-medium text-destructive">Riwayat belum dapat dimuat</p>
                  <p className="text-sm leading-6 text-muted-foreground">{loadError}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => void fetchUserRequests()}>
                <RefreshCw className="size-4" />
                Coba lagi
              </Button>
            </div>
          ) : userRequests.length === 0 && proposalRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Belum ada permintaan</p>
              <p className="text-sm">Ajukan partisipasi atau usulkan kompetisi untuk memulai</p>
            </div>
          ) : (
            <>
              {proposalRequests.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usulan kompetisi</p>
                  {proposalRequests.map((proposal) => (
                    <div key={proposal.id} className="space-y-2 rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{proposal.proposed_title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {proposal.proposed_track_name} · {proposal.proposed_level}
                          </p>
                        </div>
                        {getStatusBadge(proposal.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <a href={proposal.information_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <LinkIcon className="size-3" /> Sumber resmi
                        </a>
                        <a href={proposal.evidence_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <LinkIcon className="size-3" /> Bukti
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Capaian yang diajukan: <span className="font-medium text-foreground">{proposal.proposed_achievement}</span>
                      </p>
                      {proposal.review_notes && (
                        <div className="rounded-lg border bg-muted/40 p-2 text-xs">
                          <p className="font-semibold">Catatan admin</p>
                          <p className="mt-1 leading-5 text-muted-foreground">{proposal.review_notes}</p>
                          {proposal.status === 'needs_info' && (
                            <p className="mt-2 font-medium text-primary">
                              Lengkapi informasi melalui “Ajukan Partisipasi” lalu kirim ulang menggunakan nama dan kategori yang sama.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {userRequests.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pengajuan partisipasi</p>
                  {userRequests.map((request) => (
              <div key={request.id} className="flex flex-col gap-2 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{request.competition?.title || 'Kompetisi Tidak Dikenal'}</p>
                    {request.competition_track?.name && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{request.competition_track.name}</p>
                    )}
                  </div>
                  {getStatusBadge(request.status)}
                </div>
                
                <div className="flex items-center justify-between mt-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {request.evidence_url && (
                      <a 
                        href={request.evidence_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <LinkIcon className="w-3 h-3" /> Bukti
                      </a>
                    )}
                  </div>
                  <span className="text-xs">
                    {request.created_at ? formatDistanceToNow(new Date(request.created_at), { addSuffix: true }) : ''}
                  </span>
                </div>

                {request.requested_achievement && (
                  <p className="text-xs text-muted-foreground">
                    Diajukan sebagai <span className="font-medium text-foreground">{request.requested_achievement}</span>
                    {request.requested_points !== null ? ` · ${request.requested_points} poin` : ''}
                  </p>
                )}

                {request.notes && (
                  <div className="mt-2 p-2 bg-muted/50 rounded-md text-xs border">
                    <p className="font-semibold mb-1">Catatan Admin:</p>
                    <p>{request.notes}</p>
                  </div>
                )}
                
                {request.status === 'approved' && request.awarded_points !== null && (
                  <div className="mt-1 flex items-center justify-between gap-3 rounded-md bg-success/5 px-2.5 py-2 text-xs">
                    <span className="font-medium text-foreground">{request.awarded_achievement || 'Terverifikasi'}</span>
                    <span className="font-semibold text-success">+{request.awarded_points} poin</span>
                  </div>
                )}
              </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
