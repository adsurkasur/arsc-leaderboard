-- ============================================================================
-- Stage 5: Configurable competition scoring
-- Target: ARSC Leaderboard-owned objects only
-- Run manually in the Supabase SQL Editor after local validation and approval.
-- This script is atomic and intentionally does not modify Rapor or Halo data.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_missing text;
  v_collisions text;
BEGIN
  SELECT string_agg(required_object, ', ' ORDER BY required_object)
  INTO v_missing
  FROM unnest(ARRAY[
    'public.competitions',
    'public.participation_logs',
    'public.participation_submission_events',
    'public.profiles',
    'public.user_roles',
    'public.arsc_identities'
  ]) AS required_object
  WHERE to_regclass(required_object) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stage 5 prerequisites are missing: %', v_missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'leaderboard_has_role'
      AND p.pronargs = 2
  ) THEN
    RAISE EXCEPTION 'Stage 5 prerequisite public.leaderboard_has_role(...) is missing';
  END IF;

  SELECT string_agg(object_name, ', ' ORDER BY object_name)
  INTO v_collisions
  FROM (
    SELECT table_name AS object_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'leaderboard_scoring_templates',
        'leaderboard_scoring_template_rules',
        'leaderboard_competition_scoring_rules'
      )
    UNION ALL
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'leaderboard_save_competition',
        'submit_participation_v2',
        'review_participation_v2',
        'get_public_leaderboard_v2',
        'get_public_member_participations_v2',
        'get_public_category_scores_v2'
      )
  ) collisions;

  IF v_collisions IS NOT NULL THEN
    RAISE EXCEPTION 'Stage 5 object collision detected: %', v_collisions;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'competitions' AND column_name IN ('scoring_template_id', 'is_active'))
        OR (
          table_name = 'participation_logs'
          AND column_name IN (
            'requested_scoring_rule_id',
            'awarded_scoring_rule_id',
            'requested_achievement',
            'requested_points'
          )
        )
        OR (
          table_name = 'participation_submission_events'
          AND column_name IN ('scoring_rule_id', 'achievement')
        )
      )
  ) THEN
    RAISE EXCEPTION 'Stage 5 columns already exist or a previous deployment was only partially applied';
  END IF;

  RAISE NOTICE 'Stage 5 prerequisites and collision checks passed.';
END;
$$;

CREATE TABLE public.leaderboard_scoring_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  suggested_category text NOT NULL,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_scoring_templates_code_check
    CHECK (code ~ '^[a-z0-9][a-z0-9_-]{1,49}$'),
  CONSTRAINT leaderboard_scoring_templates_name_check
    CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  CONSTRAINT leaderboard_scoring_templates_category_check
    CHECK (length(btrim(suggested_category)) BETWEEN 1 AND 80)
);

CREATE TABLE public.leaderboard_scoring_template_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL
    REFERENCES public.leaderboard_scoring_templates(id) ON DELETE CASCADE,
  label text NOT NULL,
  points integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_scoring_template_rules_label_check
    CHECK (length(btrim(label)) BETWEEN 1 AND 80),
  CONSTRAINT leaderboard_scoring_template_rules_points_check
    CHECK (points BETWEEN 0 AND 100000),
  CONSTRAINT leaderboard_scoring_template_rules_sort_check
    CHECK (sort_order BETWEEN 0 AND 1000)
);

CREATE UNIQUE INDEX leaderboard_scoring_template_rules_label_key
  ON public.leaderboard_scoring_template_rules (template_id, lower(btrim(label)));

CREATE INDEX leaderboard_scoring_template_rules_order_idx
  ON public.leaderboard_scoring_template_rules (template_id, sort_order, label);

CREATE TABLE public.leaderboard_competition_scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL
    REFERENCES public.competitions(id) ON DELETE CASCADE,
  label text NOT NULL,
  points integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_competition_scoring_rules_label_check
    CHECK (length(btrim(label)) BETWEEN 1 AND 80),
  CONSTRAINT leaderboard_competition_scoring_rules_points_check
    CHECK (points BETWEEN 0 AND 100000),
  CONSTRAINT leaderboard_competition_scoring_rules_sort_check
    CHECK (sort_order BETWEEN 0 AND 1000)
);

