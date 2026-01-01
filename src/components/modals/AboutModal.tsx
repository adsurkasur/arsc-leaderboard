'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Info } from 'lucide-react';
import Image from 'next/image';

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
            <Info className="w-5 h-5 text-primary" />
            Tentang Aplikasi
          </DialogTitle>
          <DialogDescription>
            Informasi tentang Papan Peringkat ARSC
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-primary/10 border-2 border-primary/20 shadow-sm mb-4 overflow-hidden">
              <Image src="/arsc-logo.png" alt="ARSC Logo" width={96} height={96} className="rounded-xl" />
            </div>
            <h3 className="text-lg font-bold">ARSC Leaderboard</h3>
            <p className="text-sm text-muted-foreground">Versi 1.0.0</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">📌 Tentang Aplikasi</h4>
            <p className="text-sm text-muted-foreground">
              ARSC Leaderboard adalah platform papan peringkat kompetisi yang dirancang untuk 
              melacak dan menampilkan partisipasi anggota dalam berbagai kompetisi. 
              Aplikasi ini membantu memotivasi anggota untuk aktif berpartisipasi dalam kompetisi.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">🎯 Tujuan</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Mendorong partisipasi aktif dalam kompetisi</li>
              <li>Memberikan pengakuan kepada anggota berprestasi</li>
              <li>Memudahkan pelacakan partisipasi kompetisi</li>
              <li>Membangun semangat kompetitif yang sehat</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">👨‍💻 Pengembang</h4>
            <p className="text-sm text-muted-foreground">
              Dikembangkan oleh Tim ARSC dengan teknologi Next.js 16, React 19, 
              Tailwind CSS, dan Supabase.
            </p>
          </div>
          <div className="pt-2 border-t">
            <p className="text-xs text-center text-muted-foreground">
              © {new Date().getFullYear()} Agritech Research and Study Club (ARSC)
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
