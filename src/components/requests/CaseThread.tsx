'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, LockKeyhole, MessageCircle, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { addCaseMessage } from '@/lib/actions/stage7_operations';
import type {
  LeaderboardCaseMessage,
  LeaderboardCaseType,
  LeaderboardMessageVisibility,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface CaseThreadProps {
  caseType: LeaderboardCaseType;
  caseId: string;
  currentUserId: string;
  isAdmin?: boolean;
  compact?: boolean;
}

function messageLabel(message: LeaderboardCaseMessage, currentUserId: string) {
  if (message.author_role === 'system') return 'Pembaruan sistem';
  if (message.visibility === 'admins_only') return 'Catatan internal admin';
  if (message.author_user_id === currentUserId) return 'Anda';
  return message.author_role === 'admin' ? 'Admin' : 'Anggota';
}

export function CaseThread({ caseType, caseId, currentUserId, isAdmin = false, compact = false }: CaseThreadProps) {
  const [messages, setMessages] = useState<LeaderboardCaseMessage[]>([]);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<LeaderboardMessageVisibility>('member_admins');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const { toast } = useToast();

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    const subjectColumn = caseType === 'proposal' ? 'proposal_id' : 'participation_log_id';
    const { data, error } = await supabase
      .from('leaderboard_case_messages')
      .select('*')
      .eq(subjectColumn, caseId)
      .order('created_at', { ascending: true });

    if (error) {
      setIsUnavailable(true);
      setMessages([]);
    } else {
      setIsUnavailable(false);
      setMessages((data ?? []) as LeaderboardCaseMessage[]);
    }
    setIsLoading(false);
  }, [caseId, caseType]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  const handleSend = async () => {
    const trimmedBody = body.trim();
    if (!trimmedBody) return;

    setIsSending(true);
    const result = await addCaseMessage({ caseType, caseId, body: trimmedBody, visibility });
    setIsSending(false);

    if (!result.success) {
      toast({ title: 'Pesan belum terkirim', description: result.error, variant: 'destructive' });
      return;
    }

    setBody('');
    setVisibility('member_admins');
    await fetchMessages();
  };

  if (isUnavailable) return null;

  return (
    <section className={`rounded-2xl border bg-muted/20 ${compact ? 'p-3' : 'p-4'}`} aria-label="Percakapan pengajuan">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" />
          <p className="text-sm font-semibold">Percakapan</p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => void fetchMessages()} disabled={isLoading}>
          Segarkan
        </Button>
      </div>

      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1" aria-live="polite">
        {isLoading ? (
          <div className="flex items-center justify-center py-5 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="rounded-xl border border-dashed p-3 text-xs leading-5 text-muted-foreground">
            Belum ada pesan. Gunakan ruang ini untuk klarifikasi tanpa membuat pengajuan baru.
          </p>
        ) : messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-xl border p-3 text-sm ${
              message.visibility === 'admins_only'
                ? 'border-amber-300/50 bg-amber-50/70 dark:bg-amber-950/15'
                : message.author_role === 'system'
                  ? 'bg-muted/50'
                  : 'bg-background'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                {message.visibility === 'admins_only' && <LockKeyhole className="size-3" />}
                {messageLabel(message, currentUserId)}
              </span>
              <time dateTime={message.created_at}>
                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
              </time>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap break-words leading-6">{message.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {isAdmin && (
          <Select value={visibility} onValueChange={(value) => setVisibility(value as LeaderboardMessageVisibility)}>
            <SelectTrigger className="h-9 bg-background text-xs" aria-label="Pilih penerima pesan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member_admins">Balasan untuk anggota & admin</SelectItem>
              <SelectItem value="admins_only">Catatan internal admin</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={isAdmin ? 'Tulis balasan atau catatan peninjauan…' : 'Tulis informasi tambahan atau balasan…'}
          rows={compact ? 2 : 3}
          maxLength={2000}
          className="resize-none bg-background"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.7rem] text-muted-foreground">{body.length}/2000 karakter</p>
          <Button size="sm" className="gap-2" onClick={() => void handleSend()} disabled={isSending || !body.trim()}>
            {isSending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Kirim
          </Button>
        </div>
      </div>
    </section>
  );
}