CREATE UNIQUE INDEX leaderboard_competition_scoring_rules_label_key
  ON public.leaderboard_competition_scoring_rules (competition_id, lower(btrim(label)));

CREATE INDEX leaderboard_competition_scoring_rules_active_idx
  ON public.leaderboard_competition_scoring_rules
  (competition_id, is_active, sort_order, label);

ALTER TABLE public.competitions
  ADD COLUMN scoring_template_id uuid
    REFERENCES public.leaderboard_scoring_templates(id) ON DELETE SET NULL,
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.participation_logs
  ADD COLUMN requested_scoring_rule_id uuid
    REFERENCES public.leaderboard_competition_scoring_rules(id) ON DELETE SET NULL,
  ADD COLUMN awarded_scoring_rule_id uuid
    REFERENCES public.leaderboard_competition_scoring_rules(id) ON DELETE SET NULL,
  ADD COLUMN requested_achievement text,
  ADD COLUMN requested_points integer;

ALTER TABLE public.participation_logs
  ADD CONSTRAINT participation_logs_requested_achievement_check
    CHECK (
      requested_achievement IS NULL
      OR length(btrim(requested_achievement)) BETWEEN 1 AND 80
    ),
  ADD CONSTRAINT participation_logs_requested_points_check
    CHECK (requested_points IS NULL OR requested_points BETWEEN 0 AND 100000);

ALTER TABLE public.participation_submission_events
  ADD COLUMN scoring_rule_id uuid
    REFERENCES public.leaderboard_competition_scoring_rules(id) ON DELETE SET NULL,
  ADD COLUMN achievement text;

CREATE TRIGGER leaderboard_scoring_templates_updated_at
BEFORE UPDATE ON public.leaderboard_scoring_templates
FOR EACH ROW EXECUTE FUNCTION public.leaderboard_update_updated_at();

CREATE TRIGGER leaderboard_competition_scoring_rules_updated_at
BEFORE UPDATE ON public.leaderboard_competition_scoring_rules
FOR EACH ROW EXECUTE FUNCTION public.leaderboard_update_updated_at();

ALTER TABLE public.leaderboard_scoring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_scoring_template_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_competition_scoring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scoring templates are readable"
ON public.leaderboard_scoring_templates
FOR SELECT USING (true);

CREATE POLICY "Scoring template rules are readable"
ON public.leaderboard_scoring_template_rules
FOR SELECT USING (true);

CREATE POLICY "Competition scoring rules are readable"
ON public.leaderboard_competition_scoring_rules
FOR SELECT USING (true);

REVOKE ALL ON public.leaderboard_scoring_templates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.leaderboard_scoring_template_rules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.leaderboard_competition_scoring_rules FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.leaderboard_scoring_templates TO anon, authenticated;
GRANT SELECT ON public.leaderboard_scoring_template_rules TO anon, authenticated;
GRANT SELECT ON public.leaderboard_competition_scoring_rules TO anon, authenticated;
GRANT ALL ON public.leaderboard_scoring_templates TO postgres, service_role;
GRANT ALL ON public.leaderboard_scoring_template_rules TO postgres, service_role;
GRANT ALL ON public.leaderboard_competition_scoring_rules TO postgres, service_role;

INSERT INTO public.leaderboard_scoring_templates
  (id, code, name, description, suggested_category, is_system)
