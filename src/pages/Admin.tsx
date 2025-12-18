import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UsersManagement } from '@/components/admin/UsersManagement';
import { ParticipationManagement } from '@/components/admin/ParticipationManagement';
import { NotificationInbox } from '@/components/admin/NotificationInbox';
import { CompetitionsManagement } from '@/components/admin/CompetitionsManagement';
import { Loader2, Users, ClipboardList, Bell, Trophy } from 'lucide-react';

export default function Admin() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate('/auth');
    }
  }, [user, isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Memuat panel admin...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard Admin</h1>
          <p className="text-muted-foreground">Kelola pengguna, kompetisi, dan log partisipasi</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4 hidden sm:inline" />
              Pengguna
            </TabsTrigger>
            <TabsTrigger value="competitions" className="gap-2">
              <Trophy className="w-4 h-4 hidden sm:inline" />
              Kompetisi
            </TabsTrigger>
            <TabsTrigger value="participation" className="gap-2">
              <ClipboardList className="w-4 h-4 hidden sm:inline" />
              Log
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4 hidden sm:inline" />
              Kotak Masuk
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Manajemen Pengguna</CardTitle>
                <CardDescription>Buat, edit, dan kelola profil pengguna</CardDescription>
              </CardHeader>
              <CardContent>
                <UsersManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="competitions" className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Manajemen Kompetisi</CardTitle>
                <CardDescription>Buat dan kelola kompetisi</CardDescription>
              </CardHeader>
              <CardContent>
                <CompetitionsManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="participation" className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Log Partisipasi</CardTitle>
                <CardDescription>Tambah dan kelola entri partisipasi pengguna</CardDescription>
              </CardHeader>
              <CardContent>
                <ParticipationManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Permintaan Verifikasi</CardTitle>
                <CardDescription>Tinjau permintaan verifikasi yang tertunda dari pengguna</CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationInbox />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
