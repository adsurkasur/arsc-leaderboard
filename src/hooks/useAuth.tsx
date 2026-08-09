/* eslint-disable react-refresh/only-export-components */
'use client';

import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { getErrorMessage, withTimeout } from '@/lib/async';

const AUTH_REQUEST_TIMEOUT_MS = 10_000;

interface AccountContextSnapshot {
  isAdmin: boolean;
  linkStatus: string | null;
  accountRole: string | null;
  accountName: string | null;
  accountAvatarUrl: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  linkStatus: string | null;
  accountRole: string | null;
  accountName: string | null;
  accountAvatarUrl: string | null;
  refreshIdentityStatus: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: { full_name: string; bidang_biro: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [accountRole, setAccountRole] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountAvatarUrl, setAccountAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const accountRequestRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);

  const clearAccountContext = useCallback(() => {
    setIsAdmin(false);
    setLinkStatus(null);
    setAccountRole(null);
    setAccountName(null);
    setAccountAvatarUrl(null);
  }, []);

  const fetchAccountContext = useCallback(async (userId: string): Promise<AccountContextSnapshot> => {
    const [profileResult, accountResult, adminResult] = await withTimeout(
      Promise.all([
        supabase
          .from('profiles')
          .select('link_status')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('users')
          .select('role, name, avatar_url')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle(),
      ]),
      AUTH_REQUEST_TIMEOUT_MS,
      'Data akun belum merespons. Coba segarkan kembali.',
    );

    if (profileResult.error && accountResult.error && adminResult.error) {
      throw new Error(
        profileResult.error.message
          || accountResult.error.message
          || adminResult.error.message,
      );
    }

    return {
      isAdmin: !adminResult.error && Boolean(adminResult.data),
      linkStatus: profileResult.error ? null : profileResult.data?.link_status ?? null,
      accountRole: accountResult.error ? null : accountResult.data?.role ?? null,
      accountName: accountResult.error ? null : accountResult.data?.name ?? null,
      accountAvatarUrl: accountResult.error ? null : accountResult.data?.avatar_url ?? null,
    };
  }, []);

  const refreshAccountContext = useCallback(async (userId: string, showLoading: boolean) => {
    const requestId = ++accountRequestRef.current;
    if (showLoading) setIsLoading(true);

    try {
      const nextContext = await fetchAccountContext(userId);
      if (requestId !== accountRequestRef.current || currentUserIdRef.current !== userId) return;

      setIsAdmin(nextContext.isAdmin);
      setLinkStatus(nextContext.linkStatus);
      setAccountRole(nextContext.accountRole);
      setAccountName(nextContext.accountName);
      setAccountAvatarUrl(nextContext.accountAvatarUrl);
    } catch (error) {
      console.error('Account context refresh failed:', getErrorMessage(error, 'Unknown account error'));
    } finally {
      if (requestId === accountRequestRef.current) {
        hasInitializedRef.current = true;
        setIsLoading(false);
      }
    }
  }, [fetchAccountContext]);

  const applySession = useCallback(async (nextSession: Session | null, showLoading: boolean) => {
    const nextUser = nextSession?.user ?? null;
    const userChanged = currentUserIdRef.current !== (nextUser?.id ?? null);

    setSession(nextSession);
    setUser(nextUser);
    currentUserIdRef.current = nextUser?.id ?? null;

    if (!nextUser) {
      accountRequestRef.current += 1;
      clearAccountContext();
      hasInitializedRef.current = true;
      setIsLoading(false);
      return;
    }

    if (userChanged) clearAccountContext();
    await refreshAccountContext(nextUser.id, showLoading || !hasInitializedRef.current || userChanged);
  }, [clearAccountContext, refreshAccountContext]);

  const refreshIdentityStatus = useCallback(async () => {
    const userId = currentUserIdRef.current;
    if (!userId) {
      clearAccountContext();
      return;
    }
    await refreshAccountContext(userId, false);
  }, [clearAccountContext, refreshAccountContext]);

  useEffect(() => {
    let disposed = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (event === 'INITIAL_SESSION') return;

        // Supabase holds an internal auth lock while this callback runs.
        // Defer database reads until the callback returns to avoid a deadlock.
        globalThis.setTimeout(() => {
          if (!disposed) void applySession(nextSession, false);
        }, 0);
      }
    );

    const initializeSession = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_REQUEST_TIMEOUT_MS,
          'Sesi akun belum merespons.',
        );
        if (error) throw error;
        if (!disposed) await applySession(data.session, true);
      } catch (error) {
        console.error('Session initialization failed:', getErrorMessage(error, 'Unknown session error'));
        if (!disposed) {
          hasInitializedRef.current = true;
          setIsLoading(false);
        }
      }
    };

    void initializeSession();

    return () => {
      disposed = true;
      accountRequestRef.current += 1;
      subscription.unsubscribe();
    };
  }, [applySession]);

  useEffect(() => {
    const refreshVisibleSession = async () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;

      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_REQUEST_TIMEOUT_MS,
          'Sesi akun belum merespons.',
        );
        if (error) throw error;
        await applySession(data.session, false);
      } catch (error) {
        console.error('Visible session refresh failed:', getErrorMessage(error, 'Unknown session error'));
      }
    };

    const handleVisibilityChange = () => void refreshVisibleSession();
    const handleFocus = () => void refreshVisibleSession();
    const handleOnline = () => void refreshVisibleSession();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [applySession]);

  useEffect(() => {
    if (!user) return;

    const refresh = () => void refreshIdentityStatus();
    const channel = supabase
      .channel(`account-context-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshIdentityStatus, user]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, metadata?: { full_name: string; bidang_biro: string }) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata ? {
          full_name: metadata.full_name,
          bidang_biro: metadata.bidang_biro
        } : undefined
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    accountRequestRef.current += 1;
    currentUserIdRef.current = null;
    setUser(null);
    setSession(null);
    clearAccountContext();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAdmin,
      isLoading,
      linkStatus,
      accountRole,
      accountName,
      accountAvatarUrl,
      refreshIdentityStatus,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
