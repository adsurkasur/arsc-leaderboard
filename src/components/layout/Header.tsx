'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VerificationRequest, Competition, Profile } from '@/lib/types';
import { Trophy, Shield, LogOut, User, Clock, Loader2, Settings, HelpCircle, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [userRequests, setUserRequests] = useState<(VerificationRequest & { competition?: Competition })[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFullName, setProfileFullName] = useState('');
  const [profileBidangBiro, setProfileBidangBiro] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  useEffect(() => {
    if (isRequestsOpen && user && !isAdmin) {
      fetchUserRequests();
    }
  }, [isRequestsOpen, user, isAdmin]);

  useEffect(() => {
    if (isProfileOpen && user) {
      fetchUserProfile();
    }
  }, [isProfileOpen, user]);

  const fetchUserRequests = async () => {
    if (!user) return;

    setIsLoadingRequests(true);
    const { data, error } = await supabase
      .from('verification_requests')
      .select(`
        *,
        competition:competitions(id, title)
      `)
      .eq('profile_id', (await supabase.from('profiles').select('id').eq('user_id', user.id).single()).data?.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUserRequests(data.map(req => ({
        ...req,
        status: req.status as 'pending' | 'approved' | 'rejected',
        competition: req.competition as Competition
      })));
    }
    setIsLoadingRequests(false);
  };

  const fetchUserProfile = async () => {
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
  };

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
      setIsProfileOpen(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Menunggu</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Disetujui</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Ditolak</Badge>;
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <span className="font-bold text-xl tracking-tight">Papan Peringkat</span>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              {isAdmin ? (
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <Link href="/admin">
                    <Shield className="w-4 h-4" />
                    Panel Admin
                  </Link>
                </Button>
              ) : (
                <Dialog open={isRequestsOpen} onOpenChange={setIsRequestsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Clock className="w-4 h-4" />
                      Permintaan Saya
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Permintaan Partisipasi Saya</DialogTitle>
                      <DialogDescription>
                        Lacak status permintaan partisipasi Anda.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {isLoadingRequests ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : userRequests.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>Belum ada permintaan</p>
                          <p className="text-sm">Ajukan permintaan partisipasi untuk memulai</p>
                        </div>
                      ) : (
                        userRequests.map((request) => (
                          <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium">{request.competition?.title || 'Kompetisi Tidak Dikenal'}</p>
                              <p className="text-sm text-muted-foreground truncate">{request.message}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            {getStatusBadge(request.status)}
                          </div>
                        ))
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              
              {/* Profile Settings Modal */}
              <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
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
                    <Button variant="outline" onClick={() => setIsProfileOpen(false)} disabled={isUpdatingProfile}>
                      Batal
                    </Button>
                    <Button onClick={handleUpdateProfile} disabled={isUpdatingProfile}>
                      {isUpdatingProfile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Perbarui Profil
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {user.email?.[0].toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setIsProfileOpen(true)} className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Pengaturan Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsHelpOpen(true)} className="cursor-pointer">
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Bantuan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsAboutOpen(true)} className="cursor-pointer">
                    <Info className="w-4 h-4 mr-2" />
                    Tentang
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    <User className="w-4 h-4 mr-2" />
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Help Modal */}
              <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
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
                    <Button onClick={() => setIsHelpOpen(false)}>Tutup</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* About Modal */}
              <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
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
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                        <Trophy className="w-8 h-8 text-primary" />
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
                        © {new Date().getFullYear()} ARSC. Seluruh hak cipta dilindungi.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setIsAboutOpen(false)}>Tutup</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/auth">Masuk</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
