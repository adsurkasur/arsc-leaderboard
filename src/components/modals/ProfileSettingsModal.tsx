'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, ImageIcon, Loader2, RefreshCw, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Profile } from '@/lib/types';
import { User } from '@supabase/supabase-js';
import { RaporLinkForm } from '@/components/profile/RaporLinkForm';
import { refreshProfileFromRapor, updateProfileAvatar } from '@/lib/actions/raporIdentity';

interface ProfileSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onProfileChanged?: () => void | Promise<void>;
}

export function ProfileSettingsModal({
  open,
  onOpenChange,
  user,
  onProfileChanged,
}: ProfileSettingsModalProps) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async () => {
    if (!user) return;

    setIsLoadingProfile(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      setProfile(null);
      setLoadError(error?.message || 'Profil belum tersedia untuk akun ini.');
    } else {
      setProfile(data);
      setAvatarUrl(data.avatar_url || '');
    }
    setIsLoadingProfile(false);
  }, [user]);

  useEffect(() => {
    if (open && user) void fetchUserProfile();
  }, [open, user, fetchUserProfile]);

  const handleSaveAvatar = async () => {
    if (!profile) {
      toast({ title: 'Profil belum siap', description: loadError || 'Muat ulang profil lalu coba lagi.', variant: 'destructive' });
      return;
    }

    setIsSavingAvatar(true);
    const result = await updateProfileAvatar(avatarUrl || null);
    setIsSavingAvatar(false);

    if (!result.success) {
      toast({
        title: 'Foto belum tersimpan',
        description: 'error' in result ? result.error : 'Perubahan belum dapat disimpan.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Foto profil diperbarui', description: 'Perubahan akan tampil di papan peringkat.' });
    await fetchUserProfile();
    await onProfileChanged?.();
  };

  const handleRefreshIdentity = async () => {
    setIsRefreshing(true);
    const result = await refreshProfileFromRapor();
    setIsRefreshing(false);

    if (!result.success) {
      toast({
        title: 'Belum dapat disinkronkan',
        description: 'error' in result ? result.error : 'Integrasi Rapor belum dapat digunakan.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Data Rapor diperbarui', description: 'Nama dan bidang/biro sudah memakai rilis aktif.' });
    await fetchUserProfile();
    await onProfileChanged?.();
  };

  const isLinked = profile?.link_status === 'linked_exact' || profile?.link_status === 'manually_linked';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="size-5 text-primary" />
            Profil anggota
          </DialogTitle>
          <DialogDescription>
            Identitas utama mengikuti Rapor ARSC; Anda tetap dapat mengatur foto profil.
          </DialogDescription>
        </DialogHeader>

        {isLoadingProfile ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Memuat profil…
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
            <p className="font-medium text-destructive">Profil belum dapat dimuat</p>
            <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchUserProfile}>
              Coba lagi
            </Button>
          </div>
        ) : profile ? (
          <div className="space-y-5">
            <section className="rounded-2xl border bg-muted/25 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Identitas Rapor</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Sumber resmi nama dan unit organisasi</p>
                </div>
                {isLinked ? (
                  <Badge variant="outline" className="gap-1.5 border-success/25 bg-success/10 text-success">
                    <CheckCircle2 className="size-3.5" />
                    Terhubung
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-warning/25 bg-warning/10 text-amber-700">
                    Belum terhubung
                  </Badge>
                )}
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-fullname">Nama lengkap</Label>
                  <Input id="profile-fullname" value={profile.full_name} readOnly className="bg-background/70" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-bidangbiro">Bidang/Biro</Label>
                  <Input
                    id="profile-bidangbiro"
                    value={profile.bidang_biro || 'Belum tersinkron'}
                    readOnly
                    className="bg-background/70"
                  />
                </div>
              </div>

              {isLinked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 -ml-2 gap-2 text-primary"
                  onClick={handleRefreshIdentity}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Sinkronkan dari Rapor aktif
                </Button>
              )}
            </section>

            {!isLinked && (
              <RaporLinkForm
                onLinked={async (linkedProfile) => {
                  setProfile((current) => current ? {
                    ...current,
                    full_name: linkedProfile.full_name,
                    bidang_biro: linkedProfile.bidang_biro,
                    member_id: linkedProfile.member_id,
                    link_status: linkedProfile.link_status,
                  } : current);
                  await fetchUserProfile();
                  await onProfileChanged?.();
                }}
              />
            )}

            <section className="space-y-3 rounded-2xl border p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <ImageIcon className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Foto profil</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Opsional. Gunakan tautan gambar HTTPS yang dapat diakses publik.
                  </p>
                </div>
              </div>
              <Input
                id="profile-avatar"
                type="url"
                placeholder="https://…"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                disabled={isSavingAvatar}
              />
              <Button variant="secondary" onClick={handleSaveAvatar} disabled={isSavingAvatar} className="gap-2">
                {isSavingAvatar && <Loader2 className="size-4 animate-spin" />}
                Simpan foto
              </Button>
            </section>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
