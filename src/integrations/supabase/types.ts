export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      competitions: {
        Row: {
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          is_active: boolean
          scoring_template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          date: string
          description?: string | null
          id?: string
          is_active?: boolean
          scoring_template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          is_active?: boolean
          scoring_template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_scoring_template_id_fkey"
            columns: ["scoring_template_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_scoring_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      member_release_links: {
        Row: {
          created_at: string
          evaluation_status: string | null
          id: string
          member_id: string
          position: string | null
          release_code: string
          release_member_code: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          evaluation_status?: string | null
          id?: string
          member_id: string
          position?: string | null
          release_code: string
          release_member_code: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          evaluation_status?: string | null
          id?: string
          member_id?: string
          position?: string | null
          release_code?: string
          release_member_code?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_release_links_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          canonical_name: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          canonical_name: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      participation_logs: {
        Row: {
          awarded_achievement: string | null
          admin_id: string | null
          awarded_scoring_rule_id: string | null
          awarded_points: number | null
          competition_id: string
          created_at: string
          evidence_url: string | null
          id: string
          notes: string | null
          participation_date: string | null
          profile_id: string
          requested_achievement: string | null
          requested_points: number | null
          requested_scoring_rule_id: string | null
          status: string
          verified_at: string | null
        }
        Insert: {
          awarded_achievement?: string | null
          admin_id?: string | null
          awarded_scoring_rule_id?: string | null
          awarded_points?: number | null
          competition_id: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          participation_date?: string | null
          profile_id: string
          requested_achievement?: string | null
          requested_points?: number | null
          requested_scoring_rule_id?: string | null
          status?: string
          verified_at?: string | null
        }
        Update: {
          awarded_achievement?: string | null
          admin_id?: string | null
          awarded_scoring_rule_id?: string | null
          awarded_points?: number | null
          competition_id?: string
          created_at?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          participation_date?: string | null
          profile_id?: string
          requested_achievement?: string | null
          requested_points?: number | null
          requested_scoring_rule_id?: string | null
          status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participation_logs_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participation_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participation_logs_requested_scoring_rule_id_fkey"
            columns: ["requested_scoring_rule_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_competition_scoring_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participation_logs_awarded_scoring_rule_id_fkey"
            columns: ["awarded_scoring_rule_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_competition_scoring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bidang_biro: string | null
          created_at: string
          full_name: string
          id: string
          last_activity_at: string | null
          link_status: string | null
          member_id: string | null
          total_participation_count: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bidang_biro?: string | null
          created_at?: string
          full_name: string
          id?: string
          last_activity_at?: string | null
          link_status?: string | null
          member_id?: string | null
          total_participation_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bidang_biro?: string | null
          created_at?: string
          full_name?: string
          id?: string
          last_activity_at?: string | null
          link_status?: string | null
          member_id?: string | null
          total_participation_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          biro: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          jabatan: string
          name: string
          role: string
          theme_preference: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          biro?: string
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          jabatan?: string
          name: string
          role?: string
          theme_preference?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          biro?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          jabatan?: string
          name?: string
          role?: string
          theme_preference?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      leaderboard_competition_scoring_rules: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          points: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          points: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          points?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_competition_scoring_rules_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_scoring_template_rules: {
        Row: {
          created_at: string
          id: string
          label: string
          points: number
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          points: number
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          points?: number
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_scoring_template_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_scoring_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_scoring_templates: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          suggested_category: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          suggested_category: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          suggested_category?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          achievement: string | null
          competition_id: string | null
          created_at: string
          evidence_url: string | null
          id: string
          message: string
          participation_date: string | null
          profile_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          achievement?: string | null
          competition_id?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          message: string
          participation_date?: string | null
          profile_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          achievement?: string | null
          competition_id?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          message?: string
          participation_date?: string | null
          profile_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_category_scores_v2: {
        Args: { p_category: string }
        Returns: {
          participation_count: number
          profile_id: string
          total_points: number
        }[]
      }
      get_public_leaderboard: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string | null
          bidang_biro: string | null
          created_at: string
          full_name: string
          is_identity_verified: boolean
          last_activity_at: string | null
          profile_id: string
          total_participation_count: number
        }[]
      }
      get_public_leaderboard_v2: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string | null
          bidang_biro: string | null
          created_at: string
          full_name: string
          is_identity_verified: boolean
          last_activity_at: string | null
          profile_id: string
          total_participation_count: number
          total_points: number
        }[]
      }
      get_public_category_participation_counts: {
        Args: { p_category: string }
        Returns: {
          participation_count: number
          profile_id: string
        }[]
      }
      get_public_member_participations: {
        Args: { p_profile_id: string }
        Returns: {
          competition_category: string
          competition_date: string
          competition_id: string
          competition_title: string
          created_at: string
          participation_date: string | null
          participation_id: string
        }[]
      }
      get_public_member_participations_v2: {
        Args: { p_profile_id: string }
        Returns: {
          achievement: string | null
          awarded_points: number
          competition_category: string
          competition_date: string
          competition_id: string
          competition_title: string
          created_at: string
          participation_date: string | null
          participation_id: string
        }[]
      }
      leaderboard_save_competition: {
        Args: {
          p_category: string
          p_competition_id: string | null
          p_date: string
          p_description: string | null
          p_is_active: boolean
          p_rules: Json | null
          p_template_id: string | null
          p_title: string
        }
        Returns: Json
      }
      review_participation_v2: {
        Args: {
          p_log_id: string
          p_notes: string | null
          p_scoring_rule_id: string | null
          p_status: string
        }
        Returns: Json
      }
      submit_participation_v2: {
        Args: {
          p_competition_id: string
          p_evidence_url: string
          p_scoring_rule_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const

