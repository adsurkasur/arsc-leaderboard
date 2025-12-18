import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Trophy, Mail, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Silakan masukkan alamat email yang valid');
const passwordSchema = z.string().min(6, 'Kata sandi harus minimal 6 karakter');
const fullNameSchema = z.string().min(2, 'Nama lengkap harus minimal 2 karakter');
const bidangBiroSchema = z.string().min(1, 'Silakan pilih bidang/biro Anda');

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [bidangBiro, setBidangBiro] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string; bidangBiro?: string }>({});
  
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; fullName?: string; bidangBiro?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(password);
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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    const { error } = await signIn(email, password);
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
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    const { error } = await signUp(email, password, {
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
          <Link to="/">
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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Trophy className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Papan Peringkat Kompetisi</h1>
            <p className="text-muted-foreground">Masuk untuk melacak peringkat Anda dan mengajukan catatan partisipasi baru.</p>
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
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Kata Sandi</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="signin-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
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
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-fullname">Nama Lengkap</Label>
                      <Input
                        id="signup-fullname"
                        type="text"
                        placeholder="Masukkan nama lengkap Anda"
                        value={fullName}
                        onChange={(e) => { setFullName(e.target.value); setErrors({}); }}
                        disabled={isLoading}
                      />
                      {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-bidangbiro">Bidang/Biro</Label>
                      <Select value={bidangBiro} onValueChange={(value) => { setBidangBiro(value); setErrors({}); }} disabled={isLoading}>
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
                      {errors.bidangBiro && <p className="text-sm text-destructive">{errors.bidangBiro}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Kata Sandi</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                          className="pl-10"
                          disabled={isLoading}
                        />
                      </div>
                      {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
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
