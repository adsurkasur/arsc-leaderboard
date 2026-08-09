const HALO_UNIT_LABELS: Record<string, string> = {
  KETUM: 'Ketua Umum (KETUM)',
  'KETUA UMUM': 'Ketua Umum (KETUM)',
  PSDM: 'Biro Pengembangan Sumber Daya Mahasiswa (PSDM)',
  ADKEU: 'Biro Administrasi dan Keuangan (ADKEU)',
  PENKOM: 'Bidang Kepenulisan dan Kompetisi (PENKOM)',
  RISTEK: 'Bidang Riset dan Teknologi (RISTEK)',
  INFOKOM: 'Bidang Informasi dan Komunikasi (INFOKOM)',
};

const HALO_POSITION_LABELS: Record<string, string> = {
  ANGGOTA_MUDA: 'Anggota Muda',
  STAF_AHLI: 'Staf Ahli',
  PENGURUS_HARIAN: 'Pengurus Harian',
};

export function formatHaloUnit(unit: string | null | undefined): string | null {
  const normalized = unit?.trim().toUpperCase();
  if (!normalized) return null;
  return HALO_UNIT_LABELS[normalized] ?? unit?.trim() ?? null;
}

export function formatHaloPosition(position: string | null | undefined): string | null {
  const normalized = position?.trim().toUpperCase();
  if (!normalized) return null;
  return HALO_POSITION_LABELS[normalized] ?? position?.trim() ?? null;
}

export function accountUsesRapor(role: string | null | undefined): boolean {
  return role?.trim().toUpperCase() !== 'PH';
}
