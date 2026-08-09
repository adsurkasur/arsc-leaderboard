'use server';

import { createClient } from '@/lib/supabase/server';
import { Json } from '@/integrations/supabase/types';

export interface CompetitionRuleInput {
  id?: string;
  label: string;
  points: number;
  sort_order: number;
}

export interface CompetitionTrackInput {
  id?: string;
  name: string;
  description?: string | null;
}

export interface SaveCompetitionInput {
  id?: string | null;
  title: string;
  date: string;
  description?: string | null;
  category: string;
  isActive: boolean;
  templateId?: string | null;
  rules: CompetitionRuleInput[];
  tracks: CompetitionTrackInput[];
}

function isMissingStage6Function(error: { code?: string; message?: string } | null) {
  if (!error) return false;

  return error.code === 'PGRST202'
    || error.code === '42883'
    || error.message?.includes('leaderboard_save_competition_v2') === true;
}

export async function saveCompetition(input: SaveCompetitionInput) {
  const client = await createClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Sesi admin tidak tersedia. Silakan masuk kembali.' };
  }

  const stage6Result = await client.rpc('leaderboard_save_competition_v2', {
    p_competition_id: input.id ?? null,
    p_title: input.title,
    p_date: input.date,
    p_description: input.description ?? null,
    p_category: input.category,
    p_is_active: input.isActive,
    p_template_id: input.templateId ?? null,
    p_rules: input.rules as unknown as Json,
    p_tracks: input.tracks as unknown as Json,
  });

  if (isMissingStage6Function(stage6Result.error)) {
    const stage5Result = await client.rpc('leaderboard_save_competition', {
      p_competition_id: input.id ?? null,
      p_title: input.title,
      p_date: input.date,
      p_description: input.description ?? null,
      p_category: input.category,
      p_is_active: input.isActive,
      p_template_id: input.templateId ?? null,
      p_rules: input.rules as unknown as Json,
    });

    if (stage5Result.error) {
      return { success: false, error: stage5Result.error.message };
    }

    return { success: true, data: stage5Result.data, stage6Ready: false };
  }

  if (stage6Result.error) {
    return { success: false, error: stage6Result.error.message };
  }

  return { success: true, data: stage6Result.data, stage6Ready: true };
}
