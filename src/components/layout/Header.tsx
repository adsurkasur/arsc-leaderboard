import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VerificationRequest, Competition } from '@/lib/types';
import { Trophy, Shield, LogOut, User, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [userRequests, setUserRequests] = useState<(VerificationRequest & { competition?: Competition })[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  useEffect(() => {
    if (isRequestsOpen && user && !isAdmin) {
      fetchUserRequests();
    }
  }, [isRequestsOpen, user, isAdmin]);

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Rejected</Badge>;
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
          <span className="font-bold text-xl tracking-tight">Competition Leaderboard</span>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              {isAdmin ? (
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <Link to="/admin">
                    <Shield className="w-4 h-4" />
                    Admin Panel
                  </Link>
                </Button>
              ) : (
                <Dialog open={isRequestsOpen} onOpenChange={setIsRequestsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Clock className="w-4 h-4" />
                      My Requests
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>My Participation Requests</DialogTitle>
                      <DialogDescription>
                        Track the status of your competition participation requests.
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
                          <p>No requests found</p>
                          <p className="text-sm">Submit a participation request to get started</p>
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
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    <User className="w-4 h-4 mr-2" />
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