VALUES
  (
    '00000000-0000-4000-8000-000000000501',
    'internal-ub',
    'Internal Universitas Brawijaya',
    'Preset lengkap untuk kompetisi tingkat departemen, fakultas, atau universitas.',
    'Internal UB',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000502',
    'regional',
    'Regional / Provinsi',
    'Preset lengkap untuk kompetisi tingkat kota, wilayah, atau provinsi.',
    'Regional',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000503',
    'nasional',
    'Nasional',
    'Preset lengkap siap pakai untuk kompetisi tingkat nasional.',
    'Nasional',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000504',
    'internasional',
    'Internasional',
    'Preset lengkap siap pakai untuk kompetisi tingkat internasional.',
    'Internasional',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000505',
    'pkm',
    'Program Kreativitas Mahasiswa (PKM)',
    'Tahapan khusus PKM dari seleksi internal UB sampai medali PIMNAS.',
    'PKM',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000506',
    'umum',
    'Umum / Kustom',
    'Titik awal lengkap yang dapat diubah sepenuhnya untuk kompetisi lain.',
    'Umum',
    true
  );

INSERT INTO public.leaderboard_scoring_template_rules
  (template_id, label, points, sort_order)
VALUES
  ('00000000-0000-4000-8000-000000000501', 'Juara 1', 20, 10),
  ('00000000-0000-4000-8000-000000000501', 'Juara 2', 17, 20),
  ('00000000-0000-4000-8000-000000000501', 'Juara 3', 14, 30),
  ('00000000-0000-4000-8000-000000000501', 'Juara Harapan 1', 12, 40),
  ('00000000-0000-4000-8000-000000000501', 'Juara Harapan 2', 10, 50),
  ('00000000-0000-4000-8000-000000000501', 'Juara Harapan 3', 8, 60),
  ('00000000-0000-4000-8000-000000000501', 'Finalis', 6, 70),
  ('00000000-0000-4000-8000-000000000501', 'Semifinalis', 4, 80),
  ('00000000-0000-4000-8000-000000000501', 'Lolos Seleksi / Delegasi', 2, 90),
  ('00000000-0000-4000-8000-000000000501', 'Peserta', 1, 100),

  ('00000000-0000-4000-8000-000000000502', 'Juara 1', 30, 10),
  ('00000000-0000-4000-8000-000000000502', 'Juara 2', 25, 20),
  ('00000000-0000-4000-8000-000000000502', 'Juara 3', 21, 30),
  ('00000000-0000-4000-8000-000000000502', 'Juara Harapan 1', 18, 40),
  ('00000000-0000-4000-8000-000000000502', 'Juara Harapan 2', 16, 50),
  ('00000000-0000-4000-8000-000000000502', 'Juara Harapan 3', 14, 60),
  ('00000000-0000-4000-8000-000000000502', 'Finalis', 11, 70),
  ('00000000-0000-4000-8000-000000000502', 'Semifinalis', 8, 80),
  ('00000000-0000-4000-8000-000000000502', 'Lolos Seleksi / Delegasi', 5, 90),
  ('00000000-0000-4000-8000-000000000502', 'Peserta', 3, 100),

  ('00000000-0000-4000-8000-000000000503', 'Juara 1', 50, 10),
  ('00000000-0000-4000-8000-000000000503', 'Juara 2', 42, 20),
  ('00000000-0000-4000-8000-000000000503', 'Juara 3', 36, 30),
  ('00000000-0000-4000-8000-000000000503', 'Juara Harapan 1', 30, 40),
  ('00000000-0000-4000-8000-000000000503', 'Juara Harapan 2', 27, 50),
  ('00000000-0000-4000-8000-000000000503', 'Juara Harapan 3', 24, 60),
  ('00000000-0000-4000-8000-000000000503', 'Finalis', 18, 70),
  ('00000000-0000-4000-8000-000000000503', 'Semifinalis', 14, 80),
  ('00000000-0000-4000-8000-000000000503', 'Lolos Seleksi / Delegasi', 10, 90),
  ('00000000-0000-4000-8000-000000000503', 'Peserta', 5, 100),

  ('00000000-0000-4000-8000-000000000504', 'Juara 1', 75, 10),
  ('00000000-0000-4000-8000-000000000504', 'Juara 2 / Runner-up', 65, 20),
  ('00000000-0000-4000-8000-000000000504', 'Juara 3 / Second Runner-up', 55, 30),
  ('00000000-0000-4000-8000-000000000504', 'Honorable Mention / Harapan 1', 48, 40),
  ('00000000-0000-4000-8000-000000000504', 'Honorable Mention / Harapan 2', 43, 50),
  ('00000000-0000-4000-8000-000000000504', 'Honorable Mention / Harapan 3', 38, 60),
  ('00000000-0000-4000-8000-000000000504', 'Finalis', 30, 70),
  ('00000000-0000-4000-8000-000000000504', 'Semifinalis', 24, 80),
  ('00000000-0000-4000-8000-000000000504', 'Lolos Seleksi / Delegasi', 18, 90),
  ('00000000-0000-4000-8000-000000000504', 'Peserta', 10, 100),

  ('00000000-0000-4000-8000-000000000505', 'Lolos Seleksi Internal UB', 10, 10),
  ('00000000-0000-4000-8000-000000000505', 'Lolos Pendanaan', 35, 20),
  ('00000000-0000-4000-8000-000000000505', 'Finalis PIMNAS', 60, 30),
  ('00000000-0000-4000-8000-000000000505', 'Medali Perunggu PIMNAS', 80, 40),
  ('00000000-0000-4000-8000-000000000505', 'Medali Perak PIMNAS', 90, 50),
  ('00000000-0000-4000-8000-000000000505', 'Medali Emas PIMNAS', 100, 60),

  ('00000000-0000-4000-8000-000000000506', 'Juara 1', 30, 10),
  ('00000000-0000-4000-8000-000000000506', 'Juara 2', 25, 20),
  ('00000000-0000-4000-8000-000000000506', 'Juara 3', 21, 30),
  ('00000000-0000-4000-8000-000000000506', 'Juara Harapan 1', 18, 40),
  ('00000000-0000-4000-8000-000000000506', 'Juara Harapan 2', 15, 50),
  ('00000000-0000-4000-8000-000000000506', 'Juara Harapan 3', 12, 60),
  ('00000000-0000-4000-8000-000000000506', 'Finalis', 9, 70),
  ('00000000-0000-4000-8000-000000000506', 'Semifinalis', 7, 80),
  ('00000000-0000-4000-8000-000000000506', 'Lolos Seleksi / Delegasi', 4, 90),
  ('00000000-0000-4000-8000-000000000506', 'Peserta', 2, 100);

