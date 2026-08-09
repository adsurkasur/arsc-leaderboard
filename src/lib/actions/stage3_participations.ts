'use server';

import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';

// Keep legacy Stage 3 contracts available while the UI uses the additive Stage 5 RPCs.
type ExtendedDatabase = Database & {
  public: {
    Functions: Database['public']['Functions'] & {
      submit_participation: {
        Args: {
          p_competition_id: string;
          p_evidence_url: string;
        };
        Returns: { success: boolean; data?: unknown; error?: string };
      };
      review_participation: {
        Args: {
          p_log_id: string;
          p_status: string;
          p_points: number | null;
          p_notes: string | null;
        };
        Returns: { success: boolean; data?: unknown; error?: string };
      };
      submit_participation_v2: {
        Args: {
          p_competition_id: string;
          p_scoring_rule_id: string;
          p_evidence_url: string;
        };
        Returns: { success: boolean; data?: unknown; error?: string };
      };
      review_participation_v2: {
        Args: {
          p_log_id: string;
          p_status: string;
          p_scoring_rule_id: string | null;
          p_notes: string | null;
        };
        Returns: { success: boolean; data?: unknown; error?: string };
      };
    };
  };
};

export async function submitParticipation(
  competitionId: string,
  scoringRuleId: string,
  evidenceUrl: string,
) {
  const userClient = await createClient();
  const { data: { user }, error: authError } = await userClient.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized: Missing or invalid authenticated session.' };
  }

  // The RPC validates identity, competition/rule ownership, and state transitions.
  const typedClient = userClient as SupabaseClient<ExtendedDatabase>;
  const { data, error } = await typedClient.rpc('submit_participation_v2', {
    p_competition_id: competitionId,
    p_scoring_rule_id: scoringRuleId,
    p_evidence_url: evidenceUrl,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function reviewParticipation(
  logId: string,
  status: 'approved' | 'rejected',
  scoringRuleId?: string | null,
  notes?: string | null
) {
  const userClient = await createClient();
  const { data: { user }, error: authError } = await userClient.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized: Missing or invalid authenticated session.' };
  }

  const typedClient = userClient as SupabaseClient<ExtendedDatabase>;
  const { data, error } = await typedClient.rpc('review_participation_v2', {
    p_log_id: logId,
    p_status: status,
    p_scoring_rule_id: scoringRuleId ?? null,
    p_notes: notes ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}
