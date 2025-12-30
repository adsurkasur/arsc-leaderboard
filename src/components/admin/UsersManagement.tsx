'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Pencil, Trash2, Loader2, Search, Shield, Mail } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function UsersManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({ full_name: '', avatar_url: '' });
  const [isSaving, setIsSaving] = useState(false);
  
  // Assign Email dialog state
  const [isAssignEmailDialogOpen, setIsAssignEmailDialogOpen] = useState(false);
  const [assignEmailProfile, setAssignEmailProfile] = useState<Profile | null>(null);
  const [assignEmailData, setAssignEmailData] = useState({ email: '', password: '' });
  const [isAssigningEmail, setIsAssigningEmail] = useState(false);
  
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!profilesError && profilesData) {
      setProfiles(profilesData);

      // Fetch user roles for profiles that have user_id
      const userIds = profilesData
        .filter(p => p.user_id)
        .map(p => p.user_id);

      if (userIds.length > 0) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);

        if (!rolesError && rolesData) {
          const rolesMap: Record<string, string> = {};
          rolesData.forEach(role => {
            rolesMap[role.user_id!] = role.role;
          });
          setUserRoles(rolesMap);
        }
      }
    }
    setIsLoading(false);
  };

  const filteredProfiles = profiles.filter(p => 
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingProfile(null);
    setFormData({ full_name: '', avatar_url: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({ full_name: profile.full_name, avatar_url: profile.avatar_url || '' });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) {
      toast({ title: 'Gagal', description: 'Nama wajib diisi', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    if (editingProfile) {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: formData.full_name,
          avatar_url: formData.avatar_url || null 
        })
        .eq('id', editingProfile.id);

      if (error) {
        toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui' });
        setIsDialogOpen(false);
        fetchProfiles();
      }
    } else {
      const { error } = await supabase
        .from('profiles')
        .insert({ 
          full_name: formData.full_name,
          avatar_url: formData.avatar_url || null 
        });

      if (error) {
        toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Berhasil', description: 'Profil berhasil dibuat' });
        setIsDialogOpen(false);
        fetchProfiles();
      }
    }

    setIsSaving(false);
  };

  const handleRoleUpdate = async (userId: string, newRole: 'admin' | 'user') => {
    if (!isAdmin) {
      toast({ title: 'Gagal', description: 'Hanya admin yang dapat mengelola peran pengguna', variant: 'destructive' });
      return;
    }

    // Remove existing role first
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // Add new role if not 'user'
    if (newRole !== 'user') {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole as 'admin' | 'user' });

      if (error) {
        toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
        return;
      }
    }

    // Update local state
    setUserRoles(prev => ({
      ...prev,
      [userId]: newRole === 'user' ? undefined : newRole
    }));

    toast({ title: 'Berhasil', description: `Peran pengguna diperbarui menjadi ${newRole === 'admin' ? 'Admin' : 'Pengguna'}` });
  };

  const handleDelete = async (profile: Profile) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus ${profile.full_name}?`)) return;

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profile.id);

    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Profil berhasil dihapus' });
      fetchProfiles();
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const openAssignEmailDialog = (profile: Profile) => {
    setAssignEmailProfile(profile);
    setAssignEmailData({ email: '', password: '' });
    setIsAssignEmailDialogOpen(true);
  };

  const handleAssignEmail = async () => {
    if (!assignEmailProfile) return;
    
    if (!assignEmailData.email.trim() || !assignEmailData.password.trim()) {
      toast({ title: 'Gagal', description: 'Email dan password wajib diisi', variant: 'destructive' });
      return;
    }

    if (assignEmailData.password.length < 6) {
      toast({ title: 'Gagal', description: 'Password minimal 6 karakter', variant: 'destructive' });
      return;
    }

    setIsAssigningEmail(true);

    try {
      // Create new auth user via Supabase Admin API
      // Note: This requires admin privileges or a server-side function
      // For now, we'll use signUp which creates an unverified user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: assignEmailData.email,
        password: assignEmailData.password,
        options: {
          data: {
            full_name: assignEmailProfile.full_name,
          }
        }
      });

      if (authError) {
        toast({ title: 'Gagal', description: authError.message, variant: 'destructive' });
        setIsAssigningEmail(false);
        return;
      }

      if (authData.user) {
        // Update the profile to link it with the new user
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ user_id: authData.user.id })
          .eq('id', assignEmailProfile.id);

        if (updateError) {
          toast({ title: 'Gagal', description: updateError.message, variant: 'destructive' });
        } else {
          toast({ 
            title: 'Berhasil', 
            description: `Akun berhasil dibuat untuk ${assignEmailProfile.full_name}. Email verifikasi telah dikirim.` 
          });
          setIsAssignEmailDialogOpen(false);
          fetchProfiles();
        }
      }
    } catch (error: any) {
      toast({ title: 'Gagal', description: error.message || 'Terjadi kesalahan', variant: 'destructive' });
    }

    setIsAssigningEmail(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari pengguna..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              Tambah Pengguna
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProfile ? 'Edit Pengguna' : 'Buat Pengguna'}</DialogTitle>
              <DialogDescription>
                {editingProfile ? 'Perbarui detail profil pengguna.' : 'Tambahkan pengguna baru ke papan peringkat.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input
                  id="name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Masukkan nama lengkap"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatar">URL Avatar (opsional)</Label>
                <Input
                  id="avatar"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                  placeholder="https://contoh.com/avatar.jpg"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingProfile ? 'Simpan Perubahan' : 'Buat Pengguna'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pengguna</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead className="text-center">Partisipasi</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProfiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  Tidak ada pengguna ditemukan
                </TableCell>
              </TableRow>
            ) : (
              filteredProfiles.map((profile) => (
                <TableRow key={profile.id} className="table-row-hover">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={profile.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(profile.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{profile.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isAdmin && profile.user_id ? (
                      <Select
                        value={userRoles[profile.user_id] || 'user'}
                        onValueChange={(value) => handleRoleUpdate(profile.user_id!, value as 'admin' | 'user')}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Pengguna</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium bg-muted">
                        <Shield className="w-3 h-3" />
                        {profile.user_id ? (userRoles[profile.user_id] || 'pengguna') : 'Tanpa Akun'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-primary/10 text-primary">
                      {profile.total_participation_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!profile.user_id && (
                        <Button variant="ghost" size="icon" onClick={() => openAssignEmailDialog(profile)} title="Tetapkan Email">
                          <Mail className="w-4 h-4 text-primary" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(profile)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(profile)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Assign Email Dialog */}
      <Dialog open={isAssignEmailDialogOpen} onOpenChange={setIsAssignEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Akun untuk {assignEmailProfile?.full_name}</DialogTitle>
            <DialogDescription>
              Buat akun baru dengan email dan password untuk pengguna ini. Email verifikasi akan dikirim setelah akun dibuat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assign-email">Email</Label>
              <Input
                id="assign-email"
                type="email"
                value={assignEmailData.email}
                onChange={(e) => setAssignEmailData({ ...assignEmailData, email: e.target.value })}
                placeholder="pengguna@contoh.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-password">Password</Label>
              <Input
                id="assign-password"
                type="password"
                value={assignEmailData.password}
                onChange={(e) => setAssignEmailData({ ...assignEmailData, password: e.target.value })}
                placeholder="Minimal 6 karakter"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignEmailDialogOpen(false)}>Batal</Button>
            <Button onClick={handleAssignEmail} disabled={isAssigningEmail}>
              {isAssigningEmail && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Buat Akun
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
