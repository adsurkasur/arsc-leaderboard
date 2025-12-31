'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Competition } from '@/lib/types';
import { User } from '@supabase/supabase-js';

interface ParticipationModalProps {
  user: User | null;
}

export function ParticipationModal({ user }: ParticipationModalProps) {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionName, setCompetitionName] = useState('');
  const [competitionCategory, setCompetitionCategory] = useState('');
  const [participationDate, setParticipationDate] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const fetchCompetitions = async () => {
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .order('date', { ascending: false });

    if (!error && data) {
      setCompetitions(data);
    }
  };

  const handleSubmit = async () => {
    if (!competitionName.trim() || !competitionCategory.trim() || !message.trim()) {
      toast({
        title: 'Kesalahan',
        description: 'Silakan isi nama kompetisi, pilih kategori, dan tuliskan pesan.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) {
        toast({
          title: 'Kesalahan',
          description: 'Profil pengguna tidak ditemukan. Silakan hubungi administrator.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Check if competition exists, create if not
      let competitionId: string;
      const existingCompetition = competitions.find(
        comp => comp.title.toLowerCase() === competitionName.trim().toLowerCase()
      );

      if (existingCompetition) {
        competitionId = existingCompetition.id;
      } else {
        // Create new competition
        const { data: newCompetition, error: createError } = await supabase
          .from('competitions')
          .insert({
            title: competitionName.trim(),
            category: competitionCategory.trim(),
            date: new Date().toISOString().split('T')[0],
          })
          .select('id')
          .single();

        if (createError) {
          toast({
            title: 'Kesalahan',
            description: 'Gagal membuat kompetisi: ' + createError.message,
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }

        competitionId = newCompetition.id;
        fetchCompetitions();
      }

      // Submit verification request
      const { error } = await supabase
        .from('verification_requests')
        .insert({
          profile_id: profile.id,
          competition_id: competitionId,
          message: message.trim(),
          participation_date: participationDate ? new Date(participationDate).toISOString() : null,
        });

      if (error) {
        toast({
          title: 'Kesalahan',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Berhasil',
          description: 'Permintaan partisipasi Anda telah dikirim untuk ditinjau.',
        });
        setIsModalOpen(false);
        setCompetitionName('');
        setCompetitionCategory('');
        setParticipationDate('');
        setMessage('');
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
            Pilih kompetisi dan jelaskan detail partisipasi Anda. Permintaan akan ditinjau oleh administrator.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="competition">Nama Kompetisi</Label>
            <Input
              id="competition"
              placeholder="Masukkan nama kompetisi"
              value={competitionName}
              onChange={(e) => setCompetitionName(e.target.value)}
              className="border-primary/20 focus:border-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Jika kompetisi belum ada, akan dibuat otomatis.
            </p>
          </div>
          <div>
            <Label htmlFor="category">Kategori *</Label>
            <Select value={competitionCategory} onValueChange={setCompetitionCategory}>
              <SelectTrigger className="border-primary/20 focus:border-primary">
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Academic">Akademik</SelectItem>
                <SelectItem value="Sports">Olahraga</SelectItem>
                <SelectItem value="Innovation">Inovasi</SelectItem>
                <SelectItem value="Art">Seni</SelectItem>
                <SelectItem value="Technology">Teknologi</SelectItem>
                <SelectItem value="Science">Sains</SelectItem>
                <SelectItem value="Business">Bisnis</SelectItem>
                <SelectItem value="Culture">Budaya</SelectItem>
                <SelectItem value="Other">Lainnya</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Ini membantu memfilter papan peringkat berdasarkan kategori.
            </p>
          </div>
          <div>
            <Label htmlFor="participationDate">Tanggal Partisipasi</Label>
            <Input
              id="participationDate"
              type="date"
              value={participationDate}
              onChange={(e) => setParticipationDate(e.target.value)}
              className="border-primary/20 focus:border-primary [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tanggal Anda berpartisipasi dalam kompetisi.
            </p>
          </div>
          <div>
            <Label htmlFor="message">Pesan</Label>
            <Textarea
              id="message"
              placeholder="Jelaskan partisipasi Anda atau berikan detail tambahan..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
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
      </DialogContent>
    </Dialog>
  );
}
