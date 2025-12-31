'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { z } from 'zod';

const emailSchema = z.string().email('Silakan masukkan alamat email yang valid');
const passwordSchema = z.string().min(6, 'Kata sandi harus minimal 6 karakter');
const fullNameSchema = z.string().min(2, 'Nama lengkap harus minimal 2 karakter');
const bidangBiroSchema = z.string().min(1, 'Silakan pilih bidang/biro Anda');

export default function AuthPage() {
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});
  
  // Register form state
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [bidangBiro, setBidangBiro] = useState('');
  const [registerErrors, setRegisterErrors] = useState<{ email?: string; password?: string; fullName?: string; bidangBiro?: string }>({});
  
  const [isLoading, setIsLoading] = useState(false);
  
  const { user, signIn, signUp } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const validateLoginForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    const emailResult = emailSchema.safeParse(loginEmail);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(loginPassword);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }
    
    setLoginErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRegisterForm = () => {
    const newErrors: { email?: string; password?: string; fullName?: string; bidangBiro?: string } = {};
    
    const emailResult = emailSchema.safeParse(registerEmail);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(registerPassword);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }
    
    const fullNameResult = fullNameSchema.safeParse(fullName);
    if (!fullNameResult.success) {
      newErrors.fullName = fullNameResult.error.errors[0].message;
    }
    
    const bidangBiroResult = bidangBiroSchema.safeParse(bidangBiro);
    if (!bidangBiroResult.success) {
      newErrors.bidangBiro = bidangBiroResult.error.errors[0].message;
    }
    
    setRegisterErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLoginForm()) return;
    
    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Gagal masuk',
        description: error.message === 'Invalid login credentials' 
          ? 'Email atau kata sandi tidak valid. Silakan coba lagi.'
          : error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Selamat datang kembali!',
        description: 'Anda telah berhasil masuk.',
      });
      router.push('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegisterForm()) return;
    
    setIsLoading(true);
    const { error } = await signUp(registerEmail, registerPassword, {
      full_name: fullName,
      bidang_biro: bidangBiro
    });
    setIsLoading(false);

    if (error) {
      const errorMessage = error.message.includes('already registered')
        ? 'Email ini sudah terdaftar. Silakan masuk saja.'
        : error.message;
      
      toast({
        title: 'Gagal mendaftar',
        description: errorMessage,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Akun berhasil dibuat!',
        description: 'Selamat! Anda sekarang dapat masuk ke akun Anda.',
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="p-4">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link href="/">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Papan Peringkat
          </Link>
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 overflow-hidden">
              <Image src="/arsc-logo.png" alt="ARSC Logo" width={48} height={48} className="rounded-xl" />
            </div>
            <h1 className="text-2xl font-bold">Papan Peringkat</h1>
            <p className="text-muted-foreground">Masuk untuk melihat peringkat Anda dan mengajukan partisipasi baru.</p>
          </div>

          {/* Auth Card */}
          <Card className="border shadow-card">
            <Tabs defaultValue="signin" className="w-full">
              <CardHeader className="pb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Masuk</TabsTrigger>
                  <TabsTrigger value="signup">Daftar</TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="admin@contoh.com"
                          value={loginEmail}
                          onChange={(e) => { setLoginEmail(e.target.value); setLoginErrors({}); }}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {loginErrors.email && <p className="text-sm text-destructive">{loginErrors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Kata Sandi</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="signin-password"
                          type="password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => { setLoginPassword(e.target.value); setLoginErrors({}); }}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {loginErrors.password && <p className="text-sm text-destructive">{loginErrors.password}</p>}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Masuk
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="email@anda.com"
                          value={registerEmail}
                          onChange={(e) => { setRegisterEmail(e.target.value); setRegisterErrors({}); }}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {registerErrors.email && <p className="text-sm text-destructive">{registerErrors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-fullname">Nama Lengkap</Label>
                      <Input
                        id="signup-fullname"
                        type="text"
                        placeholder="Masukkan nama lengkap Anda"
                        value={fullName}
                        onChange={(e) => { setFullName(e.target.value); setRegisterErrors({}); }}
                        disabled={isLoading}
                      />
                      {registerErrors.fullName && <p className="text-sm text-destructive">{registerErrors.fullName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-bidangbiro">Bidang/Biro</Label>
                      <Select value={bidangBiro} onValueChange={(value) => { setBidangBiro(value); setRegisterErrors({}); }} disabled={isLoading}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih bidang/biro Anda" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ketua Umum (KETUM)">Ketua Umum (KETUM)</SelectItem>
                          <SelectItem value="Biro Pengembangan Sumber Daya Mahasiswa (PSDM)">Biro Pengembangan Sumber Daya Mahasiswa (PSDM)</SelectItem>
                          <SelectItem value="Biro Administrasi dan Keuangan (ADKEU)">Biro Administrasi dan Keuangan (ADKEU)</SelectItem>
                          <SelectItem value="Bidang Kepenulisan dan Kompetisi (PENKOM)">Bidang Kepenulisan dan Kompetisi (PENKOM)</SelectItem>
                          <SelectItem value="Bidang Riset dan Teknologi (RISTEK)">Bidang Riset dan Teknologi (RISTEK)</SelectItem>
                          <SelectItem value="Bidang Informasi dan Komunikasi (INFOKOM)">Bidang Informasi dan Komunikasi (INFOKOM)</SelectItem>
                        </SelectContent>
                      </Select>
                      {registerErrors.bidangBiro && <p className="text-sm text-destructive">{registerErrors.bidangBiro}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Kata Sandi</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••••"
                          value={registerPassword}
                          onChange={(e) => { setRegisterPassword(e.target.value); setRegisterErrors({}); }}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {registerErrors.password && <p className="text-sm text-destructive">{registerErrors.password}</p>}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Buat Akun
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </main>
    </div>
  );
}
