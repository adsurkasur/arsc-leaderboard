'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Profile, LeaderboardEntry } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Trophy, Medal, Award, ArrowUpDown, ArrowUp, ArrowDown, Info, Loader2, BadgeCheck, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { getErrorMessage, withTimeout } from '@/lib/async';

const INITIAL_LEADERBOARD_LIMIT = 12;
const LEADERBOARD_REQUEST_TIMEOUT_MS = 12_000;

type SortField = 'rank' | 'full_name' | 'total_points' | 'last_activity_at';
type SortDirection = 'asc' | 'desc';

// Extended profile type for leaderboard calculations
type ProfileWithEffectiveScore = Profile & {
  effectivePoints: number;
  effectiveParticipationCount: number;
};

export function LeaderboardTable() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [categoryScores, setCategoryScores] = useState<Record<string, { points: number; count: number }>>({});
  const [isLoadingCategoryData, setIsLoadingCategoryData] = useState(false);
  const [showAll, setShowAll] = useState(false);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [participationData, setParticipationData] = useState<Array<{
    id: string;
    competition?: { id: string; title: string; date: string; category: string } | null;
    achievement: string | null;
    awarded_points: number;
    participation_date: string | null;
    created_at: string;
  }>>([]);
  const [isLoadingParticipation, setIsLoadingParticipation] = useState(false);
  const profileRequestRef = useRef(0);

  const fetchProfiles = useCallback(async ({ initial = false }: { initial?: boolean } = {}) => {
    const requestId = ++profileRequestRef.current;
    if (initial) setIsLoading(true);
    else setIsRefreshing(true);
    setLoadError(null);

    try {
      const { data, error } = await withTimeout(
        supabase.rpc('get_public_leaderboard_v2'),
        LEADERBOARD_REQUEST_TIMEOUT_MS,
        'Peringkat belum merespons. Periksa koneksi lalu coba lagi.',
      );

      let nextProfiles: Profile[];
      if (!error && data) {
        nextProfiles = data.map((profile, index) => ({
          id: profile.profile_id,
          member_id: null,
          link_status: profile.is_identity_verified ? 'linked_exact' : 'unmatched',
          user_id: null,
          full_name: profile.full_name,
          bidang_biro: profile.bidang_biro,
          avatar_url: profile.avatar_url,
          total_points: Number(profile.total_points),
          total_participation_count: profile.total_participation_count,
          last_activity_at: profile.last_activity_at,
          created_at: profile.created_at,
          updated_at: profile.created_at,
          globalRank: index + 1,
          is_identity_verified: profile.is_identity_verified,
        }));
      } else {
        // Compatibility fallback while the additive Stage 5 read RPC awaits manual deployment.
        const legacyResult = await withTimeout(
          supabase.rpc('get_public_leaderboard'),
          LEADERBOARD_REQUEST_TIMEOUT_MS,
          'Peringkat belum merespons. Periksa koneksi lalu coba lagi.',
        );

        if (legacyResult.error) throw legacyResult.error;
        nextProfiles = (legacyResult.data ?? []).map((profile, index) => ({
          id: profile.profile_id,
          member_id: null,
          link_status: profile.is_identity_verified ? 'linked_exact' : 'unmatched',
          user_id: null,
          full_name: profile.full_name,
          bidang_biro: profile.bidang_biro,
          avatar_url: profile.avatar_url,
          total_points: 0,
          total_participation_count: profile.total_participation_count,
          last_activity_at: profile.last_activity_at,
          created_at: profile.created_at,
          updated_at: profile.created_at,
          globalRank: index + 1,
          is_identity_verified: profile.is_identity_verified,
        }));
      }

      if (requestId === profileRequestRef.current) setProfiles(nextProfiles);
    } catch (error) {
      if (requestId === profileRequestRef.current) {
        setLoadError(getErrorMessage(error, 'Peringkat belum dapat dimuat.'));
      }
    } finally {
      if (requestId === profileRequestRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('competitions').select('category'),
        LEADERBOARD_REQUEST_TIMEOUT_MS,
      );

      if (error) throw error;
      const uniqueCategories = [...new Set((data ?? []).map((competition) => competition.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Competition categories refresh failed:', getErrorMessage(error, 'Unknown category error'));
    }
  }, []);

  useEffect(() => {
    void fetchProfiles({ initial: true });
    void fetchCategories();

    const refreshProfiles = () => void fetchProfiles();
    const refreshCategories = () => void fetchCategories();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) refreshProfiles();
    };
    const channel = supabase
      .channel('leaderboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, refreshProfiles)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participation_logs' }, refreshProfiles)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competitions' }, refreshCategories)
      .subscribe();

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('online', refreshProfiles);

    return () => {
      profileRequestRef.current += 1;
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('online', refreshProfiles);
      void supabase.removeChannel(channel);
    };
  }, [fetchCategories, fetchProfiles]);

  const fetchCategoryScores = useCallback(async () => {
    if (selectedCategory === 'all') return;

    setIsLoadingCategoryData(true);
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('get_public_category_scores_v2', {
          p_category: selectedCategory,
        }),
        LEADERBOARD_REQUEST_TIMEOUT_MS,
      );

      if (!error && data) {
        const scores: Record<string, { points: number; count: number }> = {};
        data.forEach(row => {
          scores[row.profile_id] = {
            points: Number(row.total_points),
            count: Number(row.participation_count),
          };
        });
        setCategoryScores(scores);
      } else {
        const legacyResult = await withTimeout(
          supabase.rpc('get_public_category_participation_counts', {
            p_category: selectedCategory,
          }),
          LEADERBOARD_REQUEST_TIMEOUT_MS,
        );

        const scores: Record<string, { points: number; count: number }> = {};
        legacyResult.data?.forEach((row) => {
          scores[row.profile_id] = { points: 0, count: Number(row.participation_count) };
        });
        setCategoryScores(scores);
      }
    } catch (error) {
      console.error('Error fetching category participation counts:', error);
    }
    finally {
      setIsLoadingCategoryData(false);
    }
  }, [selectedCategory]);

  // Fetch category-specific points and participation counts when category changes.
  useEffect(() => {
    if (selectedCategory !== 'all') {
      fetchCategoryScores();
    } else {
      setCategoryScores({});
    }
  }, [selectedCategory, profiles, fetchCategoryScores]);

  const handleViewDetails = async (profile: Profile) => {
    setSelectedProfile(profile);
    setIsModalOpen(true);
    setIsLoadingParticipation(true);

    try {
      const { data, error } = await withTimeout(
        supabase.rpc('get_public_member_participations_v2', {
          p_profile_id: profile.id,
        }),
        LEADERBOARD_REQUEST_TIMEOUT_MS,
      );

      if (!error && data) {
        setParticipationData(data.map((participation) => ({
          id: participation.participation_id,
          competition: {
            id: participation.competition_id,
            title: participation.competition_title,
            date: participation.competition_date,
            category: participation.competition_category,
          },
          achievement: participation.achievement,
          awarded_points: participation.awarded_points,
          participation_date: participation.participation_date,
          created_at: participation.created_at,
        })));
      } else {
        const legacyResult = await withTimeout(
          supabase.rpc('get_public_member_participations', {
            p_profile_id: profile.id,
          }),
          LEADERBOARD_REQUEST_TIMEOUT_MS,
        );

        if (legacyResult.data) {
          setParticipationData(legacyResult.data.map((participation) => ({
            id: participation.participation_id,
            competition: {
              id: participation.competition_id,
              title: participation.competition_title,
              date: participation.competition_date,
              category: participation.competition_category,
            },
            achievement: null,
            awarded_points: 0,
            participation_date: participation.participation_date,
            created_at: participation.created_at,
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching participation data:', error);
    } finally {
      setIsLoadingParticipation(false);
    }
  };

  const filteredAndSortedEntries = useMemo(() => {
    let filtered: ProfileWithEffectiveScore[] = profiles.filter(profile =>
      profile.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(profile => ({
      ...profile,
      effectivePoints: selectedCategory === 'all'
        ? (profile.total_points ?? 0)
        : (categoryScores[profile.id]?.points ?? 0),
      effectiveParticipationCount: selectedCategory === 'all'
        ? profile.total_participation_count
        : (categoryScores[profile.id]?.count ?? 0)
    }));

    // Filter out profiles with 0 participations in the selected category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(profile => profile.effectiveParticipationCount > 0);
    }

    // Sort the filtered results
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'rank':
          comparison = selectedCategory === 'all'
            ? (a.globalRank || 999) - (b.globalRank || 999)
            : b.effectivePoints - a.effectivePoints
              || b.effectiveParticipationCount - a.effectiveParticipationCount
              || a.full_name.localeCompare(b.full_name);
          break;
        case 'full_name':
          comparison = a.full_name.localeCompare(b.full_name);
          break;
        case 'total_points':
          comparison = a.effectivePoints - b.effectivePoints;
          if (comparison === 0) {
            comparison = a.effectiveParticipationCount - b.effectiveParticipationCount;
          }
          // Tiebreaker 1: earlier last_activity_at = better rank
          if (comparison === 0) {
            const dateA = a.last_activity_at ? new Date(a.last_activity_at).getTime() : Infinity;
            const dateB = b.last_activity_at ? new Date(b.last_activity_at).getTime() : Infinity;
            comparison = dateA - dateB;
          }
          // Tiebreaker 2: earlier created_at = better rank
          if (comparison === 0) {
            const createdA = new Date(a.created_at).getTime();
            const createdB = new Date(b.created_at).getTime();
            comparison = createdA - createdB;
          }
          break;
        case 'last_activity_at': {
          const dateA = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
          const dateB = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
        default:
          comparison = b.effectiveParticipationCount - a.effectiveParticipationCount;
          // Tiebreaker 1: earlier last_activity_at = better rank
          if (comparison === 0) {
            const dateA = a.last_activity_at ? new Date(a.last_activity_at).getTime() : Infinity;
            const dateB = b.last_activity_at ? new Date(b.last_activity_at).getTime() : Infinity;
            comparison = dateA - dateB;
          }
          // Tiebreaker 2: earlier created_at = better rank
          if (comparison === 0) {
            const createdA = new Date(a.created_at).getTime();
            const createdB = new Date(b.created_at).getTime();
            comparison = createdA - createdB;
          }
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });

    // Use the global rank even when search/filter changes the visible set.
    const rankedEntries = filtered.map((profile, index) => ({
      ...profile,
      rank: selectedCategory === 'all' ? (profile.globalRank || 999) : index + 1,
      displayPoints: profile.effectivePoints,
      displayParticipationCount: profile.effectiveParticipationCount
    })) as LeaderboardEntry[];

    if (!showAll && !searchQuery && selectedCategory === 'all') {
      return rankedEntries.slice(0, INITIAL_LEADERBOARD_LIMIT);
    }
    
    return rankedEntries;
  }, [profiles, searchQuery, selectedCategory, categoryScores, sortField, sortDirection, showAll]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      // For rank and full_name, ascending is natural order (1 first, A first)
      // For participation count and activity, descending is natural (highest first, most recent first)
      setSortDirection(field === 'full_name' || field === 'rank' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1" /> 
      : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  const getRankBadge = (rank: number) => {
    return (
      <div>
        {rank === 1 && <div className="rank-badge rank-gold"><Trophy className="w-4 h-4" /></div>}
        {rank === 2 && <div className="rank-badge rank-silver"><Medal className="w-4 h-4" /></div>}
        {rank === 3 && <div className="rank-badge rank-bronze"><Award className="w-4 h-4" /></div>}
        {rank > 3 && <div className="rank-badge rank-default">{rank}</div>}
      </div>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border bg-card p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl sm:w-52" />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i} 
              className="flex items-center gap-3 md:gap-4 p-3 md:p-4 border-b last:border-0"
            >
              <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-4 w-24 md:w-32 mb-2 rounded" />
                <Skeleton className="h-3 w-16 md:w-24 rounded" />
              </div>
              <Skeleton className="h-6 w-10 rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError && profiles.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-card px-6 py-10 text-center shadow-sm">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </span>
        <h3 className="mt-4 font-semibold">Peringkat belum dapat dimuat</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{loadError}</p>
        <Button className="mt-5 gap-2" variant="outline" onClick={() => void fetchProfiles({ initial: true })}>
          <RefreshCw className="size-4" />
          Coba lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      {loadError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning/25 bg-warning/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="leading-6 text-muted-foreground">
              Data terakhir tetap ditampilkan. Pembaruan terbaru belum berhasil dimuat.
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => void fetchProfiles()} disabled={isRefreshing}>
            <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Segarkan
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama anggota"
              aria-label="Cari nama anggota"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 rounded-xl border-transparent bg-muted/55 pl-10 shadow-none focus-visible:border-primary/30 focus-visible:bg-background"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isLoadingCategoryData}>
            <SelectTrigger className="h-11 w-full rounded-xl border-transparent bg-muted/55 shadow-none sm:w-56" aria-label="Filter kategori kompetisi">
              <SelectValue placeholder="Semua kategori" />
              {isLoadingCategoryData && <Loader2 className="ml-2 size-4 animate-spin" />}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted-foreground">
            {searchQuery || selectedCategory !== 'all'
              ? `${filteredAndSortedEntries.length} hasil ditampilkan`
              : `${profiles.length} anggota tercatat`}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground"
            onClick={() => void fetchProfiles()}
            disabled={isRefreshing}
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Memperbarui' : 'Perbarui data'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-[0_16px_50px_-36px_hsl(var(--foreground)/0.28)]">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/35 hover:bg-muted/35">
              <TableHead className="w-16 md:w-20">
                <Button variant="ghost" size="sm" onClick={() => handleSort('rank')} className="font-semibold -ml-2 text-xs md:text-sm px-2">
                  <span className="hidden sm:inline">Peringkat</span>
                  <span className="sm:hidden">#</span>
                  <SortIcon field="rank" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('full_name')} className="font-semibold -ml-2 text-xs md:text-sm px-2">
                  Peserta <SortIcon field="full_name" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button variant="ghost" size="sm" onClick={() => handleSort('total_points')} className="font-semibold text-xs md:text-sm px-2">
                  <span>Poin</span>
                  <SortIcon field="total_points" />
                </Button>
              </TableHead>
              <TableHead className="text-right hidden md:table-cell">
                <Button variant="ghost" size="sm" onClick={() => handleSort('last_activity_at')} className="font-semibold text-sm px-2">
                  Aktivitas Terakhir <SortIcon field="last_activity_at" />
                </Button>
              </TableHead>
              <TableHead className="w-12 md:w-20 text-center">
                <span className="sr-only md:not-sr-only">Detail</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 opacity-40" />
                    <span>
                      {searchQuery || selectedCategory !== 'all' 
                        ? 'Tidak ada hasil yang ditemukan sesuai pencarian dan filter Anda'
                        : 'Tidak ada peserta ditemukan'
                      }
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
                filteredAndSortedEntries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="table-row-hover border-b last:border-0"
                  >
                    <TableCell className="py-4">{getRankBadge(entry.rank)}</TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2 md:gap-3">
                        <Avatar className="w-9 h-9 md:w-10 md:h-10 border-2 border-border ring-2 ring-background">
                          <AvatarImage src={entry.avatar_url || undefined} alt={entry.full_name} />
                          <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                            {getInitials(entry.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="flex min-w-0 items-center gap-1.5 font-medium">
                            <span className="truncate">{entry.full_name}</span>
                            {entry.is_identity_verified && (
                              <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Identitas Rapor terverifikasi" />
                            )}
                          </span>
                          {entry.bidang_biro && (
                            <span className="mt-1 max-w-[150px] truncate text-xs text-muted-foreground md:max-w-none">
                              {entry.bidang_biro}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <div className="inline-flex min-w-[4.5rem] flex-col items-center rounded-lg bg-primary/[0.08] px-2.5 py-1 text-primary md:px-3">
                        <span className="text-sm font-semibold">
                          {(entry as LeaderboardEntry & { displayPoints: number }).displayPoints}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {(entry as LeaderboardEntry & { displayParticipationCount: number }).displayParticipationCount} partisipasi
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm hidden md:table-cell">
                      {entry.last_activity_at 
                        ? formatDistanceToNow(new Date(entry.last_activity_at), { addSuffix: true })
                        : 'Belum pernah'
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewDetails(entry)}
                        className="w-9 h-9 hover:bg-primary/10 hover:text-primary rounded-lg touch-target"
                        title="Lihat detail partisipasi"
                      >
                        <Info className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

      {!searchQuery && selectedCategory === 'all' && profiles.length > INITIAL_LEADERBOARD_LIMIT && !showAll && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setShowAll(true)} className="gap-2 rounded-full px-5">
            Lihat semua {profiles.length} anggota
            <ChevronDown className="size-4" />
          </Button>
        </div>
      )}

      {/* Participation Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Detail Partisipasi
            </DialogTitle>
            <DialogDescription>
              {selectedProfile && `Kompetisi yang diikuti oleh ${selectedProfile.full_name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoadingParticipation ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Memuat data partisipasi...</span>
              </div>
            ) : participationData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Rekaman partisipasi tidak ditemukan</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {participationData.map((participation) => (
                  <div
                    key={participation.id}
                    className="p-3 bg-muted/30 rounded-lg border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{participation.competition?.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {participation.competition?.category}
                        </p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        {participation.awarded_points} poin
                      </span>
                    </div>
                    {participation.achievement && (
                      <p className="mt-2 text-sm font-medium">{participation.achievement}</p>
                    )}
                    <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Waktu Partisipasi: </span>
                        <span className="font-medium">
                          {participation.participation_date 
                            ? format(new Date(participation.participation_date), 'dd MMM yyyy, HH:mm')
                            : '-'
                          }
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Diajukan: </span>
                        <span className="font-medium">
                          {format(new Date(participation.created_at), 'dd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
