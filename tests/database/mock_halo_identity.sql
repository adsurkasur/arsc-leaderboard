-- Minimal Halo PSDM profile projection used only by local Stage 4 tests.

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  biro text NOT NULL DEFAULT '',
  jabatan text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'MEMBER',
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  whatsapp text
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
