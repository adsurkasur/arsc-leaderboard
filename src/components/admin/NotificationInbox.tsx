'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { VerificationRequest, Profile, Competition } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Inbox, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

type SortField = 'user' | 'status' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface VerificationRequestWithRelations extends VerificationRequest {
  profile?: Profile;
  competition?: Competition;
}

export function NotificationInbox() {
  const [requests, setRequests] = useState<VerificationRequestWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
      } as VerificationRequestWithRelations));
      setRequests(transformedData);
    }
    setIsLoading(false);
  };



  const sortedRequests = useMemo(() => {
    const sorted = [...requests].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'user':
          comparison = (a.profile?.full_name || '').localeCompare(b.profile?.full_name || '');
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
    return sorted;
  }, [requests, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'user' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1" /> 
      : <ArrowDown className="w-4 h-4 ml-1" />;
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
        <h3 className="font-semibold text-lg mb-1">Tidak Ada Permintaan Verifikasi (Legacy)</h3>
        <p className="text-muted-foreground">Sistem verifikasi lama sudah digantikan.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button variant="ghost" size="sm" onClick={() => handleSort('user')} className="font-semibold -ml-2">
                Pengguna <SortIcon field="user" />
              </Button>
            </TableHead>
            <TableHead>Pesan / Bukti</TableHead>
            <TableHead>Capaian</TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="font-semibold -ml-2">
                Status <SortIcon field="status" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" onClick={() => handleSort('created_at')} className="font-semibold -ml-2">
                Waktu <SortIcon field="created_at" />
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRequests.map((request) => (
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
                {request.evidence_url && (
                  <a href={request.evidence_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                    Lihat Bukti
                  </a>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{request.achievement || '-'}</Badge>
              </TableCell>
              <TableCell>{getStatusBadge(request.status)}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