-- Existing competitions receive a safe editable default without touching submissions.
UPDATE public.competitions
SET scoring_template_id = '00000000-0000-4000-8000-000000000506'
WHERE scoring_template_id IS NULL;

INSERT INTO public.leaderboard_competition_scoring_rules
  (competition_id, label, points, sort_order)
SELECT c.id, tr.label, tr.points, tr.sort_order
FROM public.competitions c
JOIN public.leaderboard_scoring_template_rules tr
  ON tr.template_id = '00000000-0000-4000-8000-000000000506'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.leaderboard_competition_scoring_rules cr
  WHERE cr.competition_id = c.id
);

CREATE FUNCTION public.leaderboard_save_competition(
  p_competition_id uuid,
  p_title text,
  p_date date,
  p_description text,
  p_category text,
  p_is_active boolean,
  p_template_id uuid,
  p_rules jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_competition_id uuid;
  v_rules jsonb := p_rules;
  v_rule jsonb;
  v_rule_id uuid;
  v_label text;
  v_points integer;
  v_sort_order integer;
  v_ordinality bigint;
  v_rule_count integer;
  v_unique_label_count integer;
BEGIN
  IF v_user_id IS NULL
    OR NOT public.leaderboard_has_role(v_user_id, 'admin')
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NULLIF(btrim(p_title), '') IS NULL OR length(btrim(p_title)) > 160 THEN
    RAISE EXCEPTION 'Competition title must contain 1 to 160 characters';
  END IF;
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'Competition date is required';
  END IF;
  IF NULLIF(btrim(p_category), '') IS NULL OR length(btrim(p_category)) > 80 THEN
    RAISE EXCEPTION 'Competition category must contain 1 to 80 characters';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 2000 THEN
    RAISE EXCEPTION 'Competition description exceeds 2000 characters';
  END IF;
  IF p_template_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.leaderboard_scoring_templates WHERE id = p_template_id
  ) THEN
    RAISE EXCEPTION 'Scoring template not found';
  END IF;

  IF v_rules IS NULL OR v_rules = '[]'::jsonb THEN
    IF p_template_id IS NULL THEN
      RAISE EXCEPTION 'At least one scoring rule or a scoring template is required';
    END IF;

    SELECT jsonb_agg(
      jsonb_build_object(
        'label', tr.label,
        'points', tr.points,
        'sort_order', tr.sort_order
      )
      ORDER BY tr.sort_order, tr.label
    )
    INTO v_rules
    FROM public.leaderboard_scoring_template_rules tr
    WHERE tr.template_id = p_template_id;
  END IF;

  IF jsonb_typeof(v_rules) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Scoring rules must be a JSON array';
  END IF;

  v_rule_count := jsonb_array_length(v_rules);
  IF v_rule_count < 1 OR v_rule_count > 40 THEN
    RAISE EXCEPTION 'A competition must have between 1 and 40 scoring rules';
  END IF;

  SELECT count(DISTINCT lower(btrim(rule->>'label')))
  INTO v_unique_label_count
  FROM jsonb_array_elements(v_rules) AS rule;

  IF v_unique_label_count IS DISTINCT FROM v_rule_count THEN
    RAISE EXCEPTION 'Scoring rule labels must be unique within a competition';
  END IF;

  IF p_competition_id IS NULL THEN
    INSERT INTO public.competitions (
      title,
      date,
      description,
      category,
      scoring_template_id,
      is_active
    )
    VALUES (
      btrim(p_title),
      p_date,
      NULLIF(btrim(p_description), ''),
      btrim(p_category),
      p_template_id,
      COALESCE(p_is_active, true)
    )
    RETURNING id INTO v_competition_id;
  ELSE
    SELECT id INTO v_competition_id
    FROM public.competitions
    WHERE id = p_competition_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Competition not found';
    END IF;

    UPDATE public.competitions
    SET title = btrim(p_title),
        date = p_date,
        description = NULLIF(btrim(p_description), ''),
        category = btrim(p_category),
        scoring_template_id = p_template_id,
        is_active = COALESCE(p_is_active, true)
    WHERE id = v_competition_id;

    UPDATE public.leaderboard_competition_scoring_rules
    SET is_active = false
    WHERE competition_id = v_competition_id;
  END IF;

  FOR v_rule, v_ordinality IN
    SELECT value, ordinality
    FROM jsonb_array_elements(v_rules) WITH ORDINALITY
  LOOP
    v_label := btrim(v_rule->>'label');

    IF v_label IS NULL OR length(v_label) NOT BETWEEN 1 AND 80 THEN
      RAISE EXCEPTION 'Every scoring rule label must contain 1 to 80 characters';
    END IF;

    BEGIN
      v_points := (v_rule->>'points')::integer;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Points for scoring rule % must be a whole number', v_label;
    END;

    IF v_points IS NULL OR v_points NOT BETWEEN 0 AND 100000 THEN
      RAISE EXCEPTION 'Points for scoring rule % must be between 0 and 100000', v_label;
    END IF;

    BEGIN
      v_sort_order := COALESCE((v_rule->>'sort_order')::integer, (v_ordinality * 10)::integer);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Sort order for scoring rule % must be a whole number', v_label;
    END;

    IF v_sort_order NOT BETWEEN 0 AND 1000 THEN
      RAISE EXCEPTION 'Sort order for scoring rule % must be between 0 and 1000', v_label;
    END IF;

    v_rule_id := NULL;
    IF NULLIF(v_rule->>'id', '') IS NOT NULL THEN
      BEGIN
        v_rule_id := (v_rule->>'id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Invalid scoring rule identifier for %', v_label;
      END;

      UPDATE public.leaderboard_competition_scoring_rules
      SET label = v_label,
          points = v_points,
          sort_order = v_sort_order,
          is_active = true
      WHERE id = v_rule_id
        AND competition_id = v_competition_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Scoring rule % does not belong to this competition', v_rule_id;
      END IF;
    ELSE
      SELECT id INTO v_rule_id
      FROM public.leaderboard_competition_scoring_rules
      WHERE competition_id = v_competition_id
        AND lower(btrim(label)) = lower(v_label)
      LIMIT 1;

      IF v_rule_id IS NULL THEN
        INSERT INTO public.leaderboard_competition_scoring_rules (
          competition_id,
          label,
          points,
          sort_order,
          is_active
        )
        VALUES (v_competition_id, v_label, v_points, v_sort_order, true);
      ELSE
        UPDATE public.leaderboard_competition_scoring_rules
        SET label = v_label,
            points = v_points,
            sort_order = v_sort_order,
            is_active = true
        WHERE id = v_rule_id;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'competition_id', v_competition_id,
    'rule_count', v_rule_count
  );
