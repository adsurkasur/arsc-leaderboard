'use client';

import { BadgeCheck, FileUp, HelpCircle, ListChecks, Link2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const guidance = [
  {
    icon: Link2,
    title: 'Hubungkan identitas',
    body: 'Buka Profil anggota dan masukkan kode akses Rapor. Nama serta bidang/biro akan diambil dari rilis Rapor aktif.',
  },
  {
    icon: FileUp,
    title: 'Ajukan partisipasi',
    body: 'Pilih kompetisi dan kategorinya, lalu lampirkan tautan HTTPS menuju sertifikat, pengumuman, atau bukti lain. Jika lomba belum tersedia, buka tab Usulkan baru; admin akan menambahkannya tanpa meminta Anda mengisi ulang bukti.',
  },
  {
    icon: ListChecks,
    title: 'Pantau peninjauan',
    body: 'Menu Permintaan saya menampilkan status menunggu, disetujui, atau ditolak beserta catatan admin.',
  },
  {
    icon: BadgeCheck,
    title: 'Masuk ke peringkat',
    body: 'Hanya partisipasi yang disetujui yang dihitung. Peringkat global tetap sama saat daftar dicari atau difilter.',
  },
];

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="size-5 text-primary" />
            Cara menggunakan Leaderboard
          </DialogTitle>
          <DialogDescription>Empat langkah dari identitas Rapor hingga partisipasi tercatat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {guidance.map(({ icon: Icon, title, body }, index) => (
            <div key={title} className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-2xl border p-4">
              <div className="relative flex size-10 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
                <Icon className="size-4" />
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {index + 1}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-semibold">{title}</h4>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
