'use client';

import Image from 'next/image';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="size-5 text-primary" />
            Tentang ARSC Leaderboard
          </DialogTitle>
          <DialogDescription>Rekam partisipasi kompetisi anggota ARSC.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-2xl border bg-muted/25 p-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-card">
              <Image src="/arsc-logo.png" alt="Logo ARSC" width={56} height={56} className="size-14 object-contain" />
            </div>
            <div>
              <p className="font-semibold">Agritech Research and Study Club</p>
              <p className="mt-1 text-sm text-muted-foreground">Periode 2025/2026</p>
            </div>
          </div>

          <div className="space-y-2 text-sm leading-6 text-muted-foreground">
            <p>
              Leaderboard mencatat pengajuan kompetisi, proses peninjauan, dan urutan partisipasi anggota dalam satu alur.
            </p>
            <p>
              Identitas nama dan bidang/biro disinkronkan dari Rapor ARSC. Bukti kompetisi baru dihitung setelah disetujui administrator.
            </p>
          </div>

          <p className="border-t pt-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Agritech Research and Study Club
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
