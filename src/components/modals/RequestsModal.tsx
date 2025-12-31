'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { VerificationRequest, Competition } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { User } from '@supabase/supabase-js';

interface RequestsModalProps {
  user: User | null;
}

export function RequestsModal({ user }: RequestsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userRequests, setUserRequests] = useState<(VerificationRequest & { competition?: Competition })[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  const fetchUserRequests = useCallback(async () => {
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
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserRequests();
    }
  }, [isOpen, user, fetchUserRequests]);

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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
  );
}
