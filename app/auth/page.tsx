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
import { Mail, Lock, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { z } from 'zod';
import { m } from 'framer-motion';
import { pageTransition, staggerContainer, staggerItem, fadeInUp, popIn } from '@/lib/motion';

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
    <m.div 
      className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-accent/20"
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Decorative background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 left-[10%] w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-[10%] w-64 h-64 bg-violet/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <m.header 
        className="p-4"
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
      >
        <m.div whileHover={{ x: -3 }} whileTap={{ scale: 0.98 }}>
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link href="/">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Kembali ke Papan Peringkat</span>
              <span className="sm:hidden">Kembali</span>
            </Link>
          </Button>
        </m.div>
      </m.header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <m.div 
          className="w-full max-w-md space-y-6"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* Logo */}
          <m.div 
            className="text-center space-y-3"
            variants={staggerItem}
          >
            <m.div 
              className="inline-flex items-center justify-center w-18 h-18 rounded-2xl bg-primary/10 mb-4 overflow-hidden ring-4 ring-primary/5"
              variants={popIn}
              whileHover={{ scale: 1.05, rotate: 3 }}
            >
              <Image src="/arsc-logo.png" alt="ARSC Logo" width={52} height={52} className="rounded-xl" />
            </m.div>
            <h1 className="text-2xl md:text-3xl font-bold">Selamat Datang</h1>
            <p className="text-muted-foreground text-sm md:text-base">Masuk untuk melihat peringkat Anda dan mengajukan partisipasi baru.</p>
          </m.div>

          {/* Auth Card */}
          <m.div variants={staggerItem}>
            <Card className="border shadow-card backdrop-blur-sm bg-card/95">
              <Tabs defaultValue="signin" className="w-full">
                <CardHeader className="pb-4">
                  <TabsList className="grid w-full grid-cols-2 h-11">
                    <TabsTrigger value="signin" className="text-sm font-medium">Masuk</TabsTrigger>
                    <TabsTrigger value="signup" className="text-sm font-medium">Daftar</TabsTrigger>
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
                            className="pl-10 h-11"
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
                            className="pl-10 h-11"
                            disabled={isLoading}
                          />
                        </div>
                        {loginErrors.password && <p className="text-sm text-destructive">{loginErrors.password}</p>}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <m.div className="w-full" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button type="submit" className="w-full h-11" disabled={isLoading}>
                          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Masuk
                        </Button>
                      </m.div>
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
                          className="pl-10 h-11"
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
                        className="h-11"
                        disabled={isLoading}
                      />
                      {registerErrors.fullName && <p className="text-sm text-destructive">{registerErrors.fullName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-bidangbiro">Bidang/Biro</Label>
                      <Select value={bidangBiro} onValueChange={(value) => { setBidangBiro(value); setRegisterErrors({}); }} disabled={isLoading}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Pilih bidang/biro Anda" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ketua Umum (KETUM)">Ketua Umum (KETUM)</SelectItem>
                          <SelectItem value="Biro Pengembangan Sumber Daya Mahasiswa (PSDM)">Biro PSDM</SelectItem>
                          <SelectItem value="Biro Administrasi dan Keuangan (ADKEU)">Biro ADKEU</SelectItem>
                          <SelectItem value="Bidang Kepenulisan dan Kompetisi (PENKOM)">Bidang PENKOM</SelectItem>
                          <SelectItem value="Bidang Riset dan Teknologi (RISTEK)">Bidang RISTEK</SelectItem>
                          <SelectItem value="Bidang Informasi dan Komunikasi (INFOKOM)">Bidang INFOKOM</SelectItem>
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
                          className="pl-10 h-11"
                          disabled={isLoading}
                        />
                      </div>
                      {registerErrors.password && <p className="text-sm text-destructive">{registerErrors.password}</p>}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <m.div className="w-full" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <Button type="submit" className="w-full h-11" disabled={isLoading}>
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        <Sparkles className="w-4 h-4 mr-2" />
                        Buat Akun
                      </Button>
                    </m.div>
                  </CardFooter>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
          </m.div>
        </m.div>
      </main>
    </m.div>
  );
}
