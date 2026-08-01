'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Competition } from '@/lib/types';
import { User } from '@supabase/supabase-js';
import { submitParticipation } from '@/lib/actions/stage3_participations';

interface ParticipationModalProps {
  user: User | null;
}

export function ParticipationModal({ user }: ParticipationModalProps) {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    if (isModalOpen && user) {
      fetchProfileAndCompetitions();
    }
  }, [isModalOpen, user]);

  const fetchProfileAndCompetitions = async () => {
    setIsLoadingProfile(true);
    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('link_status')
      .eq('user_id', user?.id)
      .single();
      
    if (profileData) {
      setLinkStatus(profileData.link_status);
    }
    
    // Fetch competitions
    const { data: compData, error } = await supabase
      .from('competitions')
      .select('*')
      .order('date', { ascending: false });

    if (!error && compData) {
      setCompetitions(compData);
    }
    setIsLoadingProfile(false);
  };

  const handleSubmit = async () => {
    if (!competitionId || !evidenceUrl.trim()) {
      toast({
        title: 'Kesalahan',
        description: 'Silakan pilih kompetisi dan sertakan URL bukti.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Execute the Stage 3 RPC explicitly (never write to participation_logs directly)
      const result = await submitParticipation(competitionId, evidenceUrl.trim());

      if (!result.success) {
        toast({
          title: 'Kesalahan',
          description: result.error || 'Gagal mengirim partisipasi.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Berhasil',
          description: 'Permintaan partisipasi Anda telah dikirim untuk ditinjau.',
        });
        setIsModalOpen(false);
        setCompetitionId('');
        setEvidenceUrl('');
      }
    } catch {
      toast({
        title: 'Kesalahan',
        description: 'Terjadi kesalahan yang tidak terduga.',
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  };

  if (!user) return null;

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Plus className="w-5 h-5" />
          Ajukan Partisipasi
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajukan Partisipasi</DialogTitle>
          <DialogDescription>
            Pilih kompetisi dan berikan tautan bukti partisipasi Anda. 
            Permintaan akan ditinjau oleh administrator.
          </DialogDescription>
        </DialogHeader>
        
        {isLoadingProfile ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : linkStatus !== 'linked_exact' ? (
          <div className="py-6 text-center space-y-4">
            <div className="bg-destructive/10 text-destructive p-4 rounded-md text-sm text-left">
              <strong>Identitas Belum Terverifikasi</strong>
              <p className="mt-1">
                Anda hanya dapat mengajukan partisipasi jika identitas Anda telah diverifikasi dan tertaut dengan Rapor (status: linked_exact).
              </p>
            </div>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Tutup
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <Label htmlFor="competition">Kompetisi *</Label>
                <Select value={competitionId} onValueChange={setCompetitionId}>
                  <SelectTrigger className="border-primary/20 focus:border-primary">
                    <SelectValue placeholder="Pilih kompetisi..." />
                  </SelectTrigger>
                  <SelectContent>
                    {competitions.length === 0 ? (
                      <SelectItem value="empty" disabled>Tidak ada kompetisi tersedia</SelectItem>
                    ) : (
                      competitions.map((comp) => (
                        <SelectItem key={comp.id} value={comp.id}>
                          {comp.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Hanya kompetisi yang sudah terdaftar yang dapat dipilih.
                </p>
              </div>
              <div>
                <Label htmlFor="evidenceUrl">Tautan Bukti (Evidence URL) *</Label>
                <Input
                  id="evidenceUrl"
                  type="url"
                  placeholder="https://gdrive.com/..."
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  className="border-primary/20 focus:border-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL ke sertifikat, pengumuman, atau bukti valid lainnya.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  'Kirim Permintaan'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
