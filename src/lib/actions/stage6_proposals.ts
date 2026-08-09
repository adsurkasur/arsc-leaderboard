'use server';

import { createClient } from '@/lib/supabase/server';
import { Json } from '@/integrations/supabase/types';

export interface SubmitCompetitionProposalInput {
  title: string;
  organizer: string;
  informationUrl: string;
  date?: string | null;
  level: string;
  trackName: string;
  achievement: string;
  evidenceUrl: string;
  memberNotes?: string | null;
}

export interface ReviewCompetitionProposalInput {
  proposalId: string;
  status: 'needs_info' | 'accepted' | 'rejected';
  reviewNotes?: string | null;
  competitionId?: string | null;
  title?: string | null;
  date?: string | null;
  description?: string | null;
  category?: string | null;
  isActive?: boolean | null;
  templateId?: string | null;
  rules?: Array<{ id?: string; label: string; points: number; sort_order: number }> | null;
  tracks?: Array<{ id?: string; name: string; description?: string | null }> | null;
  trackId?: string | null;
  trackName?: string | null;
  scoringRuleLabel?: string | null;
}

async function getAuthenticatedClient() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) return null;
  return client;
}

export async function submitCompetitionProposal(input: SubmitCompetitionProposalInput) {
  const client = await getAuthenticatedClient();
  if (!client) return { success: false, error: 'Sesi anggota tidak tersedia. Silakan masuk kembali.' };

  const { data, error } = await client.rpc('submit_competition_proposal', {
    p_title: input.title,
    p_organizer: input.organizer,
    p_information_url: input.informationUrl,
    p_date: input.date ?? null,
    p_level: input.level,
    p_track_name: input.trackName,
    p_achievement: input.achievement,
    p_evidence_url: input.evidenceUrl,
    p_member_notes: input.memberNotes ?? null,
  });

  return error
    ? { success: false, error: error.message }
    : { success: true, data };
}

export async function reviewCompetitionProposal(input: ReviewCompetitionProposalInput) {
  const client = await getAuthenticatedClient();
  if (!client) return { success: false, error: 'Sesi admin tidak tersedia. Silakan masuk kembali.' };

  const { data, error } = await client.rpc('review_competition_proposal', {
    p_proposal_id: input.proposalId,
    p_status: input.status,
    p_review_notes: input.reviewNotes ?? null,
    p_competition_id: input.competitionId ?? null,
    p_title: input.title ?? null,
    p_date: input.date ?? null,
    p_description: input.description ?? null,
    p_category: input.category ?? null,
    p_is_active: input.isActive ?? null,
    p_template_id: input.templateId ?? null,
    p_rules: (input.rules ?? null) as unknown as Json,
    p_tracks: (input.tracks ?? null) as unknown as Json,
    p_track_id: input.trackId ?? null,
    p_track_name: input.trackName ?? null,
    p_scoring_rule_label: input.scoringRuleLabel ?? null,
  });

  return error
    ? { success: false, error: error.message }
    : { success: true, data };
}
