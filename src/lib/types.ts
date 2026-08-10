export interface Profile {
  id: string;
  member_id: string | null;
  link_status: string | null;
  user_id: string | null;
  full_name: string;
  bidang_biro: string | null;
  avatar_url: string | null;
  total_participation_count: number;
  total_points?: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  globalRank?: number;
  is_identity_verified?: boolean;
}

export interface Competition {
  id: string;
  title: string;
  date: string;
  description: string | null;
  category: string;
  is_active: boolean;
  scoring_template_id: string | null;
  created_at: string;
  updated_at: string;
  scoring_rules?: CompetitionScoringRule[];
  tracks?: CompetitionTrack[];
}

export interface CompetitionTrack {
  id: string;
  competition_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CompetitionProposalStatus = 'pending' | 'needs_info' | 'accepted' | 'rejected';

export interface CompetitionProposal {
  id: string;
  submitted_by: string;
  profile_id: string;
  proposed_title: string;
  proposed_organizer: string;
  information_url: string;
  proposed_date: string | null;
  proposed_level: string;
  proposed_track_name: string;
  proposed_achievement: string;
  evidence_url: string;
  member_notes: string | null;
  status: CompetitionProposalStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolved_competition_id: string | null;
  resolved_track_id: string | null;
  resolved_scoring_rule_id: string | null;
  participation_log_id: string | null;
  resolution_type: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  resolved_competition?: Competition;
}

export type LeaderboardCaseType = 'proposal' | 'participation';
export type LeaderboardMessageVisibility = 'member_admins' | 'admins_only';

export interface LeaderboardCaseMessage {
  id: string;
  proposal_id: string | null;
  participation_log_id: string | null;
  author_user_id: string | null;
  author_role: 'member' | 'admin' | 'system';
  visibility: LeaderboardMessageVisibility;
  message_type: 'member_message' | 'admin_response' | 'admin_internal' | 'system_event';
  body: string;
  created_at: string;
}

export interface LeaderboardNotification {
  id: string;
  recipient_user_id: string;
  proposal_id: string | null;
  participation_log_id: string | null;
  event_type: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface CompetitionScoringRule {
  id: string;
  competition_id: string;
  label: string;
  points: number;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ScoringTemplateRule {
  id: string;
  template_id: string;
  label: string;
  points: number;
  sort_order: number;
}

export interface ScoringTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  suggested_category: string;
  is_system: boolean;
  rules: ScoringTemplateRule[];
}

export interface ParticipationLog {
  id: string;
  profile_id: string;
  competition_id: string;
  competition_track_id: string;
  participation_date: string | null;
  awarded_achievement: string | null;
  evidence_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  awarded_points: number | null;
  requested_scoring_rule_id: string | null;
  awarded_scoring_rule_id: string | null;
  requested_achievement: string | null;
  requested_points: number | null;
  verified_at: string | null;
  admin_id: string | null;
  notes: string | null;
  created_at: string;
  profile?: Profile;
  competition?: Competition;
  competition_track?: CompetitionTrack;
}

export interface VerificationRequest {
  id: string;
  profile_id: string;
  competition_id: string | null;
  message: string;
  participation_date: string | null;
  achievement: string | null;
  evidence_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  reviewer_id: string | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  competition?: Competition;
}

export interface LeaderboardEntry extends Profile {
  rank: number;
}
