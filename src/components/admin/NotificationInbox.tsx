'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VerificationRequest, Profile, Competition } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Loader2, Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

interface VerificationRequestWithRelations extends VerificationRequest {
  profile?: Profile;
  competition?: Competition;
}

export function NotificationInbox() {
  const [requests, setRequests] = useState<VerificationRequestWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('verification_requests')
      .select(`
        *,
        profile:profiles(id, full_name, avatar_url),
        competition:competitions(id, title)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Transform the data to match our types
      const transformedData = data.map(req => ({
        ...req,
        status: req.status as 'pending' | 'approved' | 'rejected',
        profile: req.profile as unknown as Profile,
        competition: req.competition as unknown as Competition
      }));
      setRequests(transformedData);
    }
    setIsLoading(false);
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingId(id);

    // For approved requests, first create a participation log
    if (status === 'approved') {
      const request = requests.find(r => r.id === id);
      if (!request) {
        toast({ title: 'Gagal', description: 'Permintaan tidak ditemukan', variant: 'destructive' });
        setProcessingId(null);
        return;
      }

      // Create participation log first
      const { error: logError } = await supabase
        .from('participation_logs')
        .insert({
          profile_id: request.profile_id,
          competition_id: request.competition_id,
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          notes: `Approved via verification request: ${request.message}`,
          participation_date: request.participation_date
        });

      if (logError) {
        toast({ title: 'Gagal', description: `Gagal membuat log partisipasi: ${logError.message}`, variant: 'destructive' });
        setProcessingId(null);
        return;
      }
    }

    // Update the verification request status
    const { error } = await supabase
      .from('verification_requests')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ 
        title: 'Berhasil', 
        description: `Permintaan berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}` 
      });
      fetchRequests();
    }

    setProcessingId(null);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-1">Tidak Ada Permintaan Verifikasi</h3>
        <p className="text-muted-foreground">Ketika pengguna mengirim permintaan verifikasi, akan muncul di sini.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pengguna</TableHead>
            <TableHead>Pesan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Waktu</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id} className="table-row-hover">
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={request.profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {request.profile ? getInitials(request.profile.full_name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{request.profile?.full_name || 'Tidak Dikenal'}</span>
                </div>
              </TableCell>
              <TableCell>
                <p className="max-w-xs truncate">{request.message}</p>
              </TableCell>
              <TableCell>{getStatusBadge(request.status)}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                {request.status === 'pending' && (
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleUpdateStatus(request.id, 'approved')}
                      disabled={processingId === request.id}
                      className="text-success hover:text-success hover:bg-success/10"
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleUpdateStatus(request.id, 'rejected')}
                      disabled={processingId === request.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
