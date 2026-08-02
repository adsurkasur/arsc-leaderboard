'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { ArrowLeft, BadgeCheck, FileCheck2, Link2, Loader2, Lock, Mail } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const emailSchema = z.string().email('Masukkan alamat email yang valid');
const passwordSchema = z.string().min(6, 'Kata sandi minimal 6 karakter');

const identityNotes = [
  { icon: Link2, text: 'Hubungkan kode akses Rapor satu kali.' },
  { icon: BadgeCheck, text: 'Nama dan bidang/biro mengikuti data resmi.' },
  { icon: FileCheck2, text: 'Partisipasi dihitung setelah ditinjau admin.' },
];

export default function AuthPage() {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerErrors, setRegisterErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const { user, signIn, signUp } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (user) router.push('/');
  }, [user, router]);

  const validate = (email: string, password: string) => {
    const errors: { email?: string; password?: string } = {};
    const emailResult = emailSchema.safeParse(email);
    const passwordResult = passwordSchema.safeParse(password);
    if (!emailResult.success) errors.email = emailResult.error.errors[0].message;
    if (!passwordResult.success) errors.password = passwordResult.error.errors[0].message;
    return errors;
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validate(loginEmail, loginPassword);
    setLoginErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Belum dapat masuk',
        description: error.message === 'Invalid login credentials'
          ? 'Email atau kata sandi tidak cocok.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Berhasil masuk', description: 'Anda kembali ke ARSC Leaderboard.' });
    router.push('/');
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validate(registerEmail, registerPassword);
    setRegisterErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    const { error } = await signUp(registerEmail, registerPassword);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Akun belum dibuat',
        description: error.message.includes('already registered')
          ? 'Email ini sudah terdaftar. Gunakan tab Masuk.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Akun berhasil dibuat',
      description: 'Periksa email bila verifikasi diperlukan, lalu masuk dan hubungkan Rapor.',
    });
  };

  return (
    <m.main
      className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(24rem,0.9fr)_minmax(32rem,1.1fr)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <section className="relative overflow-hidden bg-[hsl(222_47%_8%)] px-6 py-8 text-white sm:px-10 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_20%,hsl(217_91%_60%/0.24),transparent_32%),radial-gradient(circle_at_80%_85%,hsl(160_84%_45%/0.14),transparent_30%)]" />
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white">
            <ArrowLeft className="size-4" />
            Kembali ke Leaderboard
          </Link>
        </div>

        <div className="relative mx-auto mt-12 max-w-xl lg:mx-0 lg:mt-16">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white">
              <Image src="/arsc-logo.png" alt="Logo ARSC" width={42} height={42} className="size-10 object-contain" priority />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">ARSC</p>
              <p className="mt-1 font-semibold">Leaderboard</p>
            </div>
          </div>

          <h1 className="mt-8 max-w-lg text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl lg:text-5xl">
            Satu akun untuk mencatat partisipasi kompetisi Anda.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">
            Akun menyimpan pengajuan dan status peninjauan. Identitas anggota tetap berasal dari Rapor ARSC.
          </p>

          <ul className="mt-8 space-y-4">
            {identityNotes.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex size-8 items-center justify-center rounded-xl bg-white/[0.08] text-blue-300">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-12 hidden text-xs text-slate-500 lg:block">
          Agritech Research and Study Club · 2025/2026
        </p>
      </section>

      <section className="flex min-h-[42rem] items-center px-4 py-10 sm:px-8 lg:min-h-screen lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6">
            <p className="text-sm font-semibold text-primary">Akses anggota</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Masuk atau buat akun</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Setelah masuk, hubungkan kode akses Rapor dari menu profil.
            </p>
          </div>

          <Card className="rounded-3xl border-border/80 shadow-[0_22px_70px_-44px_hsl(var(--foreground)/0.45)]">
            <Tabs defaultValue="signin" className="w-full">
              <CardHeader className="pb-3">
                <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl p-1">
                  <TabsTrigger value="signin" className="rounded-lg text-sm font-medium">Masuk</TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-lg text-sm font-medium">Buat akun</TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn}>
                  <CardContent className="space-y-4">
                    <AuthField
                      id="signin-email"
                      label="Email"
                      type="email"
                      placeholder="nama@email.com"
                      value={loginEmail}
                      onChange={(value) => { setLoginEmail(value); setLoginErrors({}); }}
                      error={loginErrors.email}
                      icon={Mail}
                      disabled={isLoading}
                    />
                    <AuthField
                      id="signin-password"
                      label="Kata sandi"
                      type="password"
                      placeholder="Masukkan kata sandi"
                      value={loginPassword}
                      onChange={(value) => { setLoginPassword(value); setLoginErrors({}); }}
                      error={loginErrors.password}
                      icon={Lock}
                      disabled={isLoading}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="h-11 w-full rounded-xl" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Masuk
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp}>
                  <CardContent className="space-y-4">
                    <AuthField
                      id="signup-email"
                      label="Email"
                      type="email"
                      placeholder="nama@email.com"
                      value={registerEmail}
                      onChange={(value) => { setRegisterEmail(value); setRegisterErrors({}); }}
                      error={registerErrors.email}
                      icon={Mail}
                      disabled={isLoading}
                    />
                    <AuthField
                      id="signup-password"
                      label="Kata sandi"
                      type="password"
                      placeholder="Minimal 6 karakter"
                      value={registerPassword}
                      onChange={(value) => { setRegisterPassword(value); setRegisterErrors({}); }}
                      error={registerErrors.password}
                      icon={Lock}
                      disabled={isLoading}
                    />
                    <div className="rounded-xl bg-muted/55 p-3 text-xs leading-5 text-muted-foreground">
                      Nama dan bidang/biro tidak diisi di sini. Data tersebut akan disinkronkan dari Rapor setelah akun dibuat.
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="h-11 w-full rounded-xl" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Buat akun
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </section>
    </m.main>
  );
}
interface AuthFieldProps {
  id: string;
  label: string;
  type: 'email' | 'password';
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  icon: typeof Mail;
  disabled: boolean;
}

function AuthField({ id, label, type, placeholder, value, onChange, error, icon: Icon, disabled }: AuthFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-xl pl-10"
          disabled={disabled}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