END;
$$;

CREATE FUNCTION public.submit_participation_v2(
  p_competition_id uuid,
  p_scoring_rule_id uuid,
  p_evidence_url text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_rule public.leaderboard_competition_scoring_rules%ROWTYPE;
  v_existing_log public.participation_logs%ROWTYPE;
  v_log_id uuid;
  v_trimmed_url text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_trimmed_url := btrim(p_evidence_url);
  IF NULLIF(v_trimmed_url, '') IS NULL THEN
    RAISE EXCEPTION 'Evidence URL cannot be empty';
  END IF;
  IF length(v_trimmed_url) > 2000 THEN
    RAISE EXCEPTION 'Evidence URL exceeds maximum allowed length';
  END IF;
  IF v_trimmed_url NOT LIKE 'https://%' THEN
    RAISE EXCEPTION 'Evidence URL must use the https:// scheme';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_profile.link_status IS NULL
    OR v_profile.link_status NOT IN ('linked_exact', 'manually_linked')
    OR v_profile.member_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.arsc_identities i
      WHERE i.auth_user_id = v_user_id
        AND i.member_id = v_profile.member_id
    )
  THEN
    RAISE EXCEPTION 'Identity not securely linked';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.competitions c
    WHERE c.id = p_competition_id
      AND c.is_active = true
  ) THEN
    RAISE EXCEPTION 'Competition is not available for submissions';
  END IF;

  SELECT * INTO v_rule
  FROM public.leaderboard_competition_scoring_rules
  WHERE id = p_scoring_rule_id
    AND competition_id = p_competition_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scoring option is not available for this competition';
  END IF;

  SELECT * INTO v_existing_log
  FROM public.participation_logs
  WHERE profile_id = v_profile.id
    AND competition_id = p_competition_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_log.status IN ('pending', 'approved') THEN
      RAISE EXCEPTION 'Submission is already pending or approved';
    END IF;

    UPDATE public.participation_logs
    SET status = 'pending',
        evidence_url = v_trimmed_url,
        requested_scoring_rule_id = v_rule.id,
        requested_achievement = v_rule.label,
        requested_points = v_rule.points,
        awarded_scoring_rule_id = NULL,
        achievement = NULL,
        awarded_points = NULL,
        admin_id = NULL,
        verified_at = NULL,
        notes = NULL
    WHERE id = v_existing_log.id
    RETURNING id INTO v_log_id;

    INSERT INTO public.participation_submission_events (
      log_id,
      from_status,
      to_status,
      actor_user_id,
      actor_role,
      evidence_url,
      scoring_rule_id,
      achievement
    ) VALUES (
      v_log_id,
      'rejected',
      'pending',
      v_user_id,
      'user',
      v_trimmed_url,
      v_rule.id,
      v_rule.label
    );

    RETURN jsonb_build_object('success', true, 'log_id', v_log_id, 'action', 'resubmitted');
  END IF;

  INSERT INTO public.participation_logs (
    profile_id,
    competition_id,
    evidence_url,
    status,
    requested_scoring_rule_id,
    requested_achievement,
    requested_points
  ) VALUES (
    v_profile.id,
    p_competition_id,
    v_trimmed_url,
    'pending',
    v_rule.id,
    v_rule.label,
    v_rule.points
  )
  RETURNING id INTO v_log_id;

  INSERT INTO public.participation_submission_events (
    log_id,
    from_status,
    to_status,
    actor_user_id,
    actor_role,
    evidence_url,
    scoring_rule_id,
    achievement
  ) VALUES (
    v_log_id,
    NULL,
    'pending',
    v_user_id,
    'user',
    v_trimmed_url,
    v_rule.id,
    v_rule.label
  );

  RETURN jsonb_build_object('success', true, 'log_id', v_log_id, 'action', 'submitted');
