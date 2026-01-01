'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UsersManagement } from '@/components/admin/UsersManagement';
import { ParticipationManagement } from '@/components/admin/ParticipationManagement';
import { NotificationInbox } from '@/components/admin/NotificationInbox';
import { CompetitionsManagement } from '@/components/admin/CompetitionsManagement';
import { Loader2, Users, ClipboardList, Bell, Award, Shield } from 'lucide-react';
import { m } from 'framer-motion';
import { pageTransition, staggerContainer, staggerItem, fadeInUp } from '@/lib/motion';

export default function AdminPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      router.push('/auth');
    }
  }, [user, isAdmin, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <m.div 
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <Loader2 className="w-6 h-6 animate-spin text-primary absolute -bottom-1 -right-1 bg-background rounded-full" />
          </div>
          <p className="text-muted-foreground">Memuat dashboard admin...</p>
        </m.div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <m.div 
      className="min-h-screen bg-background"
      variants={pageTransition}
      initial="hidden"
      animate="visible"
    >
      <Header />
      
      <main className="container py-6 md:py-8">
        <m.div 
          className="mb-6 md:mb-8"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Dashboard Admin</h1>
          </div>
          <p className="text-muted-foreground">Kelola pengguna, kompetisi, dan catatan partisipasi</p>
        </m.div>

        <m.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <Tabs defaultValue="users" className="space-y-6">
            <m.div variants={staggerItem}>
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-auto lg:inline-grid h-auto p-1 gap-1">
                <TabsTrigger value="users" className="gap-2 py-2.5 data-[state=active]:shadow-sm">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Pengguna</span>
                </TabsTrigger>
                <TabsTrigger value="competitions" className="gap-2 py-2.5 data-[state=active]:shadow-sm">
                  <Award className="w-4 h-4" />
                  <span className="hidden sm:inline">Kompetisi</span>
                </TabsTrigger>
                <TabsTrigger value="participation" className="gap-2 py-2.5 data-[state=active]:shadow-sm">
                  <ClipboardList className="w-4 h-4" />
                  <span className="hidden sm:inline">Log</span>
                </TabsTrigger>
                <TabsTrigger value="notifications" className="gap-2 py-2.5 data-[state=active]:shadow-sm">
                  <Bell className="w-4 h-4" />
                  <span className="hidden sm:inline">Kotak Masuk</span>
                </TabsTrigger>
              </TabsList>
            </m.div>

            <m.div variants={staggerItem}>
              <TabsContent value="users" className="mt-0">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Manajemen Pengguna
                    </CardTitle>
                    <CardDescription>Buat, edit, dan kelola profil pengguna</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UsersManagement />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="competitions" className="mt-0">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-primary" />
                      Manajemen Kompetisi
                    </CardTitle>
                    <CardDescription>Buat dan kelola kompetisi</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CompetitionsManagement />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="participation" className="mt-0">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-primary" />
                      Log Partisipasi
                    </CardTitle>
                    <CardDescription>Tambah dan kelola entri partisipasi pengguna</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ParticipationManagement />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications" className="mt-0">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-primary" />
                      Permintaan Verifikasi
                    </CardTitle>
                    <CardDescription>Tinjau permintaan verifikasi yang tertunda dari pengguna</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <NotificationInbox />
                  </CardContent>
                </Card>
              </TabsContent>
            </m.div>
          </Tabs>
        </m.div>
      </main>
    </m.div>
  );
}
