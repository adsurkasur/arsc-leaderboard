'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, m } from 'framer-motion';
import {
  BadgeCheck,
  HelpCircle,
  Info,
  Link2,
  LogOut,
  Menu,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AboutModal, HelpModal, ProfileSettingsModal, RequestsModal } from '@/components/modals';

export function Header() {
  const { user, isAdmin, isLoading, linkStatus, refreshIdentityStatus, signOut } = useAuth();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isIdentityLinked = linkStatus === 'linked_exact' || linkStatus === 'manually_linked';

  const handleSignOut = async () => {
    await signOut();
    setIsMobileMenuOpen(false);
    router.push('/');
  };

  return (
    <>
      <m.header
        className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/90 backdrop-blur-xl"
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="container flex h-[4.5rem] items-center justify-between gap-4">
          <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label="ARSC Leaderboard — Beranda">
            <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-card shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5">
              <Image src="/arsc-logo.png" alt="" width={32} height={32} className="size-8 object-contain" priority />
            </span>
            <span className="min-w-0 leading-none">
              <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary">ARSC</span>
              <span className="mt-1 block truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
                Leaderboard
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
            <Button variant="ghost" size="sm" asChild className="rounded-full px-4 text-muted-foreground">
              <Link href="/#leaderboard">Peringkat</Link>
            </Button>

            {!isLoading && user && !isAdmin && <RequestsModal user={user} />}

            {!isLoading && user && !isIdentityLinked && (
              <Button
                variant="outline"
                size="sm"
                className="ml-1 gap-2 rounded-full border-primary/25 bg-primary/5 text-primary"
                onClick={() => setIsProfileOpen(true)}
              >
                <Link2 className="size-4" />
                Hubungkan Rapor
              </Button>
            )}

            {!isLoading && user && isAdmin && (
              <Button variant="outline" size="sm" asChild className="ml-1 gap-2 rounded-full">
                <Link href="/admin">
                  <Shield className="size-4" />
                  Admin
                </Link>
              </Button>
            )}

            {isLoading ? (
              <div className="ml-2 size-9 animate-pulse rounded-full bg-muted" aria-hidden="true" />
            ) : user ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-1 size-10 rounded-full" aria-label="Buka menu akun">
                    <Avatar className="size-9 border border-border">
                      <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
                        {user.email?.[0]?.toUpperCase() || 'A'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5">
                  <div className="px-2.5 py-2">
                    <p className="truncate text-sm font-medium">{user.email}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {isIdentityLinked ? <BadgeCheck className="size-3.5 text-success" /> : <Link2 className="size-3.5" />}
                      {isIdentityLinked ? 'Terhubung dengan Rapor' : 'Rapor belum terhubung'}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsProfileOpen(true)} className="cursor-pointer gap-2 rounded-lg">
                    <Settings className="size-4" />
                    Profil anggota
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsHelpOpen(true)} className="cursor-pointer gap-2 rounded-lg">
                    <HelpCircle className="size-4" />
                    Panduan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsAboutOpen(true)} className="cursor-pointer gap-2 rounded-lg">
                    <Info className="size-4" />
                    Tentang
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="gap-2 rounded-lg text-destructive focus:text-destructive">
                    <LogOut className="size-4" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm" className="ml-2 rounded-full px-5 shadow-sm">
                <Link href="/auth">Masuk</Link>
              </Button>
            )}
          </nav>

          <div className="flex items-center gap-1 md:hidden">
            {!isLoading && !user && (
              <Button asChild size="sm" className="rounded-full px-4">
                <Link href="/auth">Masuk</Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-11 rounded-full"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              aria-label={isMobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isMobileMenuOpen && (
            <m.div
              className="border-t bg-background md:hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="container space-y-2 py-4">
                <Link
                  href="/#leaderboard"
                  className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium hover:bg-muted"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Peringkat anggota
                </Link>

                {user && (
                  <>
                    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-foreground text-sm font-semibold text-background">
                          {user.email?.[0]?.toUpperCase() || 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{user.email}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{isAdmin ? 'Administrator' : 'Anggota ARSC'}</p>
                      </div>
                    </div>

                    {!isIdentityLinked && (
                      <button
                        className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-primary/[0.08] px-3 text-left text-sm font-medium text-primary"
                        onClick={() => { setIsProfileOpen(true); setIsMobileMenuOpen(false); }}
                      >
                        <Link2 className="size-4" />
                        Hubungkan Rapor
                      </button>
                    )}

                    {!isAdmin && <div className="px-1 py-1"><RequestsModal user={user} /></div>}

                    {isAdmin && (
                      <Link
                        href="/admin"
                        className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-muted"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Shield className="size-4" />
                        Panel admin
                      </Link>
                    )}

                    <button
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-muted"
                      onClick={() => { setIsProfileOpen(true); setIsMobileMenuOpen(false); }}
                    >
                      <Settings className="size-4" />
                      Profil anggota
                    </button>
                    <button
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-muted"
                      onClick={() => { setIsHelpOpen(true); setIsMobileMenuOpen(false); }}
                    >
                      <HelpCircle className="size-4" />
                      Panduan
                    </button>
                    <button
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-muted"
                      onClick={() => { setIsAboutOpen(true); setIsMobileMenuOpen(false); }}
                    >
                      <Info className="size-4" />
                      Tentang
                    </button>
                    <button
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-destructive hover:bg-destructive/5"
                      onClick={handleSignOut}
                    >
                      <LogOut className="size-4" />
                      Keluar
                    </button>
                  </>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </m.header>

      {user && (
        <>
          <ProfileSettingsModal
            open={isProfileOpen}
            onOpenChange={setIsProfileOpen}
            user={user}
            onProfileChanged={refreshIdentityStatus}
          />
          <HelpModal open={isHelpOpen} onOpenChange={setIsHelpOpen} />
          <AboutModal open={isAboutOpen} onOpenChange={setIsAboutOpen} />
        </>
      )}
    </>
  );
}
