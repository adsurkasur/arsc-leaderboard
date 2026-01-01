'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile, LeaderboardEntry } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Trophy, Medal, Award, ArrowUpDown, ArrowUp, ArrowDown, Info, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const TOP_LEADERBOARD_LIMIT = 10;

type SortField = 'rank' | 'full_name' | 'total_participation_count' | 'last_activity_at';
type SortDirection = 'asc' | 'desc';

// Extended profile type for leaderboard calculations
type ProfileWithEffectiveCount = Profile & {
  effectiveParticipationCount: number;
};

export function LeaderboardTable() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [categoryParticipationCounts, setCategoryParticipationCounts] = useState<Record<string, number>>({});
  const [isLoadingCategoryData, setIsLoadingCategoryData] = useState(false);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [participationData, setParticipationData] = useState<Array<{ id: string; competition?: { id: string; title: string; date: string; category: string } | null; participation_date: string | null; created_at: string }>>([]);
  const [isLoadingParticipation, setIsLoadingParticipation] = useState(false);

  useEffect(() => {
    fetchProfiles();
    fetchCategories();

    const channel = supabase
      .channel('leaderboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchProfiles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('total_participation_count', { ascending: false })
      .order('last_activity_at', { ascending: true }) // Earlier activity = better rank (tiebreaker 1)
      .order('created_at', { ascending: true }); // Earlier account = better rank (tiebreaker 2)

    if (!error && data) {
      // Calculate global ranks based on total participation count
      // With tiebreakers: 1) earlier last_activity_at, 2) earlier created_at
      type ProfileWithRank = typeof data[0] & { globalRank: number };
      const profilesWithRanks: ProfileWithRank[] = [];
      
      data.forEach((profile, index) => {
        // Each profile gets a unique rank since we have 3 ordering criteria
        // Ties are extremely unlikely with participation_count + last_activity_at + created_at
        const globalRank = index + 1;

        profilesWithRanks.push({
          ...profile,
          globalRank
        });
      });

      setProfiles(profilesWithRanks);
    }
    setIsLoading(false);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('competitions')
      .select('category');

    if (!error && data) {
      const uniqueCategories = [...new Set(data.map(c => c.category))];
      setCategories(uniqueCategories);
    }
  };

  const fetchCategoryParticipationCounts = useCallback(async () => {
    if (selectedCategory === 'all') return;

    setIsLoadingCategoryData(true);
    try {
      // Get all participation logs for the selected category
      const { data, error } = await supabase
        .from('participation_logs')
        .select(`
          profile_id,
          competition:competitions!inner(category)
        `)
        .eq('competition.category', selectedCategory);

      if (!error && data) {
        // Count participations per profile for this category
        const counts: Record<string, number> = {};
        data.forEach(log => {
          counts[log.profile_id] = (counts[log.profile_id] || 0) + 1;
        });
        setCategoryParticipationCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching category participation counts:', error);
    }
    setIsLoadingCategoryData(false);
  }, [selectedCategory]);

  // Fetch category-specific participation counts when category changes
  useEffect(() => {
    if (selectedCategory !== 'all') {
      fetchCategoryParticipationCounts();
    } else {
      setCategoryParticipationCounts({});
    }
  }, [selectedCategory, profiles, fetchCategoryParticipationCounts]);

  const handleViewDetails = async (profile: Profile) => {
    setSelectedProfile(profile);
    setIsModalOpen(true);
    setIsLoadingParticipation(true);

    try {
      const { data, error } = await supabase
        .from('participation_logs')
        .select(`
          *,
          competition:competitions(id, title, date, category)
        `)
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setParticipationData(data);
      }
    } catch (error) {
      console.error('Error fetching participation data:', error);
    }

    setIsLoadingParticipation(false);
  };

  const filteredAndSortedEntries = useMemo(() => {
    let filtered: ProfileWithEffectiveCount[] = profiles.filter(profile =>
      profile.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(profile => ({
      ...profile,
      effectiveParticipationCount: selectedCategory === 'all'
        ? profile.total_participation_count
        : (categoryParticipationCounts[profile.id] || 0)
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
          comparison = (a.globalRank || 999) - (b.globalRank || 999);
          break;
        case 'full_name':
          comparison = a.full_name.localeCompare(b.full_name);
          break;
        case 'total_participation_count':
          comparison = a.effectiveParticipationCount - b.effectiveParticipationCount;
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

    // Use global rank instead of index-based rank and limit to top 10
    const rankedEntries = filtered.map((profile) => ({
      ...profile,
      rank: profile.globalRank || 999,
      displayParticipationCount: profile.effectiveParticipationCount
    })) as LeaderboardEntry[];

    // Apply top 10 limit only when not searching and category is 'all'
    if (!searchQuery && selectedCategory === 'all') {
      return rankedEntries.slice(0, TOP_LEADERBOARD_LIMIT);
    }
    
    return rankedEntries;
  }, [profiles, searchQuery, selectedCategory, categoryParticipationCounts, sortField, sortDirection]);

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
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-full sm:w-48 rounded-xl" />
        </div>
        <div className="bg-card rounded-xl border shadow-card overflow-hidden">
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

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari peserta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-xl"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isLoadingCategoryData}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Semua Kategori" />
            {isLoadingCategoryData && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
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
                <Button variant="ghost" size="sm" onClick={() => handleSort('total_participation_count')} className="font-semibold text-xs md:text-sm px-2">
                  <span className="hidden sm:inline">Partisipasi</span>
                  <span className="sm:hidden">Pts</span>
                  <SortIcon field="total_participation_count" />
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
                    <TableCell className="py-3">{getRankBadge(entry.rank)}</TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2 md:gap-3">
                        <Avatar className="w-9 h-9 md:w-10 md:h-10 border-2 border-border ring-2 ring-background">
                          <AvatarImage src={entry.avatar_url || undefined} alt={entry.full_name} />
                          <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                            {getInitials(entry.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">{entry.full_name}</span>
                          {entry.bidang_biro && (
                            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full w-fit truncate max-w-[120px] md:max-w-none">
                              {entry.bidang_biro}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 md:px-3 py-1 bg-primary/10 text-primary font-semibold rounded-full text-sm">
                        {(entry as LeaderboardEntry & { displayParticipationCount: number }).displayParticipationCount}
                      </span>
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
                    </div>
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
