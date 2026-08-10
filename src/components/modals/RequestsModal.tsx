'use client';

import type { User } from '@supabase/supabase-js';
import { Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RequestsHistory } from '@/components/requests/RequestsHistory';

interface RequestsModalProps {
  user: User | null;
}

export function RequestsModal({ user }: RequestsModalProps) {
  if (!user) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Clock className="size-4" />
          Permintaan saya
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permintaan saya</DialogTitle>
          <DialogDescription>Lacak usulan kompetisi, partisipasi, dan percakapan dengan admin.</DialogDescription>
        </DialogHeader>
        <RequestsHistory user={user} className="py-2" />
      </DialogContent>
    </Dialog>
  );
}
