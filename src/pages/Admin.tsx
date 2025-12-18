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
          <p className="text-muted-foreground">Loading admin panel...</p>
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
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, competitions, and participation logs</p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4 hidden sm:inline" />
              Users
            </TabsTrigger>
            <TabsTrigger value="competitions" className="gap-2">
              <Trophy className="w-4 h-4 hidden sm:inline" />
              Competitions
            </TabsTrigger>
            <TabsTrigger value="participation" className="gap-2">
              <ClipboardList className="w-4 h-4 hidden sm:inline" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4 hidden sm:inline" />
              Inbox
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Create, edit, and manage user profiles</CardDescription>
              </CardHeader>
              <CardContent>
                <UsersManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="competitions" className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Competition Management</CardTitle>
                <CardDescription>Create and manage competitions</CardDescription>
              </CardHeader>
              <CardContent>
                <CompetitionsManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="participation" className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Participation Logs</CardTitle>
                <CardDescription>Add and manage user participation entries</CardDescription>
              </CardHeader>
              <CardContent>
                <ParticipationManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle>Verification Requests</CardTitle>
                <CardDescription>Review pending verification requests from users</CardDescription>
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
