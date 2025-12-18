import { Link, useNavigate } from 'react-router-dom';
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
import { Trophy, Shield, LogOut, User, Clock, Loader2, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [userRequests, setUserRequests] = useState<(VerificationRequest & { competition?: Competition })[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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
    navigate('/');
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
        <Link to="/" className="flex items-center gap-2 group">
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
                  <Link to="/admin">
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
                              <p className="font-medium">{request.competition?.title || 'Unknown Competition'}</p>
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
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Masuk</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
