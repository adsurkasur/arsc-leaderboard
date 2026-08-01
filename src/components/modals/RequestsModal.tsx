'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ParticipationLog, Competition } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { User } from '@supabase/supabase-js';

interface RequestsModalProps {
  user: User | null;
}

export function RequestsModal({ user }: RequestsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userRequests, setUserRequests] = useState<(ParticipationLog & { competition?: Competition })[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  const fetchUserRequests = useCallback(async () => {
    if (!user) return;

    setIsLoadingRequests(true);
    
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profileData?.id) {
      setIsLoadingRequests(false);
      return;
    }

    const { data, error } = await supabase
      .from('participation_logs')
      .select(`
        *,
        competition:competitions(id, title)
      `)
      .eq('profile_id', profileData.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUserRequests(data.map(req => {
        const reqData = req as unknown as ParticipationLog;
        return {
          ...reqData,
          status: reqData.status as 'pending' | 'approved' | 'rejected',
          competition: reqData.competition as unknown as Competition
        };
      }));
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
            Lacak status partisipasi kompetisi Anda.
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
              <p>Belum ada partisipasi</p>
              <p className="text-sm">Ajukan partisipasi untuk memulai</p>
            </div>
          ) : (
            userRequests.map((request) => (
              <div key={request.id} className="flex flex-col gap-2 p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{request.competition?.title || 'Kompetisi Tidak Dikenal'}</p>
                  {getStatusBadge(request.status)}
                </div>
                
                <div className="flex items-center justify-between mt-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {request.evidence_url && (
                      <a 
                        href={request.evidence_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <LinkIcon className="w-3 h-3" /> Bukti
                      </a>
                    )}
                  </div>
                  <span className="text-xs">
                    {request.created_at ? formatDistanceToNow(new Date(request.created_at), { addSuffix: true }) : ''}
                  </span>
                </div>

                {request.notes && (
                  <div className="mt-2 p-2 bg-muted/50 rounded-md text-xs border">
                    <p className="font-semibold mb-1">Catatan Admin:</p>
                    <p>{request.notes}</p>
                  </div>
                )}
                
                {request.status === 'approved' && request.awarded_points !== null && (
                  <p className="text-xs font-semibold text-success mt-1">
                    +{request.awarded_points} Poin
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
