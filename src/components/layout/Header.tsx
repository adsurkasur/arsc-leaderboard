'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { Shield, LogOut, User, Settings, HelpCircle, Info, Menu, X } from 'lucide-react';
import Image from 'next/image';
import { AboutModal, HelpModal, ProfileSettingsModal, RequestsModal } from '@/components/modals';
import { m, AnimatePresence } from 'framer-motion';
import { fadeInDown, quickSpring } from '@/lib/motion';

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <>
      <m.header 
        className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={quickSpring}
      >
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <m.div 
              className="p-1.5 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors"
              whileHover={{ scale: 1.05, rotate: 3 }}
              whileTap={{ scale: 0.95 }}
              transition={quickSpring}
            >
              <Image src="/arsc-logo.png" alt="ARSC Logo" width={28} height={28} className="rounded-lg" />
            </m.div>
            <span className="font-bold text-xl tracking-tight hidden sm:inline">ARSC Leaderboard</span>
            <span className="font-bold text-xl tracking-tight sm:hidden">ARSC</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {isAdmin ? (
                  <m.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="outline" size="sm" asChild className="gap-2">
                      <Link href="/admin">
                        <Shield className="w-4 h-4" />
                        Panel Admin
                      </Link>
                    </Button>
                  </m.div>
                ) : (
                  <RequestsModal user={user} />
                )}
              
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <m.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        <Avatar className="w-8 h-8 ring-2 ring-primary/20">
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                            {user.email?.[0].toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </m.div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => setIsProfileOpen(true)} className="cursor-pointer gap-2">
                      <Settings className="w-4 h-4" />
                      Pengaturan Profil
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsHelpOpen(true)} className="cursor-pointer gap-2">
                      <HelpCircle className="w-4 h-4" />
                      Bantuan
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsAboutOpen(true)} className="cursor-pointer gap-2">
                      <Info className="w-4 h-4" />
                      Tentang
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled className="text-muted-foreground gap-2">
                      <User className="w-4 h-4" />
                      <span className="truncate">{user.email}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive gap-2">
                      <LogOut className="w-4 h-4" />
                      Keluar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <m.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button asChild size="sm" className="px-6">
                  <Link href="/auth">Masuk</Link>
                </Button>
              </m.div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            {user && !isAdmin && <RequestsModal user={user} />}
            <m.button
              className="p-2 rounded-lg hover:bg-accent transition-colors touch-target"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                {isMobileMenuOpen ? (
                  <m.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X className="w-6 h-6" />
                  </m.div>
                ) : (
                  <m.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Menu className="w-6 h-6" />
                  </m.div>
                )}
              </AnimatePresence>
            </m.button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <m.div
              className="md:hidden border-t bg-background/98 backdrop-blur-md"
              variants={fadeInDown}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="container py-4 space-y-3">
                {user ? (
                  <>
                    {/* User info */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                      <Avatar className="w-10 h-10 ring-2 ring-primary/20">
                        <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                          {user.email?.[0].toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.email}</p>
                        <p className="text-xs text-muted-foreground">{isAdmin ? 'Administrator' : 'Member'}</p>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="space-y-1">
                      {isAdmin && (
                        <Link 
                          href="/admin" 
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors touch-target"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Shield className="w-5 h-5 text-primary" />
                          <span className="font-medium">Panel Admin</span>
                        </Link>
                      )}
                      <button 
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors w-full touch-target"
                        onClick={() => { setIsProfileOpen(true); setIsMobileMenuOpen(false); }}
                      >
                        <Settings className="w-5 h-5 text-muted-foreground" />
                        <span>Pengaturan Profil</span>
                      </button>
                      <button 
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors w-full touch-target"
                        onClick={() => { setIsHelpOpen(true); setIsMobileMenuOpen(false); }}
                      >
                        <HelpCircle className="w-5 h-5 text-muted-foreground" />
                        <span>Bantuan</span>
                      </button>
                      <button 
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors w-full touch-target"
                        onClick={() => { setIsAboutOpen(true); setIsMobileMenuOpen(false); }}
                      >
                        <Info className="w-5 h-5 text-muted-foreground" />
                        <span>Tentang</span>
                      </button>
                    </div>

                    {/* Sign out */}
                    <div className="pt-2 border-t">
                      <button 
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-destructive/10 transition-colors w-full text-destructive touch-target"
                        onClick={() => { handleSignOut(); setIsMobileMenuOpen(false); }}
                      >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Keluar</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <Link 
                    href="/auth" 
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-primary text-primary-foreground font-medium touch-target"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Masuk
                  </Link>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </m.header>

      {/* Modals */}
      {user && (
        <>
          <ProfileSettingsModal open={isProfileOpen} onOpenChange={setIsProfileOpen} user={user} />
          <HelpModal open={isHelpOpen} onOpenChange={setIsHelpOpen} />
          <AboutModal open={isAboutOpen} onOpenChange={setIsAboutOpen} />
        </>
      )}
    </>
  );
}
