import { createHash } from 'node:crypto';

export const RAPOR_UNIT_LABELS = {
  KETUM: 'Ketua Umum (KETUM)',
  'KETUA UMUM': 'Ketua Umum (KETUM)',
  PSDM: 'Biro Pengembangan Sumber Daya Mahasiswa (PSDM)',
  ADKEU: 'Biro Administrasi dan Keuangan (ADKEU)',
  PENKOM: 'Bidang Kepenulisan dan Kompetisi (PENKOM)',
  RISTEK: 'Bidang Riset dan Teknologi (RISTEK)',
  INFOKOM: 'Bidang Informasi dan Komunikasi (INFOKOM)',
} as const;

export type RaporUnitCode = keyof typeof RAPOR_UNIT_LABELS;

export function normalizeRaporUnit(unit: string): string | null {
  const normalized = unit.trim().toUpperCase() as RaporUnitCode;
  return RAPOR_UNIT_LABELS[normalized] ?? null;
}

export function hashRaporAccessCode(accessCode: string, pepper: string): string {
  const normalizedCode = accessCode.trim().toLowerCase();
  return createHash('sha256')
    .update(`${normalizedCode}::${pepper}`, 'utf8')
    .digest('hex');
}

