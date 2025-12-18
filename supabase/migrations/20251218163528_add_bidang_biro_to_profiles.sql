-- Add bidang_biro column to profiles table
ALTER TABLE public.profiles
ADD COLUMN bidang_biro TEXT;

-- Add check constraint for valid bidang_biro values
ALTER TABLE public.profiles
ADD CONSTRAINT valid_bidang_biro CHECK (
  bidang_biro IS NULL OR
  bidang_biro IN (
    'Ketua Umum (KETUM)',
    'Biro Pengembangan Sumber Daya Mahasiswa (PSDM)',
    'Biro Administrasi dan Keuangan (ADKEU)',
    'Bidang Kepenulisan dan Kompetisi (PENKOM)',
    'Bidang Riset dan Teknologi (RISTEK)',
    'Bidang Informasi dan Komunikasi (INFOKOM)'
  )
);