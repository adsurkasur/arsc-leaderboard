export interface Profile {
  id: string;
  member_id: string | null;
  link_status: string | null;
  user_id: string | null;
  full_name: string;
  bidang_biro: string | null;
  avatar_url: string | null;
  total_participation_count: number;
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
  created_at: string;
  updated_at: string;
}

export interface ParticipationLog {
  id: string;
  profile_id: string;
  competition_id: string;
  participation_date: string | null;
  achievement: string | null;
  evidence_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  awarded_points: number | null;
  verified_at: string | null;
  admin_id: string | null;
  notes: string | null;
  created_at: string;
  profile?: Profile;
  competition?: Competition;
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
