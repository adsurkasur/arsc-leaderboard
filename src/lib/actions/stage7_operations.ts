'use server';

import { createClient } from '@/lib/supabase/server';
import type { LeaderboardCaseType, LeaderboardMessageVisibility } from '@/lib/types';

async function getAuthenticatedClient() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();

  if (error || !user) return null;
  return client;
}

export async function addCaseMessage(input: {
  caseType: LeaderboardCaseType;
  caseId: string;
  body: string;
  visibility?: LeaderboardMessageVisibility;
}) {
  const client = await getAuthenticatedClient();
  if (!client) return { success: false, error: 'Sesi tidak tersedia. Silakan masuk kembali.' };

  const { data, error } = await client.rpc('leaderboard_add_case_message', {
    p_case_type: input.caseType,
    p_case_id: input.caseId,
    p_body: input.body,
    p_visibility: input.visibility ?? 'member_admins',
  });

  return error ? { success: false, error: error.message } : { success: true, data };
}

export async function markNotificationRead(notificationId: string) {
  const client = await getAuthenticatedClient();
  if (!client) return { success: false, error: 'Sesi tidak tersedia.' };

  const { error } = await client.rpc('leaderboard_mark_notification_read', {
    p_notification_id: notificationId,
  });

  return error ? { success: false, error: error.message } : { success: true };
}

export async function markAllNotificationsRead() {
  const client = await getAuthenticatedClient();
  if (!client) return { success: false, error: 'Sesi tidak tersedia.' };

  const { error } = await client.rpc('leaderboard_mark_all_notifications_read');
  return error ? { success: false, error: error.message } : { success: true };
}

export async function deleteCompetition(competitionId: string, confirmationTitle: string) {
  const client = await getAuthenticatedClient();
  if (!client) return { success: false, error: 'Sesi admin tidak tersedia. Silakan masuk kembali.' };

  const { data, error } = await client.rpc('leaderboard_delete_competition', {
    p_competition_id: competitionId,
    p_confirmation_title: confirmationTitle,
  });

  return error ? { success: false, error: error.message } : { success: true, data };
}
