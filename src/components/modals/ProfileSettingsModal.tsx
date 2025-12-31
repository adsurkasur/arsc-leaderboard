'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Profile } from '@/lib/types';
import { User } from '@supabase/supabase-js';

interface ProfileSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function ProfileSettingsModal({ open, onOpenChange, user }: ProfileSettingsModalProps) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFullName, setProfileFullName] = useState('');
  const [profileBidangBiro, setProfileBidangBiro] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const fetchUserProfile = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setProfile(data);
      setProfileFullName(data.full_name);
      setProfileBidangBiro(data.bidang_biro || '');
    }
  }, [user]);

  useEffect(() => {
    if (open && user) {
      fetchUserProfile();
    }
  }, [open, user, fetchUserProfile]);

  const handleUpdateProfile = async () => {
    if (!user || !profile) return;

    setIsUpdatingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profileFullName,
        bidang_biro: profileBidangBiro,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    setIsUpdatingProfile(false);

    if (error) {
      toast({
        title: 'Gagal memperbarui',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Profil diperbarui!',
        description: 'Profil Anda telah berhasil diperbarui.',
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pengaturan Profil</DialogTitle>
          <DialogDescription>
            Perbarui informasi profil dan bidang/biro Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-fullname">Nama Lengkap</Label>
            <Input
              id="profile-fullname"
              type="text"
              placeholder="Masukkan nama lengkap Anda"
              value={profileFullName}
              onChange={(e) => setProfileFullName(e.target.value)}
              disabled={isUpdatingProfile}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-bidangbiro">Bidang/Biro</Label>
            <Select value={profileBidangBiro} onValueChange={setProfileBidangBiro} disabled={isUpdatingProfile}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih bidang/biro Anda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ketua Umum (KETUM)">Ketua Umum (KETUM)</SelectItem>
                <SelectItem value="Biro Pengembangan Sumber Daya Mahasiswa (PSDM)">Biro Pengembangan Sumber Daya Mahasiswa (PSDM)</SelectItem>
                <SelectItem value="Biro Administrasi dan Keuangan (ADKEU)">Biro Administrasi dan Keuangan (ADKEU)</SelectItem>
                <SelectItem value="Bidang Kepenulisan dan Kompetisi (PENKOM)">Bidang Kepenulisan dan Kompetisi (PENKOM)</SelectItem>
                <SelectItem value="Bidang Riset dan Teknologi (RISTEK)">Bidang Riset dan Teknologi (RISTEK)</SelectItem>
                <SelectItem value="Bidang Informasi dan Komunikasi (INFOKOM)">Bidang Informasi dan Komunikasi (INFOKOM)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdatingProfile}>
            Batal
          </Button>
          <Button onClick={handleUpdateProfile} disabled={isUpdatingProfile}>
            {isUpdatingProfile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Perbarui Profil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