END;
$$;

CREATE FUNCTION public.review_participation_v2(
  p_log_id uuid,
  p_status text,
  p_scoring_rule_id uuid,
  p_notes text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_log public.participation_logs%ROWTYPE;
  v_rule public.leaderboard_competition_scoring_rules%ROWTYPE;
BEGIN
  IF v_admin_id IS NULL
    OR NOT public.leaderboard_has_role(v_admin_id, 'admin')
  THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'Review notes exceed 2000 characters';
  END IF;
  IF p_status = 'approved' AND p_scoring_rule_id IS NULL THEN
    RAISE EXCEPTION 'Approved submissions require a scoring option';
  END IF;
  IF p_status = 'rejected' AND p_scoring_rule_id IS NOT NULL THEN
    RAISE EXCEPTION 'Rejected submissions cannot receive a scoring option';
  END IF;

  SELECT * INTO v_log
  FROM public.participation_logs
  WHERE id = p_log_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF p_status = 'approved' THEN
    SELECT * INTO v_rule
    FROM public.leaderboard_competition_scoring_rules
    WHERE id = p_scoring_rule_id
      AND competition_id = v_log.competition_id
      AND (is_active = true OR id = v_log.requested_scoring_rule_id);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Scoring option does not belong to this competition or is inactive';
    END IF;
  END IF;

  IF v_log.status = p_status THEN
    IF v_log.awarded_scoring_rule_id IS NOT DISTINCT FROM p_scoring_rule_id
      AND v_log.notes IS NOT DISTINCT FROM NULLIF(btrim(p_notes), '')
    THEN
      RETURN jsonb_build_object('success', true, 'log_id', p_log_id, 'action', 'idempotent');
    END IF;

    RAISE EXCEPTION 'Submission is already %, and approved/rejected records are immutable', p_status;
  END IF;

  IF v_log.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Only pending submissions can be reviewed';
  END IF;

  UPDATE public.participation_logs
  SET status = p_status,
      awarded_scoring_rule_id = CASE WHEN p_status = 'approved' THEN v_rule.id ELSE NULL END,
      achievement = CASE WHEN p_status = 'approved' THEN v_rule.label ELSE NULL END,
      awarded_points = CASE WHEN p_status = 'approved' THEN v_rule.points ELSE NULL END,
      notes = NULLIF(btrim(p_notes), ''),
      admin_id = v_admin_id,
      verified_at = now()
  WHERE id = p_log_id;

  INSERT INTO public.participation_submission_events (
    log_id,
    from_status,
    to_status,
    actor_user_id,
    actor_role,
    evidence_url,
    awarded_points,
    notes,
    scoring_rule_id,
    achievement
  ) VALUES (
    p_log_id,
    'pending',
    p_status,
    v_admin_id,
    'admin',
    v_log.evidence_url,
    CASE WHEN p_status = 'approved' THEN v_rule.points ELSE NULL END,
    NULLIF(btrim(p_notes), ''),
    CASE WHEN p_status = 'approved' THEN v_rule.id ELSE NULL END,
    CASE WHEN p_status = 'approved' THEN v_rule.label ELSE NULL END
  );

  RETURN jsonb_build_object(
    'success', true,
    'log_id', p_log_id,
    'action', p_status,
    'achievement', CASE WHEN p_status = 'approved' THEN v_rule.label ELSE NULL END,
    'awarded_points', CASE WHEN p_status = 'approved' THEN v_rule.points ELSE NULL END
  );
END;
$$;

CREATE FUNCTION public.get_public_leaderboard_v2()
RETURNS TABLE (
  profile_id uuid,
  full_name text,
  bidang_biro text,
  avatar_url text,
  total_points bigint,
  total_participation_count integer,
  last_activity_at timestamptz,
  created_at timestamptz,
  is_identity_verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.full_name,
    p.bidang_biro,
    COALESCE(u.avatar_url, p.avatar_url),
    COALESCE(sum(pl.awarded_points), 0)::bigint,
    count(pl.id)::integer,
    max(COALESCE(pl.verified_at, pl.created_at)),
    p.created_at,
    true
  FROM public.profiles p
  INNER JOIN public.arsc_identities i
    ON i.auth_user_id = p.user_id
   AND i.member_id = p.member_id
  LEFT JOIN public.users u ON u.id = p.user_id
  LEFT JOIN public.participation_logs pl
    ON pl.profile_id = p.id
   AND pl.status = 'approved'
  WHERE p.link_status IN ('linked_exact', 'manually_linked')
  GROUP BY p.id, p.full_name, p.bidang_biro, p.avatar_url, u.avatar_url, p.created_at
  ORDER BY
    COALESCE(sum(pl.awarded_points), 0) DESC,
    count(pl.id) DESC,
    max(COALESCE(pl.verified_at, pl.created_at)) ASC NULLS LAST,
    p.created_at ASC;
$$;

CREATE FUNCTION public.get_public_member_participations_v2(p_profile_id uuid)
RETURNS TABLE (
  participation_id uuid,
  competition_id uuid,
  competition_title text,
  competition_date date,
  competition_category text,
  achievement text,
  awarded_points integer,
  participation_date timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pl.id,
    c.id,
    c.title,
    c.date,
    c.category,
    pl.achievement,
    COALESCE(pl.awarded_points, 0),
    pl.participation_date,
    pl.created_at
  FROM public.participation_logs pl
  INNER JOIN public.competitions c ON c.id = pl.competition_id
  INNER JOIN public.profiles p ON p.id = pl.profile_id
  INNER JOIN public.arsc_identities i
    ON i.auth_user_id = p.user_id
   AND i.member_id = p.member_id
  WHERE pl.profile_id = p_profile_id
    AND pl.status = 'approved'
    AND p.link_status IN ('linked_exact', 'manually_linked')
  ORDER BY COALESCE(pl.participation_date, pl.created_at) DESC;
$$;

CREATE FUNCTION public.get_public_category_scores_v2(p_category text)
RETURNS TABLE (
  profile_id uuid,
  total_points bigint,
  participation_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pl.profile_id,
    COALESCE(sum(pl.awarded_points), 0)::bigint,
    count(*)::bigint
  FROM public.participation_logs pl
  INNER JOIN public.competitions c ON c.id = pl.competition_id
  INNER JOIN public.profiles p ON p.id = pl.profile_id
  INNER JOIN public.arsc_identities i
    ON i.auth_user_id = p.user_id
   AND i.member_id = p.member_id
  WHERE pl.status = 'approved'
    AND c.category = p_category
    AND p.link_status IN ('linked_exact', 'manually_linked')
  GROUP BY pl.profile_id;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.competitions FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'competitions'
      AND policyname = 'Admins can manage competitions'
  ) THEN
    DROP POLICY "Admins can manage competitions" ON public.competitions;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.leaderboard_save_competition(uuid, text, date, text, text, boolean, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_participation_v2(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_participation_v2(uuid, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_public_leaderboard_v2() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_member_participations_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_category_scores_v2(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.leaderboard_save_competition(uuid, text, date, text, text, boolean, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_participation_v2(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_participation_v2(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_leaderboard_v2() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_member_participations_v2(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_category_scores_v2(text) TO anon, authenticated, service_role;

DO $$
BEGIN
  RAISE NOTICE 'Stage 5 configurable scoring deployed successfully.';
END;
$$;

COMMIT;
