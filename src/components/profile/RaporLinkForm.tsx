'use client';

import { useState } from 'react';
import { KeyRound, Link2, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { linkProfileWithRaporCode } from '@/lib/actions/raporIdentity';

type LinkedProfile = {
  profile_id: string;
  member_id: string;
  full_name: string;
  bidang_biro: string;
  link_status: 'linked_exact';
};

interface RaporLinkFormProps {
  compact?: boolean;
  onLinked?: (profile: LinkedProfile) => void | Promise<void>;
}

export function RaporLinkForm({ compact = false, onLinked }: RaporLinkFormProps) {
  const { toast } = useToast();
  const [accessCode, setAccessCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  const handleLink = async () => {
    if (!accessCode.trim()) {
      toast({
        title: 'Kode akses belum diisi',
        description: 'Gunakan kode akses yang sama dengan Portal Rapor ARSC.',
        variant: 'destructive',
      });
      return;
    }

    setIsLinking(true);
    const result = await linkProfileWithRaporCode(accessCode);
    setIsLinking(false);

    if (!result.success) {
      toast({
        title: 'Belum dapat terhubung',
        description: 'error' in result ? result.error : 'Integrasi Rapor belum dapat digunakan.',
        variant: 'destructive',
      });
      return;
    }

    setAccessCode('');
    toast({
      title: 'Rapor berhasil terhubung',
      description: `Profil disinkronkan sebagai ${result.profile.full_name}.`,
    });
    await onLinked?.(result.profile);
  };

  return (
    <div className={compact ? 'space-y-4' : 'rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 sm:p-5'}>
      {!compact && (
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Link2 className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Hubungkan profil dengan Rapor</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Cukup sekali. Nama dan bidang/biro akan mengikuti data Rapor aktif Anda.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="rapor-access-code" className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          Kode akses Rapor
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="rapor-access-code"
            type="password"
            autoComplete="one-time-code"
            placeholder="Masukkan kode akses"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !isLinking) void handleLink();
            }}
            disabled={isLinking}
            className="h-11 bg-background"
          />
          <Button onClick={handleLink} disabled={isLinking} className="h-11 shrink-0 gap-2 px-5">
            {isLinking ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Hubungkan
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Kode hanya diverifikasi di server dan tidak disimpan oleh Leaderboard.
        </p>
      </div>
    </div>
  );
}
