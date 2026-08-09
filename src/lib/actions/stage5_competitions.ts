'use server';

import { createClient } from '@/lib/supabase/server';
import { Json } from '@/integrations/supabase/types';

export interface CompetitionRuleInput {
  id?: string;
  label: string;
  points: number;
  sort_order: number;
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

  const { data, error } = await client.rpc('leaderboard_save_competition', {
    p_competition_id: input.id ?? null,
    p_title: input.title,
    p_date: input.date,
    p_description: input.description ?? null,
    p_category: input.category,
    p_is_active: input.isActive,
    p_template_id: input.templateId ?? null,
    p_rules: input.rules as unknown as Json,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}
