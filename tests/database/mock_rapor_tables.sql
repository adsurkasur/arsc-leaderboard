-- Create mock Rapor tables for local testing
CREATE TABLE IF NOT EXISTS public.rapor_releases (
    release_code text PRIMARY KEY,
    title text NOT NULL,
    period text NOT NULL,
    status text NOT NULL DEFAULT 'staging' CHECK (status IN ('staging', 'published', 'archived')),
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rapor_members (
    member_code text PRIMARY KEY,
    release_code text NOT NULL REFERENCES public.rapor_releases(release_code) ON DELETE CASCADE,
    name text NOT NULL,
    unit text NOT NULL,
    jabatan text NOT NULL,
    status_penilaian text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rapor_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapor_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for active published releases" 
ON public.rapor_releases FOR SELECT USING (is_active = true AND status = 'published');

CREATE POLICY "Service role full access on rapor_members" 
ON public.rapor_members TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.rapor_releases TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.rapor_members TO anon, authenticated, service_role;

-- Insert Synthetic Data
INSERT INTO public.rapor_releases (release_code, title, period, status, is_active) VALUES
('RTP_2026', 'Rapor Tengah Periode 2026', 'Mid 2026', 'published', true), -- active-published
('DRAFT_2026', 'Draft Rapor 2026', 'End 2026', 'staging', true), -- active-draft
('OLD_2025', 'Rapor 2025', 'End 2025', 'published', false), -- inactive-published
('TRASH_2025', 'Trash 2025', 'End 2025', 'archived', false) -- inactive-draft
ON CONFLICT (release_code) DO NOTHING;

INSERT INTO public.rapor_members (member_code, release_code, name, unit, jabatan, status_penilaian) VALUES
('RTP_2026_001', 'RTP_2026', 'Citra Kartikaning Sari', 'ADKEU', 'Staf Ahli', 'Dinilai'),
('RTP_2026_002', 'RTP_2026', 'Budi Santoso', 'INFOKOM', 'Anggota Muda', 'Dinilai'),
('DRAFT_2026_001', 'DRAFT_2026', 'Draft User', 'PSDM', 'Staf Ahli', 'Dinilai'),
('OLD_2025_001', 'OLD_2025', 'Old User', 'RISTEK', 'Ketua Biro', 'Dinilai'),
('TRASH_2025_001', 'TRASH_2025', 'Trash User', 'MEDFO', 'Staf', 'Dinilai')
ON CONFLICT (member_code) DO NOTHING;
