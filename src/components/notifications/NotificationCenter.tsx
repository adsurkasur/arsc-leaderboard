'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/stage7_operations';
import type { LeaderboardNotification } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface NotificationCenterProps {
  isAdmin: boolean;
}

export function NotificationCenter({ isAdmin }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<LeaderboardNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('leaderboard_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      setIsAvailable(false);
      setNotifications([]);
    } else {
      setIsAvailable(true);
      setNotifications((data ?? []) as LeaderboardNotification[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = window.setInterval(() => void fetchNotifications(), 60_000);
    const onFocus = () => void fetchNotifications();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchNotifications]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);
  const targetHref = isAdmin ? '/admin' : '/requests';

  const handleRead = async (notification: LeaderboardNotification) => {
    if (!notification.is_read) {
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
      await markNotificationRead(notification.id);
    }
  };

  const handleReadAll = async () => {
    setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
    await markAllNotificationsRead();
  };

  if (!isAvailable) return null;

  return (
    <Popover onOpenChange={(open) => open && void fetchNotifications()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-10 rounded-full" aria-label={`Notifikasi${unreadCount ? `, ${unreadCount} belum dibaca` : ''}`}>
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-bold leading-4 text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(23rem,calc(100vw-2rem))] rounded-2xl p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifikasi</p>
            <p className="text-xs text-muted-foreground">{unreadCount} belum dibaca</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={() => void handleReadAll()}>
              <CheckCheck className="size-3.5" /> Tandai semua
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="size-4 animate-spin" /></div>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Belum ada notifikasi.</p>
          ) : notifications.map((notification) => (
            <Link
              key={notification.id}
              href={targetHref}
              onClick={() => void handleRead(notification)}
              className={`block rounded-xl px-3 py-2.5 transition-colors hover:bg-muted ${notification.is_read ? '' : 'bg-primary/[0.06]'}`}
            >
              <div className="flex items-start gap-2">
                {!notification.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{notification.message}</p>
                  <p className="mt-1 text-[0.68rem] text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
