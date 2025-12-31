'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            Bantuan - Panduan Penggunaan
          </DialogTitle>
          <DialogDescription>
            Panduan lengkap untuk menggunakan Papan Peringkat ARSC
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">📊 Melihat Papan Peringkat</h4>
            <p className="text-sm text-muted-foreground">
              Papan peringkat menampilkan Top 10 peserta berdasarkan jumlah partisipasi kompetisi. 
              Anda dapat mencari peserta dan memfilter berdasarkan kategori.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">📝 Mengajukan Partisipasi</h4>
            <p className="text-sm text-muted-foreground">
              Klik tombol "Ajukan Partisipasi" di halaman utama. Isi nama kompetisi, 
              pilih kategori, dan jelaskan partisipasi Anda. Admin akan meninjau permintaan Anda.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">🔍 Melacak Permintaan</h4>
            <p className="text-sm text-muted-foreground">
              Klik "Permintaan Saya" untuk melihat status permintaan partisipasi Anda 
              (Menunggu, Disetujui, atau Ditolak).
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">⚙️ Mengatur Profil</h4>
            <p className="text-sm text-muted-foreground">
              Klik avatar Anda lalu pilih "Pengaturan Profil" untuk memperbarui nama dan bidang/biro.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">🏆 Peringkat & Medali</h4>
            <p className="text-sm text-muted-foreground">
              Medali emas, perak, dan perunggu diberikan kepada 3 peserta teratas. 
              Peringkat dihitung berdasarkan total partisipasi yang disetujui.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
