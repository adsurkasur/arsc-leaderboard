'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { Shield, LogOut, User, Settings, HelpCircle, Info } from 'lucide-react';
import Image from 'next/image';
import { AboutModal, HelpModal, ProfileSettingsModal, RequestsModal } from '@/components/modals';

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-1 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Image src="/arsc-logo.png" alt="ARSC Logo" width={28} height={28} className="rounded-md" />
            </div>
            <span className="font-bold text-xl tracking-tight">ARSC Leaderboard</span>
          </Link>

          <nav className="flex items-center gap-4">
            {user ? (
              <>
                {isAdmin ? (
                  <Button variant="outline" size="sm" asChild className="gap-2">
                    <Link href="/admin">
                      <Shield className="w-4 h-4" />
                      Panel Admin
                    </Link>
                  </Button>
                ) : (
                  <RequestsModal user={user} />
                )}
              
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {user.email?.[0].toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setIsProfileOpen(true)} className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Pengaturan Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsHelpOpen(true)} className="cursor-pointer">
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Bantuan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsAboutOpen(true)} className="cursor-pointer">
                    <Info className="w-4 h-4 mr-2" />
                    Tentang
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    <User className="w-4 h-4 mr-2" />
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/auth">Masuk</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>

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
