/* eslint-disable react-refresh/only-export-components */
'use client';

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  linkStatus: string | null;
  accountRole: string | null;
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
  const [isLoading, setIsLoading] = useState(true);

  const fetchIdentityContext = useCallback(async (userId: string) => {
    const [profileResult, accountResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('link_status')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    setLinkStatus(profileResult.error ? null : profileResult.data?.link_status ?? null);
    setAccountRole(accountResult.error ? null : accountResult.data?.role ?? null);
  }, []);

  const checkAdminRole = useCallback(async (userId: string) => {
    try {
      const { data: adminData, error: adminError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!adminError && Boolean(adminData));
    } catch (error) {
      console.error('Error in checkAdminRole:', error);
      setIsAdmin(false);
    }
  }, []);

  const refreshIdentityStatus = useCallback(async () => {
    if (!user) {
      setLinkStatus(null);
      setAccountRole(null);
      return;
    }
    await fetchIdentityContext(user.id);
  }, [fetchIdentityContext, user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await Promise.all([
            checkAdminRole(session.user.id),
            fetchIdentityContext(session.user.id),
          ]);
        } else {
          setIsAdmin(false);
          setLinkStatus(null);
          setAccountRole(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await Promise.all([
          checkAdminRole(session.user.id),
          fetchIdentityContext(session.user.id),
        ]);
      } else {
        setIsAdmin(false);
        setLinkStatus(null);
        setAccountRole(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkAdminRole, fetchIdentityContext]);

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
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    setLinkStatus(null);
    setAccountRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isLoading, linkStatus, accountRole, refreshIdentityStatus, signIn, signUp, signOut }}>
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
